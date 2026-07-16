// Représentation d'un point géographique compatible PostGIS via TypeORM.
// TypeORM sérialise/désérialise les colonnes geography(Point,4326) en GeoJSON.
// Attention à l'ordre : GeoJSON attend [longitude, latitude].
export interface GeoPoint {
  type: 'Point';
  coordinates: [number, number]; // [longitude, latitude]
}

export function toGeoPoint(latitude: number, longitude: number): GeoPoint {
  return { type: 'Point', coordinates: [longitude, latitude] };
}

export function geoPointLatitude(point: GeoPoint): number {
  return point.coordinates[1];
}

export function geoPointLongitude(point: GeoPoint): number {
  return point.coordinates[0];
}
