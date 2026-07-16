import { Controller, Get, UseGuards } from '@nestjs/common';

import { AuthenticatedUser } from '../../common/auth/authenticated-user';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { DriverProfilesService } from '../profiles/driver-profiles.service';
import { WalletService } from './wallet.service';
import {
  toWalletTransactionView,
  toWalletView,
  WalletTransactionView,
  WalletView,
} from './wallet.view';

// Portefeuille du livreur connecté : solde et historique. Les mouvements
// d'argent (recharge) passent par le module payments.
@Controller('wallet')
@UseGuards(JwtAuthGuard)
export class WalletController {
  constructor(
    private readonly wallet: WalletService,
    private readonly driverProfiles: DriverProfilesService,
  ) {}

  @Get('me')
  async myWallet(
    @CurrentUser() current: AuthenticatedUser,
  ): Promise<WalletView> {
    const driver = await this.driverProfiles.getByUserIdOrFail(current.id);
    const wallet = await this.wallet.getOrCreateWallet(driver.id);
    return toWalletView(wallet);
  }

  @Get('me/transactions')
  async myTransactions(
    @CurrentUser() current: AuthenticatedUser,
  ): Promise<WalletTransactionView[]> {
    const driver = await this.driverProfiles.getByUserIdOrFail(current.id);
    const wallet = await this.wallet.getOrCreateWallet(driver.id);
    const transactions = await this.wallet.listTransactions(wallet.id);
    return transactions.map(toWalletTransactionView);
  }
}
