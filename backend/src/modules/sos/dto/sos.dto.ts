import { IsIn, IsLatitude, IsLongitude, IsOptional, IsUUID } from 'class-validator';

import { SosRole } from '../entities/sos-alert.entity';

const ROLES: SosRole[] = ['client', 'livreur'];

// Déclenchement d'une alerte Livrechap Protect.
export class TriggerSosDto {
  @IsIn(ROLES)
  role: SosRole;

  @IsOptional()
  @IsUUID()
  deliveryId?: string;

  @IsLatitude()
  latitude: number;

  @IsLongitude()
  longitude: number;
}

// Mise à jour de la position pendant une alerte active (partage GPS).
export class SosLocationDto {
  @IsLatitude()
  latitude: number;

  @IsLongitude()
  longitude: number;
}
