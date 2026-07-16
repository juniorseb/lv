import { Module } from '@nestjs/common';

import { StorageService } from './storage.service';
import { UploadsController } from './uploads.controller';

// Stockage de fichiers (selfie, CNI, photos). Fournit StorageService et
// l'endpoint /uploads. En mode local, les fichiers sont servis via /uploads
// (voir main.ts, useStaticAssets).
@Module({
  controllers: [UploadsController],
  providers: [StorageService],
  exports: [StorageService],
})
export class StorageModule {}
