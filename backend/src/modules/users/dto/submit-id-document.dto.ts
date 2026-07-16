import { IsIn, IsString, IsUrl } from 'class-validator';

import { IdDocumentType } from '../entities/user.entity';

// Soumission d'une pièce d'identité (CNI ou passeport) pour demander le passage
// au Niveau 2 « Vérifié ». Le document est seulement enregistré ici ; le passage
// effectif relève d'une validation manuelle par un administrateur (dossier §6).
export class SubmitIdDocumentDto {
  @IsString()
  // require_tld: false pour accepter les URLs du stockage local (localhost).
  @IsUrl({ require_protocol: true, require_tld: false })
  documentUrl: string;

  @IsIn(['cni', 'passeport'])
  documentType: IdDocumentType;
}
