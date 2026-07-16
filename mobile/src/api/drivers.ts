import { authedRequest } from './http';
import {
  DriverProfile,
  DriverPublicProfile,
  LatLng,
  MissionCard,
} from './types';

// Opérations runtime du livreur : disponibilité, position, feed de missions.
export const driversApi = {
  setAvailability: (params: {
    isAvailable: boolean;
    latitude?: number;
    longitude?: number;
  }) =>
    authedRequest<DriverProfile>('/drivers/me/availability', {
      method: 'POST',
      body: params,
    }),

  updateLocation: (coords: LatLng) =>
    authedRequest<DriverProfile>('/drivers/me/location', {
      method: 'POST',
      body: coords,
    }),

  getMissions: () => authedRequest<MissionCard[]>('/drivers/me/missions'),

  // Profil public d'un livreur (P2).
  getPublicProfile: (driverId: string) =>
    authedRequest<DriverPublicProfile>(`/drivers/${driverId}/public`),
};
