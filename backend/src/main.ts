import { join } from 'path';

import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';

import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.enableCors();

  // Stockage local (STORAGE_MODE=local) : sert les fichiers téléversés.
  const uploadsDir = process.env.STORAGE_LOCAL_DIR || 'uploads';
  app.useStaticAssets(join(process.cwd(), uploadsDir), {
    prefix: '/uploads/',
  });

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`Livrechap API démarrée sur le port ${port}`);
}
bootstrap();
