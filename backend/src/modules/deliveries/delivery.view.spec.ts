import { toDeliveryView } from './delivery.view';
import { Delivery } from './entities/delivery.entity';

// Le code de livraison est la PREUVE de remise : s'il fuit vers le livreur, il
// peut valider une course sans avoir remis le colis. Ce mapper est la dernière
// barrière avant la réponse HTTP — d'où un test dédié.
function makeDelivery(over: Partial<Delivery> = {}): Delivery {
  return {
    id: 'd1',
    senderId: 'u-client',
    driverId: null,
    status: 'recherche',
    matchingMode: 'rapide',
    pickupAddress: 'Yopougon',
    pickupLocation: { type: 'Point', coordinates: [-4.075, 5.345] },
    dropoffAddress: 'Bingerville',
    dropoffLocation: { type: 'Point', coordinates: [-3.885, 5.356] },
    recipientName: 'Jérémie',
    recipientPhone: '+2250700000003',
    pickupContactName: 'Awa',
    pickupContactPhone: '+2250700000002',
    pickupNote: null,
    dropoffNote: null,
    priceFcfa: 3000,
    packageType: 'petit_colis',
    description: null,
    photoUrl: null,
    searchRadiusKm: 2,
    urgency: 'normal',
    scheduledAt: null,
    expiresAt: null,
    notifiedRingIndex: 0,
    isCod: false,
    codArticleAmountFcfa: null,
    deliveryCode: '5520',
    createdAt: new Date('2026-07-17T10:00:00Z'),
    matchedAt: null,
    pickedUpAt: null,
    completedAt: null,
    cancelledAt: null,
    ...over,
  } as Delivery;
}

describe('toDeliveryView — exposition du code de livraison', () => {
  it('expose le code quand includeCode est vrai (auteur, destinataire)', () => {
    const view = toDeliveryView(makeDelivery(), true);
    expect(view.deliveryCode).toBe('5520');
  });

  it('OMET totalement le code quand includeCode est faux (livreur, contact retrait)', () => {
    const view = toDeliveryView(makeDelivery(), false);
    // Le champ doit être ABSENT, pas à null : une clé présente inviterait à
    // l'afficher, et un null se sérialise quand même dans la réponse.
    expect(view.deliveryCode).toBeUndefined();
    expect('deliveryCode' in view).toBe(false);
    expect(JSON.stringify(view)).not.toContain('5520');
  });

  it('n’expose jamais le code même quand la course est terminée', () => {
    const view = toDeliveryView(
      makeDelivery({ status: 'terminee', completedAt: new Date() }),
      false,
    );
    expect(JSON.stringify(view)).not.toContain('5520');
  });
});

describe('toDeliveryView — champs métier', () => {
  it('transpose les coordonnées GeoJSON [lng, lat] vers latitude/longitude', () => {
    const view = toDeliveryView(makeDelivery(), false);
    // Inverser lng/lat enverrait les livreurs à l'autre bout du monde.
    expect(view.pickup.longitude).toBe(-4.075);
    expect(view.pickup.latitude).toBe(5.345);
    expect(view.dropoff.longitude).toBe(-3.885);
    expect(view.dropoff.latitude).toBe(5.356);
  });

  it('expose les DEUX contacts : récupération et destinataire', () => {
    const view = toDeliveryView(makeDelivery(), false);
    // Le livreur doit joindre Awa au retrait, puis Jérémie à la livraison.
    expect(view.pickupContactPhone).toBe('+2250700000002');
    expect(view.recipientPhone).toBe('+2250700000003');
  });

  it('remonte la fenêtre de recherche pour le décompte', () => {
    const expiresAt = new Date('2026-07-17T10:03:00Z');
    const view = toDeliveryView(makeDelivery({ expiresAt }), true);
    expect(view.expiresAt).toEqual(expiresAt);
  });
});
