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
import { ColumnNumericTransformer } from '../../../common/typeorm/numeric.transformer';
import { User } from '../../users/entities/user.entity';

// Type de véhicule — voir database/schema.sql (ENUM vehicle_type).
export type VehicleType = 'moto' | 'voiture' | 'velo' | 'a_pied' | 'camionnette';

// Statut de validation du livreur (spec-onboarding-livreur-v2 §4). Un livreur
// nouvellement inscrit est « en_validation » : il ne reçoit aucune mission tant
// qu'un admin ne l'a pas passé « actif ». « suspendu » = coupé par l'admin.
export type DriverStatus = 'en_validation' | 'actif' | 'suspendu';

// Opérateur mobile money du compte servant à ALIMENTER la caution (spec
// onboarding v2 §1 étape 5). Le client paie le livreur en direct ; Livrechap ne
// verse rien (pas de « payout »). Ce compte est celui DEPUIS lequel le livreur
// verse la caution initiale et la recharge quand elle passe sous le seuil.
export type MobileMoneyOperator = 'orange' | 'mtn' | 'moov' | 'wave';

// Profil livreur : activé via « Je suis livreur ». Indépendant du type de compte
// (un particulier comme un commerce peut aussi être livreur). Le cœur du moteur
// de matching s'appuie sur current_location (index GIST) et is_available.
@Entity('driver_profiles')
export class DriverProfile {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({
    name: 'vehicle_type',
    type: 'enum',
    enum: ['moto', 'voiture', 'velo', 'a_pied', 'camionnette'],
  })
  vehicleType: VehicleType;

  // Statut de validation. Par défaut « en_validation » : pas de mission tant que
  // l'admin n'a pas approuvé (spec-onboarding-livreur-v2 §4).
  @Column({
    name: 'status',
    type: 'varchar',
    length: 20,
    default: 'en_validation',
  })
  status: DriverStatus;

  // Zones de livraison choisies à l'inscription (communes/quartiers d'Abidjan).
  // Liste simple séparée par des virgules — suffisant en V1 (spec §1 étape 1).
  @Column({ name: 'zones', type: 'varchar', length: 300, nullable: true })
  zones: string | null;

  // Compte mobile money d'alimentation de la caution (spec §1 étape 5).
  @Column({
    name: 'mobile_money_operator',
    type: 'varchar',
    length: 10,
    nullable: true,
  })
  mobileMoneyOperator: MobileMoneyOperator | null;

  @Column({
    name: 'mobile_money_number',
    type: 'varchar',
    length: 20,
    nullable: true,
  })
  mobileMoneyNumber: string | null;

  @Column({
    name: 'mobile_money_holder',
    type: 'varchar',
    length: 150,
    nullable: true,
  })
  mobileMoneyHolder: string | null;

  @Column({ name: 'is_available', type: 'boolean', default: false })
  isAvailable: boolean;

  // Position courante (mise à jour périodiquement en mode Disponible, pas en
  // continu — dossier §4, pour préserver batterie et confidentialité).
  @Index('idx_driver_location', { spatial: true })
  @Column({
    name: 'current_location',
    type: 'geography',
    spatialFeatureType: 'Point',
    srid: 4326,
    nullable: true,
  })
  currentLocation: GeoPoint | null;

  @Column({ name: 'location_updated_at', type: 'timestamptz', nullable: true })
  locationUpdatedAt: Date | null;

  @Column({
    name: 'rating_average',
    type: 'numeric',
    precision: 2,
    scale: 1,
    default: 5.0,
    transformer: new ColumnNumericTransformer(),
  })
  ratingAverage: number;

  @Column({ name: 'total_deliveries', type: 'int', default: 0 })
  totalDeliveries: number;

  @Column({ name: 'no_show_count', type: 'int', default: 0 })
  noShowCount: number;

  // Suspension temporaire au-delà d'un seuil d'incidents (dossier §6).
  @Column({ name: 'suspended_until', type: 'timestamptz', nullable: true })
  suspendedUntil: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
