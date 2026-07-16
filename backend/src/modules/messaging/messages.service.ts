import {
  ForbiddenException,
  Injectable,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Delivery } from '../deliveries/entities/delivery.entity';
import { DeliveriesService } from '../deliveries/deliveries.service';
import { NotificationsService } from '../notifications/notifications.service';
import { DriverProfilesService } from '../profiles/driver-profiles.service';
import { UsersService } from '../users/users.service';
import { Message, MessageSenderRole } from './entities/message.entity';
import {
  ConversationView,
  MessageView,
  toMessageView,
} from './messages.view';

// Messagerie de mission (spec-communication) : une livraison = une conversation
// entre le client (expéditeur) et le livreur assigné. Envoi autorisé uniquement
// pendant une mission active ; lecture seule après fin/annulation ; jamais de
// conversation sans mission ni entre deux inconnus.
@Injectable()
export class MessagesService {
  // Statuts où la mission est « active » : envoi de messages autorisé.
  private readonly activeStatuses = ['livreur_trouve', 'colis_recupere'];

  constructor(
    @InjectRepository(Message)
    private readonly messages: Repository<Message>,
    private readonly deliveries: DeliveriesService,
    private readonly driverProfiles: DriverProfilesService,
    private readonly users: UsersService,
    private readonly notifications: NotificationsService,
  ) {}

  async getConversation(
    deliveryId: string,
    userId: string,
  ): Promise<ConversationView> {
    const delivery = await this.deliveries.getByIdOrFail(deliveryId);
    await this.assertParticipant(delivery, userId);

    const active = this.activeStatuses.includes(delivery.status);
    // Mission finie/annulée : la conversation est FERMÉE. On ne renvoie AUCUN
    // message aux participants (elle disparaît de leurs interfaces) ; seuls les
    // admins y accèdent (getForAdmin).
    if (!active) {
      return { deliveryId, canSend: false, closed: true, messages: [] };
    }
    const rows = await this.messages.find({
      where: { deliveryId },
      order: { createdAt: 'ASC' },
      take: 200,
    });
    return {
      deliveryId,
      canSend: true,
      closed: false,
      messages: rows.map(toMessageView),
    };
  }

  // Accès administrateur (litiges/support/sécurité/modération) : tous les
  // messages, quel que soit le statut. Aucun filtre participant.
  async getForAdmin(deliveryId: string): Promise<MessageView[]> {
    const rows = await this.messages.find({
      where: { deliveryId },
      order: { createdAt: 'ASC' },
      take: 500,
    });
    return rows.map(toMessageView);
  }

  async send(
    deliveryId: string,
    userId: string,
    body: string,
  ): Promise<MessageView> {
    const delivery = await this.deliveries.getByIdOrFail(deliveryId);
    const { clientUserId, driverUserId } = await this.participants(delivery);
    const role = this.roleOf(userId, clientUserId, driverUserId);
    if (!role) {
      throw new ForbiddenException("Vous ne participez pas à cette mission.");
    }
    if (!this.activeStatuses.includes(delivery.status)) {
      throw new BadRequestException(
        'La conversation est en lecture seule (mission terminée ou annulée).',
      );
    }

    const message = await this.messages.save(
      this.messages.create({
        deliveryId,
        senderId: userId,
        senderRole: role,
        body: body.trim(),
      }),
    );

    // Notifier l'autre participant (sauf s'il a la conversation ouverte, géré
    // côté app). Best-effort : un échec de notif ne bloque pas l'envoi.
    const recipientId = role === 'client' ? driverUserId : clientUserId;
    if (recipientId) {
      const senderName = await this.senderDisplayName(userId, role);
      try {
        await this.notifications.sendToUser(recipientId, {
          title: senderName,
          body: message.body,
          data: { type: 'message', deliveryId },
        });
      } catch {
        // ignore
      }
    }

    return toMessageView(message);
  }

  // Coordonnées de l'AUTRE participant (pour l'appel direct, §4). Vrai numéro,
  // mais réservé aux deux participants de la mission.
  async getContact(
    deliveryId: string,
    userId: string,
  ): Promise<{ name: string; phone: string }> {
    const delivery = await this.deliveries.getByIdOrFail(deliveryId);
    const { clientUserId, driverUserId } = await this.participants(delivery);
    const role = this.roleOf(userId, clientUserId, driverUserId);
    if (!role) {
      throw new ForbiddenException("Vous ne participez pas à cette mission.");
    }
    if (!this.activeStatuses.includes(delivery.status)) {
      throw new BadRequestException('La mission est terminée.');
    }

    // Le livreur qui va récupérer le colis doit joindre la personne QUI EST SUR
    // PLACE, pas forcément le titulaire du compte : « je commande depuis Marcory
    // pour un ami à Yopougon ». Une fois le colis récupéré, l'interlocuteur
    // redevient le client (qui suit sa course).
    if (
      role === 'livreur' &&
      delivery.status === 'livreur_trouve' &&
      delivery.pickupContactPhone
    ) {
      return {
        name:
          delivery.pickupContactName?.trim().split(/\s+/)[0] || 'Contact sur place',
        phone: delivery.pickupContactPhone,
      };
    }

    const otherId = role === 'client' ? driverUserId : clientUserId;
    if (!otherId) {
      throw new BadRequestException('Aucun interlocuteur pour le moment.');
    }
    const other = await this.users.findById(otherId);
    const name =
      other?.fullName?.trim().split(/\s+/)[0] ||
      (role === 'client' ? 'Votre livreur' : 'Votre client');
    return { name, phone: other?.phoneNumber ?? '' };
  }

  // --- Internes ------------------------------------------------------------

  private async assertParticipant(
    delivery: Delivery,
    userId: string,
  ): Promise<void> {
    const { clientUserId, driverUserId } = await this.participants(delivery);
    if (userId !== clientUserId && userId !== driverUserId) {
      throw new ForbiddenException("Vous ne participez pas à cette mission.");
    }
  }

  private async participants(
    delivery: Delivery,
  ): Promise<{ clientUserId: string; driverUserId: string | null }> {
    let driverUserId: string | null = null;
    if (delivery.driverId) {
      const driver = await this.driverProfiles.findById(delivery.driverId);
      driverUserId = driver?.userId ?? null;
    }
    return { clientUserId: delivery.senderId, driverUserId };
  }

  private roleOf(
    userId: string,
    clientUserId: string,
    driverUserId: string | null,
  ): MessageSenderRole | null {
    if (userId === clientUserId) return 'client';
    if (userId === driverUserId) return 'livreur';
    return null;
  }

  private async senderDisplayName(
    userId: string,
    role: MessageSenderRole,
  ): Promise<string> {
    const user = await this.users.findById(userId);
    const name = user?.fullName?.trim().split(/\s+/)[0];
    return name || (role === 'livreur' ? 'Votre livreur' : 'Votre client');
  }
}
