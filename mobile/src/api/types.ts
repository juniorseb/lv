// Types partagés reflétant les vues publiques renvoyées par l'API Livrechap.

export type AccountType = 'particulier' | 'commerce';

export type IdDocumentType = 'cni' | 'passeport';

export type UserRole = 'client' | 'livreur';

export interface User {
  id: string;
  phoneNumber: string;
  phoneVerified: boolean;
  accountType: AccountType;
  fullName: string | null;
  commune: string | null;
  email: string | null;
  dateNaissance: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  verificationLevel: string;
  hasSelfie: boolean;
  hasIdDocument: boolean;
  idDocumentType: string | null;
  isActive: boolean;
  isAdmin: boolean;
  isDriver: boolean;
  roles: string[];
  activeRole: UserRole | null;
}

export interface AuthResult {
  accessToken: string;
  refreshToken: string;
  tokenType: 'Bearer';
  user: User;
  isNewUser: boolean;
}

export interface RequestOtpResult {
  phoneNumber: string;
  expiresInSeconds: number;
  message: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  tokenType: 'Bearer';
}

// --- Livraisons ----------------------------------------------------------

export type DeliveryStatus =
  | 'recherche'
  | 'livreur_trouve'
  | 'colis_recupere'
  | 'terminee'
  | 'annulee'
  // Délai de recherche dépassé sans qu'aucun livreur n'accepte. Distinct
  // d'`annulee` : le client peut republier en ajustant son offre.
  | 'expiree';

export type MatchingMode = 'rapide' | 'choix';

export type DeliveryUrgency = 'normal' | 'urgent' | 'express';

export type PackageType =
  | 'documents'
  | 'vetements'
  | 'alimentation'
  | 'petit_colis'
  | 'autre';

export interface LocatedPoint {
  address: string;
  latitude: number;
  longitude: number;
}

export interface Delivery {
  id: string;
  senderId: string;
  driverId: string | null;
  status: DeliveryStatus;
  matchingMode: MatchingMode;
  pickup: LocatedPoint;
  dropoff: LocatedPoint;
  recipientName: string | null;
  recipientPhone: string | null;
  // Contact au point de récupération (celui qui remet le colis) — pas forcément
  // le titulaire du compte : « je commande pour un ami dans une autre commune ».
  pickupContactName: string | null;
  pickupContactPhone: string | null;
  // Repère du livreur pour chaque adresse (ex: « portail orange »).
  pickupNote: string | null;
  dropoffNote: string | null;
  priceFcfa: number;
  packageType: PackageType | null;
  description: string | null;
  photoUrl: string | null;
  searchRadiusKm: number;
  urgency: DeliveryUrgency;
  scheduledAt: string | null;
  isCod: boolean;
  codArticleAmountFcfa: number | null;
  // Fin de la fenêtre de recherche (décompte).
  expiresAt: string | null;
  // Présent uniquement dans la vue de l'expéditeur.
  deliveryCode?: string | null;
  createdAt: string;
  matchedAt: string | null;
  pickedUpAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
}

export interface CreateDeliveryInput {
  pickup: LocatedPoint;
  dropoff: LocatedPoint;
  recipientName?: string;
  recipientPhone?: string;
  pickupContactName?: string;
  pickupContactPhone?: string;
  pickupNote?: string;
  dropoffNote?: string;
  priceFcfa: number;
  packageType?: PackageType;
  description?: string;
  photoUrl?: string;
  matchingMode?: MatchingMode;
  urgency?: DeliveryUrgency;
  scheduledAt?: string;
  isCod?: boolean;
  codArticleAmountFcfa?: number;
}

// --- Matching ------------------------------------------------------------

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

export interface DriverSearchResult {
  radiusKm: number;
  availableCount: number;
  drivers: DriverCard[];
  message: string | null;
}

// --- Profil livreur ------------------------------------------------------

export type VehicleType =
  | 'moto'
  | 'voiture'
  | 'velo'
  | 'a_pied'
  | 'camionnette';

// Statut de validation du livreur (spec-onboarding-livreur-v2 §4).
export type DriverStatus = 'en_validation' | 'actif' | 'suspendu';

// Opérateur mobile money du compte d'alimentation de la caution (spec §1
// étape 5). Livrechap ne verse rien au livreur : ce n'est pas un « payout ».
export type MobileMoneyOperator = 'orange' | 'mtn' | 'moov' | 'wave';

// Documents du livreur (spec-onboarding-livreur-v2 §1 étape 4).
export type DriverDocumentType =
  | 'cni_recto'
  | 'cni_verso'
  | 'selfie_live'
  | 'permis'
  | 'carte_grise'
  | 'assurance'
  | 'visite_technique';

export type DriverDocumentStatus = 'en_attente' | 'valide' | 'rejete';

export interface DriverDocument {
  id: string;
  type: DriverDocumentType;
  url: string;
  status: DriverDocumentStatus;
  dateExpiration: string | null;
  createdAt: string;
}

// Véhicule du livreur (spec-onboarding-livreur-v2 §1 étape 3).
export interface Vehicle {
  id: string;
  vehicleType: VehicleType;
  marque: string | null;
  modele: string | null;
  annee: number | null;
  couleur: string | null;
  immatriculation: string | null;
  photoAvantUrl: string | null;
  photoArriereUrl: string | null;
  photoPlaqueUrl: string | null;
  capaciteMaxColis: number | null;
  capacitePoidsKg: number | null;
  isActive: boolean;
}

// Adresse enregistrée du client (spec-app-navigation-roles §3), persistée côté
// serveur — distincte des récents/favoris locaux (services/addressHistory).
export interface SavedAddress {
  id: string;
  label: string;
  address: string;
  latitude: number;
  longitude: number;
  landmark: string | null;
  createdAt: string;
}

export interface CreateSavedAddressInput {
  label: string;
  address: string;
  latitude: number;
  longitude: number;
  landmark?: string;
}

export interface Badge {
  key: string;
  label: string;
}

// --- Livrechap Protect (SOS) ---------------------------------------------

export interface SosAlert {
  id: string;
  status: string;
  role: string;
  deliveryId: string | null;
  latitude: number;
  longitude: number;
  createdAt: string;
}

// --- Messagerie de mission (spec-communication) --------------------------

export interface MessageItem {
  id: string;
  senderId: string;
  senderRole: string;
  body: string;
  createdAt: string;
}

export interface Conversation {
  deliveryId: string;
  canSend: boolean;
  closed: boolean;
  messages: MessageItem[];
}

// --- Tournées (spec-delivery-architecture-tournees) ----------------------

// Article d'une livraison (spec-delivery-items) — sans aucune donnée commerciale.
export interface DeliveryItemView {
  id: string;
  name: string;
  quantity: number;
  notes: string | null;
  status: string;
}

export interface TourStopDriver {
  id: string;
  recipientName: string | null;
  recipientPhone: string | null;
  address: string;
  location: LatLng | null;
  landmark: string | null;
  priceFcfa: number;
  orderIndex: number;
  status: string;
  items: DeliveryItemView[];
}

export interface ActiveTour {
  routeId: string;
  requestId: string;
  status: string;
  departAddress: string | null;
  departLocation: LatLng | null;
  totalStops: number;
  deliveredStops: number;
  returnStops: number;
  stops: TourStopDriver[];
  currentStop: TourStopDriver | null;
}

export interface TourFeedCard {
  routeId: string;
  requestId: string;
  departAddress: string | null;
  stopCount: number;
  totalPriceFcfa: number;
  approachMeters: number | null;
  difficultyScore: number;
}

export interface TourStopClient {
  id: string;
  recipientName: string | null;
  recipientPhone: string | null;
  address: string;
  landmark: string | null;
  priceFcfa: number;
  orderIndex: number;
  status: string;
  proofOtp: string | null;
  items: DeliveryItemView[];
}

export interface TourClient {
  requestId: string;
  status: string;
  departAddress: string | null;
  totalPriceFcfa: number;
  totalStops: number;
  deliveredStops: number;
  hasDriver: boolean;
  stops: TourStopClient[];
  createdAt: string;
}

export interface TourOffer {
  id: string;
  prixProposeFcfa: number;
  statut: string;
  driverFirstName: string | null;
  driverRating: number | null;
  driverTotalDeliveries: number | null;
  createdAt: string;
}

export interface CreateTourItemInput {
  name: string;
  quantity: number;
  notes?: string;
}

export interface CreateTourStopInput {
  recipientName?: string;
  recipientPhone?: string;
  address: string;
  latitude: number;
  longitude: number;
  landmark?: string;
  priceFcfa: number;
  packageDescription?: string;
  items?: CreateTourItemInput[];
}

export interface CreateTourInput {
  departAddress: string;
  departLatitude: number;
  departLongitude: number;
  stops: CreateTourStopInput[];
}

// Profil public d'un livreur, consultable par les clients (P2).
export interface DriverPublicProfile {
  id: string;
  firstName: string | null;
  selfieUrl: string | null;
  vehicleType: VehicleType;
  vehicleLabel: string | null;
  ratingAverage: number;
  totalDeliveries: number;
  memberSinceYear: number;
  zones: string[];
  badges: Badge[];
}

export interface UpsertVehicleInput {
  vehicleType: VehicleType;
  marque?: string;
  modele?: string;
  annee?: number;
  couleur?: string;
  immatriculation?: string;
  photoAvantUrl?: string;
  photoArriereUrl?: string;
  photoPlaqueUrl?: string;
  capaciteMaxColis?: number;
  capacitePoidsKg?: number;
}

export interface LatLng {
  latitude: number;
  longitude: number;
}

export interface DriverProfile {
  id: string;
  userId: string;
  vehicleType: VehicleType;
  status: DriverStatus;
  zones: string[];
  mobileMoneyOperator: MobileMoneyOperator | null;
  mobileMoneyNumber: string | null;
  mobileMoneyHolder: string | null;
  isAvailable: boolean;
  location: LatLng | null;
  locationUpdatedAt: string | null;
  ratingAverage: number;
  totalDeliveries: number;
  noShowCount: number;
  suspendedUntil: string | null;
}

export interface MissionCard {
  deliveryId: string;
  pickupAddress: string;
  dropoffAddress: string;
  priceFcfa: number;
  packageType: string | null;
  approachMeters: number;
  courseMeters: number;
  createdAt: string;
  // Fin de la fenêtre de recherche : alimente le décompte du bouton Accepter.
  expiresAt: string | null;
  // Ouverture du palier de CE livreur : sa barre part pleine à cet instant.
  windowStartedAt: string | null;
}

// --- Portefeuille --------------------------------------------------------

export interface Wallet {
  id: string;
  driverId: string;
  balanceFcfa: number;
  welcomeBonusClaimed: boolean;
  lowBalanceAlertThreshold: number;
  lowBalance: boolean;
}

export interface WalletTransaction {
  id: string;
  type: string;
  amountFcfa: number;
  provider: string | null;
  providerReference: string | null;
  deliveryId: string | null;
  createdAt: string;
}

export type RechargeProvider = 'orange_money' | 'wave';

export interface RechargeResult {
  reference: string;
  provider: RechargeProvider;
  amountFcfa: number;
  status: 'confirmed' | 'pending';
  wallet: Wallet | null;
  message: string;
}
