import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';

import { AuthenticatedUser } from '../../common/auth/authenticated-user';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { SosLocationDto, TriggerSosDto } from './dto/sos.dto';
import { SosService } from './sos.service';
import { SosAlertView } from './sos.view';

// Livrechap Protect (côté utilisateur : client ou livreur).
@Controller('sos')
@UseGuards(JwtAuthGuard)
export class SosController {
  constructor(private readonly sos: SosService) {}

  // Déclenchement (appui long 3 s côté app).
  @Post()
  trigger(
    @CurrentUser() current: AuthenticatedUser,
    @Body() dto: TriggerSosDto,
  ): Promise<SosAlertView> {
    return this.sos.trigger(current.id, dto);
  }

  // Partage GPS temps réel pendant l'alerte.
  @Post('location')
  @HttpCode(HttpStatus.OK)
  updateLocation(
    @CurrentUser() current: AuthenticatedUser,
    @Body() dto: SosLocationDto,
  ): Promise<void> {
    return this.sos.updateLocation(current.id, dto.latitude, dto.longitude);
  }

  // « Je suis en sécurité » — clôture de sa propre alerte.
  @Post('resolve')
  @HttpCode(HttpStatus.OK)
  resolve(@CurrentUser() current: AuthenticatedUser): Promise<void> {
    return this.sos.resolveByUser(current.id);
  }

  // Alerte active de l'utilisateur (pour rétablir l'état à l'ouverture).
  @Get('me')
  myActive(
    @CurrentUser() current: AuthenticatedUser,
  ): Promise<SosAlertView | null> {
    return this.sos.getMyActive(current.id);
  }
}
