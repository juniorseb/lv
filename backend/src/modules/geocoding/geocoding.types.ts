// Adresse résolue à partir de coordonnées, dans la forme attendue par le mobile
// (bandeau du sélecteur d'adresse : ligne principale, quartier, commune).
export interface GeocodedAddress {
  formattedAddress: string;
  main: string;
  neighborhood: string | null;
  city: string | null;
}

// Résultat renvoyé au client : l'adresse + le fournisseur qui l'a résolue
// (utile pour le diagnostic et les métriques de couverture).
export interface ReverseGeocodeResult extends GeocodedAddress {
  provider: string;
}

// Un fournisseur de reverse geocoding (Mapbox, Nominatim, base locale plus tard).
// Le service les essaie dans l'ordre déclaré et garde le premier résultat.
export interface ReverseGeocodingProvider {
  readonly name: string;
  // Un fournisseur non configuré (clé manquante, désactivé) est simplement sauté.
  isConfigured(): boolean;
  reverse(latitude: number, longitude: number): Promise<GeocodedAddress | null>;
}
