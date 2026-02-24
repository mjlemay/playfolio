# Running Playfolio with Docker

## 🚀 Quick Start (3 Commands)

```bash
# 1. Start everything
docker-compose up -d

# 2. Run migrations
docker-compose exec app npx drizzle-kit push

# 3. Test it works
curl http://localhost:3777/api/players
```

Done! Your app is running at http://localhost:3777

---

## 📋 What's Running?

- **PostgreSQL** on `localhost:5432`
  - Production DB: `playfolio`
  - Test DB: `playfolio_test` (auto-created)
  - User: `appuser`
  - Password: `apppassword`

- **Next.js App** on `localhost:3777`
  - Hot reload enabled ✨
  - Code changes auto-update

---

## 🛠️ Common Commands

### Start/Stop
```bash
# Start (background)
docker-compose up -d

# Start (with logs visible)
docker-compose up

# Stop
docker-compose down

# Stop & delete data (⚠️ careful!)
docker-compose down -v
```

### View Logs
```bash
# All logs
docker-compose logs -f

# Just app
docker-compose logs -f app

# Just database
docker-compose logs -f postgres
```

### Run Migrations
```bash
docker-compose exec app npx drizzle-kit push
```

### Run Tests
```bash
# All tests
docker-compose exec app npm test

# Watch mode
docker-compose exec app npm run test:watch

# Specific test
docker-compose exec app npx vitest run src/lib/__tests__/keychain.test.ts
```

### Access Database
```bash
# From command line
docker-compose exec postgres psql -U appuser -d playfolio

# Or from your host
psql -h localhost -U appuser -d playfolio
# Password: apppassword
```

### Rebuild App
```bash
# After dependency changes
docker-compose build app
docker-compose up -d
```

---

## 🔧 Troubleshooting

### Port 5432 Already in Use?
```bash
# Check what's using it
lsof -i :5432

# Kill it or change docker-compose.yml:
ports:
  - "5433:5432"  # Use different port
```

### Database Not Ready?
```bash
# Watch postgres startup
docker-compose logs -f postgres

# Wait for: "database system is ready to accept connections"
```

### App Not Updating?
```bash
# Restart app
docker-compose restart app

# Or rebuild
docker-compose up -d --build app
```

### Complete Reset
```bash
# Nuclear option - deletes everything
docker-compose down -v
docker-compose up -d
docker-compose exec app npx drizzle-kit push
```

---

## 🎯 Complete First-Time Setup

```bash
# 1. Start services
docker-compose up -d

# 2. Wait for database (watch logs)
docker-compose logs -f postgres
# Press Ctrl+C when you see "ready to accept connections"

# 3. Run migrations
docker-compose exec app npx drizzle-kit push

# 4. Verify with tests
docker-compose exec app npm test

# 5. Create a club (example)
curl -X POST http://localhost:3777/api/clubs \
  -H "Content-Type: application/json" \
  -H "x-admin-key: test-admin-key" \
  -d '{"displayName":"Test Club","safeName":"test-club"}'

# 6. List clubs
curl http://localhost:3777/api/clubs
```

---

## 💡 Pro Tips

✅ **Code changes auto-reload** - No need to rebuild  
✅ **Data persists** - Database survives restarts  
✅ **Test DB auto-created** - Ready for `npm test`  
✅ **Use service names** - App connects to `postgres`, not `localhost`  
✅ **Check logs first** - `docker-compose logs -f` shows errors  

---

## ⚠️ Before Production

1. Change `PLAYFOLIO_ADMIN_KEY` in `docker-compose.yml`
2. Use strong database password
3. Don't expose ports in production
4. Use environment files for secrets
5. Set `NODE_ENV=production`

---

## 📚 Quick Reference

```bash
# Status
docker-compose ps

# Logs
docker-compose logs -f

# Migrations
docker-compose exec app npx drizzle-kit push

# Tests
docker-compose exec app npm test

# Database
docker-compose exec postgres psql -U appuser -d playfolio

# Restart
docker-compose restart

# Rebuild
docker-compose build

# Clean up
docker-compose down -v
```
