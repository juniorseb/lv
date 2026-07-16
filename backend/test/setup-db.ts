import { Client } from 'pg';

// Base de test JETABLE, recréée à chaque exécution. Jamais `livrechap` : les
// tests suppriment des données, ils ne doivent pas pouvoir toucher le dev.
export const TEST_DB = 'livrechap_test';

function adminClient(): Client {
  return new Client({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 5433,
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: 'postgres', // base d'administration : on ne peut pas DROP celle où l'on est connecté
  });
}

export default async function globalSetup(): Promise<void> {
  const admin = adminClient();
  await admin.connect();
  // Coupe les connexions résiduelles d'un run précédent, sinon le DROP échoue.
  await admin.query(
    `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${TEST_DB}' AND pid <> pg_backend_pid()`,
  );
  await admin.query(`DROP DATABASE IF EXISTS ${TEST_DB}`);
  await admin.query(`CREATE DATABASE ${TEST_DB}`);
  await admin.end();

  // Les extensions doivent exister AVANT que synchronize ne crée les tables :
  // les colonnes geography (positions livreurs) et uuid_generate_v4() en dépendent.
  const db = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 5433,
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: TEST_DB,
  });
  await db.connect();
  await db.query('CREATE EXTENSION IF NOT EXISTS postgis');
  await db.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
  await db.end();
}
