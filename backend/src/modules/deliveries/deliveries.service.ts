import { randomInt } from 'crypto';

import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThanOrEqual, MoreThan, Repository } from 'typeorm';

import { toGeoPoint } from '../../common/geo/geo.types';
import { SmsService } from '../auth/sms.service';
import { tryNormalizeIvorianPhone } from '../auth/utils/phone.util';
import { DeliveryStructureService } from '../logistics/delivery-structure.service';
import { NotificationsService } from '../notifications/notifications.service';
import { DriverProfile } from '../profiles/entities/driver-profile.entity';
import { DriverProfilesService } from '../profiles/driver-profiles.service';
import { UsersService } from '../users/users.service';
import { VehicleCapsService } from '../vehicle-caps/vehicle-caps.service';
import { WalletService } from '../wallet/wallet.service';
import { DELIVERY_CREATED_EVENT, DeliveryCreatedEvent } from './delivery.events';
import { CreateDeliveryDto } from './dto/create-delivery.dto';
import { DeliveryIncident } from './entities/delivery-incident.entity';
import { Delivery } from './entities/delivery.entity';

// Machine à états de la livraison (dossier §4) :
//   recherche → livreur_trouve → colis_recupere → terminee
//   recherche | livreur_trouve → annulee (annulation avant récupération)
//
// La recherche de livreurs elle-même (cercle progressif PostGIS) est du ressort
// du module matching ; ce service porte la création, le code de livraison et
// les transitions d'état avec leurs garde-fous d'autorisation.
@Injectable()
export class DeliveriesService {
  private readonly logger = new Logger(DeliveriesService.name);

  constructor(
    @InjectRepository(Delivery)
    private readonly deliveries: Repository<Delivery>,
    @InjectRepository(DeliveryIncident)
    private readonly incidents: Repository<DeliveryIncident>,
    private readonly driverProfiles: DriverProfilesService,
    private readonly wallet: WalletService,
    private readonly notifications: NotificationsService,
    private readonly structure: DeliveryStructureService,
    private readonly events: EventEmitter2,
    // Plafonds des modes doux (vélo / à pied), partagés avec le matching.
    private readonly vehicleCaps: VehicleCapsService,
    private readonly config: ConfigService,
    // Envoi du code de livraison au destinataire (il n'a pas l'app).
    private readonly sms: SmsService,
    // Rapprochement numéro → compte, pour le lien de suivi.
    private readonly users: UsersService,
  ) {}

  // Délai de recherche (secondes) : au-delà, la course sort de tous les feeds et
  // bascule en `expiree`. Court volontairement — le livreur voit un décompte qui
  // se vide sur le bouton Accepter, ce qui pousse à la décision (§ Yango-like).
  private searchTtlSeconds(): number {
    return Number(this.config.get('DELIVERY_SEARCH_TTL_SECONDS')) || 180;
  }

  // Fin de la fenêtre de recherche : démarre à la publication, ou à l'heure
  // programmée si celle-ci est encore dans le futur. 0 = désactive l'expiration.
  private computeExpiresAt(scheduledAt: Date | null): Date | null {
    const ttl = this.searchTtlSeconds();
    if (ttl <= 0) return null;
    const now = new Date();
    const start = scheduledAt && scheduledAt > now ? scheduledAt : now;
    return new Date(start.getTime() + ttl * 1000);
  }

  // --- Publication ---------------------------------------------------------

  async create(senderId: string, dto: CreateDeliveryDto): Promise<Delivery> {
    const scheduledAt = dto.scheduledAt ? new Date(dto.scheduledAt) : null;
    const delivery = this.deliveries.create({
      senderId,
      pickupAddress: dto.pickup.address,
      pickupLocation: toGeoPoint(dto.pickup.latitude, dto.pickup.longitude),
      dropoffAddress: dto.dropoff.address,
      dropoffLocation: toGeoPoint(dto.dropoff.latitude, dto.dropoff.longitude),
      recipientName: dto.recipientName ?? null,
      recipientPhone: dto.recipientPhone ?? null,
      pickupContactName: dto.pickupContactName ?? null,
      pickupContactPhone: dto.pickupContactPhone ?? null,
      pickupNote: dto.pickupNote ?? null,
      dropoffNote: dto.dropoffNote ?? null,
      priceFcfa: dto.priceFcfa,
      packageType: dto.packageType ?? null,
      description: dto.description ?? null,
      photoUrl: dto.photoUrl ?? null,
      matchingMode: dto.matchingMode ?? 'rapide',
      urgency: dto.urgency ?? 'normal',
      scheduledAt,
      // Le décompte ne démarre qu'au moment où la course devient réellement
      // proposable : maintenant, ou l'heure programmée si elle est future.
      expiresAt: this.computeExpiresAt(scheduledAt),
      isCod: dto.isCod ?? false,
      codArticleAmountFcfa: dto.isCod ? (dto.codArticleAmountFcfa ?? 0) : null,
      status: 'recherche',
      deliveryCode: this.generateDeliveryCode(),
    });
    const saved = await this.deliveries.save(delivery);

    // Reflète la livraison dans le modèle généralisé (request→route→stop→package,
    // spec-tournees §3). Best-effort : ne bloque jamais la publication.
    try {
      const requestId = await this.structure.createForSingleDelivery({
        clientId: saved.senderId,
        pickupAddress: saved.pickupAddress,
        pickupLocation: saved.pickupLocation,
        dropoffAddress: saved.dropoffAddress,
        dropoffLocation: saved.dropoffLocation,
        recipientName: saved.recipientName,
        recipientPhone: saved.recipientPhone,
        dropoffNote: saved.dropoffNote,
        priceFcfa: saved.priceFcfa,
        description: saved.description,
        deliveryCode: saved.deliveryCode,
      });
      saved.deliveryRequestId = requestId;
      await this.deliveries.update(saved.id, { deliveryRequestId: requestId });
    } catch (error) {
      this.logger.warn(`Bridge logistique (create) échoué pour ${saved.id}: ${error}`);
    }

    // Déclenche l'offre aux livreurs proches (traitée par le module matching) —
    // sauf pour une course programmée dans le futur, qui restera hors du feed
    // jusqu'à son heure (filtre côté matching).
    const isFutureScheduled =
      saved.scheduledAt !== null && saved.scheduledAt.getTime() > Date.now();
    if (!isFutureScheduled) {
      this.events.emit(DELIVERY_CREATED_EVENT, {
        deliveryId: saved.id,
      } satisfies DeliveryCreatedEvent);
    }

    return saved;
  }

  // --- Lecture -------------------------------------------------------------

  listForSender(senderId: string): Promise<Delivery[]> {
    return this.deliveries.find({
      where: { senderId },
      order: { createdAt: 'DESC' },
    });
  }

  // Tableau de bord des gains du livreur (spec-app-navigation-roles §4) :
  // nombre de livraisons terminées + revenu total encaissé. Informatif — le
  // client paie le livreur en direct, Livrechap n'encaisse rien ici.
  async driverEarnings(
    userId: string,
  ): Promise<{ totalDeliveries: number; totalRevenueFcfa: number }> {
    const driver = await this.driverProfiles.findByUserId(userId);
    if (!driver) {
      return { totalDeliveries: 0, totalRevenueFcfa: 0 };
    }
    const row = await this.deliveries
      .createQueryBuilder('d')
      .select('COUNT(*)', 'count')
      .addSelect('COALESCE(SUM(d.price_fcfa), 0)', 'sum')
      .where('d.driver_id = :id AND d.status = :status', {
        id: driver.id,
        status: 'terminee',
      })
      .getRawOne<{ count: string; sum: string }>();
    return {
      totalDeliveries: Number(row?.count ?? 0),
      totalRevenueFcfa: Number(row?.sum ?? 0),
    };
  }

  // Historique des courses effectuées par le livreur (terminées ou annulées) —
  // séparé de l'historique client (spec-app-navigation-roles §7).
  async historyForDriver(userId: string): Promise<Delivery[]> {
    const driver = await this.driverProfiles.findByUserId(userId);
    if (!driver) {
      return [];
    }
    return this.deliveries.find({
      where: [
        { driverId: driver.id, status: 'terminee' },
        { driverId: driver.id, status: 'annulee' },
      ],
      order: { createdAt: 'DESC' },
      take: 100,
    });
  }

  async getByIdOrFail(id: string): Promise<Delivery> {
    const delivery = await this.deliveries.findOne({ where: { id } });
    if (!delivery) {
      throw new NotFoundException('Livraison introuvable.');
    }
    return delivery;
  }

  // Mémorise le rayon courant du cercle progressif (piloté par le matching).
  async setSearchRadius(id: string, radiusKm: number): Promise<void> {
    await this.deliveries.update({ id }, { searchRadiusKm: radiusKm });
  }

  // Course en cours du livreur (assignée et pas encore terminée/annulée), pour
  // reprendre le suivi au redémarrage de l'app. Renvoie null s'il n'y en a pas.
  async findActiveForDriver(userId: string): Promise<Delivery | null> {
    const driver = await this.driverProfiles.findByUserId(userId);
    if (!driver) {
      return null;
    }
    return this.deliveries.findOne({
      where: [
        { driverId: driver.id, status: 'livreur_trouve' },
        { driverId: driver.id, status: 'colis_recupere' },
      ],
      order: { matchedAt: 'DESC' },
    });
  }

  // Activité du JOUR pour l'accueil livreur « identité pro » (Product Psychology
  // §9) : gains encaissés et livraisons terminées depuis minuit.
  async driverToday(
    userId: string,
  ): Promise<{ todayDeliveries: number; todayRevenueFcfa: number }> {
    const driver = await this.driverProfiles.findByUserId(userId);
    if (!driver) {
      return { todayDeliveries: 0, todayRevenueFcfa: 0 };
    }
    const row = await this.deliveries
      .createQueryBuilder('d')
      .select('COUNT(*)', 'count')
      .addSelect('COALESCE(SUM(d.price_fcfa), 0)', 'sum')
      .where('d.driver_id = :id', { id: driver.id })
      .andWhere('d.status = :status', { status: 'terminee' })
      .andWhere("d.completed_at >= date_trunc('day', now())")
      .getRawOne<{ count: string; sum: string }>();
    return {
      todayDeliveries: Number(row?.count ?? 0),
      todayRevenueFcfa: Number(row?.sum ?? 0),
    };
  }

  // Disponibilité temps réel du livreur (spec-tournees §2 bis, DriverStatus) —
  // dérivée, pas une machine à états supplémentaire : offline (indisponible),
  // busy (course en cours), online (disponible et libre). « paused » n'est pas
  // modélisé en V1. Sert à savoir à qui proposer une nouvelle mission.
  async getDriverPresence(
    userId: string,
  ): Promise<{ status: 'online' | 'offline' | 'busy'; activeDeliveryId: string | null }> {
    const driver = await this.driverProfiles.findByUserId(userId);
    if (!driver) {
      return { status: 'offline', activeDeliveryId: null };
    }
    const active = await this.findActiveForDriver(userId);
    if (active) {
      return { status: 'busy', activeDeliveryId: active.id };
    }
    return {
      status: driver.isAvailable ? 'online' : 'offline',
      activeDeliveryId: null,
    };
  }

  // Position courante du livreur assigné à une livraison, pour le suivi carte
  // côté expéditeur. Accessible à l'expéditeur et au livreur assigné.
  async getDriverLocation(
    id: string,
    userId: string,
  ): Promise<{ latitude: number; longitude: number; updatedAt: Date | null } | null> {
    const delivery = await this.getByIdOrFail(id);

    const isSender = delivery.senderId === userId;
    const requesterDriver = await this.driverProfiles.findByUserId(userId);
    const isAssignedDriver =
      requesterDriver && delivery.driverId === requesterDriver.id;
    if (!isSender && !isAssignedDriver) {
      throw new ForbiddenException('Accès refusé à cette livraison.');
    }

    if (!delivery.driverId) {
      return null;
    }
    const driver = await this.driverProfiles.findById(delivery.driverId);
    if (!driver?.currentLocation) {
      return null;
    }
    const [longitude, latitude] = driver.currentLocation.coordinates;
    return { latitude, longitude, updatedAt: driver.locationUpdatedAt };
  }

  // Renvoie la livraison et indique si l'utilisateur en est l'expéditeur
  // (ce qui conditionne l'accès au code de livraison). Le livreur assigné y a
  // aussi accès en lecture, mais sans le code.
  // Qui peut consulter une course, et qui voit le code de livraison.
  //
  // Le destinataire et le contact de récupération ne sont PAS des comptes liés :
  // ce sont de simples numéros saisis par l'expéditeur. S'ils correspondent à un
  // compte Livrechap, la personne suit sa course dans l'app plutôt que d'attendre
  // un SMS. Le rapprochement se fait sur le numéro normalisé (E.164).
  //
  // Le code n'est montré qu'à l'expéditeur ET au destinataire : c'est lui qui le
  // remet au livreur. Ni le livreur (il le saisit), ni le contact de récupération
  // (il n'a pas à pouvoir valider une livraison qu'il ne reçoit pas).
  async getForUser(
    id: string,
    userId: string,
    userPhone?: string,
  ): Promise<{ delivery: Delivery; canSeeCode: boolean }> {
    const delivery = await this.getByIdOrFail(id);
    if (delivery.senderId === userId) {
      return { delivery, canSeeCode: true };
    }

    const driverProfile = await this.driverProfiles.findByUserId(userId);
    if (driverProfile && delivery.driverId === driverProfile.id) {
      return { delivery, canSeeCode: false };
    }

    const phone = tryNormalizeIvorianPhone(userPhone ?? null);
    if (phone) {
      if (phone === tryNormalizeIvorianPhone(delivery.recipientPhone)) {
        return { delivery, canSeeCode: true };
      }
      if (phone === tryNormalizeIvorianPhone(delivery.pickupContactPhone)) {
        return { delivery, canSeeCode: false };
      }
    }

    throw new ForbiddenException("Accès refusé à cette livraison.");
  }

  // --- Transitions livreur -------------------------------------------------

  // Un livreur accepte une livraison en recherche (recherche → livreur_trouve).
  // L'assignation est atomique (WHERE status = 'recherche') pour éviter que deux
  // livreurs prennent le même colis en même temps.
  async accept(id: string, userId: string): Promise<Delivery> {
    const delivery = await this.getByIdOrFail(id);

    if (delivery.senderId === userId) {
      throw new BadRequestException(
        'Vous ne pouvez pas accepter votre propre livraison.',
      );
    }
    if (delivery.status !== 'recherche') {
      throw new ConflictException("Cette livraison n'est plus disponible.");
    }
    // Le job d'expiration tourne périodiquement : on revérifie ici pour ne pas
    // laisser accepter une course déjà hors délai entre deux passages.
    if (delivery.expiresAt && delivery.expiresAt <= new Date()) {
      throw new ConflictException('Cette mission a expiré.');
    }

    const driver = await this.requireActiveDriver(userId);

    // Garde dure des modes doux : le feed et la liste client filtrent déjà les
    // courses hors plafond pour un vélo / un livreur à pied, mais on revérifie
    // ici — l'acceptation est le seul point qui engage réellement la mission.
    const violation = this.vehicleCaps.violationForAccept(
      driver.vehicleType,
      driver.currentLocation?.coordinates ?? null,
      delivery.pickupLocation.coordinates,
      delivery.dropoffLocation.coordinates,
    );
    if (violation) {
      throw new ForbiddenException(violation);
    }

    // Blocage de solde bas (dossier §7) : un livreur ne peut accepter que si son
    // crédit couvre au moins la commission minimale.
    const solvent = await this.wallet.canAcceptMission(driver.id);
    if (!solvent) {
      throw new ForbiddenException(
        'Solde insuffisant. Rechargez votre Crédit Livrechap pour accepter des missions.',
      );
    }

    const result = await this.deliveries
      .createQueryBuilder()
      .update(Delivery)
      .set({
        driverId: driver.id,
        status: 'livreur_trouve',
        matchedAt: () => 'now()',
      })
      .where(
        'id = :id AND status = :status AND (expires_at IS NULL OR expires_at > now())',
        { id, status: 'recherche' },
      )
      .execute();

    if (!result.affected) {
      // Un autre livreur a été plus rapide, ou le délai vient d'expirer.
      throw new ConflictException("Cette livraison n'est plus disponible.");
    }

    const updated = await this.getByIdOrFail(id);

    await this.syncStructure(() =>
      this.structure.onAccept(updated.deliveryRequestId, driver.id),
    );

    // L'expéditeur voit une personne, plus une application (dossier §4).
    await this.notifications.sendToUser(updated.senderId, {
      title: 'Livreur trouvé 🏍️',
      body: 'Un livreur vient récupérer votre colis.',
      data: { type: 'delivery_status', deliveryId: updated.id, status: updated.status },
    });

    return updated;
  }

  // livreur_trouve → colis_recupere. Au-delà de ce point, l'annulation n'est
  // plus gratuite (dossier §6).
  async markPickedUp(id: string, userId: string): Promise<Delivery> {
    const delivery = await this.requireAssignedDriver(id, userId);
    if (delivery.status !== 'livreur_trouve') {
      throw new ConflictException(
        'La livraison doit être au statut « livreur trouvé » pour récupérer le colis.',
      );
    }
    delivery.status = 'colis_recupere';
    delivery.pickedUpAt = new Date();
    const saved = await this.deliveries.save(delivery);

    await this.syncStructure(() =>
      this.structure.onPickedUp(saved.deliveryRequestId),
    );

    await this.notifications.sendToUser(saved.senderId, {
      title: 'Colis récupéré 📦',
      body: 'Votre colis est en route vers sa destination.',
      data: { type: 'delivery_status', deliveryId: saved.id, status: saved.status },
    });

    await this.sendCodeToRecipient(saved);

    return saved;
  }

  // Le code de livraison n'est affiché QU'À l'expéditeur. Quand il commande pour
  // quelqu'un d'autre (« colis à Yopougon, à remettre à Jérémie à Bingerville »),
  // le destinataire ne l'a pas : le livreur arriverait devant lui sans que
  // personne sur place ne puisse valider. On le lui envoie donc par SMS au
  // moment où le colis part vers lui — ni trop tôt (le colis n'est pas parti),
  // ni trop tard.
  //
  // Best-effort : un SMS qui échoue ne doit jamais bloquer la récupération.
  // L'expéditeur garde le code dans l'app, donc rien n'est perdu.
  private async sendCodeToRecipient(delivery: Delivery): Promise<void> {
    if (!delivery.recipientPhone || !delivery.deliveryCode) {
      return;
    }
    try {
      // Le lien n'a de sens que si le destinataire a déjà l'app : sinon il tombe
      // sur un lien mort. On ne l'ajoute donc que si son numéro correspond à un
      // compte — il suit alors sa course en direct au lieu de subir le SMS.
      const link = await this.trackingLinkFor(delivery);
      const suivi = link ? ` Suivez la course : ${link}` : '';
      await this.sms.sendMessage(
        delivery.recipientPhone,
        `Livrechap : un colis arrive pour vous. Votre code de livraison est ${delivery.deliveryCode}. Donnez-le au livreur au moment de la remise, jamais avant.${suivi}`,
      );
    } catch (error) {
      this.logger.warn(
        `SMS du code de livraison échoué pour ${delivery.id}: ${error}`,
      );
    }
  }

  // Lien de suivi, uniquement si le destinataire a un compte Livrechap.
  private async trackingLinkFor(delivery: Delivery): Promise<string | null> {
    const base = this.config.get<string>('APP_DEEP_LINK_BASE');
    if (!base) return null;
    const phone = tryNormalizeIvorianPhone(delivery.recipientPhone);
    if (!phone) return null;
    const account = await this.users.findByPhoneNumber(phone);
    if (!account) return null;
    // Ne pas rogner les slashes : `livrechap://` doit garder les siens (sinon on
    // produit `livrechap:/delivery/…`, un lien mort). On garantit juste UN
    // séparateur, ce qui marche aussi pour une base https.
    const root = base.endsWith('/') ? base : `${base}/`;
    return `${root}delivery/${delivery.id}`;
  }

  // colis_recupere → terminee, après saisie du code de livraison par le livreur.
  async complete(id: string, userId: string, code: string): Promise<Delivery> {
    const delivery = await this.requireAssignedDriver(id, userId);
    if (delivery.status !== 'colis_recupere') {
      throw new ConflictException(
        'La livraison doit être au statut « colis récupéré » pour être validée.',
      );
    }
    if (!delivery.deliveryCode || delivery.deliveryCode !== code) {
      throw new BadRequestException('Code de livraison incorrect.');
    }
    delivery.status = 'terminee';
    delivery.completedAt = new Date();
    const saved = await this.deliveries.save(delivery);

    await this.syncStructure(() =>
      this.structure.onCompleted(saved.deliveryRequestId),
    );

    // Règlement du crédit : commission automatique + bonus de bienvenue si
    // éligible (dossier §7). Le règlement est idempotent par livraison : en cas
    // d'échec transitoire, la livraison reste « terminée » (l'acte physique a eu
    // lieu) et un rejeu ne double-facture pas. Une requête de réconciliation
    // peut retrouver les livraisons terminées sans transaction de commission.
    if (saved.driverId) {
      try {
        await this.wallet.settleCompletedDelivery(
          saved.driverId,
          saved.id,
          saved.priceFcfa,
        );
      } catch (error) {
        this.logger.error(
          `Règlement du crédit échoué pour la livraison ${saved.id}: ${error}`,
        );
      }
    }

    await this.notifications.sendToUser(saved.senderId, {
      title: 'Livraison terminée ✅',
      body: 'Votre colis a bien été livré. Merci d\'utiliser Livrechap.',
      data: { type: 'delivery_status', deliveryId: saved.id, status: saved.status },
    });

    return saved;
  }

  // --- Expiration de la recherche -----------------------------------------

  // Bascule en `expiree` les courses dont le délai de recherche est dépassé sans
  // qu'aucun livreur n'ait accepté, et prévient l'expéditeur. Idempotent et
  // race-proof : l'UPDATE ne touche que les lignes encore en `recherche`, donc un
  // livreur qui accepte au même instant gagne (ou perd) proprement.
  // Appelé périodiquement par DeliveryExpiryJob.
  async expireOverdueSearches(): Promise<number> {
    const overdue = await this.deliveries.find({
      where: { status: 'recherche', expiresAt: LessThanOrEqual(new Date()) },
      select: ['id', 'senderId'],
    });
    if (overdue.length === 0) return 0;

    let expired = 0;
    for (const delivery of overdue) {
      const result = await this.deliveries
        .createQueryBuilder()
        .update(Delivery)
        .set({ status: 'expiree' })
        .where(
          'id = :id AND status = :status AND expires_at <= now()',
          { id: delivery.id, status: 'recherche' },
        )
        .execute();
      if (!result.affected) continue; // accepté entre-temps : on ne touche à rien
      expired += 1;

      // Formulation honnête et non décourageante : la demande n'a pas échoué,
      // les livreurs étaient occupés. Le client peut republier en ajustant.
      await this.notifications.sendToUser(delivery.senderId, {
        title: 'Nos livreurs sont tous occupés 🏍️',
        body: 'Aucun livreur ne s\'est libéré à temps. Republiez votre course, en ajustant le prix si vous le souhaitez.',
        data: {
          type: 'delivery_status',
          deliveryId: delivery.id,
          status: 'expiree',
        },
      });
    }
    return expired;
  }

  // --- Cercle progressif (support du job de notification par palier) --------

  // Courses encore en recherche et non expirées, avec ce qu'il faut pour décider
  // si un palier vient de s'ouvrir. Utilisé par le module matching.
  findSearchingWithRings(): Promise<Delivery[]> {
    return this.deliveries.find({
      where: { status: 'recherche', expiresAt: MoreThan(new Date()) },
    });
  }

  // Réserve la notification d'un palier : ne réussit que si personne n'a déjà
  // avancé l'index entre-temps (idempotence + sûr en multi-instances).
  async claimRingNotification(
    id: string,
    fromIndex: number,
    toIndex: number,
  ): Promise<boolean> {
    const result = await this.deliveries
      .createQueryBuilder()
      .update(Delivery)
      .set({ notifiedRingIndex: toIndex })
      .where('id = :id AND notified_ring_index = :fromIndex', { id, fromIndex })
      .execute();
    return !!result.affected;
  }

  // --- Annulation expéditeur ----------------------------------------------

  // L'expéditeur annule avant récupération du colis. Gratuit tant que le colis
  // n'a pas été récupéré ; après « colis_recupere » l'annulation passe par une
  // règle de facturation (hors périmètre V1 de ce module).
  async cancelBySender(
    id: string,
    userId: string,
    reason?: string,
  ): Promise<Delivery> {
    const delivery = await this.getByIdOrFail(id);
    if (delivery.senderId !== userId) {
      throw new ForbiddenException(
        'Seule la personne qui a commandé cette course peut l\'annuler.',
      );
    }
    if (
      delivery.status === 'annulee' ||
      delivery.status === 'terminee' ||
      delivery.status === 'expiree'
    ) {
      throw new ConflictException(
        'Cette livraison est déjà terminée, annulée ou expirée.',
      );
    }
    if (delivery.status === 'colis_recupere') {
      throw new ConflictException(
        'Le colis a déjà été récupéré : annulation impossible à ce stade.',
      );
    }

    const hadDriver = delivery.status === 'livreur_trouve';

    delivery.status = 'annulee';
    delivery.cancelledAt = new Date();
    delivery.cancelReason = reason ?? null;
    const saved = await this.deliveries.save(delivery);

    await this.syncStructure(() =>
      this.structure.onCancelled(saved.deliveryRequestId),
    );

    // On ne comptabilise un incident que si un livreur avait déjà accepté :
    // annuler alors que la recherche est encore en cours n'est pas pénalisé.
    if (hadDriver && delivery.driverId) {
      await this.incidents.save(
        this.incidents.create({
          deliveryId: delivery.id,
          userId,
          type: 'annulation_client',
          reason: reason ?? null,
        }),
      );

      // Prévenir le livreur assigné que la course est annulée.
      const driver = await this.driverProfiles.findById(delivery.driverId);
      if (driver) {
        await this.notifications.sendToUser(driver.userId, {
          title: 'Livraison annulée',
          body: 'Le client a annulé la course.',
          data: { type: 'delivery_status', deliveryId: saved.id, status: saved.status },
        });
      }
    }

    return saved;
  }

  // --- Helpers -------------------------------------------------------------

  private async requireActiveDriver(userId: string): Promise<DriverProfile> {
    const driver = await this.driverProfiles.findByUserId(userId);
    if (!driver) {
      throw new ForbiddenException(
        'Vous devez avoir un profil livreur pour accepter une livraison.',
      );
    }
    if (driver.status !== 'actif') {
      throw new ForbiddenException(
        driver.status === 'suspendu'
          ? 'Votre compte livreur est suspendu.'
          : 'Votre compte livreur est en cours de validation.',
      );
    }
    if (driver.suspendedUntil && driver.suspendedUntil > new Date()) {
      throw new ForbiddenException(
        'Votre compte livreur est temporairement suspendu.',
      );
    }
    return driver;
  }

  // Charge la livraison et vérifie que l'utilisateur est bien le livreur assigné.
  private async requireAssignedDriver(
    id: string,
    userId: string,
  ): Promise<Delivery> {
    const delivery = await this.getByIdOrFail(id);
    const driver = await this.driverProfiles.findByUserId(userId);
    if (!driver || delivery.driverId !== driver.id) {
      throw new ForbiddenException(
        "Vous n'êtes pas le livreur assigné à cette livraison.",
      );
    }
    return delivery;
  }

  // Synchronisation du modèle logistique généralisé — best-effort : la structure
  // parente (audit/tournées) ne doit jamais faire échouer une transition d'état
  // opérationnelle de la livraison (garantie de non-régression).
  private async syncStructure(op: () => Promise<void>): Promise<void> {
    try {
      await op();
    } catch (error) {
      this.logger.warn(`Synchro modèle logistique échouée: ${error}`);
    }
  }

  // Code à 4 chiffres (0000–9999), généré de façon cryptographiquement sûre.
  private generateDeliveryCode(): string {
    return randomInt(0, 10000).toString().padStart(4, '0');
  }
}
