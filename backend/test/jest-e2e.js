const path = require('path');

// Base JETABLE + seams factices, posés AVANT que les modules ne lisent l'env.
// NODE_ENV=test (et non production) laisse `synchronize` créer le schéma.
process.env.NODE_ENV = 'test';
process.env.DB_NAME = 'livrechap_test';
process.env.DB_PORT = process.env.DB_PORT || '5433';
process.env.OTP_DEV_BYPASS_CODE = '000000';
process.env.SMS_PROVIDER = 'console';
process.env.FCM_MODE = 'console';
process.env.PAYMENTS_MODE = 'sandbox';
process.env.JWT_ACCESS_SECRET = 'test_access_secret';
process.env.JWT_REFRESH_SECRET = 'test_refresh_secret';
// Paliers du cercle progressif : valeurs par défaut explicites, pour que les
// tests ne dépendent pas du .env local du développeur.
process.env.MATCHING_RING_STEP_SECONDS = '15';
process.env.DELIVERY_SEARCH_TTL_SECONDS = '180';

/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: path.join(__dirname, '..'),
  testRegex: 'test/.*\\.e2e-spec\\.ts$',
  moduleFileExtensions: ['js', 'json', 'ts'],
  globalSetup: '<rootDir>/test/setup-db.ts',
  globalTeardown: '<rootDir>/test/teardown-db.ts',
  // Une seule base partagée : des suites concurrentes se marcheraient dessus.
  maxWorkers: 1,
  testTimeout: 60000,
  // L'app garde des timers (jobs d'expiration/paliers) : on ne veut pas que Jest
  // reste bloqué si un handle traîne après le close.
  forceExit: true,
};
