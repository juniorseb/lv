import { Message } from './entities/message.entity';

// Vue d'un message. `senderId` permet au mobile de savoir si le message est le
// sien (aligné à droite) sans exposer d'autres données.
export interface MessageView {
  id: string;
  senderId: string;
  senderRole: string;
  body: string;
  createdAt: Date;
}

export function toMessageView(message: Message): MessageView {
  return {
    id: message.id,
    senderId: message.senderId,
    senderRole: message.senderRole,
    body: message.body,
    createdAt: message.createdAt,
  };
}

// Métadonnées de la conversation côté participant. Une conversation est
// attachée à une mission : une fois la mission finie/annulée, elle est FERMÉE et
// disparaît des interfaces (plus de lecture, plus d'envoi). Les échanges ne
// restent accessibles qu'aux administrateurs (litiges/support/modération).
export interface ConversationView {
  deliveryId: string;
  canSend: boolean; // mission active → envoi autorisé
  closed: boolean; // mission finie/annulée → conversation fermée (messages masqués)
  messages: MessageView[];
}
