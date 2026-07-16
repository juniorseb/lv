import { authedRequest } from './http';
import { DriverSearchResult } from './types';

export const matchingApi = {
  // Livreurs disponibles autour d'une livraison (cercle progressif),
  // avec le compteur live. Réservé à l'expéditeur, tant que la livraison
  // est en recherche.
  driversForDelivery: (deliveryId: string) =>
    authedRequest<DriverSearchResult>(
      `/matching/deliveries/${deliveryId}/drivers`,
    ),
};
