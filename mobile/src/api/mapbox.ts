import { ABIDJAN_CENTER, MAPBOX_TOKEN } from '../config';
import { LatLng } from './types';

const GEOCODE = 'https://api.mapbox.com/geocoding/v5/mapbox.places';
const DIRECTIONS = 'https://api.mapbox.com/directions/v5/mapbox/driving';

export interface PlaceSuggestion {
  id: string;
  name: string; // libellé court
  address: string; // libellé complet
  latitude: number;
  longitude: number;
}

/* eslint-disable @typescript-eslint/no-explicit-any */

// Autocomplétion d'adresses, biaisée sur Abidjan / Côte d'Ivoire.
export async function searchPlaces(query: string): Promise<PlaceSuggestion[]> {
  const q = query.trim();
  if (q.length < 2 || !MAPBOX_TOKEN) {
    return [];
  }
  const url =
    `${GEOCODE}/${encodeURIComponent(q)}.json` +
    `?access_token=${MAPBOX_TOKEN}` +
    `&autocomplete=true&limit=6&language=fr&country=ci` +
    `&proximity=${ABIDJAN_CENTER.longitude},${ABIDJAN_CENTER.latitude}`;
  try {
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    return (data.features ?? []).map((f: any) => ({
      id: f.id,
      name: f.text,
      address: f.place_name,
      longitude: f.center[0],
      latitude: f.center[1],
    }));
  } catch {
    return [];
  }
}

// Coordonnées → adresse lisible (pour « Ma position » et le point choisi sur carte).
export async function reverseGeocode(
  latitude: number,
  longitude: number,
): Promise<string | null> {
  const detailed = await reverseGeocodeDetailed(latitude, longitude);
  return detailed?.formattedAddress ?? null;
}

export interface ReverseAddress {
  formattedAddress: string;
  main: string; // rue / lieu le plus pertinent
  neighborhood: string | null; // quartier
  city: string | null; // commune / ville
}

// Reverse geocoding structuré (rue → quartier → commune), avec support de
// l'annulation (AbortSignal) pour ignorer les réponses obsolètes pendant que la
// carte bouge encore (spec §6).
export async function reverseGeocodeDetailed(
  latitude: number,
  longitude: number,
  signal?: AbortSignal,
): Promise<ReverseAddress | null> {
  if (!MAPBOX_TOKEN) return null;
  const url =
    `${GEOCODE}/${longitude},${latitude}.json` +
    `?access_token=${MAPBOX_TOKEN}&language=fr&limit=1`;
  try {
    const res = await fetch(url, { signal });
    if (!res.ok) return null;
    const data = await res.json();
    const f = data.features?.[0];
    if (!f) return null;
    const ctx: { id?: string; text?: string }[] = f.context ?? [];
    const find = (prefix: string) =>
      ctx.find((c) => typeof c.id === 'string' && c.id.startsWith(prefix))
        ?.text ?? null;
    return {
      formattedAddress: f.place_name,
      main: f.text ?? f.place_name,
      neighborhood: find('neighborhood') ?? find('locality'),
      city: find('place'),
    };
  } catch {
    return null;
  }
}

export interface RouteResult {
  durationSeconds: number;
  distanceMeters: number;
  // GeoJSON LineString [lng, lat][]
  coordinates: [number, number][];
}

// Itinéraire routier entre deux points : géométrie (tracé) + durée (ETA).
export async function getRoute(
  from: LatLng,
  to: LatLng,
): Promise<RouteResult | null> {
  if (!MAPBOX_TOKEN) return null;
  const coords = `${from.longitude},${from.latitude};${to.longitude},${to.latitude}`;
  const url =
    `${DIRECTIONS}/${coords}` +
    `?access_token=${MAPBOX_TOKEN}&geometries=geojson&overview=full`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    const route = data.routes?.[0];
    if (!route) return null;
    return {
      durationSeconds: route.duration,
      distanceMeters: route.distance,
      coordinates: route.geometry.coordinates,
    };
  } catch {
    return null;
  }
}

/* eslint-enable @typescript-eslint/no-explicit-any */

// Formatte une durée en minutes lisibles (« 8 min », « 1 h 05 »).
export function formatEta(seconds: number): string {
  const min = Math.max(1, Math.round(seconds / 60));
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h} h` : `${h} h ${String(m).padStart(2, '0')}`;
}
