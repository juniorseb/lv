import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { User } from '../../users/entities/user.entity';
import { Delivery } from './delivery.entity';

// Type d'incident — voir database/schema.sql (ENUM incident_type).
// Alimente le compteur de no-show / annulations par utilisateur, qui déclenche
// une suspension temporaire au-delà d'un seuil (dossier §6).
export type IncidentType =
  | 'no_show_livreur'
  | 'annulation_client'
  | 'refus_apres_acceptation';

@Entity('delivery_incidents')
export class DeliveryIncident {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'delivery_id', type: 'uuid' })
  deliveryId: string;

  @ManyToOne(() => Delivery)
  @JoinColumn({ name: 'delivery_id' })
  delivery: Delivery;

  // Personne responsable de l'incident (client ou livreur selon le type).
  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({
    name: 'type',
    type: 'enum',
    enum: ['no_show_livreur', 'annulation_client', 'refus_apres_acceptation'],
  })
  type: IncidentType;

  // Motif choisi par l'utilisateur (ex. annulation client). Sert à comprendre
  // les annulations et à améliorer le service (Product Psychology : contrôle).
  @Column({ name: 'reason', type: 'varchar', length: 40, nullable: true })
  reason: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
