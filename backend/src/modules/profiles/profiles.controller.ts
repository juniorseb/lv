import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';

import { AuthenticatedUser } from '../../common/auth/authenticated-user';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { CommerceProfilesService } from './commerce-profiles.service';
import { DriverDocumentsService } from './driver-documents.service';
import { DriverProfilesService } from './driver-profiles.service';
import { UpsertCommerceProfileDto } from './dto/commerce-profile.dto';
import { SubmitDriverDocumentDto } from './dto/driver-document.dto';
import { SetMobileMoneyDto } from './dto/mobile-money.dto';
import {
  CreateDriverProfileDto,
  UpdateDriverProfileDto,
} from './dto/driver-profile.dto';
import { UpsertVehicleDto } from './dto/vehicle.dto';
import {
  CommerceProfileView,
  DriverDocumentView,
  DriverProfileView,
  VehicleView,
  toCommerceProfileView,
  toDriverDocumentView,
  toDriverProfileView,
  toVehicleView,
} from './profile.view';
import { VehiclesService } from './vehicles.service';

// Profils de rôle du compte connecté : livreur et commerce.
// « Un même compte peut utiliser les deux rôles, sans réinscription » (dossier §4).
@Controller('profiles')
@UseGuards(JwtAuthGuard)
export class ProfilesController {
  constructor(
    private readonly driverProfiles: DriverProfilesService,
    private readonly driverDocuments: DriverDocumentsService,
    private readonly vehicles: VehiclesService,
    private readonly commerceProfiles: CommerceProfilesService,
  ) {}

  // --- Livreur -------------------------------------------------------------

  // Activation du rôle livreur (« Je suis livreur »).
  @Post('driver')
  async createDriver(
    @CurrentUser() current: AuthenticatedUser,
    @Body() dto: CreateDriverProfileDto,
  ): Promise<DriverProfileView> {
    const profile = await this.driverProfiles.create(current.id, dto);
    return toDriverProfileView(profile);
  }

  @Get('driver/me')
  async getDriver(
    @CurrentUser() current: AuthenticatedUser,
  ): Promise<DriverProfileView> {
    const profile = await this.driverProfiles.getByUserIdOrFail(current.id);
    return toDriverProfileView(profile);
  }

  @Patch('driver/me')
  async updateDriver(
    @CurrentUser() current: AuthenticatedUser,
    @Body() dto: UpdateDriverProfileDto,
  ): Promise<DriverProfileView> {
    const profile = await this.driverProfiles.updateVehicleType(current.id, dto);
    return toDriverProfileView(profile);
  }

  // Documents du livreur (spec-onboarding-livreur-v2 §1 étape 4).
  @Get('driver/documents')
  async listDriverDocuments(
    @CurrentUser() current: AuthenticatedUser,
  ): Promise<DriverDocumentView[]> {
    const docs = await this.driverDocuments.listForUser(current.id);
    return docs.map(toDriverDocumentView);
  }

  @Post('driver/documents')
  async submitDriverDocument(
    @CurrentUser() current: AuthenticatedUser,
    @Body() dto: SubmitDriverDocumentDto,
  ): Promise<DriverDocumentView> {
    const doc = await this.driverDocuments.submitForUser(
      current.id,
      dto.type,
      dto.url,
      dto.dateExpiration,
    );
    return toDriverDocumentView(doc);
  }

  // Véhicule du livreur (spec-onboarding-livreur-v2 §1 étape 3).
  @Get('driver/vehicle')
  async getVehicle(
    @CurrentUser() current: AuthenticatedUser,
  ): Promise<VehicleView | null> {
    const vehicle = await this.vehicles.getForUser(current.id);
    return vehicle ? toVehicleView(vehicle) : null;
  }

  @Post('driver/vehicle')
  async upsertVehicle(
    @CurrentUser() current: AuthenticatedUser,
    @Body() dto: UpsertVehicleDto,
  ): Promise<VehicleView> {
    const vehicle = await this.vehicles.upsertForUser(current.id, dto);
    return toVehicleView(vehicle);
  }

  // Multi-véhicules (P2). La route « vehicle » (singulier) gère le véhicule
  // actif ; « vehicles » (pluriel) gère la flotte.
  @Get('driver/vehicles')
  async listVehicles(
    @CurrentUser() current: AuthenticatedUser,
  ): Promise<VehicleView[]> {
    const list = await this.vehicles.listForUser(current.id);
    return list.map(toVehicleView);
  }

  @Post('driver/vehicles')
  async addVehicle(
    @CurrentUser() current: AuthenticatedUser,
    @Body() dto: UpsertVehicleDto,
  ): Promise<VehicleView> {
    const vehicle = await this.vehicles.addForUser(current.id, dto);
    return toVehicleView(vehicle);
  }

  @Post('driver/vehicles/:id/activate')
  @HttpCode(HttpStatus.OK)
  async activateVehicle(
    @CurrentUser() current: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<VehicleView> {
    const vehicle = await this.vehicles.activateForUser(current.id, id);
    return toVehicleView(vehicle);
  }

  @Delete('driver/vehicles/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteVehicle(
    @CurrentUser() current: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.vehicles.deleteForUser(current.id, id);
  }

  // Compte mobile money d'alimentation de la caution (spec-onboarding-livreur-v2
  // §1 étape 5). Livrechap ne verse rien au livreur : pas de « payout ».
  @Post('driver/mobile-money')
  async setMobileMoney(
    @CurrentUser() current: AuthenticatedUser,
    @Body() dto: SetMobileMoneyDto,
  ): Promise<DriverProfileView> {
    const profile = await this.driverProfiles.setMobileMoney(
      current.id,
      dto.operator,
      dto.number,
      dto.holder,
    );
    return toDriverProfileView(profile);
  }

  // --- Commerce ------------------------------------------------------------

  // Création ou mise à jour du profil commerce.
  @Post('commerce')
  async upsertCommerce(
    @CurrentUser() current: AuthenticatedUser,
    @Body() dto: UpsertCommerceProfileDto,
  ): Promise<CommerceProfileView> {
    const profile = await this.commerceProfiles.upsert(current.id, dto);
    return toCommerceProfileView(profile);
  }

  @Get('commerce/me')
  async getCommerce(
    @CurrentUser() current: AuthenticatedUser,
  ): Promise<CommerceProfileView> {
    const profile = await this.commerceProfiles.getByUserIdOrFail(current.id);
    return toCommerceProfileView(profile);
  }
}
