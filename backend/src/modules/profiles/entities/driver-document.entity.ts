import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { DriverProfile } from './driver-profile.entity';

// Types de documents livreur (spec-onboarding-livreur-v2 §1 étape 4).
// Communs : pièce d'identité (recto/verso) + selfie pris en direct.
// Selon le véhicule : permis, carte grise, assurance, visite technique.
export type DriverDocumentType =
  | 'cni_recto'
  | 'cni_verso'
  | 'selfie_live'
  | 'permis'
  | 'carte_grise'
  | 'assurance'
  | 'visite_technique';

// Statut de revue d'un document (validation admin).
export type DriverDocumentStatus = 'en_attente' | 'valide' | 'rejete';

// Un document = un fichier téléversé + son type + son statut de revue. Un seul
// document « courant » par type et par livreur (le nouvel envoi remplace l'ancien).
@Entity('driver_documents')
@Index('idx_driver_document_driver', ['driverId'])
export class DriverDocument {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'driver_id', type: 'uuid' })
  driverId: string;

  @ManyToOne(() => DriverProfile, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'driver_id' })
  driver: DriverProfile;

  @Column({ name: 'type_document', type: 'varchar', length: 30 })
  typeDocument: DriverDocumentType;

  @Column({ name: 'url', type: 'text' })
  url: string;

  @Column({
    name: 'status',
    type: 'varchar',
    length: 20,
    default: 'en_attente',
  })
  status: DriverDocumentStatus;

  // Date d'expiration (assurance, visite technique…), pour de futures alertes.
  @Column({ name: 'date_expiration', type: 'date', nullable: true })
  dateExpiration: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
