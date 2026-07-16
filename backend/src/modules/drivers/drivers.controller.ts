import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';

import { AuthenticatedUser } from '../../common/auth/authenticated-user';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { MatchingService } from '../matching/matching.service';
import { MissionCard } from '../matching/matching.view';
import {
  DriverProfileView,
  DriverPublicView,
  toDriverProfileView,
} from '../profiles/profile.view';
import { DriversService } from './drivers.service';
import { SetAvailabilityDto } from './dto/set-availability.dto';
import { UpdateLocationDto } from './dto/update-location.dto';

// Espace livreur : disponibilité, position et feed de missions proches.
// Nécessite un profil livreur (créé via POST /profiles/driver).
@Controller('drivers')
@UseGuards(JwtAuthGuard)
export class DriversController {
  constructor(
    private readonly drivers: DriversService,
    private readonly matching: MatchingService,
  ) {}

  // Mode 🟢 Disponible / Indisponible.
  @Post('me/availability')
  @HttpCode(HttpStatus.OK)
  async setAvailability(
    @CurrentUser() current: AuthenticatedUser,
    @Body() dto: SetAvailabilityDto,
  ): Promise<DriverProfileView> {
    const profile = await this.drivers.setAvailability(current.id, dto);
    return toDriverProfileView(profile);
  }

  // Actualisation périodique de la position.
  @Post('me/location')
  @HttpCode(HttpStatus.OK)
  async updateLocation(
    @CurrentUser() current: AuthenticatedUser,
    @Body() dto: UpdateLocationDto,
  ): Promise<DriverProfileView> {
    const profile = await this.drivers.updateLocation(current.id, dto);
    return toDriverProfileView(profile);
  }

  // Feed des missions ouvertes proches, triées par distance d'approche.
  @Get('me/missions')
  getMissions(
    @CurrentUser() current: AuthenticatedUser,
  ): Promise<MissionCard[]> {
    return this.matching.getFeedForDriver(current.id);
  }

  // Profil public d'un livreur (P2), consultable par tout compte connecté.
  // Placé après `me/...` pour ne pas capturer ces routes.
  @Get(':id/public')
  getPublicProfile(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<DriverPublicView> {
    return this.drivers.getPublicProfile(id);
  }
}
