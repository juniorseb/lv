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
import { CreateTourDto } from './dto/create-tour.dto';
import {
  CompleteStopDto,
  PickupTourDto,
  ProposeOfferDto,
  ReportProblemDto,
} from './dto/stop-actions.dto';
import { ToursService } from './tours.service';
import {
  ActiveTourView,
  OfferView,
  TourClientView,
  TourFeedCard,
} from './tours.view';

// Tournées (spec-delivery-architecture-tournees). Le client crée une tournée
// multi-arrêts ; le livreur la voit comme UNE mission, l'accepte, collecte, puis
// livre arrêt par arrêt avec le code OTP du destinataire.
@Controller('tours')
@UseGuards(JwtAuthGuard)
export class ToursController {
  constructor(private readonly tours: ToursService) {}

  // --- Client --------------------------------------------------------------

  @Post()
  createTour(
    @CurrentUser() current: AuthenticatedUser,
    @Body() dto: CreateTourDto,
  ): Promise<TourClientView> {
    return this.tours.createTour(current.id, dto);
  }

  // --- Livreur (routes spécifiques avant les routes paramétrées) -----------

  @Get('feed')
  feed(@CurrentUser() current: AuthenticatedUser): Promise<TourFeedCard[]> {
    return this.tours.getFeedForDriver(current.id);
  }

  @Get('active')
  active(
    @CurrentUser() current: AuthenticatedUser,
  ): Promise<ActiveTourView | null> {
    return this.tours.getActiveForDriver(current.id);
  }

  @Get('mine')
  mine(@CurrentUser() current: AuthenticatedUser): Promise<TourClientView[]> {
    return this.tours.listClientTours(current.id);
  }

  @Post('stops/:stopId/complete')
  @HttpCode(HttpStatus.OK)
  completeStop(
    @CurrentUser() current: AuthenticatedUser,
    @Param('stopId', ParseUUIDPipe) stopId: string,
    @Body() dto: CompleteStopDto,
  ): Promise<ActiveTourView> {
    return this.tours.completeStop(
      stopId,
      current.id,
      dto.code,
      dto.proofPhotoUrl,
    );
  }

  @Post('stops/:stopId/problem')
  @HttpCode(HttpStatus.OK)
  reportProblem(
    @CurrentUser() current: AuthenticatedUser,
    @Param('stopId', ParseUUIDPipe) stopId: string,
    @Body() dto: ReportProblemDto,
  ): Promise<ActiveTourView> {
    return this.tours.reportStopProblem(stopId, current.id, dto.reason);
  }

  // --- Négociation de prix (spec §2 bis) -----------------------------------

  // Livreur : proposer un prix pour une tournée.
  @Post(':routeId/offer')
  @HttpCode(HttpStatus.OK)
  proposeOffer(
    @CurrentUser() current: AuthenticatedUser,
    @Param('routeId', ParseUUIDPipe) routeId: string,
    @Body() dto: ProposeOfferDto,
  ): Promise<OfferView> {
    return this.tours.proposeOffer(routeId, current.id, dto.prixProposeFcfa);
  }

  // Client : lister les offres reçues pour sa tournée.
  @Get(':requestId/offers')
  listOffers(
    @CurrentUser() current: AuthenticatedUser,
    @Param('requestId', ParseUUIDPipe) requestId: string,
  ): Promise<OfferView[]> {
    return this.tours.listOffers(requestId, current.id);
  }

  // Client : accepter / refuser une offre.
  @Post('offers/:offerId/accept')
  @HttpCode(HttpStatus.OK)
  acceptOffer(
    @CurrentUser() current: AuthenticatedUser,
    @Param('offerId', ParseUUIDPipe) offerId: string,
  ): Promise<ActiveTourView> {
    return this.tours.acceptOffer(offerId, current.id);
  }

  @Post('offers/:offerId/refuse')
  @HttpCode(HttpStatus.NO_CONTENT)
  refuseOffer(
    @CurrentUser() current: AuthenticatedUser,
    @Param('offerId', ParseUUIDPipe) offerId: string,
  ): Promise<void> {
    return this.tours.refuseOffer(offerId, current.id);
  }

  @Post(':routeId/accept')
  @HttpCode(HttpStatus.OK)
  accept(
    @CurrentUser() current: AuthenticatedUser,
    @Param('routeId', ParseUUIDPipe) routeId: string,
  ): Promise<ActiveTourView> {
    return this.tours.acceptTour(routeId, current.id);
  }

  @Post(':routeId/pickup')
  @HttpCode(HttpStatus.OK)
  pickup(
    @CurrentUser() current: AuthenticatedUser,
    @Param('routeId', ParseUUIDPipe) routeId: string,
    @Body() dto: PickupTourDto,
  ): Promise<ActiveTourView> {
    return this.tours.pickupTour(routeId, current.id, dto.proofPhotoUrl);
  }

  @Get(':requestId')
  clientTour(
    @CurrentUser() current: AuthenticatedUser,
    @Param('requestId', ParseUUIDPipe) requestId: string,
  ): Promise<TourClientView> {
    return this.tours.getClientTour(requestId, current.id);
  }
}
