import { SosAlert } from './entities/sos-alert.entity';

// Vue d'une alerte pour son propriétaire (état + dernière position partagée).
export interface SosAlertView {
  id: string;
  status: string;
  role: string;
  deliveryId: string | null;
  latitude: number;
  longitude: number;
  createdAt: Date;
}

export function toSosAlertView(alert: SosAlert): SosAlertView {
  return {
    id: alert.id,
    status: alert.status,
    role: alert.role,
    deliveryId: alert.deliveryId,
    latitude: alert.lastLatitude ?? alert.latitude,
    longitude: alert.lastLongitude ?? alert.longitude,
    createdAt: alert.createdAt,
  };
}

// Vue admin (support) : ajoute l'identité et la position live.
export interface AdminSosView {
  id: string;
  status: string;
  role: string;
  userName: string | null;
  userPhone: string;
  deliveryId: string | null;
  latitude: number;
  longitude: number;
  locationUpdatedAt: Date | null;
  createdAt: Date;
}
