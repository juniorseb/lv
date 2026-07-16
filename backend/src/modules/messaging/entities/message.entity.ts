import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { Delivery } from '../../deliveries/entities/delivery.entity';
import { User } from '../../users/entities/user.entity';

// Message d'une conversation de mission (spec-communication) : une livraison =
// une conversation, entre le client (expéditeur) et le livreur assigné. Texte
// seul (pas de pièce jointe en P0). Sécurité : rattaché à une livraison précise.
export type MessageSenderRole = 'client' | 'livreur';

@Entity('messages')
@Index('idx_message_delivery', ['deliveryId'])
export class Message {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'delivery_id', type: 'uuid' })
  deliveryId: string;

  @ManyToOne(() => Delivery, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'delivery_id' })
  delivery: Delivery;

  @Column({ name: 'sender_id', type: 'uuid' })
  senderId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'sender_id' })
  sender: User;

  @Column({ name: 'sender_role', type: 'varchar', length: 10 })
  senderRole: MessageSenderRole;

  @Column({ name: 'body', type: 'varchar', length: 1000 })
  body: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
