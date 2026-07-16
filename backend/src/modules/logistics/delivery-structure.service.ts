import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { GeoPoint } from '../../common/geo/geo.types';
import { DeliveryPackage } from './entities/package.entity';
import { DeliveryRequest } from './entities/delivery-request.entity';
import { DeliveryRoute } from './entities/route.entity';
import { Stop } from './entities/stop.entity';
import { TrackingEvent } from './entities/tracking-event.entity';

// Données d'une livraison simple à refléter dans le modèle généralisé.
export interface SingleDeliveryInput {
  clientId: string;
  pickupAddress: string;
  pickupLocation: GeoPoint;
  dropoffAddress: string;
  dropoffLocation: GeoPoint;
  recipientName: string | null;
  recipientPhone: string | null;
  dropoffNote: string | null;
  priceFcfa: number;
  description: string | null;
  deliveryCode: string | null;
}

// Pont entre la table `deliveries` (record opérationnel de la livraison simple,
// inchangé) et le modèle généralisé DeliveryRequest → Route → Stop → Package
// (spec-delivery-architecture-tournees §3). En V1, `deliveries` reste la source
// de vérité du hot-path (matching, wallet, mobile) ; ces tables portent la
// structure « 1..N livraisons par demande » et l'audit, prêtes pour les tournées
// (P1) sans migration. Toutes les méthodes de synchro sont NO-OP si aucune
// structure n'est liée — aucune régression possible sur l'existant.
@Injectable()
export class DeliveryStructureService {
  constructor(
    @InjectRepository(DeliveryRequest)
    private readonly requests: Repository<DeliveryRequest>,
    @InjectRepository(DeliveryRoute)
    private readonly routes: Repository<DeliveryRoute>,
    @InjectRepository(Stop)
    private readonly stops: Repository<Stop>,
    @InjectRepository(DeliveryPackage)
    private readonly packages: Repository<DeliveryPackage>,
    @InjectRepository(TrackingEvent)
    private readonly events: Repository<TrackingEvent>,
  ) {}

  // Crée la chaîne request(single) → route → stop → package pour une livraison
  // simple, et renvoie l'id de la demande (stocké sur `deliveries`).
  async createForSingleDelivery(input: SingleDeliveryInput): Promise<string> {
    const request = await this.requests.save(
      this.requests.create({
        clientId: input.clientId,
        type: 'single',
        departAddress: input.pickupAddress,
        departLocation: input.pickupLocation,
        statusGlobal: 'en_cours',
        totalPriceFcfa: input.priceFcfa,
        urgency: 'normal',
      }),
    );
    const route = await this.routes.save(
      this.routes.create({
        deliveryRequestId: request.id,
        driverId: null,
        status: 'en_attente',
        gainTotalFcfa: input.priceFcfa,
      }),
    );
    const stop = await this.stops.save(
      this.stops.create({
        routeId: route.id,
        recipientName: input.recipientName,
        recipientPhone: input.recipientPhone,
        address: input.dropoffAddress,
        location: input.dropoffLocation,
        landmark: input.dropoffNote,
        priceFcfa: input.priceFcfa,
        orderIndex: 0,
        status: 'en_attente',
        proofOtp: input.deliveryCode,
      }),
    );
    const pkg = await this.packages.save(
      this.packages.create({
        stopId: stop.id,
        descriptionProduit: input.description,
        status: 'cree',
      }),
    );
    await this.track(pkg.id, 'cree', 'Livraison créée');
    return request.id;
  }

  // --- Synchronisation des transitions (NO-OP si non lié) ------------------

  async onAccept(requestId: string | null, driverId: string): Promise<void> {
    const ctx = await this.context(requestId);
    if (!ctx) return;
    ctx.route.driverId = driverId;
    ctx.route.status = 'en_cours';
    ctx.request.statusGlobal = 'en_cours';
    ctx.pkg.status = 'assigne';
    await this.routes.save(ctx.route);
    await this.requests.save(ctx.request);
    await this.packages.save(ctx.pkg);
    await this.track(ctx.pkg.id, 'assigne', `Livreur ${driverId} assigné`);
  }

  async onPickedUp(requestId: string | null): Promise<void> {
    const ctx = await this.context(requestId);
    if (!ctx) return;
    ctx.stop.status = 'en_route';
    ctx.pkg.status = 'en_transport';
    await this.stops.save(ctx.stop);
    await this.packages.save(ctx.pkg);
    await this.track(ctx.pkg.id, 'recupere', 'Colis récupéré, en transport');
  }

  async onCompleted(requestId: string | null): Promise<void> {
    const ctx = await this.context(requestId);
    if (!ctx) return;
    ctx.stop.status = 'livre';
    ctx.pkg.status = 'livre';
    ctx.route.status = 'terminee';
    ctx.request.statusGlobal = 'terminee';
    await this.stops.save(ctx.stop);
    await this.packages.save(ctx.pkg);
    await this.routes.save(ctx.route);
    await this.requests.save(ctx.request);
    await this.track(ctx.pkg.id, 'livre', 'Livraison confirmée');
  }

  async onCancelled(requestId: string | null): Promise<void> {
    const ctx = await this.context(requestId);
    if (!ctx) return;
    ctx.route.status = 'annulee';
    ctx.request.statusGlobal = 'annulee';
    await this.routes.save(ctx.route);
    await this.requests.save(ctx.request);
    await this.track(ctx.pkg.id, 'annulee', 'Livraison annulée');
  }

  // Charge la chaîne route/stop/package d'une demande. null si rien de lié.
  private async context(requestId: string | null): Promise<{
    request: DeliveryRequest;
    route: DeliveryRoute;
    stop: Stop;
    pkg: DeliveryPackage;
  } | null> {
    if (!requestId) return null;
    const request = await this.requests.findOne({ where: { id: requestId } });
    if (!request) return null;
    const route = await this.routes.findOne({
      where: { deliveryRequestId: requestId },
    });
    if (!route) return null;
    const stop = await this.stops.findOne({ where: { routeId: route.id } });
    if (!stop) return null;
    const pkg = await this.packages.findOne({ where: { stopId: stop.id } });
    if (!pkg) return null;
    return { request, route, stop, pkg };
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
}
