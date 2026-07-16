import { Wallet } from './entities/wallet.entity';
import { WalletTransaction } from './entities/wallet-transaction.entity';

export interface WalletView {
  id: string;
  driverId: string;
  balanceFcfa: number;
  welcomeBonusClaimed: boolean;
  lowBalanceAlertThreshold: number;
  // true quand le solde passe sous le seuil d'alerte (déclenche l'invitation à
  // recharger avant blocage des nouvelles missions).
  lowBalance: boolean;
}

export function toWalletView(wallet: Wallet): WalletView {
  return {
    id: wallet.id,
    driverId: wallet.driverId,
    balanceFcfa: wallet.balanceFcfa,
    welcomeBonusClaimed: wallet.welcomeBonusClaimed,
    lowBalanceAlertThreshold: wallet.lowBalanceAlertThreshold,
    lowBalance: wallet.balanceFcfa < wallet.lowBalanceAlertThreshold,
  };
}

export interface WalletTransactionView {
  id: string;
  type: string;
  amountFcfa: number;
  provider: string | null;
  providerReference: string | null;
  deliveryId: string | null;
  createdAt: Date;
}

export function toWalletTransactionView(
  tx: WalletTransaction,
): WalletTransactionView {
  return {
    id: tx.id,
    type: tx.type,
    amountFcfa: tx.amountFcfa,
    provider: tx.provider,
    providerReference: tx.providerReference,
    deliveryId: tx.deliveryId,
    createdAt: tx.createdAt,
  };
}
