import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';

import { AuthenticatedUser } from '../../common/auth/authenticated-user';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { RechargeDto } from './dto/recharge.dto';
import { PaymentsService, RechargeResult } from './payments.service';

// Recharge du Crédit Livrechap via Orange Money / Wave.
@Controller('payments')
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  // Le livreur connecté initie une recharge (confirmée immédiatement en sandbox).
  @Post('recharge')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  recharge(
    @CurrentUser() current: AuthenticatedUser,
    @Body() dto: RechargeDto,
  ): Promise<RechargeResult> {
    return this.payments.initiateRecharge(current.id, dto);
  }

  // Callback fournisseur (mode live). Non authentifié par JWT : la sécurité
  // repose sur la vérification de signature du webhook (à brancher).
  @Post('webhook/:provider')
  @HttpCode(HttpStatus.OK)
  async webhook(
    @Param('provider') provider: string,
    @Body() payload: unknown,
  ): Promise<{ received: true }> {
    await this.payments.confirmWebhook(provider, payload);
    return { received: true };
  }
}
