import { IsString, IsUrl } from 'class-validator';

// Le selfie fait partie du Niveau 1. En V1, le client téléverse le fichier vers
// le stockage objet (Cloudflare R2 / S3, dossier §10) puis transmet l'URL
// obtenue. Une couture d'upload signé pourra être ajoutée plus tard.
export class SetSelfieDto {
  @IsString()
  // require_tld: false pour accepter les URLs du stockage local (localhost) en
  // dev ; les URLs R2/S3 de production restent valides.
  @IsUrl({ require_protocol: true, require_tld: false })
  selfieUrl: string;
}
