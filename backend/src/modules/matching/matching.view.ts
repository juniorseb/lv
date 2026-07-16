// Carte de profil livreur présentée au client pendant le matching (mode choix) :
// photo, note, nombre de livraisons, type de véhicule, distance (dossier §4).
export interface DriverCard {
  driverId: string;
  userId: string;
  fullName: string | null;
  selfieUrl: string | null;
  vehicleType: string;
  ratingAverage: number;
  totalDeliveries: number;
  distanceMeters: number;
}

// Résultat d'une recherche par cercle progressif pour une livraison donnée.
// availableCount est la métrique principale affichée au client
// (« 6 livreurs disponibles autour de vous »), recalculée à chaque rayon.
export interface DriverSearchResult {
  radiusKm: number;
  availableCount: number;
  drivers: DriverCard[];
  // Message honnête quand la zone est peu dense (dossier §5), sinon null.
  message: string | null;
}

// Carte de mission présentée au livreur dans son feed (dossier §4).
// Distance d'approche (livreur → récupération) et distance de course
// (récupération → destination) sont affichées séparément.
export interface MissionCard {
  deliveryId: string;
  pickupAddress: string;
  dropoffAddress: string;
  priceFcfa: number;
  packageType: string | null;
  approachMeters: number;
  courseMeters: number;
  createdAt: Date;
  // Fin de la fenêtre de recherche : alimente le décompte qui se vide sur le
  // bouton Accepter. null = pas d'expiration.
  expiresAt: Date | null;
  // Ouverture du palier de CE livreur : la barre part pleine à cet instant et se
  // vide jusqu'à expiresAt. Un livreur du dernier palier voit donc une barre
  // pleine calibrée sur son seul créneau, pas sur la fenêtre globale.
  windowStartedAt: Date | null;
}

// --- Mappers depuis les lignes brutes des requêtes PostGIS ----------------
// node-postgres renvoie NUMERIC en chaîne : on convertit explicitement.

/* eslint-disable @typescript-eslint/no-explicit-any */
export function rowToDriverCard(row: any): DriverCard {
  return {
    driverId: row.driver_id,
    userId: row.user_id,
    fullName: row.full_name ?? null,
    selfieUrl: row.selfie_url ?? null,
    vehicleType: row.vehicle_type,
    ratingAverage: Number(row.rating_average),
    totalDeliveries: Number(row.total_deliveries),
    distanceMeters: Math.round(Number(row.distance_m)),
  };
}

export function rowToMissionCard(row: any): MissionCard {
  return {
    deliveryId: row.id,
    pickupAddress: row.pickup_address,
    dropoffAddress: row.dropoff_address,
    priceFcfa: Number(row.price_fcfa),
    packageType: row.package_type ?? null,
    approachMeters: Math.round(Number(row.approach_m)),
    courseMeters: Math.round(Number(row.course_m)),
    createdAt: row.created_at,
    expiresAt: row.expires_at ?? null,
    windowStartedAt: row.window_started_at ?? null,
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */
