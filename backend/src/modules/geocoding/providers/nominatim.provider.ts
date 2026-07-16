import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

import { REDIS_CLIENT } from '../../../common/redis/redis.constants';
import { GeocodedAddress, ReverseGeocodingProvider } from '../geocoding.types';
import { fetchJsonWithTimeout } from './http';

const DEFAULT_BASE_URL = 'https://nominatim.openstreetmap.org';
const TIMEOUT_MS = 5000;
// Politique d'usage de l'instance publique Nominatim : 1 requête/seconde maximum
// et un User-Agent identifiable. Au-delà, l'IP est bloquée.
const MAX_REQUESTS_PER_SECOND = 1;

interface NominatimAddress {
  road?: string;
  pedestrian?: string;
  neighbourhood?: string;
  suburb?: string;
  quarter?: string;
  city_district?: string;
  city?: string;
  town?: string;
  village?: string;
  municipality?: string;
}
interface NominatimResponse {
  display_name?: string;
  name?: string;
  address?: NominatimAddress;
}

// Fournisseur de repli (spec §6) : OSM/Nominatim, appelé UNIQUEMENT depuis le
// backend. L'instance publique n'est pas dimensionnée pour un trafic commercial :
// on la protège par un cache (côté service) et un plafond global 1 req/s partagé
// entre toutes les instances via Redis. Quand le volume le justifiera, pointer
// NOMINATIM_BASE_URL vers une instance auto-hébergée.
@Injectable()
export class NominatimReverseProvider implements ReverseGeocodingProvider {
  readonly name = 'nominatim';
  private readonly logger = new Logger(NominatimReverseProvider.name);

  constructor(
    private readonly config: ConfigService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  isConfigured(): boolean {
    return this.config.get<string>('NOMINATIM_ENABLED') !== 'false';
  }

  async reverse(
    latitude: number,
    longitude: number,
  ): Promise<GeocodedAddress | null> {
    if (!(await this.acquireSlot())) {
      this.logger.warn(
        'Plafond Nominatim atteint (1 req/s) — repli abandonné pour cette requête.',
      );
      return null;
    }

    const base =
      this.config.get<string>('NOMINATIM_BASE_URL') ?? DEFAULT_BASE_URL;
    const url =
      `${base.replace(/\/$/, '')}/reverse` +
      `?format=jsonv2&lat=${latitude}&lon=${longitude}` +
      `&zoom=18&addressdetails=1&accept-language=fr`;

    const data = await fetchJsonWithTimeout<NominatimResponse>(
      url,
      TIMEOUT_MS,
      { 'User-Agent': this.userAgent() },
    );
    if (!data?.display_name) return null;

    const a = data.address ?? {};
    const main =
      data.name ||
      a.road ||
      a.pedestrian ||
      a.neighbourhood ||
      a.suburb ||
      data.display_name;

    return {
      formattedAddress: data.display_name,
      main,
      neighborhood: a.neighbourhood ?? a.quarter ?? a.suburb ?? null,
      city:
        a.city ??
        a.town ??
        a.village ??
        a.municipality ??
        a.city_district ??
        null,
    };
  }

  // Plafond global 1 req/s : compteur Redis par seconde civile, partagé entre
  // instances. Best-effort — si Redis est indisponible, on laisse passer plutôt
  // que de casser le repli (le cache absorbe déjà l'essentiel du trafic).
  private async acquireSlot(): Promise<boolean> {
    const second = Math.floor(Date.now() / 1000);
    const key = `geo:nominatim:rate:${second}`;
    try {
      const count = await this.redis.incr(key);
      if (count === 1) await this.redis.expire(key, 2);
      return count <= MAX_REQUESTS_PER_SECOND;
    } catch {
      return true;
    }
  }

  private userAgent(): string {
    return (
      this.config.get<string>('NOMINATIM_USER_AGENT') ??
      'Livrechap/1.0 (contact@livrechap.ci)'
    );
  }
}
