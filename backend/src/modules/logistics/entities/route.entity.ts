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
import { DriverProfile } from '../../profiles/entities/driver-profile.entity';
import { DeliveryRequest } from './delivery-request.entity';

// Tournée = regroupement d'arrêts assignés à un livreur (spec-tournees §3). Pour
// une livraison simple : une seule Route avec un seul Stop.
export type RouteStatus = 'en_attente' | 'en_cours' | 'terminee' | 'annulee';

@Entity('routes')
export class DeliveryRoute {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('idx_route_request')
  @Column({ name: 'delivery_request_id', type: 'uuid' })
  deliveryRequestId: string;

  @ManyToOne(() => DeliveryRequest, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'delivery_request_id' })
  deliveryRequest: DeliveryRequest;

  @Index('idx_route_driver')
  @Column({ name: 'driver_id', type: 'uuid', nullable: true })
  driverId: string | null;

  @ManyToOne(() => DriverProfile, { nullable: true })
  @JoinColumn({ name: 'driver_id' })
  driver: DriverProfile | null;

  @Column({
    name: 'distance_estimee_m',
    type: 'numeric',
    precision: 10,
    scale: 1,
    nullable: true,
    transformer: new ColumnNumericTransformer(),
  })
  distanceEstimeeM: number | null;

  @Column({ name: 'gain_total_fcfa', type: 'int', nullable: true })
  gainTotalFcfa: number | null;

  @Column({ name: 'commission_totale_fcfa', type: 'int', nullable: true })
  commissionTotaleFcfa: number | null;

  @Column({ name: 'status', type: 'varchar', length: 20, default: 'en_attente' })
  status: RouteStatus;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
