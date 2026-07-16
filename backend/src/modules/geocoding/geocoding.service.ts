import {
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

import { REDIS_CLIENT } from '../../common/redis/redis.constants';
import { ReverseGeocodeResult, ReverseGeocodingProvider } from './geocoding.types';
import { MapboxReverseProvider } from './providers/mapbox.provider';
import { NominatimReverseProvider } from './providers/nominatim.provider';

const DEFAULT_CACHE_TTL_SECONDS = 30 * 24 * 3600; // 30 jours
const DEFAULT_RATE_LIMIT_PER_MINUTE = 60;

// Reverse geocoding côté serveur (spec §6) : chaîne de fournisseurs
// Mapbox → Nominatim, avec cache Redis et limitation de débit par utilisateur.
// Le mobile n'appelle JAMAIS Nominatim directement — c'est ce service qui porte
// le repli, son cache et son rate-limiting.
@Injectable()
export class GeocodingService {
  private readonly logger = new Logger(GeocodingService.name);
  private readonly providers: ReverseGeocodingProvider[];

  constructor(
    private readonly config: ConfigService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    mapbox: MapboxReverseProvider,
    nominatim: NominatimReverseProvider,
  ) {
    // Ordre = priorité. Ajouter ici un futur fournisseur (base d'adresses
    // Livrechap, Yandex…) sans toucher au contrôleur ni au mobile.
    this.providers = [mapbox, nominatim];
  }

  async reverse(
    latitude: number,
    longitude: number,
    userId: string,
  ): Promise<ReverseGeocodeResult | null> {
    await this.enforceRateLimit(userId);

    const key = cacheKey(latitude, longitude);
    const cached = await this.readCache(key);
    if (cached) return cached;

    for (const provider of this.providers) {
      if (!provider.isConfigured()) continue;
      const address = await provider.reverse(latitude, longitude);
      if (address) {
        const result: ReverseGeocodeResult = {
          ...address,
          provider: provider.name,
        };
        await this.writeCache(key, result);
        return result;
      }
      this.logger.debug(
        `Aucun résultat de ${provider.name} pour ${latitude},${longitude} — fournisseur suivant.`,
      );
    }

    // Aucun fournisseur n'a résolu le point : le mobile affichera les
    // coordonnées brutes (spec §7, « jamais de bandeau vide »).
    return null;
  }

  // Limite de débit par utilisateur, fenêtre d'une minute. Protège les quotas
  // Mapbox et l'instance Nominatim d'un client mobile qui boucherait.
  private async enforceRateLimit(userId: string): Promise<void> {
    const limit =
      Number(this.config.get<string>('GEOCODING_RATE_LIMIT_PER_MINUTE')) ||
      DEFAULT_RATE_LIMIT_PER_MINUTE;
    const minute = Math.floor(Date.now() / 60000);
    const key = `geo:rl:${userId}:${minute}`;
    let count: number;
    try {
      count = await this.redis.incr(key);
      if (count === 1) await this.redis.expire(key, 120);
    } catch {
      // Redis indisponible : on n'empêche pas l'utilisateur de commander.
      return;
    }
    if (count > limit) {
      throw new HttpException(
        'Trop de requêtes de localisation. Réessayez dans une minute.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  private async readCache(key: string): Promise<ReverseGeocodeResult | null> {
    try {
      const raw = await this.redis.get(key);
      return raw ? (JSON.parse(raw) as ReverseGeocodeResult) : null;
    } catch {
      return null;
    }
  }

  private async writeCache(
    key: string,
    result: ReverseGeocodeResult,
  ): Promise<void> {
    const ttl =
      Number(this.config.get<string>('GEOCODING_CACHE_TTL_SECONDS')) ||
      DEFAULT_CACHE_TTL_SECONDS;
    try {
      await this.redis.set(key, JSON.stringify(result), 'EX', ttl);
    } catch {
      // Cache best-effort.
    }
  }
}

// Clé de cache arrondie à 4 décimales (~10-15 m, spec §6) : deux points voisins
// dans un même bâtiment partagent la même adresse résolue.
export function cacheKey(latitude: number, longitude: number): string {
  return `geo:rev:${latitude.toFixed(4)}:${longitude.toFixed(4)}`;
}
