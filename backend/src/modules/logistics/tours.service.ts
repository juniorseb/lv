import { randomInt } from 'crypto';

import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';

import { geoPointLatitude, geoPointLongitude, toGeoPoint } from '../../common/geo/geo.types';
import { NotificationsService } from '../notifications/notifications.service';
import { DriverProfile } from '../profiles/entities/driver-profile.entity';
import { DriverProfilesService } from '../profiles/driver-profiles.service';
import { WalletService } from '../wallet/wallet.service';
import { computeDifficulty } from './difficulty';
import { CreateTourDto } from './dto/create-tour.dto';
import { DeliveryItem } from './entities/delivery-item.entity';
import { DeliveryPackage } from './entities/package.entity';
import { DeliveryRequest } from './entities/delivery-request.entity';
import { DeliveryRoute } from './entities/route.entity';
import { DeliveryOffer } from './entities/reserved.entities';
import { Stop } from './entities/stop.entity';
import { TrackingEvent } from './entities/tracking-event.entity';
import { OfferView, toOfferView } from './tours.view';
import {
  ActiveTourView,
  TourClientView,
  TourFeedCard,
  toActiveTourView,
  toTourClientView,
} from './tours.view';

// Tournées — distribution de plusieurs colis en une demande (spec-tournees §1.2).
// Vit nativement sur le modèle DeliveryRequest(batch) → Route → Stops → Packages.
// Un seul livreur par tournée, présentée comme une mission unique. Commission
// débitée une fois à la clôture, sur le total réellement livré.
@Injectable()
export class ToursService {
  constructor(
    @InjectRepository(DeliveryRequest)
    private readonly requests: Repository<DeliveryRequest>,
    @InjectRepository(DeliveryRoute)
    private readonly routes: Repository<DeliveryRoute>,
    @InjectRepository(Stop)
    private readonly stops: Repository<Stop>,
    @InjectRepository(DeliveryPackage)
    private readonly packages: Repository<DeliveryPackage>,
    @InjectRepository(DeliveryItem)
    private readonly items: Repository<DeliveryItem>,
    @InjectRepository(TrackingEvent)
    private readonly events: Repository<TrackingEvent>,
    @InjectRepository(DeliveryOffer)
    private readonly offers: Repository<DeliveryOffer>,
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly driverProfiles: DriverProfilesService,
    private readonly wallet: WalletService,
    private readonly notifications: NotificationsService,
  ) {}

  // --- Création (client) ---------------------------------------------------

  async createTour(clientId: string, dto: CreateTourDto): Promise<TourClientView> {
    const total = dto.stops.reduce((sum, s) => sum + s.priceFcfa, 0);
    const request = await this.requests.save(
      this.requests.create({
        clientId,
        type: 'batch',
        departAddress: dto.departAddress,
        departLocation: toGeoPoint(dto.departLatitude, dto.departLongitude),
        statusGlobal: 'en_cours',
        totalPriceFcfa: total,
        urgency: 'normal',
      }),
    );
    const route = await this.routes.save(
      this.routes.create({
        deliveryRequestId: request.id,
        driverId: null,
        status: 'en_attente',
        gainTotalFcfa: total,
      }),
    );

    const stops: Stop[] = [];
    for (let i = 0; i < dto.stops.length; i++) {
      const s = dto.stops[i];
      const stop = await this.stops.save(
        this.stops.create({
          routeId: route.id,
          recipientName: s.recipientName ?? null,
          recipientPhone: s.recipientPhone ?? null,
          address: s.address,
          location: toGeoPoint(s.latitude, s.longitude),
          landmark: s.landmark ?? null,
          priceFcfa: s.priceFcfa,
          orderIndex: i,
          status: 'en_attente',
          proofOtp: this.generateOtp(),
        }),
      );
      const pkg = await this.packages.save(
        this.packages.create({
          stopId: stop.id,
          descriptionProduit: s.packageDescription ?? null,
          status: 'cree',
        }),
      );
      // Détail des articles à remettre (spec-delivery-items).
      if (s.items && s.items.length > 0) {
        await this.items.save(
          s.items.map((it) =>
            this.items.create({
              stopId: stop.id,
              name: it.name.trim(),
              quantity: it.quantity,
              notes: it.notes?.trim() || null,
              status: 'pending',
            }),
          ),
        );
      }
      await this.track(pkg.id, 'cree', `Arrêt ${i + 1} créé`);
      stops.push(stop);
    }

    return this.buildClientView(request, route, stops);
  }

  // --- Feed livreur : tournées ouvertes proches ----------------------------

  async getFeedForDriver(userId: string): Promise<TourFeedCard[]> {
    const driver = await this.driverProfiles.findByUserId(userId);
    if (!driver || !driver.currentLocation) {
      return [];
    }
    const lng = geoPointLongitude(driver.currentLocation);
    const lat = geoPointLatitude(driver.currentLocation);

    const rows = await this.dataSource.query(
      `
      SELECT
        r.id AS route_id,
        dr.id AS request_id,
        dr.depart_address,
        dr.total_price_fcfa,
        (SELECT COUNT(*)::int FROM stops s WHERE s.route_id = r.id) AS stop_count,
        CASE WHEN dr.depart_location IS NULL THEN NULL ELSE ST_Distance(
          dr.depart_location,
          ST_SetSRID(ST_MakePoint($1::float8, $2::float8), 4326)::geography
        ) END AS approach_m
      FROM routes r
      JOIN delivery_requests dr ON dr.id = r.delivery_request_id
      WHERE r.status = 'en_attente'
        AND r.driver_id IS NULL
        AND dr.type = 'batch'
        AND dr.client_id <> $3
      ORDER BY approach_m ASC NULLS LAST
      LIMIT 30
      `,
      [lng, lat, driver.userId],
    );

    return rows.map(
      (row: {
        route_id: string;
        request_id: string;
        depart_address: string | null;
        total_price_fcfa: number;
        stop_count: number;
        approach_m: string | null;
      }): TourFeedCard => ({
        routeId: row.route_id,
        requestId: row.request_id,
        departAddress: row.depart_address,
        stopCount: Number(row.stop_count),
        totalPriceFcfa: Number(row.total_price_fcfa),
        approachMeters: row.approach_m === null ? null : Number(row.approach_m),
        difficultyScore: computeDifficulty({
          stopCount: Number(row.stop_count),
        }),
      }),
    );
  }

  // --- Acceptation (livreur) ----------------------------------------------

  async acceptTour(routeId: string, userId: string): Promise<ActiveTourView> {
    const driver = await this.requireActiveSolventDriver(userId);
    const route = await this.routes.findOne({ where: { id: routeId } });
    if (!route) {
      throw new NotFoundException('Tournée introuvable.');
    }
    if (route.driverId || route.status !== 'en_attente') {
      throw new ConflictException("Cette tournée n'est plus disponible.");
    }
    const request = await this.requests.findOneOrFail({
      where: { id: route.deliveryRequestId },
    });
    // Accept direct : au prix affiché.
    return this.assignDriverToRoute(
      route,
      request,
      driver,
      route.gainTotalFcfa ?? request.totalPriceFcfa,
    );
  }

  // Assigne un livreur à une tournée (accept direct OU offre acceptée) : ordre
  // optimisé, colis assignés, gain verrouillé, client notifié.
  private async assignDriverToRoute(
    route: DeliveryRoute,
    request: DeliveryRequest,
    driver: DriverProfile,
    gainFcfa: number,
  ): Promise<ActiveTourView> {
    route.driverId = driver.id;
    route.status = 'en_cours';
    route.gainTotalFcfa = gainFcfa;
    await this.routes.save(route);

    const stops = await this.stops.find({ where: { routeId: route.id } });
    const startLat = driver.currentLocation
      ? geoPointLatitude(driver.currentLocation)
      : request.departLocation
        ? geoPointLatitude(request.departLocation)
        : null;
    const startLng = driver.currentLocation
      ? geoPointLongitude(driver.currentLocation)
      : request.departLocation
        ? geoPointLongitude(request.departLocation)
        : null;
    const ordered = this.nearestNeighborOrder(stops, startLat, startLng);
    for (let i = 0; i < ordered.length; i++) {
      ordered[i].orderIndex = i;
      await this.stops.save(ordered[i]);
    }
    await this.packages.update(
      { stopId: In(stops.map((s) => s.id)) },
      { status: 'assigne' },
    );
    await this.notifications.sendToUser(request.clientId, {
      title: 'Tournée acceptée 🛵',
      body: `Un livreur prend en charge vos ${stops.length} colis.`,
      data: { type: 'tour_status', requestId: request.id, status: 'en_cours' },
    });
    return this.buildActiveView(request, route, ordered);
  }

  // --- Négociation de prix (DeliveryOffer, spec §2 bis) --------------------

  // Le livreur propose un prix différent pour une tournée ouverte.
  async proposeOffer(
    routeId: string,
    userId: string,
    prixProposeFcfa: number,
  ): Promise<OfferView> {
    const driver = await this.requireActiveSolventDriver(userId);
    const route = await this.routes.findOne({ where: { id: routeId } });
    if (!route) {
      throw new NotFoundException('Tournée introuvable.');
    }
    if (route.driverId || route.status !== 'en_attente') {
      throw new ConflictException("Cette tournée n'est plus disponible.");
    }
    const existing = await this.offers.findOne({
      where: {
        deliveryRequestId: route.deliveryRequestId,
        driverId: driver.id,
        statut: 'en_attente',
      },
    });
    if (existing) {
      existing.prixProposeFcfa = prixProposeFcfa;
      const saved = await this.offers.save(existing);
      return toOfferView(saved, null);
    }
    const offer = await this.offers.save(
      this.offers.create({
        deliveryRequestId: route.deliveryRequestId,
        driverId: driver.id,
        prixProposeFcfa,
        statut: 'en_attente',
      }),
    );
    const request = await this.requests.findOne({
      where: { id: route.deliveryRequestId },
    });
    if (request) {
      await this.notifications.sendToUser(request.clientId, {
        title: 'Nouvelle offre 💬',
        body: `Un livreur propose ${prixProposeFcfa} FCFA pour votre tournée.`,
        data: { type: 'tour_offer', requestId: request.id },
      });
    }
    return toOfferView(offer, null);
  }

  // Le client liste les offres reçues pour sa tournée.
  async listOffers(requestId: string, userId: string): Promise<OfferView[]> {
    const request = await this.requests.findOne({ where: { id: requestId } });
    if (!request) {
      throw new NotFoundException('Tournée introuvable.');
    }
    if (request.clientId !== userId) {
      throw new ForbiddenException("Cette tournée n'est pas la vôtre.");
    }
    const offers = await this.offers.find({
      where: { deliveryRequestId: requestId, statut: 'en_attente' },
      order: { prixProposeFcfa: 'ASC' },
    });
    const views: OfferView[] = [];
    for (const offer of offers) {
      const driver = await this.driverProfiles.findById(offer.driverId);
      views.push(toOfferView(offer, driver));
    }
    return views;
  }

  // Le client accepte une offre : la tournée est assignée au livreur au prix
  // négocié, les autres offres sont refusées.
  async acceptOffer(offerId: string, userId: string): Promise<ActiveTourView> {
    const offer = await this.offers.findOne({ where: { id: offerId } });
    if (!offer) {
      throw new NotFoundException('Offre introuvable.');
    }
    const request = await this.requests.findOne({
      where: { id: offer.deliveryRequestId },
    });
    if (!request) {
      throw new NotFoundException('Tournée introuvable.');
    }
    if (request.clientId !== userId) {
      throw new ForbiddenException("Cette tournée n'est pas la vôtre.");
    }
    const route = await this.routes.findOne({
      where: { deliveryRequestId: request.id },
    });
    if (!route || route.driverId || route.status !== 'en_attente') {
      throw new ConflictException('Cette tournée est déjà attribuée.');
    }
    const driver = await this.driverProfiles.findById(offer.driverId);
    if (!driver || driver.status !== 'actif') {
      throw new ConflictException("Ce livreur n'est plus disponible.");
    }

    offer.statut = 'accepte';
    await this.offers.save(offer);
    // Les autres offres de la même tournée sont refusées.
    await this.offers
      .createQueryBuilder()
      .update(DeliveryOffer)
      .set({ statut: 'refuse' })
      .where(
        'delivery_request_id = :rid AND id != :id AND statut = :statut',
        { rid: request.id, id: offer.id, statut: 'en_attente' },
      )
      .execute();

    return this.assignDriverToRoute(route, request, driver, offer.prixProposeFcfa);
  }

  async refuseOffer(offerId: string, userId: string): Promise<void> {
    const offer = await this.offers.findOne({ where: { id: offerId } });
    if (!offer) {
      throw new NotFoundException('Offre introuvable.');
    }
    const request = await this.requests.findOne({
      where: { id: offer.deliveryRequestId },
    });
    if (!request || request.clientId !== userId) {
      throw new ForbiddenException("Cette offre ne vous concerne pas.");
    }
    offer.statut = 'refuse';
    await this.offers.save(offer);
  }

  // --- Course en cours -----------------------------------------------------

  async getActiveForDriver(userId: string): Promise<ActiveTourView | null> {
    const driver = await this.driverProfiles.findByUserId(userId);
    if (!driver) return null;
    const route = await this.routes.findOne({
      where: { driverId: driver.id, status: 'en_cours' },
      order: { createdAt: 'DESC' },
    });
    if (!route) return null;
    const request = await this.requests.findOneOrFail({
      where: { id: route.deliveryRequestId },
    });
    const stops = await this.stops.find({ where: { routeId: route.id } });
    return this.buildActiveView(request, route, stops);
  }

  // Collecte des colis chez l'expéditeur : tous les colis passent en transport,
  // le premier arrêt devient « en route ». Une photo de collecte optionnelle
  // (preuve, spec §2 bis) est enregistrée sur chaque colis.
  async pickupTour(
    routeId: string,
    userId: string,
    proofPhotoUrl?: string,
  ): Promise<ActiveTourView> {
    const { driver, route } = await this.requireOwnedRoute(routeId, userId);
    if (route.status !== 'en_cours') {
      throw new ConflictException("La tournée n'est pas en cours.");
    }
    const stops = await this.stops.find({ where: { routeId: route.id } });
    await this.packages.update(
      { stopId: In(stops.map((s) => s.id)) },
      {
        status: 'en_transport',
        ...(proofPhotoUrl ? { proofCollectionPhotoUrl: proofPhotoUrl } : {}),
      },
    );
    const ordered = [...stops].sort((a, b) => a.orderIndex - b.orderIndex);
    const first = ordered.find((s) => s.status === 'en_attente');
    if (first) {
      first.status = 'en_route';
      await this.stops.save(first);
    }
    const detail = `${stops.length} colis récupérés${proofPhotoUrl ? ' (photo)' : ''}`;
    for (const pkg of await this.packagesOfStops(stops.map((s) => s.id))) {
      await this.track(pkg.id, 'recupere', detail);
    }
    const request = await this.requests.findOneOrFail({
      where: { id: route.deliveryRequestId },
    });
    void driver;
    return this.buildActiveView(request, route, ordered);
  }

  // Livraison d'un arrêt, validée par le code OTP du destinataire. Une photo de
  // preuve optionnelle (spec §9, au-delà de l'OTP) peut être jointe.
  async completeStop(
    stopId: string,
    userId: string,
    otp: string,
    proofPhotoUrl?: string,
  ): Promise<ActiveTourView> {
    const { driver, stop, route } = await this.requireOwnedStop(stopId, userId);
    if (stop.status === 'livre') {
      throw new ConflictException('Cet arrêt est déjà livré.');
    }
    if (!stop.proofOtp || stop.proofOtp !== otp) {
      throw new BadRequestException('Code de livraison incorrect.');
    }
    stop.status = 'livre';
    if (proofPhotoUrl) {
      stop.proofPhotoUrl = proofPhotoUrl;
    }
    await this.stops.save(stop);
    // Articles remis (spec-delivery-items).
    await this.items.update(
      { stopId: stop.id, status: 'pending' },
      { status: 'delivered' },
    );
    const pkg = await this.packages.findOne({ where: { stopId: stop.id } });
    if (pkg) {
      pkg.status = 'livre';
      await this.packages.save(pkg);
      await this.track(pkg.id, 'livre', 'Arrêt livré');
    }
    await this.advanceOrClose(route, driver);
    return this.getActiveOrFinal(route);
  }

  // Arrêt en échec (client absent, refus…). Passe à l'arrêt suivant.
  async reportStopProblem(
    stopId: string,
    userId: string,
    reason: string,
  ): Promise<ActiveTourView> {
    const { driver, stop, route } = await this.requireOwnedStop(stopId, userId);
    if (stop.status === 'livre') {
      throw new ConflictException('Cet arrêt est déjà livré.');
    }
    stop.status = 'probleme';
    await this.stops.save(stop);
    // Article manquant : on marque les articles non remis (spec-delivery-items §6).
    if (reason === 'article_manquant') {
      await this.items.update(
        { stopId: stop.id, status: 'pending' },
        { status: 'missing' },
      );
    }
    const pkg = await this.packages.findOne({ where: { stopId: stop.id } });
    if (pkg) {
      pkg.status = 'retour';
      await this.packages.save(pkg);
      await this.track(pkg.id, 'probleme', `Échec: ${reason}`);
    }
    await this.advanceOrClose(route, driver);
    return this.getActiveOrFinal(route);
  }

  // --- Vue client ----------------------------------------------------------

  async listClientTours(userId: string): Promise<TourClientView[]> {
    const requests = await this.requests.find({
      where: { clientId: userId, type: 'batch' },
      order: { createdAt: 'DESC' },
      take: 50,
    });
    const views: TourClientView[] = [];
    for (const request of requests) {
      const route = await this.routes.findOne({
        where: { deliveryRequestId: request.id },
      });
      const stops = route
        ? await this.stops.find({ where: { routeId: route.id } })
        : [];
      views.push(await this.buildClientView(request, route, stops));
    }
    return views;
  }

  async getClientTour(
    requestId: string,
    userId: string,
  ): Promise<TourClientView> {
    const request = await this.requests.findOne({ where: { id: requestId } });
    if (!request) {
      throw new NotFoundException('Tournée introuvable.');
    }
    if (request.clientId !== userId) {
      throw new ForbiddenException("Cette tournée n'est pas la vôtre.");
    }
    const route = await this.routes.findOne({
      where: { deliveryRequestId: request.id },
    });
    const stops = route
      ? await this.stops.find({ where: { routeId: route.id } })
      : [];
    return this.buildClientView(request, route, stops);
  }

  // --- Internes ------------------------------------------------------------

  // Avance à l'arrêt suivant ; si tous les arrêts sont résolus, clôt la tournée
  // et débite la commission sur le total réellement livré.
  private async advanceOrClose(
    route: DeliveryRoute,
    driver: DriverProfile,
  ): Promise<void> {
    const stops = await this.stops.find({ where: { routeId: route.id } });
    const ordered = [...stops].sort((a, b) => a.orderIndex - b.orderIndex);
    const pending = ordered.find(
      (s) => s.status === 'en_attente' || s.status === 'en_route',
    );

    if (pending) {
      if (pending.status === 'en_attente') {
        pending.status = 'en_route';
        await this.stops.save(pending);
      }
      return;
    }

    // Tous les arrêts sont résolus → clôture.
    route.status = 'terminee';
    await this.routes.save(route);
    const request = await this.requests.findOneOrFail({
      where: { id: route.deliveryRequestId },
    });
    request.statusGlobal = 'terminee';
    await this.requests.save(request);

    const deliveredTotal = ordered
      .filter((s) => s.status === 'livre')
      .reduce((sum, s) => sum + s.priceFcfa, 0);
    // Commission une seule fois, sur le total livré (idempotent par route).
    if (deliveredTotal > 0) {
      await this.wallet.settleCompletedDelivery(
        driver.id,
        route.id,
        deliveredTotal,
      );
    }

    await this.notifications.sendToUser(request.clientId, {
      title: 'Tournée terminée ✅',
      body: `${ordered.filter((s) => s.status === 'livre').length}/${ordered.length} colis livrés.`,
      data: { type: 'tour_status', requestId: request.id, status: 'terminee' },
    });
  }

  private async getActiveOrFinal(route: DeliveryRoute): Promise<ActiveTourView> {
    const fresh = await this.routes.findOneOrFail({ where: { id: route.id } });
    const request = await this.requests.findOneOrFail({
      where: { id: fresh.deliveryRequestId },
    });
    const stops = await this.stops.find({ where: { routeId: fresh.id } });
    return this.buildActiveView(request, fresh, stops);
  }

  // Charge les articles groupés par arrêt (spec-delivery-items).
  private async loadItemsByStop(
    stopIds: string[],
  ): Promise<Map<string, DeliveryItem[]>> {
    const map = new Map<string, DeliveryItem[]>();
    if (stopIds.length === 0) return map;
    const items = await this.items.find({
      where: { stopId: In(stopIds) },
      order: { createdAt: 'ASC' },
    });
    for (const it of items) {
      const arr = map.get(it.stopId) ?? [];
      arr.push(it);
      map.set(it.stopId, arr);
    }
    return map;
  }

  private async buildActiveView(
    request: DeliveryRequest,
    route: DeliveryRoute,
    stops: Stop[],
  ): Promise<ActiveTourView> {
    const map = await this.loadItemsByStop(stops.map((s) => s.id));
    return toActiveTourView(request, route, stops, map);
  }

  private async buildClientView(
    request: DeliveryRequest,
    route: DeliveryRoute | null,
    stops: Stop[],
  ): Promise<TourClientView> {
    const map = await this.loadItemsByStop(stops.map((s) => s.id));
    return toTourClientView(request, route, stops, map);
  }

  private async requireActiveSolventDriver(
    userId: string,
  ): Promise<DriverProfile> {
    const driver = await this.driverProfiles.findByUserId(userId);
    if (!driver) {
      throw new ForbiddenException('Profil livreur requis.');
    }
    if (driver.status !== 'actif') {
      throw new ForbiddenException(
        driver.status === 'suspendu'
          ? 'Votre compte livreur est suspendu.'
          : 'Votre compte est en cours de validation.',
      );
    }
    const solvent = await this.wallet.canAcceptMission(driver.id);
    if (!solvent) {
      throw new ForbiddenException(
        'Solde insuffisant. Rechargez votre caution pour accepter des missions.',
      );
    }
    return driver;
  }

  private async requireOwnedRoute(
    routeId: string,
    userId: string,
  ): Promise<{ driver: DriverProfile; route: DeliveryRoute }> {
    const driver = await this.driverProfiles.findByUserId(userId);
    const route = await this.routes.findOne({ where: { id: routeId } });
    if (!route) {
      throw new NotFoundException('Tournée introuvable.');
    }
    if (!driver || route.driverId !== driver.id) {
      throw new ForbiddenException("Vous n'êtes pas le livreur de cette tournée.");
    }
    return { driver, route };
  }

  private async requireOwnedStop(
    stopId: string,
    userId: string,
  ): Promise<{ driver: DriverProfile; stop: Stop; route: DeliveryRoute }> {
    const stop = await this.stops.findOne({ where: { id: stopId } });
    if (!stop) {
      throw new NotFoundException('Arrêt introuvable.');
    }
    const { driver, route } = await this.requireOwnedRoute(stop.routeId, userId);
    return { driver, stop, route };
  }

  private packagesOfStops(stopIds: string[]): Promise<DeliveryPackage[]> {
    if (stopIds.length === 0) return Promise.resolve([]);
    return this.packages.find({ where: { stopId: In(stopIds) } });
  }

  private generateOtp(): string {
    return randomInt(0, 10000).toString().padStart(4, '0');
  }

  private async track(
    packageId: string,
    typeEvenement: string,
    details: string,
  ): Promise<void> {
    await this.events.save(
      this.events.create({ packageId, typeEvenement, details }),
    );
  }

  // Ordre « plus proche voisin » (heuristique, spec §6) : depuis le point de
  // départ, on prend à chaque fois l'arrêt non visité le plus proche.
  private nearestNeighborOrder(
    stops: Stop[],
    startLat: number | null,
    startLng: number | null,
  ): Stop[] {
    const withCoords = stops.filter((s) => s.location);
    const withoutCoords = stops.filter((s) => !s.location);
    if (startLat === null || startLng === null || withCoords.length <= 1) {
      return [...withCoords, ...withoutCoords];
    }
    const remaining = [...withCoords];
    const ordered: Stop[] = [];
    let curLat = startLat;
    let curLng = startLng;
    while (remaining.length > 0) {
      let bestIdx = 0;
      let bestDist = Infinity;
      for (let i = 0; i < remaining.length; i++) {
        const loc = remaining[i].location!;
        const d = haversine(
          curLat,
          curLng,
          loc.coordinates[1],
          loc.coordinates[0],
        );
        if (d < bestDist) {
          bestDist = d;
          bestIdx = i;
        }
      }
      const [next] = remaining.splice(bestIdx, 1);
      ordered.push(next);
      curLat = next.location!.coordinates[1];
      curLng = next.location!.coordinates[0];
    }
    return [...ordered, ...withoutCoords];
  }
}

// Distance approximative en mètres entre deux points (formule de haversine).
function haversine(
  aLat: number,
  aLng: number,
  bLat: number,
  bLng: number,
): number {
  const R = 6371000;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((aLat * Math.PI) / 180) *
      Math.cos((bLat * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}
