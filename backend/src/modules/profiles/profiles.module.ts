import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { CommerceProfilesService } from './commerce-profiles.service';
import { DriverDocumentsService } from './driver-documents.service';
import { DriverProfilesService } from './driver-profiles.service';
import { CommerceProfile } from './entities/commerce-profile.entity';
import { DriverDocument } from './entities/driver-document.entity';
import { DriverProfile } from './entities/driver-profile.entity';
import { Vehicle } from './entities/vehicle.entity';
import { ProfilesController } from './profiles.controller';
import { VehiclesService } from './vehicles.service';

// Profils étendus : livreur (véhicule, vérification, documents), commerce
// (adresse, historique). Les services sont exportés : le matching (livreurs
// disponibles à proximité) et les livraisons s'appuieront sur les profils.

@Module({
  imports: [
    TypeOrmModule.forFeature([
      DriverProfile,
      DriverDocument,
      Vehicle,
      CommerceProfile,
    ]),
  ],
  controllers: [ProfilesController],
  providers: [
    DriverProfilesService,
    DriverDocumentsService,
    VehiclesService,
    CommerceProfilesService,
  ],
  exports: [
    DriverProfilesService,
    DriverDocumentsService,
    VehiclesService,
    CommerceProfilesService,
    TypeOrmModule,
  ],
})
export class ProfilesModule {}
