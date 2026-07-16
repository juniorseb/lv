import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthModule } from '../auth/auth.module';
import { LogisticsModule } from '../logistics/logistics.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ProfilesModule } from '../profiles/profiles.module';
import { UsersModule } from '../users/users.module';
import { VehicleCapsModule } from '../vehicle-caps/vehicle-caps.module';
import { WalletModule } from '../wallet/wallet.module';
import { DeliveriesController } from './deliveries.controller';
import { DeliveriesService } from './deliveries.service';
import { DeliveryExpiryJob } from './delivery-expiry.job';
import { DeliveryIncident } from './entities/delivery-incident.entity';
import { Delivery } from './entities/delivery.entity';

// Cycle de vie d'une livraison : création, statuts, code de livraison à 4 chiffres.
// S'appuie sur ProfilesModule pour résoudre le profil livreur lors des
// transitions (accepter / récupérer / valider). Le service est exporté pour le
// module matching (qui déclenchera l'acceptation dans le cercle progressif).

@Module({
  imports: [
    TypeOrmModule.forFeature([Delivery, DeliveryIncident]),
    ProfilesModule,
    WalletModule,
    NotificationsModule,
    LogisticsModule,
    VehicleCapsModule,
    // SmsService : code de livraison envoyé au destinataire à la récupération.
    AuthModule,
    // Rapprochement numéro → compte (lien de suivi dans le SMS).
    UsersModule,
  ],
  controllers: [DeliveriesController],
  providers: [DeliveriesService, DeliveryExpiryJob],
  exports: [DeliveriesService, TypeOrmModule],
})
export class DeliveriesModule {}
