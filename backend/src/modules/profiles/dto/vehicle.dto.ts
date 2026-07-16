import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

import { VehicleType } from '../entities/driver-profile.entity';

const VEHICLE_TYPES: VehicleType[] = [
  'moto',
  'voiture',
  'velo',
  'a_pied',
  'camionnette',
];

// Enregistrement/mise à jour du véhicule du livreur. Les détails sont optionnels
// (un vélo/à pied n'a pas d'immatriculation) ; les photos proviennent d'/uploads.
export class UpsertVehicleDto {
  @IsIn(VEHICLE_TYPES)
  vehicleType: VehicleType;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  marque?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  modele?: string;

  @IsOptional()
  @IsInt()
  @Min(1950)
  @Max(2100)
  annee?: number;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  couleur?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  immatriculation?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  photoAvantUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  photoArriereUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  photoPlaqueUrl?: string;

  // Capacité déclarée (spec-tournees §2).
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(500)
  capaciteMaxColis?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(5000)
  capacitePoidsKg?: number;
}
