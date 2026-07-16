import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { ColumnNumericTransformer } from '../../../common/typeorm/numeric.transformer';
import { User } from '../../users/entities/user.entity';

// Alerte de sécurité « Livrechap Protect ». Déclenchée pendant une livraison par
// le client ou le livreur (appui long 3 s côté app). Partage la position en
// temps réel avec le support (admins) jusqu'à résolution.
export type SosStatus = 'active' | 'resolved';
export type SosRole = 'client' | 'livreur';

@Entity('sos_alerts')
export class SosAlert {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('idx_sos_user')
  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'role', type: 'varchar', length: 10 })
  role: SosRole;

  // Livraison concernée (contexte), si l'alerte est déclenchée pendant une course.
  @Column({ name: 'delivery_id', type: 'uuid', nullable: true })
  deliveryId: string | null;

  // Position au déclenchement.
  @Column({
    name: 'latitude',
    type: 'numeric',
    precision: 9,
    scale: 6,
    transformer: new ColumnNumericTransformer(),
  })
  latitude: number;

  @Column({
    name: 'longitude',
    type: 'numeric',
    precision: 9,
    scale: 6,
    transformer: new ColumnNumericTransformer(),
  })
  longitude: number;

  // Dernière position connue (partage GPS temps réel pendant l'alerte).
  @Column({
    name: 'last_latitude',
    type: 'numeric',
    precision: 9,
    scale: 6,
    nullable: true,
    transformer: new ColumnNumericTransformer(),
  })
  lastLatitude: number | null;

  @Column({
    name: 'last_longitude',
    type: 'numeric',
    precision: 9,
    scale: 6,
    nullable: true,
    transformer: new ColumnNumericTransformer(),
  })
  lastLongitude: number | null;

  @Column({ name: 'location_updated_at', type: 'timestamptz', nullable: true })
  locationUpdatedAt: Date | null;

  @Index('idx_sos_status')
  @Column({ name: 'status', type: 'varchar', length: 10, default: 'active' })
  status: SosStatus;

  // Qui a résolu (l'utilisateur lui-même « je suis en sécurité », ou un admin).
  @Column({ name: 'resolved_by', type: 'uuid', nullable: true })
  resolvedBy: string | null;

  @Column({ name: 'resolved_at', type: 'timestamptz', nullable: true })
  resolvedAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
