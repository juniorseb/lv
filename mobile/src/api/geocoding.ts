import { ReverseAddress } from './mapbox';
import { authedRequest } from './http';

interface ReverseResponse {
  address:
    | (ReverseAddress & {
        provider: string;
      })
    | null;
}

// Reverse geocoding par le backend Livrechap (GET /geocoding/reverse).
// C'est LUI qui porte le repli OSM/Nominatim, son cache et son rate-limiting :
// le mobile ne doit jamais appeler Nominatim en direct (spec §6).
export async function reverseGeocodeViaBackend(
  latitude: number,
  longitude: number,
  signal?: AbortSignal,
): Promise<ReverseAddress | null> {
  try {
    const res = await authedRequest<ReverseResponse>(
      `/geocoding/reverse?lat=${latitude}&lng=${longitude}`,
      { signal },
    );
    return res.address;
  } catch {
    // Hors ligne, 429, non authentifié : pas de repli, l'appelant affichera les
    // coordonnées brutes.
    return null;
  }
}
