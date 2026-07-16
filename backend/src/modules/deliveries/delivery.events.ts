// Événement émis à la publication d'une livraison. Découple deliveries du
// matching : le module matching écoute cet événement pour notifier les livreurs
// proches (offre de mission), sans créer de dépendance circulaire.
export const DELIVERY_CREATED_EVENT = 'delivery.created';

export interface DeliveryCreatedEvent {
  deliveryId: string;
}
