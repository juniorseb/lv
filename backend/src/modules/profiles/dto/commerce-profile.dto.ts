import {
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

// Création / mise à jour du profil commerce. Tous les champs sont optionnels :
// le compte peut compléter progressivement (nom de boutique, adresse par défaut,
// point de récupération). latitude et longitude vont de pair (validé en service).
export class UpsertCommerceProfileDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  shopName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  defaultAddress?: string;

  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude?: number;

  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude?: number;
}
