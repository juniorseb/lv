import { GeoPoint } from '../../common/geo/geo.types';
import { Badge, computeDriverBadges } from './driver-badges';
import { CommerceProfile } from './entities/commerce-profile.entity';
import { DriverDocument } from './entities/driver-document.entity';
import { DriverProfile } from './entities/driver-profile.entity';
import { Vehicle } from './entities/vehicle.entity';

// Coordonnées exposées côté client de façon lisible ({latitude, longitude})
// plutôt que le GeoJSON interne ([longitude, latitude]).
interface LatLng {
  latitude: number;
  longitude: number;
}

function toLatLng(point: GeoPoint | null): LatLng | null {
  if (!point) {
    return null;
  }
  return { latitude: point.coordinates[1], longitude: point.coordinates[0] };
}

export interface DriverProfileView {
  id: string;
  userId: string;
  vehicleType: string;
  status: string;
  zones: string[];
  mobileMoneyOperator: string | null;
  mobileMoneyNumber: string | null;
  mobileMoneyHolder: string | null;
  isAvailable: boolean;
  location: LatLng | null;
  locationUpdatedAt: Date | null;
  ratingAverage: number;
  totalDeliveries: number;
  noShowCount: number;
  suspendedUntil: Date | null;
}

export function toDriverProfileView(profile: DriverProfile): DriverProfileView {
  return {
    id: profile.id,
    userId: profile.userId,
    vehicleType: profile.vehicleType,
    status: profile.status,
    zones: profile.zones
      ? profile.zones.split(',').map((z) => z.trim()).filter(Boolean)
      : [],
    mobileMoneyOperator: profile.mobileMoneyOperator,
    mobileMoneyNumber: profile.mobileMoneyNumber,
    mobileMoneyHolder: profile.mobileMoneyHolder,
    isAvailable: profile.isAvailable,
    location: toLatLng(profile.currentLocation),
    locationUpdatedAt: profile.locationUpdatedAt,
    ratingAverage: profile.ratingAverage,
    totalDeliveries: profile.totalDeliveries,
    noShowCount: profile.noShowCount,
    suspendedUntil: profile.suspendedUntil,
  };
}

export interface DriverDocumentView {
  id: string;
  type: string;
  url: string;
  status: string;
  dateExpiration: string | null;
  createdAt: Date;
}

export function toDriverDocumentView(doc: DriverDocument): DriverDocumentView {
  return {
    id: doc.id,
    type: doc.typeDocument,
    url: doc.url,
    status: doc.status,
    dateExpiration: doc.dateExpiration,
    createdAt: doc.createdAt,
  };
}

export interface VehicleView {
  id: string;
  vehicleType: string;
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

export function toVehicleView(vehicle: Vehicle): VehicleView {
  return {
    id: vehicle.id,
    vehicleType: vehicle.vehicleType,
    marque: vehicle.marque,
    modele: vehicle.modele,
    annee: vehicle.annee,
    couleur: vehicle.couleur,
    immatriculation: vehicle.immatriculation,
    photoAvantUrl: vehicle.photoAvantUrl,
    photoArriereUrl: vehicle.photoArriereUrl,
    photoPlaqueUrl: vehicle.photoPlaqueUrl,
    capaciteMaxColis: vehicle.capaciteMaxColis,
    capacitePoidsKg: vehicle.capacitePoidsKg,
    isActive: vehicle.isActive,
  };
}

// Profil public d'un livreur, visible par les clients (P2). Ne contient aucune
// donnée sensible (ni téléphone, ni documents, ni nom complet).
export interface DriverPublicView {
  id: string;
  firstName: string | null;
  selfieUrl: string | null;
  vehicleType: string;
  vehicleLabel: string | null;
  ratingAverage: number;
  totalDeliveries: number;
  memberSinceYear: number;
  zones: string[];
  badges: Badge[];
}

export function toDriverPublicView(
  driver: DriverProfile,
  input: {
    fullName: string | null;
    selfieUrl: string | null;
    verificationLevel: string;
    createdAt: Date;
    vehicle: Vehicle | null;
  },
): DriverPublicView {
  const firstName = input.fullName?.trim().split(/\s+/)[0] ?? null;
  const vehicleLabel = input.vehicle
    ? [input.vehicle.marque, input.vehicle.modele].filter(Boolean).join(' ') ||
      null
    : null;
  return {
    id: driver.id,
    firstName,
    selfieUrl: input.selfieUrl,
    vehicleType: driver.vehicleType,
    vehicleLabel,
    ratingAverage: driver.ratingAverage,
    totalDeliveries: driver.totalDeliveries,
    memberSinceYear: driver.createdAt.getFullYear(),
    zones: driver.zones
      ? driver.zones.split(',').map((z) => z.trim()).filter(Boolean)
      : [],
    badges: computeDriverBadges({
      verificationLevel: input.verificationLevel,
      ratingAverage: driver.ratingAverage,
      totalDeliveries: driver.totalDeliveries,
    }),
  };
}

export interface CommerceProfileView {
  id: string;
  userId: string;
  shopName: string | null;
  defaultAddress: string | null;
  defaultLocation: LatLng | null;
}

export function toCommerceProfileView(
  profile: CommerceProfile,
): CommerceProfileView {
  return {
    id: profile.id,
    userId: profile.userId,
    shopName: profile.shopName,
    defaultAddress: profile.defaultAddress,
    defaultLocation: toLatLng(profile.defaultLocation),
  };
}
