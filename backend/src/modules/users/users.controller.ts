import { Body, Controller, Get, Patch, Put, UseGuards } from '@nestjs/common';

import { AuthenticatedUser } from '../../common/auth/authenticated-user';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { SetSelfieDto } from './dto/set-selfie.dto';
import { SubmitIdDocumentDto } from './dto/submit-id-document.dto';
import { UpdateAccountTypeDto } from './dto/update-account-type.dto';
import { UpdateActiveRoleDto } from './dto/update-active-role.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { PublicUser } from './user.view';
import { UsersService } from './users.service';

// Gestion du compte de l'utilisateur connecté : onboarding Niveau 1
// (nom, commune, selfie), demande de vérification Niveau 2 (CNI), bascule du
// type de compte, et rôle actif de l'app. Toutes les routes sont protégées.
@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  async me(@CurrentUser() current: AuthenticatedUser): Promise<PublicUser> {
    const user = await this.usersService.getByIdOrFail(current.id);
    return this.usersService.buildPublicUser(user);
  }

  // Complétion du profil : nom et/ou commune.
  @Patch('me')
  async updateProfile(
    @CurrentUser() current: AuthenticatedUser,
    @Body() dto: UpdateProfileDto,
  ): Promise<PublicUser> {
    const user = await this.usersService.updateProfile(current.id, dto);
    return this.usersService.buildPublicUser(user);
  }

  // Enregistrement du selfie (Niveau 1).
  @Put('me/selfie')
  async setSelfie(
    @CurrentUser() current: AuthenticatedUser,
    @Body() dto: SetSelfieDto,
  ): Promise<PublicUser> {
    const user = await this.usersService.setSelfie(current.id, dto.selfieUrl);
    return this.usersService.buildPublicUser(user);
  }

  // Soumission d'une pièce d'identité (CNI ou passeport) pour demander le
  // passage au Niveau 2 (validation manuelle par un administrateur ensuite).
  @Put('me/id-document')
  async submitIdDocument(
    @CurrentUser() current: AuthenticatedUser,
    @Body() dto: SubmitIdDocumentDto,
  ): Promise<PublicUser> {
    const user = await this.usersService.submitIdDocument(
      current.id,
      dto.documentUrl,
      dto.documentType,
    );
    return this.usersService.buildPublicUser(user);
  }

  // Bascule particulier ↔ commerce.
  @Patch('me/account-type')
  async updateAccountType(
    @CurrentUser() current: AuthenticatedUser,
    @Body() dto: UpdateAccountTypeDto,
  ): Promise<PublicUser> {
    const user = await this.usersService.updateAccountType(
      current.id,
      dto.accountType,
    );
    return this.usersService.buildPublicUser(user);
  }

  // Rôle affiché au lancement de l'app (client ↔ livreur). Persisté serveur.
  @Patch('me/active-role')
  async updateActiveRole(
    @CurrentUser() current: AuthenticatedUser,
    @Body() dto: UpdateActiveRoleDto,
  ): Promise<PublicUser> {
    const user = await this.usersService.setActiveRole(
      current.id,
      dto.activeRole,
    );
    return this.usersService.buildPublicUser(user);
  }
}
