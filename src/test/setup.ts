import { beforeAll, afterAll, afterEach } from 'vitest';
import { closeTestDb, getTestDatabaseUrl } from './test-db';
import { cleanDatabase } from './test-helpers';
import { execSync } from 'child_process';

// Setup files run before each test file's imports, so environment must be set
// here at module top level — not inside beforeAll — for modules that read it at import.
const testDbUrl = getTestDatabaseUrl();
process.env.DATABASE_URL = testDbUrl;
process.env.TEST_DATABASE_URL = testDbUrl;
process.env.PLAYFOLIO_ADMIN_KEY = 'test-admin-key';
process.env.KRATOS_PUBLIC_URL = 'http://kratos.test:4433';

beforeAll(async () => {
  console.log('Running migrations on test database...');
  try {
    execSync('npx drizzle-kit push', {
      env: { ...process.env, DATABASE_URL: testDbUrl },
      stdio: 'inherit',
    });
    console.log('Migrations completed successfully');
    // Start from a clean slate so rows left by an interrupted earlier run
    // cannot leak into the first test of this one.
    await cleanDatabase();
  } catch (error) {
    console.error('Failed to run migrations:', error);
    throw error;
  }
});

afterEach(async () => {
  await cleanDatabase();
});

afterAll(async () => {
  await closeTestDb();
});
