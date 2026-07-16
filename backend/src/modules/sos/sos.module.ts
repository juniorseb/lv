import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthModule } from '../auth/auth.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { UsersModule } from '../users/users.module';
import { SosAlert } from './entities/sos-alert.entity';
import { SosController } from './sos.controller';
import { SosService } from './sos.service';

// Livrechap Protect. S'appuie sur UsersModule (support + contact d'urgence),
// NotificationsModule (alerte support) et AuthModule (SmsService, alerte SMS).
@Module({
  imports: [
    TypeOrmModule.forFeature([SosAlert]),
    UsersModule,
    NotificationsModule,
    AuthModule,
  ],
  controllers: [SosController],
  providers: [SosService],
  exports: [SosService],
})
export class SosModule {}
