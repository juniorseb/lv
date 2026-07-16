import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { DriverProfile, VehicleType } from './driver-profile.entity';

// Véhicule d'un livreur (spec-onboarding-livreur-v2 §1 étape 3 + §9). Une table
// dédiée prépare le multi-véhicules (P2) ; en V1 un seul véhicule actif par
// livreur. Les détails (marque/modèle/immatriculation) et photos servent au
// contrôle et à l'affichage. Le type reste synchronisé avec driver_profiles
// (source du matching).
@Entity('vehicles')
@Index('idx_vehicle_driver', ['driverId'])
export class Vehicle {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'driver_id', type: 'uuid' })
  driverId: string;

  @ManyToOne(() => DriverProfile, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'driver_id' })
  driver: DriverProfile;

  @Column({
    name: 'vehicle_type',
    type: 'enum',
    enum: ['moto', 'voiture', 'velo', 'a_pied', 'camionnette'],
  })
  vehicleType: VehicleType;

  @Column({ name: 'marque', type: 'varchar', length: 60, nullable: true })
  marque: string | null;

  @Column({ name: 'modele', type: 'varchar', length: 60, nullable: true })
  modele: string | null;

  @Column({ name: 'annee', type: 'int', nullable: true })
  annee: number | null;

  @Column({ name: 'couleur', type: 'varchar', length: 40, nullable: true })
  couleur: string | null;

  @Column({
    name: 'immatriculation',
    type: 'varchar',
    length: 30,
    nullable: true,
  })
  immatriculation: string | null;

  @Column({ name: 'photo_avant_url', type: 'text', nullable: true })
  photoAvantUrl: string | null;

  @Column({ name: 'photo_arriere_url', type: 'text', nullable: true })
  photoArriereUrl: string | null;

  @Column({ name: 'photo_plaque_url', type: 'text', nullable: true })
  photoPlaqueUrl: string | null;

  // Capacité déclarée (spec-tournees §2) : pour ne pas assigner une tournée
  // impossible. Informatif en V1 (l'attribution reste manuelle), utilisé plus
  // tard par l'auto-matching.
  @Column({ name: 'capacite_max_colis', type: 'int', nullable: true })
  capaciteMaxColis: number | null;

  @Column({ name: 'capacite_poids_kg', type: 'int', nullable: true })
  capacitePoidsKg: number | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
