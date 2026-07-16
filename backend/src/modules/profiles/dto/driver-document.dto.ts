import { IsIn, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

import { DriverDocumentType } from '../entities/driver-document.entity';

const DOCUMENT_TYPES: DriverDocumentType[] = [
  'cni_recto',
  'cni_verso',
  'selfie_live',
  'permis',
  'carte_grise',
  'assurance',
  'visite_technique',
];

// Envoi d'un document par le livreur (l'URL provient de POST /uploads).
export class SubmitDriverDocumentDto {
  @IsIn(DOCUMENT_TYPES)
  type: DriverDocumentType;

  @IsString()
  @MaxLength(500)
  url: string;

  // Date d'expiration au format ISO (YYYY-MM-DD), pour assurance/visite technique.
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'dateExpiration doit être au format AAAA-MM-JJ.',
  })
  dateExpiration?: string;
}
