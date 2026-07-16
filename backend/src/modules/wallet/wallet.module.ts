import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { NotificationsModule } from '../notifications/notifications.module';
import { ProfilesModule } from '../profiles/profiles.module';
import { Wallet } from './entities/wallet.entity';
import { WalletTransaction } from './entities/wallet-transaction.entity';
import { WalletController } from './wallet.controller';
import { WalletService } from './wallet.service';

// Crédit Livrechap : recharge Orange Money/Wave, débit automatique de commission.
// WalletService est exporté : le module deliveries prélève la commission à la
// livraison confirmée, et le module payments crédite après recharge.

@Module({
  imports: [
    TypeOrmModule.forFeature([Wallet, WalletTransaction]),
    ProfilesModule,
    NotificationsModule,
  ],
  controllers: [WalletController],
  providers: [WalletService],
  exports: [WalletService, TypeOrmModule],
})
export class WalletModule {}
