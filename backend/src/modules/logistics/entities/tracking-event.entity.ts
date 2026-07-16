import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { DeliveryPackage } from './package.entity';

// Historique horodaté d'un colis (spec-tournees §3), pour litiges et audit.
@Entity('tracking_events')
export class TrackingEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('idx_tracking_package')
  @Column({ name: 'package_id', type: 'uuid' })
  packageId: string;

  @ManyToOne(() => DeliveryPackage, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'package_id' })
  package: DeliveryPackage;

  @Column({ name: 'type_evenement', type: 'varchar', length: 40 })
  typeEvenement: string;

  @Column({ name: 'details', type: 'text', nullable: true })
  details: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
