import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { Wallet } from './wallet.entity';

// Nature d'une opération de portefeuille — voir database/schema.sql.
//  - recharge   : crédit via Mobile Money (Orange Money / Wave)
//  - commission : débit automatique à la livraison confirmée (10 %, min 200 FCFA)
//  - bonus      : bonus de bienvenue
//  - ajustement : correction manuelle (support / admin)
export type WalletTransactionType =
  | 'recharge'
  | 'commission'
  | 'bonus'
  | 'ajustement';

// Fournisseur du mouvement d'argent. « systeme » = opération interne
// (commission, bonus, ajustement).
export type PaymentProvider = 'orange_money' | 'wave' | 'systeme';

@Entity('wallet_transactions')
export class WalletTransaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'wallet_id', type: 'uuid' })
  walletId: string;

  @ManyToOne(() => Wallet, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'wallet_id' })
  wallet: Wallet;

  @Column({
    name: 'type',
    type: 'enum',
    enum: ['recharge', 'commission', 'bonus', 'ajustement'],
  })
  type: WalletTransactionType;

  // Positif = crédit, négatif = débit.
  @Column({ name: 'amount_fcfa', type: 'int' })
  amountFcfa: number;

  @Column({
    name: 'provider',
    type: 'enum',
    enum: ['orange_money', 'wave', 'systeme'],
    nullable: true,
  })
  provider: PaymentProvider | null;

  // Référence renvoyée par le fournisseur (idempotence des recharges).
  @Column({
    name: 'provider_reference',
    type: 'varchar',
    length: 150,
    nullable: true,
  })
  providerReference: string | null;

  // Livraison associée (pour une commission). Stocké en UUID pour éviter un
  // couplage d'entités entre modules ; correspond à deliveries.id.
  @Index('idx_wallet_tx_delivery')
  @Column({ name: 'delivery_id', type: 'uuid', nullable: true })
  deliveryId: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
