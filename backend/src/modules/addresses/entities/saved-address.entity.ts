import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { User } from '../../users/entities/user.entity';

// Adresse enregistrée par un client (spec-app-navigation-roles §3 « Mes adresses
// enregistrées ») : domicile, travail, favoris — réutilisation rapide lors de la
// création d'une livraison. Le repère (landmark) est partagé avec le sélecteur
// d'adresse (cf. ticket-precision-livreur.md).
@Entity('saved_addresses')
@Index('idx_saved_address_user', ['userId'])
export class SavedAddress {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  // Libellé court choisi par l'utilisateur : « Maison », « Bureau », etc.
  @Column({ name: 'label', type: 'varchar', length: 60 })
  label: string;

  @Column({ name: 'address', type: 'varchar', length: 300 })
  address: string;

  @Column({ name: 'latitude', type: 'double precision' })
  latitude: number;

  @Column({ name: 'longitude', type: 'double precision' })
  longitude: number;

  @Column({ name: 'landmark', type: 'varchar', length: 150, nullable: true })
  landmark: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
