import { AccountType } from '../../modules/users/entities/user.entity';

// Objet attaché à req.user après validation de l'access token (voir JwtStrategy).
// Partagé par tous les modules protégés via le décorateur @CurrentUser().
export interface AuthenticatedUser {
  id: string;
  phoneNumber: string;
  accountType: AccountType;
  isAdmin: boolean;
}
