import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';

import { AdminGuard } from '../../common/auth/admin.guard';
import { AuthenticatedUser } from '../../common/auth/authenticated-user';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { DriverDocumentView } from '../profiles/profile.view';
import { AdminService, AdminStats } from './admin.service';
import { AdminDriverView } from './admin-driver.view';
import { AdminUserView } from './admin-user.view';
import { SetDocumentStatusDto } from './dto/set-document-status.dto';
import { SetDriverStatusDto } from './dto/set-driver-status.dto';

// Back-office Livrechap. Toutes les routes exigent un compte administrateur.
@Controller('admin')
@UseGuards(AdminGuard)
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('stats')
  getStats(): Promise<AdminStats> {
    return this.admin.getStats();
  }

  // Comptes en attente de validation CNI (Niveau 2).
  @Get('verifications/pending')
  listPending(): Promise<AdminUserView[]> {
    return this.admin.listPendingVerifications();
  }

  @Post('users/:id/verify')
  @HttpCode(HttpStatus.OK)
  verify(@Param('id', ParseUUIDPipe) id: string): Promise<AdminUserView> {
    return this.admin.verifyUser(id);
  }

  @Post('users/:id/reject')
  @HttpCode(HttpStatus.OK)
  reject(@Param('id', ParseUUIDPipe) id: string): Promise<AdminUserView> {
    return this.admin.rejectVerification(id);
  }

  // --- Validation des livreurs (spec-onboarding-livreur-v2 §4) -------------

  // Livreurs en attente de validation.
  @Get('drivers/pending')
  listPendingDrivers(): Promise<AdminDriverView[]> {
    return this.admin.listPendingDrivers();
  }

  // Tous les livreurs (suivi + validation).
  @Get('drivers')
  listDrivers(): Promise<AdminDriverView[]> {
    return this.admin.listAllDrivers();
  }

  // Active ou suspend un livreur.
  @Post('drivers/:id/status')
  @HttpCode(HttpStatus.OK)
  setDriverStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetDriverStatusDto,
  ): Promise<AdminDriverView> {
    return this.admin.setDriverStatus(id, dto.status);
  }

  // Conversation d'une livraison (litiges/support) — conservée pour l'admin
  // même après fermeture côté client/livreur (spec-communication).
  @Get('deliveries/:id/messages')
  deliveryMessages(@Param('id', ParseUUIDPipe) id: string) {
    return this.admin.getDeliveryMessages(id);
  }

  // Alertes Livrechap Protect actives (support) + résolution.
  @Get('sos')
  activeSos() {
    return this.admin.listActiveSos();
  }

  @Post('sos/:id/resolve')
  @HttpCode(HttpStatus.OK)
  resolveSos(
    @CurrentUser() current: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.admin.resolveSos(id, current.id);
  }

  // Valide ou rejette un document du livreur.
  @Post('documents/:id/status')
  @HttpCode(HttpStatus.OK)
  setDocumentStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetDocumentStatusDto,
  ): Promise<DriverDocumentView> {
    return this.admin.setDocumentStatus(id, dto.status);
  }
}
