// URL de base de l'API Livrechap.
//
// En développement avec Expo Go sur un vrai téléphone, "localhost" pointe vers
// le téléphone, pas vers votre machine : définissez EXPO_PUBLIC_API_URL sur
// l'IP LAN de votre machine (ex: http://192.168.1.10:3000) dans un fichier .env
// à la racine du dossier mobile, ou via la variable d'environnement.
export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

// Token public Mapbox (pk.*) pour la cartographie, l'autocomplétion d'adresses
// et le calcul d'itinéraire (dossier §10). Défini dans mobile/.env.
export const MAPBOX_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_TOKEN ?? '';

// Clé Yandex Geocoder (fournisseur alternatif, spec §9). Optionnelle : sans
// clé, le connecteur Yandex reste inactif et la chaîne se limite à Mapbox puis
// au backend Livrechap. À poser dans mobile/.env : EXPO_PUBLIC_YANDEX_API_KEY.
export const YANDEX_API_KEY = process.env.EXPO_PUBLIC_YANDEX_API_KEY ?? '';

// Centre d'Abidjan, utilisé pour biaiser l'autocomplétion et centrer les cartes.
export const ABIDJAN_CENTER = { latitude: 5.3599, longitude: -4.0083 };
