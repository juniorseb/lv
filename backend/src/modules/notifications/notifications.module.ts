import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { DeviceToken } from './entities/device-token.entity';
import { ExpoPushClient } from './expo-push.client';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';

// Notifications push, via le service Expo (et non Firebase en direct : voir
// expo-push.client.ts). Module bas niveau sans dépendance métier : les autres
// modules l'importent pour émettre des push (statuts de livraison, offre au
// livreur, solde bas, alertes SOS).

@Module({
  imports: [TypeOrmModule.forFeature([DeviceToken])],
  controllers: [NotificationsController],
  providers: [NotificationsService, ExpoPushClient],
  exports: [NotificationsService],
})
export class NotificationsModule {}
