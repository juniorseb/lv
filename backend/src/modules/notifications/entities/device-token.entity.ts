import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { User } from '../../users/entities/user.entity';

export type DevicePlatform = 'android' | 'ios' | 'web';

// Jeton d'appareil pour les notifications push (Firebase Cloud Messaging).
// Un utilisateur peut avoir plusieurs appareils ; un même jeton est unique et
// peut être réattribué si l'appareil change de compte.
@Entity('device_tokens')
export class DeviceToken {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('idx_device_tokens_user')
  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'token', type: 'text', unique: true })
  token: string;

  @Column({ name: 'platform', type: 'varchar', length: 20, default: 'android' })
  platform: DevicePlatform;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
