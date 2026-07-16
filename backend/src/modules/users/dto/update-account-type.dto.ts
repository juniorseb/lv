import { IsIn } from 'class-validator';

import { AccountType } from '../entities/user.entity';

// Bascule du type de compte particulier ↔ commerce.
// Prévu dès la conception même si les fonctionnalités avancées du compte
// Commerce arrivent en V2 (dossier §4).
export class UpdateAccountTypeDto {
  @IsIn(['particulier', 'commerce'])
  accountType: AccountType;
}
