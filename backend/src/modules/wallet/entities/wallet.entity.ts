import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { DriverProfile } from '../../profiles/entities/driver-profile.entity';

// Portefeuille Crédit Livrechap — un par livreur (dossier §7).
// Le client paie le livreur directement (cash / OM / Wave) ; la commission de
// Livrechap est prélevée sur ce crédit interne, ce qui évite tout flux d'argent
// client → plateforme → livreur en V1.
@Entity('wallets')
export class Wallet {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'driver_id', type: 'uuid', unique: true })
  driverId: string;

  @OneToOne(() => DriverProfile, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'driver_id' })
  driver: DriverProfile;

  // Solde en FCFA (entier). Peut être bas mais l'acceptation de nouvelles
  // missions est bloquée sous un seuil (voir WalletService).
  @Column({ name: 'balance_fcfa', type: 'int', default: 0 })
  balanceFcfa: number;

  // Bonus de bienvenue débloqué après la première livraison réussie (et non à
  // l'inscription, pour éviter les créations de comptes multiples abusives).
  @Column({ name: 'welcome_bonus_claimed', type: 'boolean', default: false })
  welcomeBonusClaimed: boolean;

  // Seuil d'alerte de solde bas (avant blocage des nouvelles missions).
  @Column({ name: 'low_balance_alert_threshold', type: 'int', default: 300 })
  lowBalanceAlertThreshold: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
