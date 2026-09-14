import 'dotenv/config';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from './schema';

export type Db = NodePgDatabase<typeof schema>;

let instance: Db | null = null;

/**
 * Build the Drizzle client on first use rather than at import time, so that
 * DATABASE_URL can be set by test setup (or by the runtime) after this module loads.
 */
export function getDb(): Db {
  if (!instance) {
    const url = process.env.DATABASE_URL;
    if (!url) {
      throw new Error('DATABASE_URL is not set; cannot connect to Postgres');
    }
    instance = drizzle(url, { schema });
  }
  return instance;
}

/**
 * Default export kept for the many `import db from '@/lib/db'` call sites.
 * Every property access resolves against the lazily built client.
 */
const db: Db = new Proxy({} as Db, {
  get(_target, prop) {
    const real = getDb() as unknown as Record<PropertyKey, unknown>;
    const value = real[prop];
    return typeof value === 'function' ? (value as (...a: unknown[]) => unknown).bind(real) : value;
  },
});

export default db;
