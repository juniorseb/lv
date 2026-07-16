import { randomUUID } from 'crypto';

import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { DriverProfilesService } from '../profiles/driver-profiles.service';
import { WalletService } from '../wallet/wallet.service';
import { toWalletView, WalletView } from '../wallet/wallet.view';
import { RechargeDto, RechargeProvider } from './dto/recharge.dto';

export interface RechargeResult {
  reference: string;
  provider: RechargeProvider;
  amountFcfa: number;
  status: 'confirmed' | 'pending';
  // Renseigné quand la recharge est confirmée (mode sandbox), sinon null.
  wallet: WalletView | null;
  message: string;
}

// Intégration paiement / recharge (dossier §7/§10 : Orange Money + Wave).
//
// Séparation des responsabilités : ce module gère le mouvement d'argent auprès
// du fournisseur ; le crédit du solde est délégué à WalletService (le registre).
//
// PAYMENTS_MODE :
//  - "sandbox" (défaut, dev) : la recharge est confirmée immédiatement et le
//    solde crédité, pour tester le parcours sans API réelle.
//  - "live" : la recharge est initiée auprès d'Orange Money / Wave et reste en
//    attente jusqu'au webhook de confirmation (intégration réelle à brancher).
@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  private readonly mode: string;
  private readonly minimumRechargeFcfa: number;

  constructor(
    private readonly config: ConfigService,
    private readonly wallet: WalletService,
    private readonly driverProfiles: DriverProfilesService,
  ) {
    this.mode = (this.config.get<string>('PAYMENTS_MODE') ?? 'sandbox').toLowerCase();
    this.minimumRechargeFcfa =
      Number(this.config.get('WALLET_MINIMUM_RECHARGE_FCFA')) || 1000;
  }

  async initiateRecharge(
    userId: string,
    dto: RechargeDto,
  ): Promise<RechargeResult> {
    if (dto.amountFcfa < this.minimumRechargeFcfa) {
      throw new BadRequestException(
        `Le montant minimum de recharge est de ${this.minimumRechargeFcfa} FCFA.`,
      );
    }

    const driver = await this.driverProfiles.getByUserIdOrFail(userId);
    const reference = randomUUID();

    if (this.mode === 'live') {
      // TODO(V1) : appeler l'API Orange Money / Wave for Business pour créer le
      // paiement, puis attendre la confirmation via confirmWebhook().
      this.logger.warn(
        `Mode paiement "live" non branché — recharge ${reference} laissée en attente.`,
      );
      return {
        reference,
        provider: dto.provider,
        amountFcfa: dto.amountFcfa,
        status: 'pending',
        wallet: null,
        message:
          'Recharge initiée. Confirmez le paiement sur votre application Mobile Money.',
      };
    }

    // Mode sandbox : confirmation immédiate.
    const wallet = await this.wallet.applyRecharge(
      driver.id,
      dto.amountFcfa,
      dto.provider,
      reference,
    );

    return {
      reference,
      provider: dto.provider,
      amountFcfa: dto.amountFcfa,
      status: 'confirmed',
      wallet: toWalletView(wallet),
      message: 'Recharge effectuée.',
    };
  }

  // Confirmation d'une recharge par le fournisseur (mode live).
  // TODO(V1) : vérifier la signature du webhook, retrouver l'intention de
  // paiement par sa référence (montant, livreur) puis créditer via
  // WalletService.applyRecharge. Non fonctionnel tant que le mode live n'est pas
  // branché ; documenté ici pour figer le point d'entrée.
  async confirmWebhook(provider: string, payload: unknown): Promise<void> {
    this.logger.warn(
      `Webhook paiement reçu (${provider}) mais non traité : intégration live à brancher.`,
    );
    void payload;
  }
}
