import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ProfilesModule } from '../profiles/profiles.module';
import { User } from './entities/user.entity';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

// Comptes utilisateurs de base (particulier / commerce), rôles.
// L'entité User est la source de vérité partagée : le module auth s'appuie
// dessus pour la création de compte et la connexion par OTP.

@Module({
  imports: [TypeOrmModule.forFeature([User]), ProfilesModule],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService, TypeOrmModule],
})
export class UsersModule {}
