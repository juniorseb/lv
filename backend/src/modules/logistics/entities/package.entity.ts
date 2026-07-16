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
import { Stop } from './stop.entity';

// Colis — entité séparée du Stop (spec-tournees §3) : un colis existe
// indépendamment de son trajet (assurance, suivi, litiges) et un Stop peut
// regrouper plusieurs colis. Son statut est distinct de celui du Stop.
export type PackageStatus =
  | 'cree'
  | 'assigne'
  | 'recupere'
  | 'en_transport'
  | 'livre'
  | 'retour';

@Entity('packages')
export class DeliveryPackage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('idx_package_stop')
  @Column({ name: 'stop_id', type: 'uuid' })
  stopId: string;

  @ManyToOne(() => Stop, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'stop_id' })
  stop: Stop;

  @Column({ name: 'description_produit', type: 'text', nullable: true })
  descriptionProduit: string | null;

  @Column({ name: 'valeur_declaree_fcfa', type: 'int', nullable: true })
  valeurDeclareeFcfa: number | null;

  @Column({
    name: 'poids_kg',
    type: 'numeric',
    precision: 6,
    scale: 2,
    nullable: true,
    transformer: new ColumnNumericTransformer(),
  })
  poidsKg: number | null;

  @Column({ name: 'fragile', type: 'boolean', default: false })
  fragile: boolean;

  @Column({ name: 'status', type: 'varchar', length: 20, default: 'cree' })
  status: PackageStatus;

  // Preuve de collecte (§2 bis), symétrique à la preuve de livraison.
  @Column({ name: 'proof_collection_photo_url', type: 'text', nullable: true })
  proofCollectionPhotoUrl: string | null;

  @Column({
    name: 'proof_collection_code',
    type: 'varchar',
    length: 10,
    nullable: true,
  })
  proofCollectionCode: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
