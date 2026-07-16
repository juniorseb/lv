import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { GeoPoint } from '../../../common/geo/geo.types';
import { ColumnNumericTransformer } from '../../../common/typeorm/numeric.transformer';
import { DriverProfile } from '../../profiles/entities/driver-profile.entity';
import { User } from '../../users/entities/user.entity';

// Statuts de la livraison — voir database/schema.sql (ENUM delivery_status).
// Parcours de suivi (dossier §4) :
//   recherche → livreur_trouve → colis_recupere → terminee   (ou annulee)
//   recherche → expiree  (délai de recherche dépassé, aucun livreur n'a accepté)
//
// `expiree` est distinct d'`annulee` : personne n'a annulé, la recherche a
// simplement atteint sa limite. Le client peut republier en ajustant son offre.
export type DeliveryStatus =
  | 'recherche'
  | 'livreur_trouve'
  | 'colis_recupere'
  | 'terminee'
  | 'annulee'
  | 'expiree';

// Mode de mise en relation (dossier §4) :
//  - rapide : le premier livreur disponible accepte (urgences)
//  - choix  : le client compare plusieurs livreurs (colis importants)
export type MatchingMode = 'rapide' | 'choix';

// Niveau d'urgence (spec-tournees §2) — impacte le prix conseillé et la vitesse
// de recherche. Normal par défaut.
export type DeliveryUrgency = 'normal' | 'urgent' | 'express';

// Types de colis autorisés (dossier §4). Les objets interdits (espèces, armes,
// produits illicites, animaux, objets de valeur non déclarés) sont exclus par
// les CGU (dossier §6).
export type PackageType =
  | 'documents'
  | 'vetements'
  | 'alimentation'
  | 'petit_colis'
  | 'autre';

export const DELIVERY_PACKAGE_TYPES: PackageType[] = [
  'documents',
  'vetements',
  'alimentation',
  'petit_colis',
  'autre',
];

@Entity('deliveries')
export class Delivery {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // AUTEUR DE LA COMMANDE : le compte qui publie et paie la course. Ce n'est pas
  // forcément celui qui remet physiquement le colis — « je commande depuis
  // Marcory, c'est Awa qui remet à Yopougon » (cf. pickup_contact_*).
  //
  // Ne dites donc jamais « l'expéditeur » à l'utilisateur pour désigner ce champ :
  // l'expéditeur au sens physique peut être Awa. Seul l'auteur annule, republie
  // et suit la course ; les droits découlent de CE champ, pas du colis.
  @Column({ name: 'sender_id', type: 'uuid' })
  senderId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'sender_id' })
  sender: User;

  // Livreur assigné (profil livreur). Nul tant que la livraison est en recherche.
  @Column({ name: 'driver_id', type: 'uuid', nullable: true })
  driverId: string | null;

  @ManyToOne(() => DriverProfile, { nullable: true })
  @JoinColumn({ name: 'driver_id' })
  driver: DriverProfile | null;

  // --- Récupération --------------------------------------------------------
  @Column({ name: 'pickup_address', type: 'text' })
  pickupAddress: string;

  @Index('idx_deliveries_pickup_location', { spatial: true })
  @Column({
    name: 'pickup_location',
    type: 'geography',
    spatialFeatureType: 'Point',
    srid: 4326,
  })
  pickupLocation: GeoPoint;

  // --- Destination ---------------------------------------------------------
  @Column({ name: 'dropoff_address', type: 'text' })
  dropoffAddress: string;

  @Column({
    name: 'dropoff_location',
    type: 'geography',
    spatialFeatureType: 'Point',
    srid: 4326,
  })
  dropoffLocation: GeoPoint;

  // Coordonnées du destinataire, pour que le livreur puisse l'appeler.
  @Column({ name: 'recipient_name', type: 'varchar', length: 150, nullable: true })
  recipientName: string | null;

  @Column({ name: 'recipient_phone', type: 'varchar', length: 20, nullable: true })
  recipientPhone: string | null;

  // Contact AU POINT DE RÉCUPÉRATION — la personne qui remet réellement le colis.
  // Par défaut l'expéditeur lui-même, mais pas toujours : « je commande depuis
  // Marcory pour un ami à Yopougon » est un cas courant. Sans ce champ, le livreur
  // arrivé au retrait appellerait le titulaire du compte, qui n'est pas sur place.
  // Symétrique de recipient_* (comme pickup_note l'est de dropoff_note).
  @Column({
    name: 'pickup_contact_name',
    type: 'varchar',
    length: 150,
    nullable: true,
  })
  pickupContactName: string | null;

  @Column({
    name: 'pickup_contact_phone',
    type: 'varchar',
    length: 20,
    nullable: true,
  })
  pickupContactPhone: string | null;

  // « Précision pour le livreur » : repère humain saisi par le client
  // (ex: « portail orange, après la pharmacie »). Stocké à part de l'adresse
  // formatée (ticket-precision-livreur.md) — avantage produit en Côte d'Ivoire.
  //
  // Un repère PAR ADRESSE : le livreur doit aussi trouver le point de
  // récupération, pas seulement celui de livraison. On affiche celui qui
  // correspond à la phase courante de la course.
  @Column({ name: 'pickup_note', type: 'varchar', length: 150, nullable: true })
  pickupNote: string | null;

  @Column({ name: 'dropoff_note', type: 'varchar', length: 150, nullable: true })
  dropoffNote: string | null;

  // Prix proposé par l'expéditeur, verrouillé au moment du match pour garantir
  // un calcul de commission fiable côté portefeuille (dossier §7).
  @Column({ name: 'price_fcfa', type: 'int' })
  priceFcfa: number;

  @Column({ name: 'package_type', type: 'varchar', length: 50, nullable: true })
  packageType: PackageType | null;

  @Column({ name: 'description', type: 'text', nullable: true })
  description: string | null;

  // Photo optionnelle — accélérateur de confiance, jamais une barrière à la
  // publication (dossier §4).
  @Column({ name: 'photo_url', type: 'text', nullable: true })
  photoUrl: string | null;

  @Column({
    name: 'matching_mode',
    type: 'enum',
    enum: ['rapide', 'choix'],
    default: 'rapide',
  })
  matchingMode: MatchingMode;

  // Urgence (spec-tournees §2). Normal par défaut.
  @Column({ name: 'urgency', type: 'varchar', length: 10, default: 'normal' })
  urgency: DeliveryUrgency;

  // Livraison programmée (spec-tournees §2) : tant que scheduled_at est dans le
  // futur, la course n'est pas proposée aux livreurs (filtrée du feed). null =
  // dès que possible.
  @Column({ name: 'scheduled_at', type: 'timestamptz', nullable: true })
  scheduledAt: Date | null;

  // Paiement à la réception / COD (spec-tournees §8) : le livreur collecte le
  // prix de l'article EN PLUS des frais de livraison, puis le reverse au vendeur
  // en direct (Livrechap n'encaisse jamais). Montant distinct des frais.
  @Column({ name: 'is_cod', type: 'boolean', default: false })
  isCod: boolean;

  @Column({ name: 'cod_article_amount_fcfa', type: 'int', nullable: true })
  codArticleAmountFcfa: number | null;

  // Rayon courant du cercle progressif de recherche (dossier §5), piloté par le
  // module matching. Initialisé à 2 km.
  @Column({
    name: 'search_radius_km',
    type: 'numeric',
    precision: 4,
    scale: 1,
    default: 2.0,
    transformer: new ColumnNumericTransformer(),
  })
  searchRadiusKm: number;

  // Limite de la recherche : au-delà, plus aucun livreur ne voit la course et
  // elle bascule en `expiree`. Calculée à la publication (ou au moment où une
  // course programmée devient active). null = pas de limite.
  @Index('idx_deliveries_expires_at')
  @Column({ name: 'expires_at', type: 'timestamptz', nullable: true })
  expiresAt: Date | null;

  // Dernier palier du cercle progressif dont les livreurs ont été notifiés.
  // 0 = palier initial (notifié à la publication). Sert au job qui pousse une
  // notification quand un palier plus large s'ouvre, sans jamais notifier 2 fois.
  @Column({ name: 'notified_ring_index', type: 'int', default: 0 })
  notifiedRingIndex: number;

  @Index('idx_deliveries_status')
  @Column({
    name: 'status',
    type: 'enum',
    enum: [
      'recherche',
      'livreur_trouve',
      'colis_recupere',
      'terminee',
      'annulee',
      'expiree',
    ],
    default: 'recherche',
  })
  status: DeliveryStatus;

  // Code à 4 chiffres généré à la publication, communiqué au client, saisi par
  // le livreur pour valider « Livré » (preuve de livraison, dossier §6).
  // Ne doit jamais être exposé au livreur via l'API.
  @Column({ name: 'delivery_code', type: 'char', length: 4, nullable: true })
  deliveryCode: string | null;

  // Lien vers le modèle logistique généralisé (spec-tournees §3) : chaque
  // livraison simple est reflétée dans DeliveryRequest → Route → Stop → Package.
  // `deliveries` reste le record opérationnel ; ce lien porte la structure et
  // l'audit. Nullable (livraisons créées avant l'introduction du modèle).
  @Column({ name: 'delivery_request_id', type: 'uuid', nullable: true })
  deliveryRequestId: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @Column({ name: 'matched_at', type: 'timestamptz', nullable: true })
  matchedAt: Date | null;

  @Column({ name: 'picked_up_at', type: 'timestamptz', nullable: true })
  pickedUpAt: Date | null;

  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  completedAt: Date | null;

  @Column({ name: 'cancelled_at', type: 'timestamptz', nullable: true })
  cancelledAt: Date | null;

  // Motif d'annulation choisi par l'expéditeur (toujours capturé, quel que soit
  // le stade — Product Psychology §12 : l'utilisateur explique son choix).
  @Column({ name: 'cancel_reason', type: 'varchar', length: 40, nullable: true })
  cancelReason: string | null;
}
