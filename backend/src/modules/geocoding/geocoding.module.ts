import { Module } from '@nestjs/common';

import { GeocodingController } from './geocoding.controller';
import { GeocodingService } from './geocoding.service';
import { MapboxReverseProvider } from './providers/mapbox.provider';
import { NominatimReverseProvider } from './providers/nominatim.provider';

// Geocoding serveur : Mapbox puis repli OSM/Nominatim, avec cache Redis et
// limitation de débit. Module feuille (aucune dépendance métier), exporte son
// service pour un usage interne futur (enrichissement d'adresses de livraison).
@Module({
  controllers: [GeocodingController],
  providers: [GeocodingService, MapboxReverseProvider, NominatimReverseProvider],
  exports: [GeocodingService],
})
export class GeocodingModule {}
