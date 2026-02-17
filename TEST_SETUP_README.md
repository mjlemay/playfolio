# Quick Start: Running Tests

## 🚀 Quick Setup (3 steps)

### 1. Set up test database

**Option A: Using the setup script**
```bash
./scripts/setup-test-db.sh
```

**Option B: Manual setup**
```bash
# Connect to PostgreSQL (use your PostgreSQL user)
psql -U postgres  # or psql -U $USER

# Run these commands:
CREATE DATABASE playfolio_test;
CREATE USER appuser WITH PASSWORD 'apppassword';
GRANT ALL PRIVILEGES ON DATABASE playfolio_test TO appuser;
\q
```

### 2. Set test database URL (optional)

Add to `.env`:
```
TEST_DATABASE_URL=postgresql://appuser:apppassword@localhost:5432/playfolio_test
```

Or it will use the default URL above.

### 3. Run tests!

```bash
npm test
```

That's it! The tests will:
- ✅ Automatically run migrations on the test database
- ✅ Clean the database between each test
- ✅ Test real database interactions

## 📊 Test Commands

```bash
npm test              # Run all tests once
npm run test:watch    # Watch mode (re-run on changes)
npm run test:ui       # Visual test interface
npm run test:coverage # Generate coverage report
```

## 📝 What's Tested

The keychain integration tests verify:
- ✅ UUID v4 key generation
- ✅ Club-player ownership validation
- ✅ Key resolution with two-factor security (key + club ID)
- ✅ Key revocation and expiration
- ✅ Usage tracking (count and timestamps)
- ✅ All security edge cases

## 📚 More Details

See [TESTING.md](./TESTING.md) for:
- Full testing guide
- Writing new tests
- Test helpers documentation
- Troubleshooting
- CI/CD integration

## ⚠️ Troubleshooting

**"Connection failed"**
- Make sure PostgreSQL is running
- Check that playfolio_test database exists
- Verify appuser has permissions

**"Migrations failed"**
- Manually run: `TEST_DATABASE_URL=... npx drizzle-kit push`
- Check schema.ts for errors

**Need help?**
- Check TESTING.md for detailed troubleshooting
- Verify DATABASE_URL in .env doesn't conflict with TEST_DATABASE_URL
