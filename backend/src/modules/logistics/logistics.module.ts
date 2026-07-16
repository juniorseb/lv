import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { NotificationsModule } from '../notifications/notifications.module';
import { ProfilesModule } from '../profiles/profiles.module';
import { WalletModule } from '../wallet/wallet.module';
import { DeliveryStructureService } from './delivery-structure.service';
import { DeliveryItem } from './entities/delivery-item.entity';
import { DeliveryPackage } from './entities/package.entity';
import { DeliveryRequest } from './entities/delivery-request.entity';
import { DeliveryRoute } from './entities/route.entity';
import {
  DeliveryOffer,
  PaymentCollection,
  RecurringDelivery,
  VehicleCapacity,
} from './entities/reserved.entities';
import { Stop } from './entities/stop.entity';
import { TrackingEvent } from './entities/tracking-event.entity';
import { ToursController } from './tours.controller';
import { ToursService } from './tours.service';

// Modèle logistique généralisé (spec-delivery-architecture-tournees). Porte les
// entités DeliveryRequest → Route → Stop → Package + audit, et le service pont
// avec la table `deliveries`. Les entités réservées (COD sécurisé, offres,
// récurrent) sont enregistrées pour créer leurs tables, sans logique active.
@Module({
  imports: [
    TypeOrmModule.forFeature([
      DeliveryRequest,
      DeliveryRoute,
      Stop,
      DeliveryPackage,
      DeliveryItem,
      TrackingEvent,
      PaymentCollection,
      DeliveryOffer,
      RecurringDelivery,
      VehicleCapacity,
    ]),
    ProfilesModule,
    WalletModule,
    NotificationsModule,
  ],
  controllers: [ToursController],
  providers: [DeliveryStructureService, ToursService],
  exports: [DeliveryStructureService, ToursService],
})
export class LogisticsModule {}
