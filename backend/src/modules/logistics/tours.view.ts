import { GeoPoint } from '../../common/geo/geo.types';
import { DriverProfile } from '../profiles/entities/driver-profile.entity';
import { DeliveryItem } from './entities/delivery-item.entity';
import { DeliveryRequest } from './entities/delivery-request.entity';
import { DeliveryRoute } from './entities/route.entity';
import { DeliveryOffer } from './entities/reserved.entities';
import { Stop } from './entities/stop.entity';

// Articles d'un arrêt, affichés SANS aucune donnée commerciale (spec-delivery-items).
export interface DeliveryItemView {
  id: string;
  name: string;
  quantity: number;
  notes: string | null;
  status: string;
}

function toItemView(item: DeliveryItem): DeliveryItemView {
  return {
    id: item.id,
    name: item.name,
    quantity: item.quantity,
    notes: item.notes,
    status: item.status,
  };
}

export type ItemsByStop = Map<string, DeliveryItem[]>;

interface LatLng {
  latitude: number;
  longitude: number;
}

function toLatLng(point: GeoPoint | null): LatLng | null {
  if (!point) return null;
  return { latitude: point.coordinates[1], longitude: point.coordinates[0] };
}

// Vue d'un arrêt côté LIVREUR — n'expose JAMAIS le code OTP (le livreur doit le
// demander au destinataire pour prouver la livraison).
export interface TourStopDriverView {
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

export function toTourStopDriverView(
  stop: Stop,
  items: DeliveryItem[] = [],
): TourStopDriverView {
  return {
    id: stop.id,
    recipientName: stop.recipientName,
    recipientPhone: stop.recipientPhone,
    address: stop.address,
    location: toLatLng(stop.location),
    landmark: stop.landmark,
    priceFcfa: stop.priceFcfa,
    orderIndex: stop.orderIndex,
    status: stop.status,
    items: items.map(toItemView),
  };
}

// Offre de prix d'un livreur, vue par le client (spec §2 bis). Ne dévoile que le
// prénom et la note du livreur.
export interface OfferView {
  id: string;
  prixProposeFcfa: number;
  statut: string;
  driverFirstName: string | null;
  driverRating: number | null;
  driverTotalDeliveries: number | null;
  createdAt: Date;
}

export function toOfferView(
  offer: DeliveryOffer,
  driver: DriverProfile | null,
): OfferView {
  return {
    id: offer.id,
    prixProposeFcfa: offer.prixProposeFcfa,
    statut: offer.statut,
    driverFirstName: null, // le profil livreur ne porte pas le nom (sur users)
    driverRating: driver ? driver.ratingAverage : null,
    driverTotalDeliveries: driver ? driver.totalDeliveries : null,
    createdAt: offer.createdAt,
  };
}

// Carte de tournée dans le feed livreur (avant acceptation).
export interface TourFeedCard {
  routeId: string;
  requestId: string;
  departAddress: string | null;
  stopCount: number;
  totalPriceFcfa: number;
  approachMeters: number | null;
  difficultyScore: number;
}

// Tournée active du livreur : progression + arrêts ordonnés + arrêt courant.
export interface ActiveTourView {
  routeId: string;
  requestId: string;
  status: string;
  departAddress: string | null;
  departLocation: LatLng | null;
  totalStops: number;
  deliveredStops: number;
  // Arrêts en échec dont le colis est à ramener à l'expéditeur (spec §2 bis).
  returnStops: number;
  stops: TourStopDriverView[];
  currentStop: TourStopDriverView | null;
}

export function toActiveTourView(
  request: DeliveryRequest,
  route: DeliveryRoute,
  stops: Stop[],
  itemsByStop: ItemsByStop = new Map(),
): ActiveTourView {
  const ordered = [...stops].sort((a, b) => a.orderIndex - b.orderIndex);
  const delivered = ordered.filter((s) => s.status === 'livre').length;
  const returns = ordered.filter(
    (s) => s.status === 'probleme' || s.status === 'retour',
  ).length;
  // Arrêt courant = premier non résolu (ni livré ni en problème/retour).
  const current = ordered.find(
    (s) => s.status === 'en_attente' || s.status === 'en_route',
  );
  const view = (s: Stop) =>
    toTourStopDriverView(s, itemsByStop.get(s.id) ?? []);
  return {
    routeId: route.id,
    requestId: request.id,
    status: route.status,
    departAddress: request.departAddress,
    departLocation: toLatLng(request.departLocation),
    totalStops: ordered.length,
    deliveredStops: delivered,
    returnStops: returns,
    stops: ordered.map(view),
    currentStop: current ? view(current) : null,
  };
}

// Vue d'un arrêt côté CLIENT — inclut le code OTP à transmettre au destinataire.
export interface TourStopClientView {
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

export interface TourClientView {
  requestId: string;
  status: string;
  departAddress: string | null;
  totalPriceFcfa: number;
  totalStops: number;
  deliveredStops: number;
  hasDriver: boolean;
  stops: TourStopClientView[];
  createdAt: Date;
}

export function toTourClientView(
  request: DeliveryRequest,
  route: DeliveryRoute | null,
  stops: Stop[],
  itemsByStop: ItemsByStop = new Map(),
): TourClientView {
  const ordered = [...stops].sort((a, b) => a.orderIndex - b.orderIndex);
  return {
    requestId: request.id,
    status: request.statusGlobal,
    departAddress: request.departAddress,
    totalPriceFcfa: request.totalPriceFcfa,
    totalStops: ordered.length,
    deliveredStops: ordered.filter((s) => s.status === 'livre').length,
    hasDriver: Boolean(route?.driverId),
    stops: ordered.map((s) => ({
      id: s.id,
      recipientName: s.recipientName,
      recipientPhone: s.recipientPhone,
      address: s.address,
      landmark: s.landmark,
      priceFcfa: s.priceFcfa,
      orderIndex: s.orderIndex,
      status: s.status,
      proofOtp: s.proofOtp,
      items: (itemsByStop.get(s.id) ?? []).map(toItemView),
    })),
    createdAt: request.createdAt,
  };
}
