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

import { AuthenticatedUser } from '../../common/auth/authenticated-user';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { DeliveriesService } from './deliveries.service';
import { DeliveryView, toDeliveryView } from './delivery.view';
import { CancelDeliveryDto } from './dto/cancel-delivery.dto';
import { CompleteDeliveryDto } from './dto/complete-delivery.dto';
import { CreateDeliveryDto } from './dto/create-delivery.dto';

// Livraisons : publication par l'expéditeur, suivi de statut et transitions
// livreur (accepter, récupérer, valider avec le code). Toutes les routes sont
// protégées. La recherche de livreurs à proximité relève du module matching.
@Controller('deliveries')
@UseGuards(JwtAuthGuard)
export class DeliveriesController {
  constructor(private readonly deliveries: DeliveriesService) {}

  // Publication (« Trouver un livreur »). Renvoie la vue expéditeur (avec code).
  @Post()
  async create(
    @CurrentUser() current: AuthenticatedUser,
    @Body() dto: CreateDeliveryDto,
  ): Promise<DeliveryView> {
    const delivery = await this.deliveries.create(current.id, dto);
    return toDeliveryView(delivery, true);
  }

  // Mes livraisons (en tant qu'expéditeur).
  @Get('me')
  async listMine(
    @CurrentUser() current: AuthenticatedUser,
  ): Promise<DeliveryView[]> {
    const list = await this.deliveries.listForSender(current.id);
    return list.map((d) => toDeliveryView(d, true));
  }

  // Course en cours du livreur connecté (pour reprendre le suivi au démarrage).
  // Déclaré avant :id pour ne pas être capturé par le paramètre.
  @Get('driver/active')
  async activeForDriver(
    @CurrentUser() current: AuthenticatedUser,
  ): Promise<DeliveryView | null> {
    const delivery = await this.deliveries.findActiveForDriver(current.id);
    return delivery ? toDeliveryView(delivery, false) : null;
  }

  // Tableau de bord des gains du livreur (nb livraisons + revenu encaissé).
  @Get('driver/earnings')
  driverEarnings(@CurrentUser() current: AuthenticatedUser) {
    return this.deliveries.driverEarnings(current.id);
  }

  // Disponibilité temps réel du livreur (DriverStatus : online/offline/busy).
  @Get('driver/presence')
  driverPresence(@CurrentUser() current: AuthenticatedUser) {
    return this.deliveries.getDriverPresence(current.id);
  }

  // Activité du jour (gains + livraisons) pour l'accueil livreur.
  @Get('driver/today')
  driverToday(@CurrentUser() current: AuthenticatedUser) {
    return this.deliveries.driverToday(current.id);
  }

  // Historique des courses du livreur connecté (terminées / annulées).
  @Get('driver/history')
  async driverHistory(
    @CurrentUser() current: AuthenticatedUser,
  ): Promise<DeliveryView[]> {
    const list = await this.deliveries.historyForDriver(current.id);
    return list.map((d) => toDeliveryView(d, false));
  }

  // Position courante du livreur assigné (suivi carte). null si pas encore de
  // livreur ou position inconnue.
  @Get(':id/driver-location')
  driverLocation(
    @CurrentUser() current: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.deliveries.getDriverLocation(id, current.id);
  }

  // Détail : expéditeur et destinataire (avec code), livreur assigné et contact
  // de récupération (sans). Destinataire/contact sont rapprochés par numéro.
  @Get(':id')
  async getOne(
    @CurrentUser() current: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<DeliveryView> {
    const { delivery, canSeeCode } = await this.deliveries.getForUser(
      id,
      current.id,
      current.phoneNumber,
    );
    return toDeliveryView(delivery, canSeeCode);
  }

  // L'expéditeur annule (avant récupération du colis), avec un motif.
  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  async cancel(
    @CurrentUser() current: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CancelDeliveryDto,
  ): Promise<DeliveryView> {
    const delivery = await this.deliveries.cancelBySender(
      id,
      current.id,
      dto.reason,
    );
    return toDeliveryView(delivery, true);
  }

  // Un livreur accepte la livraison (recherche → livreur_trouve).
  @Post(':id/accept')
  @HttpCode(HttpStatus.OK)
  async accept(
    @CurrentUser() current: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<DeliveryView> {
    const delivery = await this.deliveries.accept(id, current.id);
    return toDeliveryView(delivery, false);
  }

  // Le livreur récupère le colis (livreur_trouve → colis_recupere).
  @Post(':id/pickup')
  @HttpCode(HttpStatus.OK)
  async pickup(
    @CurrentUser() current: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<DeliveryView> {
    const delivery = await this.deliveries.markPickedUp(id, current.id);
    return toDeliveryView(delivery, false);
  }

  // Le livreur valide « Livré » avec le code (colis_recupere → terminee).
  @Post(':id/complete')
  @HttpCode(HttpStatus.OK)
  async complete(
    @CurrentUser() current: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CompleteDeliveryDto,
  ): Promise<DeliveryView> {
    const delivery = await this.deliveries.complete(id, current.id, dto.code);
    return toDeliveryView(delivery, false);
  }
}
