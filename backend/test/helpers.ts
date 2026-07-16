import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import request from 'supertest';

import { AppModule } from '../src/app.module';

// Boot d'une vraie application Nest sur la base de test : mêmes guards, mêmes
// pipes, mêmes transitions qu'en production. Les seams (SMS/FCM/paiement) sont
// déjà en mode console/sandbox — rien ne sort de la machine.
export async function bootApp(): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleRef.createNestApplication();
  // Doit refléter main.ts : sans ce pipe, les DTO ne valident pas et les tests
  // passeraient là où la vraie API rejette (400).
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true }),
  );
  await app.init();
  return app;
}

// Connexion via le bypass OTP de développement (OTP_DEV_BYPASS_CODE), qui est
// désactivé de force en production. Renvoie le jeton d'accès.
export async function login(
  app: INestApplication,
  phoneNumber: string,
): Promise<string> {
  const server = app.getHttpServer();
  await request(server).post('/auth/otp/request').send({ phoneNumber });
  const res = await request(server)
    .post('/auth/otp/verify')
    .send({ phoneNumber, code: process.env.OTP_DEV_BYPASS_CODE ?? '000000' });
  if (!res.body?.accessToken) {
    throw new Error(
      `Login échoué pour ${phoneNumber} : ${res.status} ${JSON.stringify(res.body)}`,
    );
  }
  return res.body.accessToken as string;
}

// Rend un livreur immédiatement opérationnel : actif (validé), disponible,
// géolocalisé et solvable. Passe par SQL car ces états sont normalement produits
// par une validation admin et une recharge — hors sujet pour tester les
// transitions de livraison.
export async function makeDriverReady(
  app: INestApplication,
  phoneNumber: string,
  opts: {
    lat: number;
    lng: number;
    vehicleType?: string;
    balanceFcfa?: number;
  },
): Promise<void> {
  const ds = app.get(DataSource);
  const { lat, lng, vehicleType = 'moto', balanceFcfa = 5000 } = opts;

  const rows = await ds.query(
    `SELECT dp.id FROM driver_profiles dp
     JOIN users u ON u.id = dp.user_id WHERE u.phone_number = $1`,
    [phoneNumber],
  );
  const driverId = rows[0]?.id;
  if (!driverId) {
    throw new Error(`Aucun profil livreur pour ${phoneNumber}`);
  }

  await ds.query(
    `UPDATE driver_profiles SET
       vehicle_type = $2, status = 'actif', is_available = TRUE,
       suspended_until = NULL,
       current_location = ST_SetSRID(ST_MakePoint($3, $4), 4326)::geography,
       location_updated_at = now()
     WHERE id = $1`,
    [driverId, vehicleType, lng, lat],
  );

  // Le wallet est créé à la demande par WalletService ; on l'amorce ici pour que
  // `canAcceptMission` passe (solde >= commission minimale).
  await ds.query(
    `INSERT INTO wallets (driver_id, balance_fcfa)
     VALUES ($1, $2)
     ON CONFLICT (driver_id) DO UPDATE SET balance_fcfa = $2`,
    [driverId, balanceFcfa],
  );
}

// Crée un profil livreur pour un compte (étape d'onboarding).
export async function createDriverProfile(
  app: INestApplication,
  token: string,
  vehicleType = 'moto',
): Promise<void> {
  await request(app.getHttpServer())
    .post('/profiles/driver')
    .set('Authorization', `Bearer ${token}`)
    .send({ vehicleType });
}

// Publie une course. Coordonnées par défaut : Yopougon → 1 km au nord.
export async function createDelivery(
  app: INestApplication,
  token: string,
  over: Record<string, unknown> = {},
): Promise<Record<string, any>> {
  const res = await request(app.getHttpServer())
    .post('/deliveries')
    .set('Authorization', `Bearer ${token}`)
    .send({
      pickup: { address: 'Yopougon', latitude: 5.345, longitude: -4.075 },
      dropoff: { address: 'Yopougon Nord', latitude: 5.354, longitude: -4.075 },
      priceFcfa: 3000,
      ...over,
    });
  if (res.status !== 201) {
    throw new Error(`Création échouée : ${res.status} ${JSON.stringify(res.body)}`);
  }
  return res.body;
}

export const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
