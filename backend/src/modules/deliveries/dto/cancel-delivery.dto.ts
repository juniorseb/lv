import { IsIn, IsOptional } from 'class-validator';

// Motifs d'annulation par l'expéditeur (Product Psychology : l'utilisateur garde
// le contrôle et explique son choix, comme pour un problème d'arrêt).
export const CANCEL_REASONS = [
  'erreur_adresse',
  'plus_besoin',
  'trop_long',
  'autre_solution',
  'autre',
] as const;

export class CancelDeliveryDto {
  @IsOptional()
  @IsIn(CANCEL_REASONS)
  reason?: string;
}
