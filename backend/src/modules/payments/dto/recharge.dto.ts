import { IsIn, IsInt, Min } from 'class-validator';

// Fournisseurs Mobile Money supportés pour la recharge (dossier §7/§10).
export type RechargeProvider = 'orange_money' | 'wave';

// Recharge du Crédit Livrechap. Le montant minimal est appliqué côté service
// (WALLET_MINIMUM_RECHARGE_FCFA) ; on garde ici une borne basse de sécurité.
export class RechargeDto {
  @IsInt()
  @Min(1)
  amountFcfa: number;

  @IsIn(['orange_money', 'wave'])
  provider: RechargeProvider;
}
