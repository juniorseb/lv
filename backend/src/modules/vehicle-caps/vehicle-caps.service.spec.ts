import { ConfigService } from '@nestjs/config';

import { VehicleCapsService } from './vehicle-caps.service';

// Politique des modes doux. Source UNIQUE partagée par le matching (filtrage du
// feed) et la garde dure à l'acceptation : si elle dérive, un vélo peut se voir
// proposer une course de 20 km, ou l'inverse — une course légitime refusée.
function makeCaps(env: Record<string, string> = {}): VehicleCapsService {
  const config = { get: (key: string) => env[key] } as unknown as ConfigService;
  return new VehicleCapsService(config);
}

// Abidjan : ~1 degré de latitude ≈ 111 km. 0,009° ≈ 1 km au nord.
const YOPOUGON: number[] = [-4.075, 5.345]; // [lng, lat]
const pointAtKmNorth = (km: number): number[] => [-4.075, 5.345 + km * 0.009];

describe('VehicleCapsService — plafonds par défaut', () => {
  const caps = makeCaps();

  it('plafonne le vélo à 3 km d’approche et 4 km de course', () => {
    expect(caps.approachCapKm('velo')).toBe(3);
    expect(caps.courseCapKm('velo')).toBe(4);
  });

  it('plafonne le livreur à pied plus court que le vélo', () => {
    expect(caps.approachCapKm('a_pied')).toBe(2);
    expect(caps.courseCapKm('a_pied')).toBe(3);
  });

  it('ne plafonne PAS les modes motorisés', () => {
    for (const type of ['moto', 'voiture', 'camionnette']) {
      expect(caps.approachCapKm(type)).toBeNull();
      expect(caps.courseCapKm(type)).toBeNull();
    }
  });
});

describe('VehicleCapsService.effectiveApproachCapsM', () => {
  const caps = makeCaps();

  it('garde le plafond nominal quand la course tient dans les limites', () => {
    const short = caps.effectiveApproachCapsM(2000); // course de 2 km
    expect(short.velo).toBe(3000);
    expect(short.apied).toBe(2000);
  });

  it('EXCLUT le mode (plafond 0) dès que la course dépasse sa limite', () => {
    // 3,5 km : trop long à pied (3 km), encore bon à vélo (4 km).
    const mid = caps.effectiveApproachCapsM(3500);
    expect(mid.velo).toBe(3000);
    expect(mid.apied).toBe(0);

    // 5 km : les deux modes doux sortent.
    const long = caps.effectiveApproachCapsM(5000);
    expect(long.velo).toBe(0);
    expect(long.apied).toBe(0);
  });

  it('traite la limite exacte comme acceptable (<= et non <)', () => {
    expect(caps.effectiveApproachCapsM(4000).velo).toBe(3000); // pile 4 km : OK
    expect(caps.effectiveApproachCapsM(4001).velo).toBe(0); // 1 m de trop
  });
});

describe('VehicleCapsService.violationForAccept (garde dure)', () => {
  const caps = makeCaps();
  const driverNear = pointAtKmNorth(1); // 1 km du retrait

  it('laisse passer une course courte à vélo', () => {
    expect(
      caps.violationForAccept('velo', driverNear, YOPOUGON, pointAtKmNorth(2)),
    ).toBeNull();
  });

  it('refuse une course trop longue à vélo, en nommant le plafond', () => {
    const violation = caps.violationForAccept(
      'velo',
      driverNear,
      YOPOUGON,
      pointAtKmNorth(6), // ~5 km de course
    );
    expect(violation).toContain('vélo');
    expect(violation).toContain('4 km');
  });

  it('refuse un point de récupération trop loin pour un vélo', () => {
    const violation = caps.violationForAccept(
      'velo',
      pointAtKmNorth(5), // livreur à ~4 km, plafond 3 km
      YOPOUGON,
      pointAtKmNorth(1),
    );
    expect(violation).toContain('récupération');
  });

  it('n’impose jamais de plafond à une moto', () => {
    expect(
      caps.violationForAccept(
        'moto',
        pointAtKmNorth(9),
        YOPOUGON,
        pointAtKmNorth(30),
      ),
    ).toBeNull();
  });

  it('vérifie la COURSE même sans position du livreur', () => {
    // Position inconnue : on ne peut pas juger l'approche, mais la course si.
    expect(
      caps.violationForAccept('velo', null, YOPOUGON, pointAtKmNorth(1)),
    ).toBeNull();
    expect(
      caps.violationForAccept('velo', null, YOPOUGON, pointAtKmNorth(10)),
    ).toContain('trop longue');
  });
});

describe('VehicleCapsService.distanceMeters', () => {
  const caps = makeCaps();

  it('mesure une distance connue à ~1 % près', () => {
    // 0,009° de latitude ≈ 1 km.
    const d = caps.distanceMeters(YOPOUGON, pointAtKmNorth(1));
    expect(d).toBeGreaterThan(980);
    expect(d).toBeLessThan(1020);
  });

  it('renvoie 0 pour deux points identiques', () => {
    expect(caps.distanceMeters(YOPOUGON, YOPOUGON)).toBe(0);
  });
});
