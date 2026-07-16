import * as Location from 'expo-location';

import { LatLng } from '../api/types';

// Distance à vol d'oiseau entre deux points, en mètres (formule de haversine).
// Sert de repli quand aucun itinéraire routier n'est disponible (ex. pour savoir
// si le livreur approche du point de livraison).
export function distanceMeters(a: LatLng, b: LatLng): number {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.latitude)) *
      Math.cos(toRad(b.latitude)) *
      Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// Récupère la position courante de l'appareil après demande d'autorisation.
// Renvoie null si l'autorisation est refusée ou la position indisponible.
export async function getCurrentCoords(): Promise<LatLng | null> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      return null;
    }
    const position = await Location.getCurrentPositionAsync({});
    return {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
    };
  } catch {
    return null;
  }
}
