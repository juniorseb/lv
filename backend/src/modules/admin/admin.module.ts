import { Module } from '@nestjs/common';

import { MessagingModule } from '../messaging/messaging.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ProfilesModule } from '../profiles/profiles.module';
import { SosModule } from '../sos/sos.module';
import { UsersModule } from '../users/users.module';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

// Back-office : validation CNI (Niveau 2), validation des livreurs, statistiques.
// S'appuie sur UsersService et DriverProfilesService pour les mutations de
// comptes, NotificationsService pour prévenir le livreur de sa validation.
// L'accès est restreint aux administrateurs via AdminGuard (posé sur le contrôleur).
@Module({
  imports: [
    UsersModule,
    ProfilesModule,
    NotificationsModule,
    MessagingModule,
    SosModule,
  ],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
