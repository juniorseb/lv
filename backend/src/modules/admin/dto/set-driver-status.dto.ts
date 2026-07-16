import { IsIn } from 'class-validator';

import { DriverStatus } from '../../profiles/entities/driver-profile.entity';

const DRIVER_STATUSES: DriverStatus[] = ['en_validation', 'actif', 'suspendu'];

// Décision de l'admin sur un livreur (spec-onboarding-livreur-v2 §4).
export class SetDriverStatusDto {
  @IsIn(DRIVER_STATUSES)
  status: DriverStatus;
}
