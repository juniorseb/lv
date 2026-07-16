import { AccountType } from '../../users/entities/user.entity';

// Contenu (claims) transporté par les jetons JWT Livrechap.
export interface JwtPayload {
  // Identifiant de l'utilisateur (users.id).
  sub: string;
  // Numéro E.164, pratique côté client sans requête supplémentaire.
  phone: string;
  accountType: AccountType;
  // Distingue un access token d'un refresh token pour éviter qu'un refresh
  // token soit accepté comme jeton d'accès et inversement.
  type: 'access' | 'refresh';
}
