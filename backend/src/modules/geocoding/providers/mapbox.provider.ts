import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { GeocodedAddress, ReverseGeocodingProvider } from '../geocoding.types';
import { fetchJsonWithTimeout } from './http';

const GEOCODE_URL = 'https://api.mapbox.com/geocoding/v5/mapbox.places';
const TIMEOUT_MS = 4000;

interface MapboxContext {
  id?: string;
  text?: string;
}
interface MapboxFeature {
  place_name?: string;
  text?: string;
  context?: MapboxContext[];
}
interface MapboxResponse {
  features?: MapboxFeature[];
}

// Fournisseur principal : Mapbox Geocoding (le même que côté mobile, mais avec
// le jeton serveur — le mobile peut donc s'en remettre entièrement au backend).
@Injectable()
export class MapboxReverseProvider implements ReverseGeocodingProvider {
  readonly name = 'mapbox';

  constructor(private readonly config: ConfigService) {}

  isConfigured(): boolean {
    return !!this.config.get<string>('MAPBOX_ACCESS_TOKEN');
  }

  async reverse(
    latitude: number,
    longitude: number,
  ): Promise<GeocodedAddress | null> {
    const token = this.config.get<string>('MAPBOX_ACCESS_TOKEN');
    if (!token) return null;

    const url =
      `${GEOCODE_URL}/${longitude},${latitude}.json` +
      `?access_token=${encodeURIComponent(token)}&language=fr&limit=1`;

    const data = await fetchJsonWithTimeout<MapboxResponse>(url, TIMEOUT_MS);
    const feature = data?.features?.[0];
    if (!feature?.place_name) return null;

    const context = feature.context ?? [];
    const find = (prefix: string): string | null =>
      context.find((c) => typeof c.id === 'string' && c.id.startsWith(prefix))
        ?.text ?? null;

    return {
      formattedAddress: feature.place_name,
      main: feature.text ?? feature.place_name,
      neighborhood: find('neighborhood') ?? find('locality'),
      city: find('place'),
    };
  }
}
