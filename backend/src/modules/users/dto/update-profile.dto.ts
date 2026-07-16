import {
  IsEmail,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

// Complétion du profil : nom, commune, et (profil pro livreur, spec v2 §1
// étape 1) email + date de naissance. Le selfie/CNI sont gérés séparément.
export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  fullName?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  commune?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(150)
  email?: string;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'dateNaissance doit être au format AAAA-MM-JJ.',
  })
  dateNaissance?: string;

  // Contact d'urgence (Livrechap Protect).
  @IsOptional()
  @IsString()
  @MaxLength(150)
  emergencyContactName?: string;

  @IsOptional()
  @Matches(/^\+?\d{8,15}$/, {
    message: 'Numéro du contact d’urgence invalide.',
  })
  emergencyContactPhone?: string;
}
