import { authedRequest } from './http';
import { Conversation, MessageItem } from './types';

// Messagerie de mission (spec-communication) : une conversation par livraison.
export const messagesApi = {
  conversation: (deliveryId: string) =>
    authedRequest<Conversation>(`/deliveries/${deliveryId}/messages`),

  send: (deliveryId: string, body: string) =>
    authedRequest<MessageItem>(`/deliveries/${deliveryId}/messages`, {
      method: 'POST',
      body: { body },
    }),

  // Coordonnées de l'interlocuteur (appel direct).
  contact: (deliveryId: string) =>
    authedRequest<{ name: string; phone: string }>(
      `/deliveries/${deliveryId}/messages/contact`,
    ),
};
