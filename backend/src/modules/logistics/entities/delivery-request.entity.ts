import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { GeoPoint } from '../../../common/geo/geo.types';
import { User } from '../../users/entities/user.entity';

// Demande logistique globale (spec-delivery-architecture-tournees §3). Une
// demande peut contenir une ou plusieurs livraisons ; en V1 seul le type
// « single » est actif (bridge depuis la table `deliveries`). Le modèle est déjà
// prêt pour les tournées (batch/route) sans migration ultérieure.
export type DeliveryRequestType = 'single' | 'batch' | 'route' | 'recurring';
export type DeliveryRequestStatus = 'en_cours' | 'terminee' | 'annulee';
export type DeliveryUrgency = 'normal' | 'urgent' | 'express';

@Entity('delivery_requests')
export class DeliveryRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'client_id', type: 'uuid' })
  clientId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'client_id' })
  client: User;

  @Column({ name: 'type', type: 'varchar', length: 20, default: 'single' })
  type: DeliveryRequestType;

  @Column({ name: 'depart_address', type: 'text', nullable: true })
  departAddress: string | null;

  @Column({
    name: 'depart_location',
    type: 'geography',
    spatialFeatureType: 'Point',
    srid: 4326,
    nullable: true,
  })
  departLocation: GeoPoint | null;

  @Index('idx_delivery_request_status')
  @Column({
    name: 'status_global',
    type: 'varchar',
    length: 20,
    default: 'en_cours',
  })
  statusGlobal: DeliveryRequestStatus;

  @Column({ name: 'total_price_fcfa', type: 'int', default: 0 })
  totalPriceFcfa: number;

  @Column({ name: 'urgency', type: 'varchar', length: 10, default: 'normal' })
  urgency: DeliveryUrgency;

  // Livraison programmée (§2 P1) — null = dès que possible.
  @Column({ name: 'scheduled_at', type: 'timestamptz', nullable: true })
  scheduledAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
