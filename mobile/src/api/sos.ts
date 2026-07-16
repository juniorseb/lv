import { authedRequest } from './http';
import { SosAlert } from './types';

// Livrechap Protect — alertes de sécurité pendant une livraison.
export const sosApi = {
  trigger: (
    role: 'client' | 'livreur',
    latitude: number,
    longitude: number,
    deliveryId?: string,
  ) =>
    authedRequest<SosAlert>('/sos', {
      method: 'POST',
      body: { role, latitude, longitude, ...(deliveryId ? { deliveryId } : {}) },
    }),

  updateLocation: (latitude: number, longitude: number) =>
    authedRequest<void>('/sos/location', {
      method: 'POST',
      body: { latitude, longitude },
    }),

  resolve: () => authedRequest<void>('/sos/resolve', { method: 'POST' }),

  myActive: () => authedRequest<SosAlert | null>('/sos/me'),
};
