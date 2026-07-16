import { reverseGeocodeViaBackend } from '../api/geocoding';
import {
  PlaceSuggestion,
  ReverseAddress,
  reverseGeocodeDetailed,
  searchPlaces,
} from '../api/mapbox';
import {
  isYandexEnabled,
  yandexReverseGeocode,
  yandexSearchPlaces,
} from '../api/yandex';
import { readGeocodeCache, writeGeocodeCache } from './geocodeCache';

// Abstraction de recherche/résolution d'adresse (spec §9).
// L'UI ne dépend jamais d'un fournisseur en dur : elle passe par ce service.
//
// Chaîne effective :
//   suggest : Mapbox → Yandex (si clé) → []
//   reverse : cache local → Mapbox → Yandex (si clé) → backend Livrechap
//             (qui porte lui-même le repli OSM/Nominatim, son cache et son
//              rate-limiting — jamais d'appel Nominatim direct depuis le mobile)
//
// Ajouter un fournisseur = ajouter une entrée dans les tableaux ci-dessous.
// Objectif long terme (spec §9) : placer la base d'adresses Livrechap en tête.
export interface AddressSearchService {
  suggest(query: string): Promise<PlaceSuggestion[]>;
  reverse(
    latitude: number,
    longitude: number,
    signal?: AbortSignal,
  ): Promise<ReverseAddress | null>;
}

interface SuggestProvider {
  name: string;
  enabled(): boolean;
  suggest(query: string): Promise<PlaceSuggestion[]>;
}

interface ReverseProvider {
  name: string;
  enabled(): boolean;
  reverse(
    latitude: number,
    longitude: number,
    signal?: AbortSignal,
  ): Promise<ReverseAddress | null>;
}

const suggestProviders: SuggestProvider[] = [
  { name: 'mapbox', enabled: () => true, suggest: (q) => searchPlaces(q) },
  { name: 'yandex', enabled: isYandexEnabled, suggest: yandexSearchPlaces },
];

const reverseProviders: ReverseProvider[] = [
  {
    name: 'mapbox',
    enabled: () => true,
    reverse: (lat, lng, signal) => reverseGeocodeDetailed(lat, lng, signal),
  },
  { name: 'yandex', enabled: isYandexEnabled, reverse: yandexReverseGeocode },
  {
    name: 'livrechap-backend',
    enabled: () => true,
    reverse: (lat, lng, signal) => reverseGeocodeViaBackend(lat, lng, signal),
  },
];

const compositeProvider: AddressSearchService = {
  async suggest(query) {
    for (const provider of suggestProviders) {
      if (!provider.enabled()) continue;
      const results = await provider.suggest(query);
      if (results.length > 0) return results;
    }
    return [];
  },

  async reverse(latitude, longitude, signal) {
    const cached = await readGeocodeCache(latitude, longitude);
    if (cached) return cached;

    for (const provider of reverseProviders) {
      if (!provider.enabled()) continue;
      const address = await provider.reverse(latitude, longitude, signal);
      if (signal?.aborted) return null;
      if (address) {
        void writeGeocodeCache(latitude, longitude, address);
        return address;
      }
    }
    return null;
  },
};

export const addressSearch: AddressSearchService = compositeProvider;
