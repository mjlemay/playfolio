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

- **PostgreSQL** on `localhost:5433`
  - Production DB: `playfolio`
  - Test DB: `playfolio_test` (auto-created)
  - User: `appuser`
  - Password: `apppassword`

- **Next.js App** on `localhost:3777`
  - Hot reload enabled ✨
  - Code changes auto-update

- **Ory Kratos** on `localhost:4433` (public) and `localhost:4434` (admin, loopback only),
  plus the **Login app** on `localhost:3778` — see
  [Identity (Ory Kratos) and the Login app](#identity-ory-kratos-and-the-login-app)

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
psql -h localhost -p 5433 -U appuser -d playfolio
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

### Postgres Port Conflicts

The compose file already publishes Postgres on host port **5433** (`"5433:5432"`), because
Homebrew's `postgresql@14` commonly owns 5432 on a dev Mac. Connect from the host with
`-p 5433`; containers still reach it as `postgres:5432` on the Docker network.

If something else has taken 5433 too:
```bash
# Check what's using it
lsof -i :5433

# Then pick another free host port in docker-compose.yml:
ports:
  - "5434:5432"  # host port only — leave the container side at 5432
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

## Identity (Ory Kratos) and the Login app

The stack also runs Ory Kratos v26.2.0 and the player-facing login app from `../playfolio-login`.

| Service | Host port | Purpose |
|---|---|---|
| `kratos` | 4433 | Kratos public API (self-service flows, whoami) |
| `kratos` | 4434 | Kratos admin API — local only, never expose |
| `login` | 3778 | Register / login / profile pages |
| `postgres` | **5433** | Postgres (host port moved off 5432 to avoid Homebrew Postgres) |

Kratos config lives in `../playfolio-login/kratos/` and is bind-mounted read-only. It uses its own
database, `kratos`, in the shared Postgres container. That database is created by
`scripts/init-kratos-db.sql` on a fresh volume. If your volume predates this, create it once.
Run this **before** `docker compose up -d`, with only `postgres` started — it is safe to re-run:

```sh
docker compose up -d postgres
docker compose exec postgres psql -U appuser -d playfolio -tc \
  "SELECT 1 FROM pg_database WHERE datname='kratos'" | grep -q 1 || \
  docker compose exec postgres psql -U appuser -d playfolio -c "CREATE DATABASE kratos;"
```

Forget it and `kratos-migrate` restart-loops with `database "kratos" does not exist`, so `kratos`
never starts (it waits for the migrator to exit cleanly).

### Things that bite

- Always use `http://localhost:…`, never `127.0.0.1`. Kratos derives its CSRF cookie name from `serve.public.base_url` (`http://localhost:4433/`), and cookies are host-scoped, so mixing the two produces opaque CSRF errors.
- Keep the `--dev` flag on the `kratos` command while running over plain http. Without it Kratos marks cookies Secure and the browser drops them.
- The `login` container installs `node_modules` into an anonymous volume seeded at first start. After adding a dependency, run `docker compose up -d --build --renew-anon-volumes login` — the `--renew-anon-volumes` flag discards the stale `node_modules` volume, without which the rebuilt image still sees the old packages.
- Secrets in `kratos.yml` and `HOOK_SECRET` in the compose file are development values. For an event, mount a separate non-committed `kratos.yml` with real secrets and set `HOOK_SECRET` to match; Kratos does not interpolate environment variables inside its config file.

### Smoke test

1. `docker compose up -d` — `kratos-migrate` and `migrate` exit 0; `postgres`, `kratos`, `app`, `login` stay up.
2. Open http://localhost:3778/register, register with an email, password, and display name. You land on `/profile` showing the display name and a `player_uid`. The `login` container must be running for this to succeed: Kratos assigns `player_uid` by calling the registration webhook at `http://login:3778` before saving the identity, so registration fails outright while it is down.
3. Log out (link on the profile page), log back in at http://localhost:3778/login.
4. Verify from the terminal (copy the `ory_kratos_session` cookie value from your browser dev tools):
   ```sh
   curl -s -b "ory_kratos_session=<value>" http://localhost:4433/sessions/whoami | python3 -m json.tool
   curl -s http://localhost:4434/admin/identities | python3 -c "import json,sys;[print(i['traits']) for i in json.load(sys.stdin)]"
   ```
   `whoami` shows `"active": true`; every identity has a UUID in `traits.player_uid`. If any identity lacks one, the registration webhook is misconfigured — check `docker compose logs kratos | grep -i hook`.

### Session API

The API can identify the logged-in player from the Kratos session cookie:

| Endpoint | Returns |
|---|---|
| `GET /api/me` | The caller's player row (created on first call, `uid` = Kratos `player_uid`), club and squad memberships, and `identity { email, display_name }` |
| `GET /api/me/activities` | The caller's activities, newest first. Query: `format`, `start_date`, `end_date`, `limit` (≤500), `offset` |

Both return 401 with no session and 503 if Kratos is unreachable. Try it after logging in at http://localhost:3778 (copy the `ory_kratos_session` cookie from dev tools):

```sh
curl -s -b "ory_kratos_session=<value>" http://localhost:3777/api/me | python3 -m json.tool
```

### Resetting test identities

Smoke tests leave throwaway accounts behind. To delete every identity in the dev database (dev only; this is irreversible):

```sh
curl -s http://127.0.0.1:4434/admin/identities | python3 -c "import json,sys;[print(i['id']) for i in json.load(sys.stdin)]" \
  | xargs -I{} curl -s -o /dev/null -w '%{http_code} {}\n' -X DELETE http://127.0.0.1:4434/admin/identities/{}
```
