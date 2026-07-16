import { randomUUID } from 'crypto';
import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';

import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

// Fichier téléversé (selfie, CNI, photo de colis).
export interface UploadedImage {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
}

// Stockage des fichiers (dossier §10 : Cloudflare R2 / S3, chiffré).
//
// STORAGE_MODE :
//  - "local" (défaut, dev) : écrit sur le disque et sert via /uploads.
//  - "s3" : Cloudflare R2 / AWS S3 (intégration à brancher).
//
// La couche appelante ne connaît jamais le fournisseur : elle reçoit une URL.
@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly mode: string;
  private readonly localDir: string;
  private readonly publicBaseUrl: string;

  constructor(config: ConfigService) {
    this.mode = (config.get<string>('STORAGE_MODE') ?? 'local').toLowerCase();
    this.localDir = config.get<string>('STORAGE_LOCAL_DIR') ?? 'uploads';
    this.publicBaseUrl =
      config.get<string>('PUBLIC_BASE_URL') ?? 'http://localhost:3000';
  }

  // Enregistre une image et renvoie son URL publique.
  async saveImage(file: UploadedImage): Promise<string> {
    const ext = this.extensionFor(file.mimetype);
    const filename = `${randomUUID()}.${ext}`;

    if (this.mode === 's3') {
      // TODO(V1) : téléverser vers Cloudflare R2 / S3 (@aws-sdk/client-s3) et
      // renvoyer l'URL publique / signée.
      this.logger.warn('STORAGE_MODE=s3 non branché — upload refusé.');
      throw new ServiceUnavailableException(
        'Stockage distant non configuré. Réessayez plus tard.',
      );
    }

    const dir = join(process.cwd(), this.localDir);
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, filename), file.buffer);
    return `${this.publicBaseUrl}/uploads/${filename}`;
  }

  private extensionFor(mimetype: string): string {
    switch (mimetype) {
      case 'image/png':
        return 'png';
      case 'image/webp':
        return 'webp';
      case 'image/heic':
        return 'heic';
      case 'image/jpeg':
      default:
        return 'jpg';
    }
  }
}
