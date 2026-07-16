import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Redis } from 'ioredis';

import { REDIS_CLIENT } from '../../common/redis/redis.constants';

// Cache de présence des livreurs disponibles, indexé géographiquement (Redis GEO).
// Sert de chemin rapide pour le compteur live « X livreurs disponibles autour de
// vous », recalculé fréquemment pendant l'animation de recherche (dossier §4/§5).
//
// La source de vérité reste PostGIS (driver_profiles.current_location) : ce cache
// est best-effort. En cas d'échec Redis, l'appelant retombe sur le comptage
// PostGIS — le produit ne dépend jamais du cache pour rester correct.
//
// Limite connue : un livreur qui cesse d'émettre sans se déclarer indisponible
// reste dans l'index (pas de TTL par membre sur un GEO set). Le rafraîchissement
// périodique de position et le passage explicite en « indisponible » couvrent le
// cas nominal ; un nettoyage des positions périmées pourra être ajouté plus tard.
@Injectable()
export class DriverPresenceCache {
  private readonly logger = new Logger(DriverPresenceCache.name);
  private readonly key = 'drivers:available:geo';

  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  // Ajoute / met à jour la position d'un livreur disponible.
  async setAvailable(
    driverId: string,
    latitude: number,
    longitude: number,
  ): Promise<void> {
    try {
      await this.redis.geoadd(this.key, longitude, latitude, driverId);
    } catch (error) {
      this.logger.warn(`GEOADD présence livreur échoué (${driverId}): ${error}`);
    }
  }

  // Retire un livreur de l'index (passage en indisponible).
  async remove(driverId: string): Promise<void> {
    try {
      await this.redis.zrem(this.key, driverId);
    } catch (error) {
      this.logger.warn(`ZREM présence livreur échoué (${driverId}): ${error}`);
    }
  }

  // Nombre de livreurs disponibles dans un rayon (mètres) autour d'un point.
  // Renvoie null si le cache est indisponible → l'appelant bascule sur PostGIS.
  async countWithin(
    latitude: number,
    longitude: number,
    radiusMeters: number,
  ): Promise<number | null> {
    try {
      const members = await this.redis.geosearch(
        this.key,
        'FROMLONLAT',
        longitude,
        latitude,
        'BYRADIUS',
        radiusMeters,
        'm',
      );
      return Array.isArray(members) ? members.length : 0;
    } catch (error) {
      this.logger.warn(`GEOSEARCH présence livreur échoué: ${error}`);
      return null;
    }
  }
}
