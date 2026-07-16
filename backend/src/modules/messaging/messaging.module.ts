import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { DeliveriesModule } from '../deliveries/deliveries.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ProfilesModule } from '../profiles/profiles.module';
import { UsersModule } from '../users/users.module';
import { Message } from './entities/message.entity';
import { MessagesController } from './messages.controller';
import { MessagesService } from './messages.service';

// Messagerie de mission (spec-communication). S'appuie sur DeliveriesModule
// (charger la livraison + statut), ProfilesModule (résoudre le livreur),
// UsersModule (nom d'affichage) et NotificationsModule (alerter l'autre).
@Module({
  imports: [
    TypeOrmModule.forFeature([Message]),
    DeliveriesModule,
    ProfilesModule,
    UsersModule,
    NotificationsModule,
  ],
  controllers: [MessagesController],
  providers: [MessagesService],
  exports: [MessagesService],
})
export class MessagingModule {}
