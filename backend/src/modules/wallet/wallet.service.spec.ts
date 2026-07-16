import { ConfigService } from '@nestjs/config';

import { WalletService } from './wallet.service';

// Règle de commission (dossier §7) : c'est de l'argent réellement prélevé sur la
// caution du livreur. Une régression ici se paie en litiges, pas en bugs.
//
// computeCommission ne touche ni la base ni les notifications : on instancie le
// service avec des dépendances factices plutôt que de monter un module Nest.
function makeWallet(env: Record<string, string> = {}): WalletService {
  const config = {
    get: (key: string) => env[key],
  } as unknown as ConfigService;
  return new WalletService(
    {} as never, // DataSource — inutilisé par computeCommission
    config,
    {} as never, // DriverProfilesService
    {} as never, // NotificationsService
  );
}

describe('WalletService.computeCommission', () => {
  const wallet = makeWallet();

  it('prélève 10 % au-dessus du plancher', () => {
    expect(wallet.computeCommission(3000)).toBe(300);
    expect(wallet.computeCommission(10000)).toBe(1000);
  });

  it('applique le plancher de 200 FCFA sur les petites courses', () => {
    // 10 % de 1500 = 150 → sous le plancher, on prélève 200.
    expect(wallet.computeCommission(1500)).toBe(200);
    expect(wallet.computeCommission(500)).toBe(200);
    expect(wallet.computeCommission(0)).toBe(200);
  });

  it('bascule exactement à 2000 FCFA, le point de rencontre plancher/pourcentage', () => {
    expect(wallet.computeCommission(1999)).toBe(200); // 199,9 → arrondi 200
    expect(wallet.computeCommission(2000)).toBe(200); // pile 10 % = 200
    expect(wallet.computeCommission(2010)).toBe(201); // au-dessus, le % prend le relais
  });

  it('arrondit au FCFA le plus proche (jamais de centime)', () => {
    expect(wallet.computeCommission(2505)).toBe(251); // 250,5 → 251
    expect(wallet.computeCommission(2504)).toBe(250); // 250,4 → 250
    expect(Number.isInteger(wallet.computeCommission(3333))).toBe(true);
  });

  it('ne renvoie jamais une commission négative ou nulle', () => {
    for (const price of [0, 1, 100, 999, 1500, 50000]) {
      expect(wallet.computeCommission(price)).toBeGreaterThan(0);
    }
  });

  it('respecte la configuration (taux et plancher surchargeables)', () => {
    const custom = makeWallet({
      COMMISSION_RATE_PERCENT: '20',
      COMMISSION_MINIMUM_FCFA: '500',
    });
    expect(custom.computeCommission(5000)).toBe(1000); // 20 %
    expect(custom.computeCommission(1000)).toBe(500); // plancher
  });
});
