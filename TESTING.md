# Testing Guide

This document explains how to set up and run tests for the Playfolio API, including the keychain system.

## Overview

We use **integration tests** with a real PostgreSQL database rather than mocking. This ensures:
- Tests verify actual database interactions
- Schema changes are caught immediately
- Tests are simpler and more reliable
- Real-world behavior is tested

## Test Stack

- **Vitest** - Fast, modern test runner
- **PostgreSQL** - Separate test database
- **Drizzle ORM** - Database operations

## Setup

### 1. Create Test Database

First, create a separate PostgreSQL database for testing:

```bash
# Connect to PostgreSQL
psql -U postgres

# Create test database and user
CREATE DATABASE playfolio_test;
CREATE USER appuser WITH PASSWORD 'apppassword';
GRANT ALL PRIVILEGES ON DATABASE playfolio_test TO appuser;
\q
```

### 2. Configure Test Database URL

The tests use `TEST_DATABASE_URL` environment variable. You can either:

**Option A: Use .env file**
```bash
# Add to your .env file
TEST_DATABASE_URL=postgresql://appuser:apppassword@localhost:5432/playfolio_test
```

**Option B: Use default**

If not set, tests default to: `postgresql://appuser:apppassword@localhost:5432/playfolio_test`

### 3. Run Migrations

Migrations are automatically run before tests start. You can also run them manually:

```bash
TEST_DATABASE_URL=postgresql://appuser:apppassword@localhost:5432/playfolio_test npx drizzle-kit push
```

## Running Tests

### Run All Tests

```bash
npm test
```

### Watch Mode (Re-run on changes)

```bash
npm run test:watch
```

### Interactive UI

```bash
npm run test:ui
```

Then open http://localhost:51204 in your browser for a visual test interface.

### Coverage Report

```bash
npm run test:coverage
```

### Run Specific Test File

```bash
npx vitest run src/lib/__tests__/keychain.test.ts
```

## Test Structure

### Test Helpers

Located in `src/test/test-helpers.ts`, these provide utilities for:

- **cleanDatabase()** - Removes all data from test DB
- **seedTestData()** - Creates basic test club and player
- **createTestClub()** - Creates a test club
- **createTestPlayer()** - Creates a test player
- **createClubMembership()** - Creates club-player relationship
- **createTestKey()** - Creates a keychain key

### Database Lifecycle

```
beforeAll() → Run migrations on test database
  ↓
beforeEach() → (if needed)
  ↓
test() → Run test with clean database
  ↓
afterEach() → Clean all tables (automatic)
  ↓
afterAll() → Close database connection
```

## Writing Tests

### Example: Testing Keychain Functions

```typescript
import { describe, it, expect } from 'vitest';
import { generateKey, resolvePlayerFromKey } from '../keychain';
import { createTestClub, createTestPlayer, createClubMembership, createTestKey } from '@/test/test-helpers';

describe('my feature', () => {
  it('should resolve a key to player uid', async () => {
    // Arrange - Set up test data
    const club = await createTestClub();
    const player = await createTestPlayer();
    await createClubMembership(club.uid, player.uid);

    const key = generateKey();
    await createTestKey(key, player.uid, club.uid);

    // Act - Perform the operation
    const result = await resolvePlayerFromKey(key, club.uid);

    // Assert - Verify the result
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.player_uid).toBe(player.uid);
    }
  });
});
```

### Database Cleanup

The database is **automatically cleaned** after each test, so you don't need to manually clean up. Each test starts with a fresh database state.

## Keychain Test Coverage

Current tests verify:

✅ **generateKey()**
- Generates valid UUID v4 format
- Generates unique keys
- Correct UUID version and variant

✅ **validateClubPlayerOwnership()**
- Returns true for valid club-player relationships
- Returns false when no relationship exists
- Handles non-existent clubs/players

✅ **resolvePlayerFromKey()**
- Successfully resolves valid active keys
- Increments usage_count on each resolution
- Updates last_used_at timestamp
- Rejects keys with wrong originating_club_id (two-factor security)
- Rejects revoked keys
- Rejects expired keys (by status)
- Auto-expires keys past expires_at date
- Allows keys with future expiration
- Rejects non-existent keys

## API Endpoint Testing

For testing API endpoints, you can create integration tests that:

1. Set up test data using helpers
2. Call the API route handlers directly
3. Verify responses and database state

Example structure (to be implemented):

```typescript
import { POST } from '@/app/api/clubs/[uid]/keys/route';
import { createTestClub, createTestPlayer, createClubMembership } from '@/test/test-helpers';

describe('POST /api/clubs/[uid]/keys', () => {
  it('should create a key for club member', async () => {
    const club = await createTestClub();
    const player = await createTestPlayer();
    await createClubMembership(club.uid, player.uid);

    const mockRequest = {
      json: async () => ({ player_uid: player.uid }),
    } as any;

    const response = await POST(mockRequest, {
      params: Promise.resolve({ uid: club.uid })
    });

    const data = await response.json();
    expect(data.success).toBe(true);
  });
});
```

## Troubleshooting

### "Database connection failed"

- Verify PostgreSQL is running: `psql -U postgres -c "SELECT version();"`
- Check test database exists: `psql -U postgres -l | grep playfolio_test`
- Verify credentials match TEST_DATABASE_URL

### "Migrations failed"

- Manually run migrations: `TEST_DATABASE_URL=... npx drizzle-kit push`
- Check schema.ts for syntax errors
- Verify appuser has proper permissions

### "Tests hang or timeout"

- Check database connection isn't blocked
- Increase timeout in vitest.config.ts
- Look for unclosed database connections in code

### "Foreign key constraint errors"

- Ensure cleanDatabase() deletes in correct order (child tables first)
- Check that test helpers create all required relationships

## CI/CD Integration

For CI/CD pipelines:

```yaml
# Example GitHub Actions
- name: Set up PostgreSQL
  run: |
    sudo systemctl start postgresql
    sudo -u postgres psql -c "CREATE DATABASE playfolio_test;"
    sudo -u postgres psql -c "CREATE USER appuser WITH PASSWORD 'apppassword';"

- name: Run tests
  env:
    TEST_DATABASE_URL: postgresql://appuser:apppassword@localhost:5432/playfolio_test
  run: npm test
```

## Best Practices

1. **Use helpers** - Always use test helpers instead of direct DB inserts
2. **Descriptive names** - Test names should describe the expected behavior
3. **Arrange-Act-Assert** - Structure tests clearly in three parts
4. **Don't rely on order** - Each test should work independently
5. **Test edge cases** - Include error cases, empty results, boundary conditions
6. **Keep it fast** - Avoid unnecessary database operations

## Next Steps

Future testing improvements:

- [ ] Add API endpoint integration tests
- [ ] Add load testing for key resolution
- [ ] Test concurrent key usage scenarios
- [ ] Add end-to-end workflow tests
- [ ] Performance benchmarking
