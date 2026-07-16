import {
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

import { AccountType } from '../../users/entities/user.entity';

// Étape 2 : la personne saisit le code reçu. Si le compte n'existe pas encore,
// il est créé à ce moment (connexion et inscription passent par le même flux —
// « Un même compte peut utiliser les deux rôles, sans réinscription », dossier §4).
export class VerifyOtpDto {
  @IsString()
  @MinLength(8)
  @MaxLength(20)
  phoneNumber: string;

  // Code OTP numérique (4 à 8 chiffres selon la configuration OTP_LENGTH).
  @IsString()
  @Matches(/^[0-9]{4,8}$/, { message: 'Code OTP invalide.' })
  code: string;

  // Optionnel, uniquement pertinent à la première inscription.
  // Par défaut « particulier » ; « commerce » prévu dès la conception.
  @IsOptional()
  @IsIn(['particulier', 'commerce'])
  accountType?: AccountType;
}
