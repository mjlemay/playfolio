import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./src/test/setup.ts'],
    env: {
      DATABASE_URL: 'postgresql://appuser:apppassword@localhost:5433/playfolio_test',
      TEST_DATABASE_URL: 'postgresql://appuser:apppassword@localhost:5433/playfolio_test',
      PLAYFOLIO_ADMIN_KEY: 'test-admin-key',
      KRATOS_PUBLIC_URL: 'http://kratos.test:4433',
    },
    // Run tests sequentially for database tests
    fileParallelism: false,
    // Increase timeout for database operations
    testTimeout: 10000,
    hookTimeout: 30000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/test/',
        '**/*.config.{js,ts}',
        '**/types.ts',
        '**/*.d.ts',
      ],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
