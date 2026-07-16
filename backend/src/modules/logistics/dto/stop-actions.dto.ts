import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Length,
  MaxLength,
  Min,
} from 'class-validator';

// Le livreur propose un prix pour une tournée (négociation, spec §2 bis).
export class ProposeOfferDto {
  @IsInt()
  @Min(1)
  prixProposeFcfa: number;
}

// Collecte des colis d'une tournée, avec photo de preuve optionnelle (§2 bis).
export class PickupTourDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  proofPhotoUrl?: string;
}

// Validation de la livraison d'un arrêt par le code OTP du destinataire, avec
// photo de preuve optionnelle.
export class CompleteStopDto {
  @IsString()
  @Length(4, 4)
  code: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  proofPhotoUrl?: string;
}

const PROBLEM_REASONS = [
  'client_absent',
  'mauvaise_adresse',
  'client_injoignable',
  'refus',
  // Problèmes liés aux articles (spec-delivery-items §6).
  'article_manquant',
  'mauvais_article',
  'colis_endommage',
] as const;

// Signalement d'un arrêt en échec (spec-tournees §7).
export class ReportProblemDto {
  @IsIn(PROBLEM_REASONS)
  @MaxLength(40)
  reason: string;
}
