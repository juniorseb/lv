import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { DeviceToken } from './entities/device-token.entity';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';

// Notifications push (Firebase Cloud Messaging), alertes de mission proche.
// Module bas niveau sans dépendance métier : les autres modules l'importent
// pour émettre des push (statuts de livraison, offre au livreur, solde bas).

@Module({
  imports: [TypeOrmModule.forFeature([DeviceToken])],
  controllers: [NotificationsController],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
