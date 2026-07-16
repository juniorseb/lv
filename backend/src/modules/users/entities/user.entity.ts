import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

// Type de compte — voir database/schema.sql (ENUM account_type).
// « particulier » et « commerce » sont prévus dès la conception technique
// même si les fonctionnalités avancées du compte Commerce arrivent en V2.
export type AccountType = 'particulier' | 'commerce';

// Niveau de vérification par palier (dossier §6 « Confiance et sécurité ») :
//  - standard : téléphone vérifié, selfie, commune → accès aux missions standards
//  - verifie  : CNI validée manuellement, obligatoire au-delà d'un seuil de montant
export type VerificationLevel = 'standard' | 'verifie';

// Type de pièce d'identité acceptée pour la vérification Niveau 2.
export type IdDocumentType = 'cni' | 'passeport';

// Rôle d'usage (spec-app-navigation-roles §1). Distinct de account_type :
//  - client  : expéditeur (toujours disponible sur un compte)
//  - livreur : disponible une fois l'onboarding livreur fait (= driver_profile)
// activeRole = le rôle affiché au lancement de l'app (résout le re-choix à
// chaque ouverture). Persisté côté serveur pour survivre à une réinstallation.
export type UserRole = 'client' | 'livreur';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // Numéro au format E.164 (+225XXXXXXXXXX). Unique : un numéro = un compte.
  @Column({ name: 'phone_number', type: 'varchar', length: 20, unique: true })
  phoneNumber: string;

  @Column({ name: 'phone_verified', type: 'boolean', default: false })
  phoneVerified: boolean;

  @Column({
    name: 'account_type',
    type: 'enum',
    enum: ['particulier', 'commerce'],
    default: 'particulier',
  })
  accountType: AccountType;

  @Column({ name: 'full_name', type: 'varchar', length: 150, nullable: true })
  fullName: string | null;

  @Column({ name: 'selfie_url', type: 'text', nullable: true })
  selfieUrl: string | null;

  @Column({ name: 'commune', type: 'varchar', length: 100, nullable: true })
  commune: string | null;

  // Profil pro étendu (spec-onboarding-livreur-v2 §1 étape 1). Optionnels pour
  // un simple client, renseignés par le livreur à l'inscription.
  @Column({ name: 'email', type: 'varchar', length: 150, nullable: true })
  email: string | null;

  @Column({ name: 'date_naissance', type: 'date', nullable: true })
  dateNaissance: string | null;

  // Contact d'urgence prévenu par SMS lors d'une alerte Livrechap Protect.
  @Column({
    name: 'emergency_contact_name',
    type: 'varchar',
    length: 150,
    nullable: true,
  })
  emergencyContactName: string | null;

  @Column({
    name: 'emergency_contact_phone',
    type: 'varchar',
    length: 20,
    nullable: true,
  })
  emergencyContactPhone: string | null;

  @Column({
    name: 'verification_level',
    type: 'enum',
    enum: ['standard', 'verifie'],
    default: 'standard',
  })
  verificationLevel: VerificationLevel;

  // Pièce d'identité soumise pour le Niveau 2 : CNI ou passeport.
  @Column({ name: 'id_document_url', type: 'text', nullable: true })
  idDocumentUrl: string | null;

  @Column({
    name: 'id_document_type',
    type: 'enum',
    enum: ['cni', 'passeport'],
    nullable: true,
  })
  idDocumentType: IdDocumentType | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  // Rôle affiché au lancement (null = jamais choisi → écran « Je veux… »).
  @Column({
    name: 'active_role',
    type: 'varchar',
    length: 20,
    nullable: true,
  })
  activeRole: UserRole | null;

  // Accès au back-office (validation CNI, litiges, statistiques). Activé
  // manuellement en base pour les comptes administrateurs.
  @Column({ name: 'is_admin', type: 'boolean', default: false })
  isAdmin: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
