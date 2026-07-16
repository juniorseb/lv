import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';

import { NotificationsService } from '../notifications/notifications.service';
import { DriverProfilesService } from '../profiles/driver-profiles.service';
import { Wallet } from './entities/wallet.entity';
import {
  PaymentProvider,
  WalletTransaction,
  WalletTransactionType,
} from './entities/wallet-transaction.entity';

interface ApplyParams {
  type: WalletTransactionType;
  amountFcfa: number; // signé : positif = crédit, négatif = débit
  provider?: PaymentProvider;
  providerReference?: string;
  deliveryId?: string;
}

// Registre du Crédit Livrechap (dossier §7). Toutes les écritures (recharge,
// commission, bonus) passent par une transaction SQL qui met à jour le solde de
// façon atomique et journalise l'opération — pas d'incohérence solde / historique.
@Injectable()
export class WalletService {
  private readonly logger = new Logger(WalletService.name);

  private readonly commissionRatePercent: number;
  private readonly commissionMinimumFcfa: number;
  private readonly welcomeBonusFcfa: number;

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly config: ConfigService,
    private readonly driverProfiles: DriverProfilesService,
    private readonly notifications: NotificationsService,
  ) {
    this.commissionRatePercent =
      Number(this.config.get('COMMISSION_RATE_PERCENT')) || 10;
    this.commissionMinimumFcfa =
      Number(this.config.get('COMMISSION_MINIMUM_FCFA')) || 200;
    this.welcomeBonusFcfa =
      Number(this.config.get('WALLET_WELCOME_BONUS_FCFA')) || 500;
  }

  // --- Lecture -------------------------------------------------------------

  async getOrCreateWallet(driverProfileId: string): Promise<Wallet> {
    return this.dataSource.transaction((manager) =>
      this.getOrCreateWalletTx(manager, driverProfileId),
    );
  }

  async listTransactions(
    walletId: string,
    limit = 50,
  ): Promise<WalletTransaction[]> {
    return this.dataSource.getRepository(WalletTransaction).find({
      where: { walletId },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  // Un livreur ne peut accepter une mission que si son solde couvre au moins la
  // commission minimale (blocage de solde bas, dossier §7).
  async canAcceptMission(driverProfileId: string): Promise<boolean> {
    const wallet = await this.getOrCreateWallet(driverProfileId);
    return wallet.balanceFcfa >= this.commissionMinimumFcfa;
  }

  // --- Recharge (appelée par le module payments après confirmation) --------

  // Idempotente par référence fournisseur : un webhook rejoué ne crédite pas
  // deux fois.
  async applyRecharge(
    driverProfileId: string,
    amountFcfa: number,
    provider: PaymentProvider,
    providerReference: string,
  ): Promise<Wallet> {
    return this.dataSource.transaction(async (manager) => {
      const wallet = await this.getOrCreateWalletTx(manager, driverProfileId);

      const already = await manager.findOne(WalletTransaction, {
        where: { type: 'recharge', providerReference },
      });
      if (already) {
        return wallet;
      }

      return this.applyTx(manager, wallet, {
        type: 'recharge',
        amountFcfa: Math.abs(amountFcfa),
        provider,
        providerReference,
      });
    });
  }

  // --- Règlement d'une livraison terminée ----------------------------------

  // Débite la commission puis débloque le bonus de bienvenue si éligible.
  // Idempotent par livraison : sûr à rejouer (job de réconciliation).
  async settleCompletedDelivery(
    driverProfileId: string,
    deliveryId: string,
    priceFcfa: number,
  ): Promise<void> {
    await this.chargeCommission(driverProfileId, deliveryId, priceFcfa);
    await this.grantWelcomeBonusIfEligible(driverProfileId, deliveryId);
  }

  private async chargeCommission(
    driverProfileId: string,
    deliveryId: string,
    priceFcfa: number,
  ): Promise<void> {
    const commission = this.computeCommission(priceFcfa);

    // Solde à alerter renseigné dans la transaction, notifié après commit.
    let lowBalanceAmount: number | null = null;

    await this.dataSource.transaction(async (manager) => {
      const wallet = await this.getOrCreateWalletTx(manager, driverProfileId);

      const already = await manager.findOne(WalletTransaction, {
        where: { type: 'commission', deliveryId },
      });
      if (already) {
        return;
      }

      const updated = await this.applyTx(manager, wallet, {
        type: 'commission',
        amountFcfa: -commission,
        provider: 'systeme',
        deliveryId,
      });

      if (updated.balanceFcfa < updated.lowBalanceAlertThreshold) {
        lowBalanceAmount = updated.balanceFcfa;
      }
    });

    if (lowBalanceAmount !== null) {
      await this.notifyLowBalance(driverProfileId, lowBalanceAmount);
    }
  }

  // Alerte de solde bas avant blocage des nouvelles missions (dossier §7).
  private async notifyLowBalance(
    driverProfileId: string,
    balanceFcfa: number,
  ): Promise<void> {
    const driver = await this.driverProfiles.findById(driverProfileId);
    if (!driver) {
      return;
    }
    await this.notifications.sendToUser(driver.userId, {
      title: 'Solde bas 💳',
      body: `Il vous reste ${balanceFcfa} FCFA. Rechargez pour continuer à accepter des missions.`,
      data: { type: 'low_balance' },
    });
  }

  private async grantWelcomeBonusIfEligible(
    driverProfileId: string,
    deliveryId: string,
  ): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const wallet = await this.getOrCreateWalletTx(manager, driverProfileId);
      if (wallet.welcomeBonusClaimed) {
        return;
      }

      await manager.update(Wallet, { id: wallet.id }, {
        welcomeBonusClaimed: true,
      });
      await this.applyTx(manager, wallet, {
        type: 'bonus',
        amountFcfa: Math.abs(this.welcomeBonusFcfa),
        provider: 'systeme',
        deliveryId,
      });
    });
  }

  // Commission = pourcentage du prix, avec un plancher (dossier §7).
  computeCommission(priceFcfa: number): number {
    const percentage = Math.round((priceFcfa * this.commissionRatePercent) / 100);
    return Math.max(percentage, this.commissionMinimumFcfa);
  }

  // --- Helpers transactionnels ---------------------------------------------

  private async getOrCreateWalletTx(
    manager: EntityManager,
    driverProfileId: string,
  ): Promise<Wallet> {
    const existing = await manager.findOne(Wallet, {
      where: { driverId: driverProfileId },
    });
    if (existing) {
      return existing;
    }
    const wallet = manager.create(Wallet, { driverId: driverProfileId });
    return manager.save(wallet);
  }

  // Met à jour le solde de façon atomique (SET balance = balance + delta) et
  // journalise l'opération, puis renvoie le portefeuille rechargé.
  private async applyTx(
    manager: EntityManager,
    wallet: Wallet,
    params: ApplyParams,
  ): Promise<Wallet> {
    await manager.increment(
      Wallet,
      { id: wallet.id },
      'balanceFcfa',
      params.amountFcfa,
    );
    await manager.insert(WalletTransaction, {
      walletId: wallet.id,
      type: params.type,
      amountFcfa: params.amountFcfa,
      provider: params.provider ?? null,
      providerReference: params.providerReference ?? null,
      deliveryId: params.deliveryId ?? null,
    });
    return manager.findOneOrFail(Wallet, { where: { id: wallet.id } });
  }
}
