import { INestApplication } from '@nestjs/common';
import request from 'supertest';

import {
  auth,
  bootApp,
  createDelivery,
  createDriverProfile,
  login,
  makeDriverReady,
} from './helpers';

// Cycle de vie d'une livraison, contre une VRAIE base et de VRAIS guards.
// Remplace les scripts jetables : ces règles sont celles qui, si elles cèdent,
// coûtent un colis ou un litige — pas un simple bug d'affichage.
//
//   recherche → livreur_trouve → colis_recupere → terminee
//   recherche | livreur_trouve → annulee     (jamais après récupération)
const PICKUP = { address: 'Yopougon', latitude: 5.345, longitude: -4.075 };

describe('Livraison — machine à états (e2e)', () => {
  let app: INestApplication;
  let client: string;
  let driver: string;
  let other: string;

  beforeAll(async () => {
    app = await bootApp();
    client = await login(app, '0700000101');
    driver = await login(app, '0700000102');
    other = await login(app, '0700000103');
    await createDriverProfile(app, driver);
    // Livreur à ~1 km du retrait, solvable.
    await makeDriverReady(app, '+2250700000102', { lat: 5.354, lng: -4.075 });
  });

  afterAll(async () => {
    await app?.close();
  });

  describe('publication', () => {
    it('naît en « recherche », avec un code à 4 chiffres et une fenêtre de recherche', async () => {
      const d = await createDelivery(app, client);
      expect(d.status).toBe('recherche');
      expect(d.deliveryCode).toMatch(/^\d{4}$/);
      expect(d.expiresAt).toBeTruthy();
      const fenetreS =
        (new Date(d.expiresAt).getTime() - new Date(d.createdAt).getTime()) / 1000;
      // `expires_at` est calculé en JS, `created_at` vient du now() de Postgres :
      // quelques millisecondes les séparent, d'où la tolérance.
      expect(fenetreS).toBeCloseTo(180, 0);
    });

    it('ne montre le code qu’à l’auteur, jamais au livreur assigné', async () => {
      const d = await createDelivery(app, client);
      // Le livreur doit d'abord être ASSIGNÉ : sans cela il n'a aucun accès (403).
      await request(app.getHttpServer())
        .post(`/deliveries/${d.id}/accept`)
        .set(auth(driver));

      const vueLivreur = await request(app.getHttpServer())
        .get(`/deliveries/${d.id}`)
        .set(auth(driver));
      expect(vueLivreur.status).toBe(200);
      // Absent, pas à null : le livreur SAISIT le code, il ne le lit pas.
      expect(vueLivreur.body.deliveryCode).toBeUndefined();
    });

    it('refuse à un livreur NON assigné de consulter la course', async () => {
      const d = await createDelivery(app, client);
      const res = await request(app.getHttpServer())
        .get(`/deliveries/${d.id}`)
        .set(auth(driver));
      // Avoir un profil livreur ne donne aucun droit sur les courses d'autrui.
      expect(res.status).toBe(403);
    });

    it('refuse l’accès à un tiers sans lien avec la course', async () => {
      const d = await createDelivery(app, client);
      const res = await request(app.getHttpServer())
        .get(`/deliveries/${d.id}`)
        .set(auth(other));
      expect(res.status).toBe(403);
    });
  });

  describe('cycle nominal', () => {
    it('parcourt recherche → livreur_trouve → colis_recupere → terminee', async () => {
      const d = await createDelivery(app, client);
      const srv = app.getHttpServer();

      const accepte = await request(srv)
        .post(`/deliveries/${d.id}/accept`)
        .set(auth(driver));
      expect(accepte.status).toBe(200);
      expect(accepte.body.status).toBe('livreur_trouve');

      const recupere = await request(srv)
        .post(`/deliveries/${d.id}/pickup`)
        .set(auth(driver));
      expect(recupere.status).toBe(200);
      expect(recupere.body.status).toBe('colis_recupere');

      const livre = await request(srv)
        .post(`/deliveries/${d.id}/complete`)
        .set(auth(driver))
        .send({ code: d.deliveryCode });
      expect(livre.status).toBe(200);
      expect(livre.body.status).toBe('terminee');
      expect(livre.body.completedAt).toBeTruthy();
    });
  });

  describe('gardes sur l’acceptation', () => {
    it('interdit d’accepter sa propre course', async () => {
      const d = await createDelivery(app, client);
      // Le client se dote d'un profil livreur : il reste interdit.
      await createDriverProfile(app, client);
      const res = await request(app.getHttpServer())
        .post(`/deliveries/${d.id}/accept`)
        .set(auth(client));
      expect(res.status).toBe(400);
    });

    it('refuse une course déjà prise (409) — pas de double attribution', async () => {
      const d = await createDelivery(app, client);
      const srv = app.getHttpServer();
      await request(srv).post(`/deliveries/${d.id}/accept`).set(auth(driver));

      const second = await login(app, '0700000104');
      await createDriverProfile(app, second);
      await makeDriverReady(app, '+2250700000104', { lat: 5.354, lng: -4.075 });
      const res = await request(srv)
        .post(`/deliveries/${d.id}/accept`)
        .set(auth(second));
      expect(res.status).toBe(409);
    });

    it('n’attribue la course qu’à UN SEUL livreur en cas d’acceptations simultanées', async () => {
      const d = await createDelivery(app, client);
      const srv = app.getHttpServer();
      const rival = await login(app, '0700000105');
      await createDriverProfile(app, rival);
      await makeDriverReady(app, '+2250700000105', { lat: 5.354, lng: -4.075 });

      // Course réelle entre deux livreurs : l'UPDATE conditionnel doit trancher.
      const [a, b] = await Promise.all([
        request(srv).post(`/deliveries/${d.id}/accept`).set(auth(driver)),
        request(srv).post(`/deliveries/${d.id}/accept`).set(auth(rival)),
      ]);
      const statuts = [a.status, b.status].sort();
      expect(statuts).toEqual([200, 409]);
    });
  });

  describe('gardes sur la livraison', () => {
    it('refuse la récupération à un livreur NON assigné', async () => {
      const d = await createDelivery(app, client);
      const res = await request(app.getHttpServer())
        .post(`/deliveries/${d.id}/pickup`)
        .set(auth(driver));
      // Non assigné → interdit (403), et non « mauvais statut » (409).
      expect(res.status).toBe(403);
    });

    it('refuse de récupérer deux fois le même colis', async () => {
      const d = await createDelivery(app, client);
      const srv = app.getHttpServer();
      await request(srv).post(`/deliveries/${d.id}/accept`).set(auth(driver));
      await request(srv).post(`/deliveries/${d.id}/pickup`).set(auth(driver));

      const res = await request(srv)
        .post(`/deliveries/${d.id}/pickup`)
        .set(auth(driver));
      // Assigné mais mauvais statut → conflit.
      expect(res.status).toBe(409);
    });

    it('refuse un mauvais code de livraison', async () => {
      const d = await createDelivery(app, client);
      const srv = app.getHttpServer();
      await request(srv).post(`/deliveries/${d.id}/accept`).set(auth(driver));
      await request(srv).post(`/deliveries/${d.id}/pickup`).set(auth(driver));

      const res = await request(srv)
        .post(`/deliveries/${d.id}/complete`)
        .set(auth(driver))
        .send({ code: '0000' });
      expect(res.status).toBe(400);

      // La course reste récupérée : un mauvais code ne fait rien avancer.
      const apres = await request(srv)
        .get(`/deliveries/${d.id}`)
        .set(auth(client));
      expect(apres.body.status).toBe('colis_recupere');
    });
  });

  describe('annulation', () => {
    it('permet à l’auteur d’annuler pendant la recherche', async () => {
      const d = await createDelivery(app, client);
      const res = await request(app.getHttpServer())
        .post(`/deliveries/${d.id}/cancel`)
        .set(auth(client))
        .send({ reason: 'plus_besoin' });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('annulee');
    });

    it('permet encore d’annuler après acceptation, avant récupération', async () => {
      const d = await createDelivery(app, client);
      const srv = app.getHttpServer();
      await request(srv).post(`/deliveries/${d.id}/accept`).set(auth(driver));
      const res = await request(srv)
        .post(`/deliveries/${d.id}/cancel`)
        .set(auth(client))
        .send({ reason: 'erreur_adresse' });
      expect(res.status).toBe(200);
    });

    it('INTERDIT l’annulation une fois le colis récupéré', async () => {
      const d = await createDelivery(app, client);
      const srv = app.getHttpServer();
      await request(srv).post(`/deliveries/${d.id}/accept`).set(auth(driver));
      await request(srv).post(`/deliveries/${d.id}/pickup`).set(auth(driver));

      const res = await request(srv)
        .post(`/deliveries/${d.id}/cancel`)
        .set(auth(client))
        .send({ reason: 'plus_besoin' });
      // Le livreur roule déjà avec le colis : plus d'annulation gratuite.
      expect(res.status).toBe(409);
    });

    it('n’autorise que l’AUTEUR à annuler — pas le livreur assigné', async () => {
      const d = await createDelivery(app, client);
      const srv = app.getHttpServer();
      await request(srv).post(`/deliveries/${d.id}/accept`).set(auth(driver));
      const res = await request(srv)
        .post(`/deliveries/${d.id}/cancel`)
        .set(auth(driver))
        .send({ reason: 'plus_besoin' });
      expect(res.status).toBe(403);
    });

    it('refuse d’annuler deux fois', async () => {
      const d = await createDelivery(app, client);
      const srv = app.getHttpServer();
      await request(srv)
        .post(`/deliveries/${d.id}/cancel`)
        .set(auth(client))
        .send({ reason: 'plus_besoin' });
      const res = await request(srv)
        .post(`/deliveries/${d.id}/cancel`)
        .set(auth(client))
        .send({ reason: 'plus_besoin' });
      expect(res.status).toBe(409);
    });
  });

  describe('contacts et code (commander pour quelqu’un d’autre)', () => {
    it('donne au destinataire l’accès à SA course et à son code', async () => {
      // Jérémie a un compte : il doit suivre la course reçue.
      const jeremie = await login(app, '0700000106');
      const d = await createDelivery(app, client, {
        pickup: PICKUP,
        dropoff: { address: 'Bingerville', latitude: 5.356, longitude: -3.885 },
        recipientName: 'Jérémie',
        recipientPhone: '0700000106',
        pickupContactName: 'Awa',
        pickupContactPhone: '0700000107',
      });

      const vue = await request(app.getHttpServer())
        .get(`/deliveries/${d.id}`)
        .set(auth(jeremie));
      expect(vue.status).toBe(200);
      // C'est lui qui remet le code au livreur : il doit le voir.
      expect(vue.body.deliveryCode).toBe(d.deliveryCode);
    });

    it('donne au contact de récupération le suivi, mais JAMAIS le code', async () => {
      const awa = await login(app, '0700000107');
      const d = await createDelivery(app, client, {
        pickupContactName: 'Awa',
        pickupContactPhone: '0700000107',
      });

      const vue = await request(app.getHttpServer())
        .get(`/deliveries/${d.id}`)
        .set(auth(awa));
      expect(vue.status).toBe(200);
      // Elle remet le colis : elle n'a pas à pouvoir valider la livraison.
      expect(vue.body.deliveryCode).toBeUndefined();
    });

    it('reconnaît un numéro saisi en format local comme le compte E.164', async () => {
      const awa = await login(app, '+2250700000107');
      const d = await createDelivery(app, client, {
        pickupContactPhone: '07 00 00 01 07', // saisie « humaine »
      });
      const vue = await request(app.getHttpServer())
        .get(`/deliveries/${d.id}`)
        .set(auth(awa));
      expect(vue.status).toBe(200);
    });
  });
});
