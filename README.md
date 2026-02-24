# PlayFolio!

This is an api to help folks manage activities at immersive events such as LARPs or experiences with light game elements.

## Environment Vars

```bash
PLAYFOLIO_ADMIN_KEY=secretkeyphrase // key should match playfolio admin env. var
```

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3777](http://localhost:3777) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.


## Run In Docker

Docker stands up a PostgreSQL container and runs Drizzle migrations automatically — no manual database setup required.

### Services

| Service | Description | Port |
|---|---|---|
| `postgres` | PostgreSQL 16 database | 5432 |
| `migrate` | Runs Drizzle migrations on startup, then exits | — |
| `app` | Playfolio API (Next.js dev server) | 3777 |
| `admin` | Playfolio Admin UI — **optional**, see below | 4400 |

### Start API only

```bash
docker compose up -d
```

API available at `http://localhost:3777`.

### Start API + Admin together

```bash
docker compose --profile admin up -d
```

Admin UI available at `http://localhost:4400`.

### Rebuild after code changes

```bash
# API only
docker compose up -d --build

# API + Admin
docker compose --profile admin up -d --build
```

### Fresh start (wipe database)

```bash
docker compose down -v   # -v removes the postgres_data volume
docker compose up -d
```

### Logs

```bash
docker compose logs -f              # all services
docker compose logs -f app          # API only
docker compose logs -f admin        # Admin UI only
docker compose logs migrate         # check migrations ran OK
```

### Check running containers

```bash
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
```
