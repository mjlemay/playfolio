import { beforeAll, afterAll, afterEach } from 'vitest';
import { closeTestDb, getTestDatabaseUrl } from './test-db';
import { cleanDatabase } from './test-helpers';
import { execSync } from 'child_process';

// Set up test environment variables
beforeAll(async () => {
  const testDbUrl = getTestDatabaseUrl();
  process.env.DATABASE_URL = testDbUrl;
  process.env.TEST_DATABASE_URL = testDbUrl;
  process.env.PLAYFOLIO_ADMIN_KEY = 'test-admin-key';

  // Run migrations on test database
  console.log('Running migrations on test database...');
  try {
    execSync('npx drizzle-kit push', {
      env: { ...process.env, DATABASE_URL: testDbUrl },
      stdio: 'inherit',
    });
    console.log('Migrations completed successfully');
  } catch (error) {
    console.error('Failed to run migrations:', error);
    throw error;
  }
});

// Clean database after each test
afterEach(async () => {
  await cleanDatabase();
});

// Close database connection after all tests
afterAll(async () => {
  await closeTestDb();
});
