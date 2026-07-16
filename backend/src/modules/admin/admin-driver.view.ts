// Vue livreur pour le back-office : profil livreur enrichi des infos du compte
// (nom, téléphone, niveau de vérification), pour l'écran de validation admin
// (spec-onboarding-livreur-v2 §4).
export interface AdminDriverDocument {
  id: string;
  type: string;
  url: string;
  status: string;
  dateExpiration: string | null;
}

export interface AdminVehicle {
  vehicleType: string;
  marque: string | null;
  modele: string | null;
  annee: number | null;
  couleur: string | null;
  immatriculation: string | null;
  photoAvantUrl: string | null;
  photoArriereUrl: string | null;
  photoPlaqueUrl: string | null;
}

export interface AdminDriverView {
  driverId: string;
  userId: string;
  fullName: string | null;
  phoneNumber: string;
  vehicleType: string;
  status: string;
  zones: string[];
  mobileMoneyOperator: string | null;
  mobileMoneyNumber: string | null;
  mobileMoneyHolder: string | null;
  verificationLevel: string;
  idDocumentUrl: string | null;
  idDocumentType: string | null;
  selfieUrl: string | null;
  documents: AdminDriverDocument[];
  vehicle: AdminVehicle | null;
  totalDeliveries: number;
  ratingAverage: number;
  createdAt: Date;
}

// Ligne brute renvoyée par la requête SQL du back-office.
export interface AdminDriverRow {
  driver_id: string;
  user_id: string;
  full_name: string | null;
  phone_number: string;
  vehicle_type: string;
  status: string;
  zones: string | null;
  mobile_money_operator: string | null;
  mobile_money_number: string | null;
  mobile_money_holder: string | null;
  verification_level: string;
  id_document_url: string | null;
  id_document_type: string | null;
  selfie_url: string | null;
  documents: AdminDriverDocument[] | null;
  vehicle: AdminVehicle | null;
  total_deliveries: number;
  rating_average: string | number;
  created_at: Date;
}

export function toAdminDriverView(row: AdminDriverRow): AdminDriverView {
  return {
    driverId: row.driver_id,
    userId: row.user_id,
    fullName: row.full_name,
    phoneNumber: row.phone_number,
    vehicleType: row.vehicle_type,
    status: row.status,
    zones: row.zones
      ? row.zones.split(',').map((z) => z.trim()).filter(Boolean)
      : [],
    mobileMoneyOperator: row.mobile_money_operator,
    mobileMoneyNumber: row.mobile_money_number,
    mobileMoneyHolder: row.mobile_money_holder,
    verificationLevel: row.verification_level,
    idDocumentUrl: row.id_document_url,
    idDocumentType: row.id_document_type,
    selfieUrl: row.selfie_url,
    documents: row.documents ?? [],
    vehicle: row.vehicle ?? null,
    totalDeliveries: Number(row.total_deliveries),
    ratingAverage: Number(row.rating_average),
    createdAt: row.created_at,
  };
}
