import AsyncStorage from '@react-native-async-storage/async-storage';

// Suggestions intelligentes (spec §10, P2) : adresses récentes + favoris,
// stockés localement. Proposés à l'ouverture du sélecteur et sous le champ
// d'adresse quand l'utilisateur n'a encore rien tapé.

export interface SavedAddress {
  latitude: number;
  longitude: number;
  formattedAddress: string;
  neighborhood: string | null;
  city: string | null;
  // Horodatage du dernier usage (tri des récentes).
  usedAt: number;
}

const RECENTS_KEY = 'lc_addr_recents';
const FAVORITES_KEY = 'lc_addr_favorites';
const MAX_RECENTS = 8;

// Deux adresses sont « la même » si elles tombent dans la même case de ~10-15 m
// (même arrondi que le cache de geocoding).
function sameSpot(a: SavedAddress, b: SavedAddress): boolean {
  return (
    a.latitude.toFixed(4) === b.latitude.toFixed(4) &&
    a.longitude.toFixed(4) === b.longitude.toFixed(4)
  );
}

async function readList(key: string): Promise<SavedAddress[]> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as SavedAddress[]) : [];
  } catch {
    return [];
  }
}

async function writeList(key: string, list: SavedAddress[]): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(list));
  } catch {
    // Stockage best-effort : ne jamais bloquer une commande pour un favori.
  }
}

export function getRecentAddresses(): Promise<SavedAddress[]> {
  return readList(RECENTS_KEY);
}

export function getFavoriteAddresses(): Promise<SavedAddress[]> {
  return readList(FAVORITES_KEY);
}

// Appelée à chaque adresse confirmée : la remonte en tête et déduplique.
export async function rememberAddress(
  address: Omit<SavedAddress, 'usedAt'>,
): Promise<void> {
  const entry: SavedAddress = { ...address, usedAt: Date.now() };
  const recents = await readList(RECENTS_KEY);
  const next = [entry, ...recents.filter((r) => !sameSpot(r, entry))].slice(
    0,
    MAX_RECENTS,
  );
  await writeList(RECENTS_KEY, next);
}

export async function isFavorite(
  address: Omit<SavedAddress, 'usedAt'>,
): Promise<boolean> {
  const entry: SavedAddress = { ...address, usedAt: 0 };
  const favorites = await readList(FAVORITES_KEY);
  return favorites.some((f) => sameSpot(f, entry));
}

// Bascule favori / non-favori. Renvoie le nouvel état.
export async function toggleFavorite(
  address: Omit<SavedAddress, 'usedAt'>,
): Promise<boolean> {
  const entry: SavedAddress = { ...address, usedAt: Date.now() };
  const favorites = await readList(FAVORITES_KEY);
  const existing = favorites.find((f) => sameSpot(f, entry));
  if (existing) {
    await writeList(
      FAVORITES_KEY,
      favorites.filter((f) => !sameSpot(f, entry)),
    );
    return false;
  }
  await writeList(FAVORITES_KEY, [entry, ...favorites]);
  return true;
}
