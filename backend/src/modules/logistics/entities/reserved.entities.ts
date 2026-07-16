import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

// Tables « réservées mais inactives » (spec-delivery-architecture-tournees §2 bis
// + §10) : structure créée dès maintenant pour ne pas re-modéliser plus tard.
// Aucune logique métier ne les alimente en V1 — ce sont des réservations de
// schéma, pas des fonctionnalités actives.

// COD sécurisé par la plateforme (P2) : Client paie → Livreur collecte →
// Plateforme sécurise → Vendeur reçoit.
@Entity('payment_collections')
export class PaymentCollection {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'package_id', type: 'uuid' })
  packageId: string;

  @Column({ name: 'montant_a_collecter_fcfa', type: 'int' })
  montantACollecterFcfa: number;

  @Column({ name: 'livreur_collecteur_id', type: 'uuid', nullable: true })
  livreurCollecteurId: string | null;

  @Column({ name: 'statut', type: 'varchar', length: 20, default: 'en_attente' })
  statut: 'en_attente' | 'collecte' | 'reverse';

  @Column({ name: 'date_reception', type: 'timestamptz', nullable: true })
  dateReception: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}

// Offre de prix négociée par le livreur (P2).
@Entity('delivery_offers')
export class DeliveryOffer {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'delivery_request_id', type: 'uuid' })
  deliveryRequestId: string;

  @Column({ name: 'driver_id', type: 'uuid' })
  driverId: string;

  @Column({ name: 'prix_propose_fcfa', type: 'int' })
  prixProposeFcfa: number;

  @Column({ name: 'statut', type: 'varchar', length: 20, default: 'en_attente' })
  statut: 'en_attente' | 'accepte' | 'refuse';

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}

// Réservation de tournée récurrente entreprise (P2).
@Entity('recurring_deliveries')
export class RecurringDelivery {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'entreprise_id', type: 'uuid' })
  entrepriseId: string;

  @Column({ name: 'frequency', type: 'varchar', length: 20 })
  frequency: 'daily' | 'weekly';

  @Column({ name: 'heure_depart', type: 'varchar', length: 5, nullable: true })
  heureDepart: string | null;

  @Column({ name: 'livreur_prefere_id', type: 'uuid', nullable: true })
  livreurPrefereId: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}

// Capacité réelle d'un véhicule (P1) — liée à `vehicles` de l'onboarding. Plus
// riche qu'un simple nombre max de colis (10 petits AirPods ≠ 10 gros colis).
@Entity('vehicle_capacity')
export class VehicleCapacity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'vehicle_id', type: 'uuid' })
  vehicleId: string;

  @Column({ name: 'capacite_poids_kg', type: 'int', nullable: true })
  capacitePoidsKg: number | null;

  @Column({ name: 'capacite_volume_litres', type: 'int', nullable: true })
  capaciteVolumeLitres: number | null;

  @Column({ name: 'capacite_max_colis', type: 'int', nullable: true })
  capaciteMaxColis: number | null;
}
