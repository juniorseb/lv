import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { Stop } from './stop.entity';

// Article à remettre à un destinataire (spec-delivery-items). Rattaché au Stop :
// une livraison peut contenir plusieurs articles. AUCUNE donnée commerciale
// (prix, marge, coût) — le livreur ne voit que quoi remettre et en quelle
// quantité.
export type DeliveryItemStatus = 'pending' | 'delivered' | 'missing';

@Entity('delivery_items')
export class DeliveryItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('idx_delivery_item_stop')
  @Column({ name: 'stop_id', type: 'uuid' })
  stopId: string;

  @ManyToOne(() => Stop, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'stop_id' })
  stop: Stop;

  @Column({ name: 'name', type: 'varchar', length: 120 })
  name: string;

  @Column({ name: 'quantity', type: 'int', default: 1 })
  quantity: number;

  // Instruction pour l'article (ex. « Sans oignons », « Bien emballer »).
  @Column({ name: 'notes', type: 'varchar', length: 200, nullable: true })
  notes: string | null;

  @Column({ name: 'status', type: 'varchar', length: 20, default: 'pending' })
  status: DeliveryItemStatus;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
