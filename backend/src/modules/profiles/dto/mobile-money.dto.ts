import { IsIn, IsString, Matches, MaxLength, MinLength } from 'class-validator';

import { MobileMoneyOperator } from '../entities/driver-profile.entity';

const OPERATORS: MobileMoneyOperator[] = ['orange', 'mtn', 'moov', 'wave'];

// Compte mobile money d'alimentation de la caution (spec-onboarding-livreur-v2
// §1 étape 5) : compte depuis lequel le livreur verse/recharge sa caution. Ce
// n'est pas un compte de réception — Livrechap ne verse rien au livreur.
export class SetMobileMoneyDto {
  @IsIn(OPERATORS)
  operator: MobileMoneyOperator;

  // Numéro mobile money (chiffres, éventuel + initial).
  @Matches(/^\+?\d{8,15}$/, {
    message: 'Numéro mobile money invalide.',
  })
  number: string;

  @IsString()
  @MinLength(2)
  @MaxLength(150)
  holder: string;
}
