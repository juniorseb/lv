import {
  BadRequestException,
  Controller,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';

import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { StorageService } from './storage.service';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 Mo

// Téléversement d'images (selfie, CNI, photo de colis). Le client envoie le
// fichier ici puis transmet l'URL obtenue à l'API métier (profil, livraison).
@Controller('uploads')
@UseGuards(JwtAuthGuard)
export class UploadsController {
  constructor(private readonly storage: StorageService) {}

  @Post()
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: MAX_FILE_SIZE } }),
  )
  async upload(
    @UploadedFile() file?: Express.Multer.File,
  ): Promise<{ url: string }> {
    if (!file) {
      throw new BadRequestException('Fichier requis.');
    }
    if (!file.mimetype.startsWith('image/')) {
      throw new BadRequestException('Seules les images sont acceptées.');
    }
    const url = await this.storage.saveImage({
      buffer: file.buffer,
      mimetype: file.mimetype,
      originalname: file.originalname,
    });
    return { url };
  }
}
