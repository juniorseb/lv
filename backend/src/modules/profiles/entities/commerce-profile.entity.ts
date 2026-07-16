import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { GeoPoint } from '../../../common/geo/geo.types';
import { User } from '../../users/entities/user.entity';

// Profil commerce (vendeuses Instagram, boutiques WhatsApp, petits commerçants —
// cible prioritaire, dossier §3). Les fonctionnalités avancées (historique,
// adresses multiples, statistiques) arrivent en V2/Phase 3 ; la structure est
// posée dès maintenant pour éviter une migration douloureuse.
@Entity('commerce_profiles')
export class CommerceProfile {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'shop_name', type: 'varchar', length: 150, nullable: true })
  shopName: string | null;

  @Column({ name: 'default_address', type: 'text', nullable: true })
  defaultAddress: string | null;

  // Point de récupération par défaut de la boutique.
  @Column({
    name: 'default_location',
    type: 'geography',
    spatialFeatureType: 'Point',
    srid: 4326,
    nullable: true,
  })
  defaultLocation: GeoPoint | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
