export interface AdminUser {
  id: string;
  phoneNumber: string;
  phoneVerified: boolean;
  accountType: string;
  fullName: string | null;
  commune: string | null;
  verificationLevel: string;
  hasSelfie: boolean;
  isActive: boolean;
  isAdmin: boolean;
}

export interface PendingUser {
  id: string;
  phoneNumber: string;
  fullName: string | null;
  commune: string | null;
  accountType: string;
  verificationLevel: string;
  selfieUrl: string | null;
  idDocumentUrl: string | null;
  idDocumentType: string | null;
  createdAt: string;
}

export type DriverStatus = 'en_validation' | 'actif' | 'suspendu';

export type DocumentStatus = 'en_attente' | 'valide' | 'rejete';

export interface AdminDriverDocument {
  id: string;
  type: string;
  url: string;
  status: DocumentStatus;
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

export interface AdminDriver {
  driverId: string;
  userId: string;
  fullName: string | null;
  phoneNumber: string;
  vehicleType: string;
  status: DriverStatus;
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
  createdAt: string;
}

// Alerte Livrechap Protect (SOS) vue par le support.
export interface AdminSosAlert {
  id: string;
  status: string;
  role: string;
  userName: string | null;
  userPhone: string;
  deliveryId: string | null;
  latitude: number;
  longitude: number;
  locationUpdatedAt: string | null;
  createdAt: string;
}

export interface AdminStats {
  users: number;
  drivers: number;
  commerces: number;
  deliveries: {
    total: number;
    recherche: number;
    enCours: number;
    terminee: number;
    annulee: number;
    expiree: number;
  };
  pendingVerifications: number;
  pendingDrivers: number;
}
