import { Module } from '@nestjs/common';

import { DeliveriesModule } from '../deliveries/deliveries.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ProfilesModule } from '../profiles/profiles.module';
import { VehicleCapsModule } from '../vehicle-caps/vehicle-caps.module';
import { DriverPresenceCache } from './driver-presence.cache';
import { MatchingEventsListener } from './matching-events.listener';
import { MatchingController } from './matching.controller';
import { MatchingService } from './matching.service';
import { RingDispatchJob } from './ring-dispatch.job';

// Moteur de recherche par cercle progressif (PostGIS), tri des livreurs disponibles.
// Dépend de DeliveriesModule (livraison à matcher) et ProfilesModule (profil
// livreur). Exporte MatchingService (feed livreur) et DriverPresenceCache
// (mise à jour de présence) pour le module drivers.

@Module({
  imports: [
    DeliveriesModule,
    ProfilesModule,
    NotificationsModule,
    VehicleCapsModule,
  ],
  controllers: [MatchingController],
  providers: [
    MatchingService,
    DriverPresenceCache,
    MatchingEventsListener,
    RingDispatchJob,
  ],
  exports: [MatchingService, DriverPresenceCache],
})
export class MatchingModule {}
