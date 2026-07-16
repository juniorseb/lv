import { authedRequest } from './http';
import { RechargeProvider, RechargeResult, Wallet, WalletTransaction } from './types';

export const walletApi = {
  getMyWallet: () => authedRequest<Wallet>('/wallet/me'),

  getMyTransactions: () =>
    authedRequest<WalletTransaction[]>('/wallet/me/transactions'),

  // Recharge du Crédit Livrechap (Orange Money / Wave). En mode sandbox côté
  // backend, la recharge est confirmée immédiatement.
  recharge: (amountFcfa: number, provider: RechargeProvider) =>
    authedRequest<RechargeResult>('/payments/recharge', {
      method: 'POST',
      body: { amountFcfa, provider },
    }),
};
