import {
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';

import { AuthenticatedUser } from '../../common/auth/authenticated-user';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { RegisterDeviceDto } from './dto/register-device.dto';
import { NotificationsService } from './notifications.service';

// Gestion des appareils recevant les notifications push de l'utilisateur connecté.
@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  // Enregistre le jeton FCM de l'appareil (à l'ouverture de session mobile).
  @Post('devices')
  @HttpCode(HttpStatus.NO_CONTENT)
  async register(
    @CurrentUser() current: AuthenticatedUser,
    @Body() dto: RegisterDeviceDto,
  ): Promise<void> {
    await this.notifications.registerDevice(
      current.id,
      dto.token,
      dto.platform ?? 'android',
    );
  }

  // Retire le jeton (déconnexion / désactivation des notifications).
  @Delete('devices')
  @HttpCode(HttpStatus.NO_CONTENT)
  async unregister(
    @CurrentUser() current: AuthenticatedUser,
    @Body() dto: RegisterDeviceDto,
  ): Promise<void> {
    await this.notifications.unregisterDevice(current.id, dto.token);
  }
}
