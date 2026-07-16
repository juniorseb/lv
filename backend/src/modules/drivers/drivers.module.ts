import { Module } from '@nestjs/common';

import { MatchingModule } from '../matching/matching.module';
import { ProfilesModule } from '../profiles/profiles.module';
import { UsersModule } from '../users/users.module';
import { DriversController } from './drivers.controller';
import { DriversService } from './drivers.service';

// Disponibilité des livreurs, position, mode Disponible/Indisponible + feed +
// profil public. S'appuie sur ProfilesModule (profil livreur, véhicule),
// MatchingModule (présence Redis + missions) et UsersModule (infos publiques).

@Module({
  imports: [ProfilesModule, MatchingModule, UsersModule],
  controllers: [DriversController],
  providers: [DriversService],
  exports: [DriversService],
})
export class DriversModule {}
