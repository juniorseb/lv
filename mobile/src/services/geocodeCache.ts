import AsyncStorage from '@react-native-async-storage/async-storage';

import { ReverseAddress } from '../api/mapbox';

// Cache local des adresses résolues (spec §6).
// Clé : latitude/longitude arrondies à 4 décimales (~10-15 m) — deux points
// voisins dans le même bâtiment partagent le même résultat, ce qui évite un
// appel réseau à chaque micro-déplacement de la carte.
//
// Deux niveaux : une Map en mémoire (instantanée, pour le glissement de carte)
// adossée à AsyncStorage (survit au redémarrage de l'app).

const PREFIX = 'lc_geo_rev:';
const MEMORY_MAX_ENTRIES = 300;

const memory = new Map<string, ReverseAddress>();

export function geocodeCacheKey(latitude: number, longitude: number): string {
  return `${latitude.toFixed(4)}:${longitude.toFixed(4)}`;
}

export async function readGeocodeCache(
  latitude: number,
  longitude: number,
): Promise<ReverseAddress | null> {
  const key = geocodeCacheKey(latitude, longitude);
  const hit = memory.get(key);
  if (hit) return hit;
  try {
    const raw = await AsyncStorage.getItem(PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ReverseAddress;
    memory.set(key, parsed);
    return parsed;
  } catch {
    return null;
  }
}

export async function writeGeocodeCache(
  latitude: number,
  longitude: number,
  address: ReverseAddress,
): Promise<void> {
  const key = geocodeCacheKey(latitude, longitude);
  if (memory.size >= MEMORY_MAX_ENTRIES) {
    // Éviction FIFO simple : la persistance AsyncStorage reste la source longue.
    const oldest = memory.keys().next().value;
    if (oldest) memory.delete(oldest);
  }
  memory.set(key, address);
  try {
    await AsyncStorage.setItem(PREFIX + key, JSON.stringify(address));
  } catch {
    // Cache best-effort : un échec d'écriture ne doit rien casser.
  }
}
