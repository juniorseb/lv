import { Module } from '@nestjs/common';

import { ProfilesModule } from '../profiles/profiles.module';
import { WalletModule } from '../wallet/wallet.module';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';

// Intégrations Orange Money et Wave for Business pour la recharge du portefeuille.
// Délègue le crédit du solde à WalletService (registre) après confirmation.

@Module({
  imports: [WalletModule, ProfilesModule],
  controllers: [PaymentsController],
  providers: [PaymentsService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
