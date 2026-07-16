import { Client } from 'pg';

import { TEST_DB } from './setup-db';

// Supprime la base jetable après les tests. Best-effort : si le DROP échoue, le
// prochain globalSetup la recréera de toute façon — inutile de faire rougir la
// suite pour un nettoyage.
export default async function globalTeardown(): Promise<void> {
  const admin = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 5433,
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: 'postgres',
  });
  try {
    await admin.connect();
    await admin.query(
      `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${TEST_DB}' AND pid <> pg_backend_pid()`,
    );
    await admin.query(`DROP DATABASE IF EXISTS ${TEST_DB}`);
  } catch {
    // ignoré volontairement
  } finally {
    await admin.end().catch(() => undefined);
  }
}
