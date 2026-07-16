import { ABIDJAN_CENTER, YANDEX_API_KEY } from '../config';
import { PlaceSuggestion, ReverseAddress } from './mapbox';

// Connecteur Yandex Geocoder (spec §9 / P2) — fournisseur alternatif branché
// dans AddressSearchService.
//
// ⚠️ ACTIVATION : nécessite une clé API Yandex (console développeur Yandex,
// service « Geocoder API »). La poser dans mobile/.env :
//
//     EXPO_PUBLIC_YANDEX_API_KEY=votre_cle
//
// Sans clé, `isYandexEnabled()` renvoie false et le composite ignore purement et
// simplement ce fournisseur : rien à débrancher, le code reste en place.
// Yandex est ici en SECOND rideau (après Mapbox) : pour le mettre en tête, il
// suffit de changer l'ordre dans services/addressSearch.ts.

const GEOCODE_URL = 'https://geocode-maps.yandex.ru/1.x/';

export function isYandexEnabled(): boolean {
  return YANDEX_API_KEY.length > 0;
}

/* eslint-disable @typescript-eslint/no-explicit-any */

interface YandexGeoObject {
  name?: string;
  description?: string;
  Point?: { pos?: string }; // "lng lat"
  metaDataProperty?: any;
}

function parseGeoObjects(data: any): YandexGeoObject[] {
  const members = data?.response?.GeoObjectCollection?.featureMember ?? [];
  return members
    .map((m: any) => m?.GeoObject)
    .filter((g: any): g is YandexGeoObject => !!g);
}

function parsePoint(g: YandexGeoObject): { lat: number; lng: number } | null {
  const [lngStr, latStr] = (g.Point?.pos ?? '').split(' ');
  const lat = Number(latStr);
  const lng = Number(lngStr);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

// Composants d'adresse Yandex : on extrait quartier (district) et commune
// (locality) pour alimenter le bandeau du sélecteur.
function parseComponents(g: YandexGeoObject): {
  neighborhood: string | null;
  city: string | null;
} {
  const components: { kind?: string; name?: string }[] =
    g.metaDataProperty?.GeocoderMetaData?.Address?.Components ?? [];
  const pick = (kind: string) =>
    components.find((c) => c.kind === kind)?.name ?? null;
  return { neighborhood: pick('district'), city: pick('locality') };
}

export async function yandexSearchPlaces(
  query: string,
): Promise<PlaceSuggestion[]> {
  const q = query.trim();
  if (q.length < 2 || !isYandexEnabled()) return [];
  const url =
    `${GEOCODE_URL}?apikey=${encodeURIComponent(YANDEX_API_KEY)}` +
    `&format=json&results=6&lang=en_US&geocode=${encodeURIComponent(q)}` +
    `&ll=${ABIDJAN_CENTER.longitude},${ABIDJAN_CENTER.latitude}&spn=0.6,0.6`;
  try {
    const res = await fetch(url);
    if (!res.ok) return [];
    const objects = parseGeoObjects(await res.json());
    return objects.flatMap((g, i) => {
      const point = parsePoint(g);
      if (!point) return [];
      const full =
        g.metaDataProperty?.GeocoderMetaData?.text ??
        [g.name, g.description].filter(Boolean).join(', ');
      return [
        {
          id: `yandex-${i}-${point.lat},${point.lng}`,
          name: g.name ?? full,
          address: full,
          latitude: point.lat,
          longitude: point.lng,
        },
      ];
    });
  } catch {
    return [];
  }
}

export async function yandexReverseGeocode(
  latitude: number,
  longitude: number,
  signal?: AbortSignal,
): Promise<ReverseAddress | null> {
  if (!isYandexEnabled()) return null;
  const url =
    `${GEOCODE_URL}?apikey=${encodeURIComponent(YANDEX_API_KEY)}` +
    `&format=json&results=1&lang=en_US&sco=longlat` +
    `&geocode=${longitude},${latitude}`;
  try {
    const res = await fetch(url, { signal });
    if (!res.ok) return null;
    const g = parseGeoObjects(await res.json())[0];
    if (!g) return null;
    const { neighborhood, city } = parseComponents(g);
    const formatted =
      g.metaDataProperty?.GeocoderMetaData?.text ??
      [g.name, g.description].filter(Boolean).join(', ');
    if (!formatted) return null;
    return {
      formattedAddress: formatted,
      main: g.name ?? formatted,
      neighborhood,
      city,
    };
  } catch {
    return null;
  }
}

/* eslint-enable @typescript-eslint/no-explicit-any */
