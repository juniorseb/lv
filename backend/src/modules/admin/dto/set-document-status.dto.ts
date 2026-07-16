import { IsIn } from 'class-validator';

import { DriverDocumentStatus } from '../../profiles/entities/driver-document.entity';

const STATUSES: DriverDocumentStatus[] = ['en_attente', 'valide', 'rejete'];

// Revue d'un document livreur par l'admin.
export class SetDocumentStatusDto {
  @IsIn(STATUSES)
  status: DriverDocumentStatus;
}
