// Espone query(sql, params) → { rows } sia su Postgres (DATABASE_URL: Neon/Supabase) sia su PGlite (solo dev).
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { config } from '../config.js';

const schemaPath = fileURLToPath(new URL('./schema.sql', import.meta.url));
let client;

export async function initDb() {
  if (config.databaseUrl) {
    const { default: pg } = await import('pg');
    const pool = new pg.Pool({
      connectionString: config.databaseUrl,
      ssl: /localhost|127\.0\.0\.1/.test(config.databaseUrl) ? false : { rejectUnauthorized: false },
      max: 5,
    });
    client = { query: (sql, params) => pool.query(sql, params), exec: (sql) => pool.query(sql) };
  } else {
    if (config.isProduction) throw new Error('DATABASE_URL obbligatoria in produzione'); // doppia sicurezza
    const { PGlite } = await import('@electric-sql/pglite');
    const lite = new PGlite(fileURLToPath(new URL('../../.pglite', import.meta.url)));
    client = { query: (sql, params) => lite.query(sql, params), exec: (sql) => lite.exec(sql) };
    console.log('DB: PGlite locale (.pglite/) — solo sviluppo');
  }
  await client.exec(await readFile(schemaPath, 'utf8'));
}

export const query = (sql, params = []) => client.query(sql, params);
