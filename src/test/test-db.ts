import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from '@/lib/schema';

// Use a separate test database
const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL || 'postgresql://appuser:apppassword@localhost:5432/playfolio_test';

let pool: Pool | null = null;
let testDb: ReturnType<typeof drizzle> | null = null;

/**
 * Get or create the test database connection
 */
export function getTestDb() {
  if (!testDb) {
    pool = new Pool({
      connectionString: TEST_DATABASE_URL,
    });
    testDb = drizzle(pool, { schema });
  }
  return testDb;
}

/**
 * Close the test database connection
 */
export async function closeTestDb() {
  if (pool) {
    await pool.end();
    pool = null;
    testDb = null;
  }
}

/**
 * Get the test database URL
 */
export function getTestDatabaseUrl(): string {
  return TEST_DATABASE_URL;
}
