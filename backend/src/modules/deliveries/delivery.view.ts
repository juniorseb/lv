import { GeoPoint } from '../../common/geo/geo.types';
import { Delivery } from './entities/delivery.entity';

interface LocatedPoint {
  address: string;
  latitude: number;
  longitude: number;
}

function toLocated(address: string, point: GeoPoint): LocatedPoint {
  return {
    address,
    latitude: point.coordinates[1],
    longitude: point.coordinates[0],
  };
}

export interface DeliveryView {
  id: string;
  senderId: string;
  driverId: string | null;
  status: string;
  matchingMode: string;
  pickup: LocatedPoint;
  dropoff: LocatedPoint;
  recipientName: string | null;
  recipientPhone: string | null;
  // Contact au point de récupération (celui qui remet le colis).
  pickupContactName: string | null;
  pickupContactPhone: string | null;
  pickupNote: string | null;
  dropoffNote: string | null;
  priceFcfa: number;
  packageType: string | null;
  description: string | null;
  photoUrl: string | null;
  searchRadiusKm: number;
  urgency: string;
  scheduledAt: Date | null;
  // Fin de la fenêtre de recherche (décompte côté client et livreur).
  expiresAt: Date | null;
  isCod: boolean;
  codArticleAmountFcfa: number | null;
  // Présent uniquement dans la vue de l'expéditeur (le client). Le livreur ne
  // doit jamais recevoir le code : il l'obtient du client à la remise du colis.
  deliveryCode?: string | null;
  createdAt: Date;
  matchedAt: Date | null;
  pickedUpAt: Date | null;
  completedAt: Date | null;
  cancelledAt: Date | null;
}

// includeCode = true seulement pour l'expéditeur propriétaire de la livraison.
export function toDeliveryView(
  delivery: Delivery,
  includeCode: boolean,
): DeliveryView {
  const view: DeliveryView = {
    id: delivery.id,
    senderId: delivery.senderId,
    driverId: delivery.driverId,
    status: delivery.status,
    matchingMode: delivery.matchingMode,
    pickup: toLocated(delivery.pickupAddress, delivery.pickupLocation),
    dropoff: toLocated(delivery.dropoffAddress, delivery.dropoffLocation),
    recipientName: delivery.recipientName,
    recipientPhone: delivery.recipientPhone,
    pickupContactName: delivery.pickupContactName,
    pickupContactPhone: delivery.pickupContactPhone,
    pickupNote: delivery.pickupNote,
    dropoffNote: delivery.dropoffNote,
    priceFcfa: delivery.priceFcfa,
    packageType: delivery.packageType,
    description: delivery.description,
    photoUrl: delivery.photoUrl,
    searchRadiusKm: delivery.searchRadiusKm,
    urgency: delivery.urgency,
    scheduledAt: delivery.scheduledAt,
    expiresAt: delivery.expiresAt,
    isCod: delivery.isCod,
    codArticleAmountFcfa: delivery.codArticleAmountFcfa,
    createdAt: delivery.createdAt,
    matchedAt: delivery.matchedAt,
    pickedUpAt: delivery.pickedUpAt,
    completedAt: delivery.completedAt,
    cancelledAt: delivery.cancelledAt,
  };

  if (includeCode) {
    view.deliveryCode = delivery.deliveryCode;
  }

  return view;
}
