import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

// Politique de plafonnement des modes doux (vélo / à pied) — SOURCE UNIQUE
// partagée entre le matching (filtrage du feed + de la liste client) et la garde
// dure à l'acceptation, pour qu'ils ne divergent jamais.
//
// Deux limites par mode, 0 = aucune :
//  • approche : distance livreur → point de récupération ;
//  • course : distance récupération → destination.
@Injectable()
export class VehicleCapsService {
  readonly veloMaxKm: number;
  readonly apiedMaxKm: number;
  readonly veloCourseMaxKm: number;
  readonly apiedCourseMaxKm: number;

  constructor(config: ConfigService) {
    this.veloMaxKm = Number(config.get('MATCHING_VELO_MAX_RADIUS_KM')) || 3;
    this.apiedMaxKm = Number(config.get('MATCHING_APIED_MAX_RADIUS_KM')) || 2;
    this.veloCourseMaxKm =
      Number(config.get('MATCHING_VELO_MAX_COURSE_KM')) || 4;
    this.apiedCourseMaxKm =
      Number(config.get('MATCHING_APIED_MAX_COURSE_KM')) || 3;
  }

  // Plafond de rayon d'approche (km) propre à un type de véhicule, ou null.
  approachCapKm(vehicleType: string): number | null {
    if (vehicleType === 'velo') return this.veloMaxKm || null;
    if (vehicleType === 'a_pied') return this.apiedMaxKm || null;
    return null;
  }

  // Plafond de distance de course (km) propre à un type de véhicule, ou null.
  courseCapKm(vehicleType: string): number | null {
    if (vehicleType === 'velo') return this.veloCourseMaxKm || null;
    if (vehicleType === 'a_pied') return this.apiedCourseMaxKm || null;
    return null;
  }

  // Libellé lisible du mode doux (pour messages d'erreur).
  softLabel(vehicleType: string): string {
    if (vehicleType === 'velo') return 'à vélo';
    if (vehicleType === 'a_pied') return 'à pied';
    return '';
  }

  // Distance à vol d'oiseau entre deux points [lng, lat], en mètres (haversine,
  // sphère) — suffisant pour un simple seuil de plafonnement.
  distanceMeters(a: number[], b: number[]): number {
    const [lng1, lat1] = a;
    const [lng2, lat2] = b;
    const R = 6371000;
    const toRad = (d: number) => (d * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const h =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  }

  // Plafond d'approche EFFECTIF (mètres) par type doux pour une course donnée :
  // si la course dépasse le plafond de course du mode, on renvoie 0 → le mode est
  // totalement exclu de cette livraison (ST_DWithin(…, 0)). Utilisé par le
  // matching côté recherche client.
  effectiveApproachCapsM(courseMeters: number): { velo: number; apied: number } {
    const velo =
      this.veloCourseMaxKm && courseMeters > this.veloCourseMaxKm * 1000
        ? 0
        : this.veloMaxKm * 1000;
    const apied =
      this.apiedCourseMaxKm && courseMeters > this.apiedCourseMaxKm * 1000
        ? 0
        : this.apiedMaxKm * 1000;
    return { velo, apied };
  }

  // Garde dure à l'acceptation : renvoie un message d'erreur si la livraison
  // dépasse un plafond du mode doux, sinon null. Le plafond de course est
  // toujours vérifié ; l'approche seulement si la position du livreur est connue.
  violationForAccept(
    vehicleType: string,
    driverLocation: number[] | null,
    pickup: number[],
    dropoff: number[],
  ): string | null {
    const courseCapKm = this.courseCapKm(vehicleType);
    if (courseCapKm === null) return null; // mode non plafonné

    const label = this.softLabel(vehicleType);
    const courseKm = this.distanceMeters(pickup, dropoff) / 1000;
    if (courseKm > courseCapKm) {
      return `Course trop longue pour une livraison ${label} : ${courseKm.toFixed(1)} km (max ${courseCapKm} km).`;
    }

    const approachCapKm = this.approachCapKm(vehicleType);
    if (approachCapKm !== null && driverLocation) {
      const approachKm = this.distanceMeters(driverLocation, pickup) / 1000;
      if (approachKm > approachCapKm) {
        return `Point de récupération trop loin pour une livraison ${label} : ${approachKm.toFixed(1)} km (max ${approachCapKm} km).`;
      }
    }
    return null;
  }
}
