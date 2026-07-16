import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

import { VehicleType } from '../entities/driver-profile.entity';

const VEHICLE_TYPES: VehicleType[] = [
  'moto',
  'voiture',
  'velo',
  'a_pied',
  'camionnette',
];

// Activation du rôle livreur (« Je suis livreur » / onboarding v2 étape 1-2).
export class CreateDriverProfileDto {
  @IsIn(VEHICLE_TYPES)
  vehicleType: VehicleType;

  // Zones de livraison (communes/quartiers d'Abidjan). Optionnel à la création,
  // complétable ensuite.
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(15)
  @IsString({ each: true })
  @MaxLength(40, { each: true })
  zones?: string[];
}

// Mise à jour du type de véhicule.
export class UpdateDriverProfileDto {
  @IsIn(VEHICLE_TYPES)
  vehicleType: VehicleType;
}
