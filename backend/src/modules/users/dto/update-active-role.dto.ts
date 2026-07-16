import { IsIn } from 'class-validator';

import { UserRole } from '../entities/user.entity';

// Rôle à afficher au lancement de l'app (spec-app-navigation-roles §6).
export class UpdateActiveRoleDto {
  @IsIn(['client', 'livreur'])
  activeRole: UserRole;
}
