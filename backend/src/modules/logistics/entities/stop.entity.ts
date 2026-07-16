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
import { DeliveryRoute } from './route.entity';

// Un arrêt individuel dans une tournée (spec-tournees §3). « probleme » et
// « retour » couvrent la gestion des imprévus (§7) et le retour colis (§2 bis).
export type StopStatus =
  | 'en_attente'
  | 'en_route'
  | 'livre'
  | 'probleme'
  | 'retour';

@Entity('stops')
export class Stop {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('idx_stop_route')
  @Column({ name: 'route_id', type: 'uuid' })
  routeId: string;

  @ManyToOne(() => DeliveryRoute, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'route_id' })
  route: DeliveryRoute;

  @Column({ name: 'recipient_name', type: 'varchar', length: 150, nullable: true })
  recipientName: string | null;

  @Column({ name: 'recipient_phone', type: 'varchar', length: 20, nullable: true })
  recipientPhone: string | null;

  @Column({ name: 'address', type: 'text' })
  address: string;

  @Column({
    name: 'location',
    type: 'geography',
    spatialFeatureType: 'Point',
    srid: 4326,
    nullable: true,
  })
  location: GeoPoint | null;

  // Repère livreur, partagé avec le sélecteur d'adresse (ticket-precision-livreur).
  @Column({ name: 'landmark', type: 'varchar', length: 150, nullable: true })
  landmark: string | null;

  @Column({ name: 'price_fcfa', type: 'int', default: 0 })
  priceFcfa: number;

  // Position dans la tournée après optimisation (§6). 0 pour une livraison simple.
  @Column({ name: 'order_index', type: 'int', default: 0 })
  orderIndex: number;

  @Column({ name: 'status', type: 'varchar', length: 20, default: 'en_attente' })
  status: StopStatus;

  // Preuve de livraison (§9) : code OTP saisi par le livreur, et/ou photo (P2).
  // Pour le single, repris de `deliveries.delivery_code`.
  @Column({ name: 'proof_otp', type: 'char', length: 4, nullable: true })
  proofOtp: string | null;

  @Column({ name: 'proof_photo_url', type: 'text', nullable: true })
  proofPhotoUrl: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
