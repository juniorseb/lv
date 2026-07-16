import { Controller, Get, Query, UseGuards } from '@nestjs/common';

import { AuthenticatedUser } from '../../common/auth/authenticated-user';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { ReverseGeocodeDto } from './dto/reverse-geocode.dto';
import { GeocodingService } from './geocoding.service';
import { ReverseGeocodeResult } from './geocoding.types';

// Résolution d'adresse côté serveur, utilisée par le sélecteur d'adresse du
// mobile en repli de Mapbox (spec §6). Authentifié : le rate-limiting est par
// utilisateur.
@Controller('geocoding')
@UseGuards(JwtAuthGuard)
export class GeocodingController {
  constructor(private readonly geocoding: GeocodingService) {}

  // GET /geocoding/reverse?lat=5.359&lng=-3.986
  // Renvoie { address: null } si aucun fournisseur ne résout le point : le
  // mobile affiche alors les coordonnées brutes plutôt qu'un bandeau vide.
  @Get('reverse')
  async reverse(
    @Query() query: ReverseGeocodeDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ address: ReverseGeocodeResult | null }> {
    const address = await this.geocoding.reverse(query.lat, query.lng, user.id);
    return { address };
  }
}
