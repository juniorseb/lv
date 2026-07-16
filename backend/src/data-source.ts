import 'dotenv/config';
import { DataSource } from 'typeorm';

// DataSource réservé à la CLI TypeORM (génération / exécution des migrations).
// L'application, elle, se configure dans app.module.ts via TypeOrmModule.forRoot :
// les deux doivent décrire la MÊME base, mais Nest n'expose pas sa config à la CLI.
//
// `synchronize` est volontairement absent ici : la CLI ne doit jamais altérer le
// schéma implicitement — c'est précisément ce que les migrations remplacent.
export default new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 5432,
  username: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_NAME || 'livrechap',
  // Toutes les entités vivent dans un dossier `entities/`. On cible le DOSSIER et
  // non `*.entity.ts` : certains fichiers en regroupent plusieurs et s'appellent
  // `*.entities.ts` (ex. logistics/entities/reserved.entities.ts), qu'un glob sur
  // `*.entity.ts` manquerait silencieusement.
  entities: ['src/**/entities/*.ts'],
  migrations: ['src/migrations/*.ts'],
});
