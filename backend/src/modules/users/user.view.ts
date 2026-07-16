import { User } from './entities/user.entity';

// Vue publique d'un utilisateur renvoyée aux clients.
// Ne jamais exposer de champs internes (URLs de documents, horodatages bruts…)
// au-delà de ce qui est utile côté application.
export interface PublicUser {
  id: string;
  phoneNumber: string;
  phoneVerified: boolean;
  accountType: string;
  fullName: string | null;
  commune: string | null;
  email: string | null;
  dateNaissance: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  verificationLevel: string;
  // Le selfie a-t-il été fourni (Niveau 1) ? On expose le booléen, pas l'URL.
  hasSelfie: boolean;
  // Une pièce d'identité a-t-elle été soumise (Niveau 2 en attente) ?
  hasIdDocument: boolean;
  idDocumentType: string | null;
  isActive: boolean;
  isAdmin: boolean;
  // Rôles & rôle actif (spec-app-navigation-roles §1).
  isDriver: boolean; // l'onboarding livreur est-il fait (= driver_profile) ?
  roles: string[]; // rôles disponibles : ['client'] (+ 'livreur' si isDriver)
  activeRole: string | null; // rôle affiché au lancement (null = pas choisi)
}

// isDriver est fourni par l'appelant (il connaît l'existence du profil livreur) ;
// par défaut false pour les vues où l'info n'est pas nécessaire.
export function toPublicUser(user: User, isDriver = false): PublicUser {
  const roles = ['client', ...(isDriver ? ['livreur'] : [])];
  return {
    id: user.id,
    phoneNumber: user.phoneNumber,
    phoneVerified: user.phoneVerified,
    accountType: user.accountType,
    fullName: user.fullName,
    commune: user.commune,
    email: user.email,
    dateNaissance: user.dateNaissance,
    emergencyContactName: user.emergencyContactName,
    emergencyContactPhone: user.emergencyContactPhone,
    verificationLevel: user.verificationLevel,
    hasSelfie: Boolean(user.selfieUrl),
    hasIdDocument: Boolean(user.idDocumentUrl),
    idDocumentType: user.idDocumentType,
    isActive: user.isActive,
    isAdmin: user.isAdmin,
    isDriver,
    roles,
    activeRole: user.activeRole,
  };
}
