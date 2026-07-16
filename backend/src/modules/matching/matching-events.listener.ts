import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

import {
  DELIVERY_CREATED_EVENT,
  DeliveryCreatedEvent,
} from '../deliveries/delivery.events';
import { MatchingService } from './matching.service';

// Écoute la publication d'une livraison et déclenche l'offre aux livreurs
// proches. Ce listener est le point qui relie deliveries → matching sans
// dépendance de module directe (donc sans cycle).
@Injectable()
export class MatchingEventsListener {
  private readonly logger = new Logger(MatchingEventsListener.name);

  constructor(private readonly matching: MatchingService) {}

  @OnEvent(DELIVERY_CREATED_EVENT)
  async handleDeliveryCreated(event: DeliveryCreatedEvent): Promise<void> {
    try {
      await this.matching.notifyNearbyDrivers(event.deliveryId);
    } catch (error) {
      this.logger.warn(
        `Offre aux livreurs proches échouée (livraison ${event.deliveryId}): ${error}`,
      );
    }
  }
}
