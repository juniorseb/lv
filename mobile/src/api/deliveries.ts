import { authedRequest } from './http';
import { CreateDeliveryInput, Delivery } from './types';

// Appels API du parcours livraison (expéditeur + transitions livreur).
export const deliveriesApi = {
  create: (input: CreateDeliveryInput) =>
    authedRequest<Delivery>('/deliveries', { method: 'POST', body: input }),

  get: (id: string) => authedRequest<Delivery>(`/deliveries/${id}`),

  listMine: () => authedRequest<Delivery[]>('/deliveries/me'),

  // Historique des courses du livreur (terminées / annulées).
  driverHistory: () => authedRequest<Delivery[]>('/deliveries/driver/history'),

  // Gains du livreur (informatif) : nb livraisons + revenu total encaissé.
  driverEarnings: () =>
    authedRequest<{ totalDeliveries: number; totalRevenueFcfa: number }>(
      '/deliveries/driver/earnings',
    ),

  // Activité du jour (accueil livreur « identité pro »).
  driverToday: () =>
    authedRequest<{ todayDeliveries: number; todayRevenueFcfa: number }>(
      '/deliveries/driver/today',
    ),

  // Course en cours du livreur (null si aucune), pour reprise au démarrage.
  activeForDriver: () =>
    authedRequest<Delivery | null>('/deliveries/driver/active'),

  // Position courante du livreur assigné (suivi carte côté expéditeur).
  driverLocation: (id: string) =>
    authedRequest<{
      latitude: number;
      longitude: number;
      updatedAt: string | null;
    } | null>(`/deliveries/${id}/driver-location`),

  cancel: (id: string, reason?: string) =>
    authedRequest<Delivery>(`/deliveries/${id}/cancel`, {
      method: 'POST',
      body: reason ? { reason } : {},
    }),

  // Transitions côté livreur.
  accept: (id: string) =>
    authedRequest<Delivery>(`/deliveries/${id}/accept`, { method: 'POST' }),

  pickup: (id: string) =>
    authedRequest<Delivery>(`/deliveries/${id}/pickup`, { method: 'POST' }),

  complete: (id: string, code: string) =>
    authedRequest<Delivery>(`/deliveries/${id}/complete`, {
      method: 'POST',
      body: { code },
    }),
};
