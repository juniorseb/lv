import { Controller, Get, Param, ParseUUIDPipe, UseGuards } from '@nestjs/common';

import { AuthenticatedUser } from '../../common/auth/authenticated-user';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { MatchingService } from './matching.service';
import { DriverSearchResult } from './matching.view';

// Moteur de matching côté expéditeur : livreurs disponibles autour d'une
// livraison, par cercle progressif. (Le feed côté livreur est exposé par le
// module drivers sur /drivers/me/missions.)
@Controller('matching')
@UseGuards(JwtAuthGuard)
export class MatchingController {
  constructor(private readonly matching: MatchingService) {}

  // Livreurs disponibles autour du point de récupération de la livraison,
  // avec le compteur « X livreurs disponibles » et le rayon courant.
  @Get('deliveries/:id/drivers')
  getDrivers(
    @CurrentUser() current: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<DriverSearchResult> {
    return this.matching.getDriversForDelivery(id, current.id);
  }
}
