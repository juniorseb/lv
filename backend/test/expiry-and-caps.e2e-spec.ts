import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import request from 'supertest';

import { DeliveriesService } from '../src/modules/deliveries/deliveries.service';
import {
  auth,
  bootApp,
  createDelivery,
  createDriverProfile,
  login,
  makeDriverReady,
} from './helpers';

// Deux règles qui décident QUI voit QUOI, et jusqu'à quand.
//
// L'expiration est pilotée par le temps : plutôt que d'attendre 3 minutes, on
// force `expires_at` dans le passé — c'est exactement ce que le job constatera.
const YOP = { address: 'Yopougon', latitude: 5.345, longitude: -4.075 };
const kmNorth = (km: number) => 5.345 + km * 0.009;

describe('Expiration de la recherche (e2e)', () => {
  let app: INestApplication;
  let ds: DataSource;
  let client: string;
  let driver: string;

  beforeAll(async () => {
    app = await bootApp();
    ds = app.get(DataSource);
    client = await login(app, '0700000201');
    driver = await login(app, '0700000202');
    await createDriverProfile(app, driver);
    await makeDriverReady(app, '+2250700000202', {
      lat: kmNorth(1),
      lng: -4.075,
    });
  });

  afterAll(async () => {
    await app?.close();
  });

  const expire = (id: string) =>
    ds.query(`UPDATE deliveries SET expires_at = now() - interval '1 second' WHERE id = $1`, [id]);

  it('retire la course du feed dès le délai dépassé, sans attendre le job', async () => {
    const d = await createDelivery(app, client, { pickup: YOP });
    const avant = await request(app.getHttpServer())
      .get('/drivers/me/missions')
      .set(auth(driver));
    expect(avant.body.some((m: any) => m.deliveryId === d.id)).toBe(true);

    await expire(d.id);

    const apres = await request(app.getHttpServer())
      .get('/drivers/me/missions')
      .set(auth(driver));
    // Le filtre SQL exclut immédiatement : aucune fenêtre où un livreur
    // accepterait une course déjà morte.
    expect(apres.body.some((m: any) => m.deliveryId === d.id)).toBe(false);
  });

  it('refuse l’acceptation d’une course expirée, même avant le passage du job', async () => {
    const d = await createDelivery(app, client, { pickup: YOP });
    await expire(d.id);

    const res = await request(app.getHttpServer())
      .post(`/deliveries/${d.id}/accept`)
      .set(auth(driver));
    expect(res.status).toBe(409);
  });

  it('bascule en « expiree » et laisse la course consultable par son auteur', async () => {
    const d = await createDelivery(app, client, { pickup: YOP });
    await expire(d.id);

    const nb = await app.get(DeliveriesService).expireOverdueSearches();
    expect(nb).toBeGreaterThanOrEqual(1);

    const vue = await request(app.getHttpServer())
      .get(`/deliveries/${d.id}`)
      .set(auth(client));
    expect(vue.body.status).toBe('expiree');
  });

  it('n’expire jamais une course déjà acceptée', async () => {
    const d = await createDelivery(app, client, { pickup: YOP });
    await request(app.getHttpServer())
      .post(`/deliveries/${d.id}/accept`)
      .set(auth(driver));
    // Même avec une échéance dépassée : le livreur roule, on ne l'annule pas.
    await expire(d.id);

    await app.get(DeliveriesService).expireOverdueSearches();

    const vue = await request(app.getHttpServer())
      .get(`/deliveries/${d.id}`)
      .set(auth(client));
    expect(vue.body.status).toBe('livreur_trouve');
  });

  it('est idempotent : un second balayage ne rebascule rien', async () => {
    const d = await createDelivery(app, client, { pickup: YOP });
    await expire(d.id);
    const svc = app.get(DeliveriesService);
    await svc.expireOverdueSearches();
    const second = await svc.expireOverdueSearches();
    expect(second).toBe(0);
  });

  it('interdit d’annuler une course expirée', async () => {
    const d = await createDelivery(app, client, { pickup: YOP });
    await expire(d.id);
    await app.get(DeliveriesService).expireOverdueSearches();

    const res = await request(app.getHttpServer())
      .post(`/deliveries/${d.id}/cancel`)
      .set(auth(client))
      .send({ reason: 'plus_besoin' });
    expect(res.status).toBe(409);
  });
});

describe('Plafonds vélo / à pied (e2e)', () => {
  let app: INestApplication;
  let client: string;
  let velo: string;

  beforeAll(async () => {
    app = await bootApp();
    client = await login(app, '0700000203');
    velo = await login(app, '0700000204');
    await createDriverProfile(app, velo, 'velo');
    // Vélo à ~1 km du retrait : dans son plafond d'approche (3 km).
    await makeDriverReady(app, '+2250700000204', {
      lat: kmNorth(1),
      lng: -4.075,
      vehicleType: 'velo',
    });
  });

  afterAll(async () => {
    await app?.close();
  });

  it('accepte une course courte à vélo', async () => {
    const d = await createDelivery(app, client, {
      pickup: YOP,
      dropoff: { address: 'Proche', latitude: kmNorth(2), longitude: -4.075 },
    });
    const res = await request(app.getHttpServer())
      .post(`/deliveries/${d.id}/accept`)
      .set(auth(velo));
    expect(res.status).toBe(200);
  });

  it('masque du feed une course trop longue pour un vélo', async () => {
    const d = await createDelivery(app, client, {
      pickup: YOP,
      dropoff: { address: 'Loin', latitude: kmNorth(7), longitude: -4.075 }, // ~6 km
    });
    const feed = await request(app.getHttpServer())
      .get('/drivers/me/missions')
      .set(auth(velo));
    expect(feed.body.some((m: any) => m.deliveryId === d.id)).toBe(false);
  });

  it('REFUSE l’acceptation d’une course trop longue, même si le livreur a l’id', async () => {
    const d = await createDelivery(app, client, {
      pickup: YOP,
      dropoff: { address: 'Loin', latitude: kmNorth(7), longitude: -4.075 },
    });
    const res = await request(app.getHttpServer())
      .post(`/deliveries/${d.id}/accept`)
      .set(auth(velo));
    // Garde dure : le filtrage du feed ne suffit pas, l'acceptation revérifie.
    expect(res.status).toBe(403);
    expect(res.body.message).toContain('vélo');
  });

  it('exclut le vélo de la liste vue par le client sur une longue course', async () => {
    const d = await createDelivery(app, client, {
      pickup: YOP,
      dropoff: { address: 'Loin', latitude: kmNorth(7), longitude: -4.075 },
    });
    const res = await request(app.getHttpServer())
      .get(`/matching/deliveries/${d.id}/drivers`)
      .set(auth(client));
    const veloListe = (res.body.drivers ?? []).some(
      (dr: any) => dr.vehicleType === 'velo',
    );
    expect(veloListe).toBe(false);
  });
});
