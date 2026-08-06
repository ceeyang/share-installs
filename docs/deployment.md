# Deployment Guide

## Contents

1. [Docker (Recommended)](#1-docker-recommended)
2. [Development Mode (Hot-reload)](#2-development-mode)
3. [Bare Metal](#3-bare-metal)
4. [PaaS (Railway / Render / Fly.io)](#4-paas-quick-options)
5. [Environment Variables Reference](#5-environment-variables-reference)
6. [Database Migrations](#6-database-migrations)
7. [Monitoring & Logs](#7-monitoring--logs)

---

## 1. Docker (Recommended)

The simplest way to self-host share-installs. Compose starts Traefik (HTTPS),
the dashboard, the backend (`:6066`), PostgreSQL 16, and Redis 7.

### Prerequisites

- Docker Desktop (Mac/Windows) or Docker Engine + Compose plugin (Linux)
- Ports 6066, 5432, 6379 available on your host
  (override with `BACKEND_PORT` / `DB_PORT` / `REDIS_PORT` in `.env`)

### Steps

```bash
# Clone
git clone https://github.com/ceeyang/share-installs.git
cd share-installs

# (Optional) create a .env file in the project root for overrides
cat > .env <<'EOF'
CORS_ORIGINS=https://yourapp.com
# ADMIN_SECRET=change-me-to-a-random-secret   # protects /api/v1/projects
# DB_PORT=15432                               # if 5432 is taken on the host
EOF

# Start (first run builds the image, ~2-3 min)
docker compose up --build -d

# Follow logs
docker compose logs -f backend
```

### Verify

```bash
curl http://localhost:6066/api/health
# {"status":"ok","timestamp":"...","version":"1.0.0","mode":"self-hosted"}

curl -X POST http://localhost:6066/api/v1/clicks \
  -H "Content-Type: application/json" \
  -d '{"inviteCode":"TEST123","fingerprint":{"timezone":"Asia/Shanghai"}}'
# {"eventId":"..."}
```

### Update

```bash
git pull
docker compose up --build -d
```

### Backup & Restore

```bash
# Backup PostgreSQL data
docker compose exec db pg_dump -U postgres share_installs > backup.sql

# Restore
docker compose exec -T db psql -U postgres share_installs < backup.sql
```

---

## 2. Development Mode

Hot-reload via Docker Compose Watch. Source changes sync into the container
and restart the server automatically; the dev overlay also bypasses Traefik
for direct port access.

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build
```

Edit files under `backend/src/` or `dashboard/src/` locally — changes are
picked up automatically. `package.json` or Prisma schema changes trigger an
image rebuild.

---

## 3. Bare Metal

### Prerequisites

- Node.js 20+
- PostgreSQL 14+ (database: `share_installs`)
- Redis 7+

### Steps

```bash
cd backend

# 1. Install dependencies
npm install

# 2. Configure
cp .env.example .env
# Edit .env – at minimum set DATABASE_URL and REDIS_URL

# 3. Generate Prisma client & run migrations
npm run db:generate
npm run db:migrate

# 4a. Development (hot-reload)
npm run dev

# 4b. Production
npm run build
NODE_ENV=production node dist/server.js
```

### Process Management (Production)

Use a process manager to keep the server alive:

**PM2:**
```bash
npm install -g pm2
pm2 start dist/server.js --name share-installs
pm2 save && pm2 startup
```

**systemd:**
```ini
# /etc/systemd/system/share-installs.service
[Unit]
Description=share-installs backend
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/opt/share-installs/backend
ExecStart=node dist/server.js
Restart=on-failure
EnvironmentFile=/opt/share-installs/backend/.env

[Install]
WantedBy=multi-user.target
```

```bash
systemctl enable --now share-installs
```

---

## 4. PaaS Quick Options

### Railway

```bash
npm install -g @railway/cli
railway login
railway init

# Add PostgreSQL and Redis plugins in the Railway dashboard, then:
railway variables set CORS_ORIGINS=https://yourapp.com
railway up --detach
```

### Render

1. Create a new **Web Service** → connect your GitHub repo
2. Set **Root Directory** to `backend`
3. Set **Build Command**: `npm install && npm run db:generate && npm run build`
4. Set **Start Command**: `npx prisma migrate deploy && node dist/server.js`
5. Add **Environment Variables** from the reference table below
6. Add **PostgreSQL** and **Redis** add-ons

### Fly.io

```bash
cd backend
fly launch --name share-installs
fly postgres create --name share-installs-db
fly redis create --name share-installs-redis
fly secrets set \
  DATABASE_URL="<postgres-connection-string>" \
  REDIS_URL="<redis-connection-string>"
fly deploy
```

---

## 5. Environment Variables Reference

Matches `backend/src/config/index.ts` (see `backend/.env.example`).

### Core

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | ✓ | — | `postgresql://user:pass@host:5432/share_installs` |
| `REDIS_URL` | — | `redis://localhost:6379` | `redis://` or `rediss://` (TLS) |
| `PORT` | — | `3000` (compose sets `6066`) | HTTP listen port |
| `HOST` | — | `0.0.0.0` | HTTP bind address |
| `NODE_ENV` | — | `development` | `development` / `test` / `production` |
| `CORS_ORIGINS` | — | `*` | Comma-separated allowed origins |
| `LOG_LEVEL` | — | `info` | `trace`…`fatal` |
| `REDIS_KEY_PREFIX` | — | `si:` | Prefix for all Redis keys |

### Deployment mode & auth

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `MULTI_TENANT` | — | `false` | `false` = self-hosted (no API keys); `true` = SaaS (API keys required) |
| `ADMIN_SECRET` | — | _(open)_ | Protects `/api/v1/projects` admin endpoints |
| `JWT_SECRET` | SaaS | — | Signs dashboard session cookies |
| `ENCRYPTION_KEY` | SaaS | — | Encrypts stored API keys for one-time reveal |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | SaaS | — | GitHub OAuth login |
| `FRONTEND_URL` | SaaS | `http://localhost:5173` | Dashboard URL (OAuth redirects, Paddle success page) |

### Fingerprint matching & rate limiting

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `FINGERPRINT_MATCH_TTL_HOURS` | — | `72` | Click-event match window |
| `FINGERPRINT_MATCH_THRESHOLD` | — | `0.75` | Fuzzy match min score (0.0–1.0) |
| `RATE_LIMIT_WINDOW_MS` | — | `900000` | Global rate-limit window (15 min) |
| `RATE_LIMIT_MAX_REQUESTS` | — | `100` | Max requests per window |
| `RATE_LIMIT_RESOLVE_MAX` | — | `10` | `/api/v1/resolutions` per-minute cap (self-hosted) |

### Billing (SaaS only, Paddle)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PADDLE_ENV` | — | `sandbox` | `sandbox` / `production` (independent of NODE_ENV) |
| `PADDLE_API_KEY` | SaaS billing | — | Paddle Billing API key |
| `PADDLE_WEBHOOK_SECRET` | SaaS billing | — | Verifies `/api/webhooks/paddle` signatures |
| `PADDLE_PRICE_PRO_MONTHLY` 等 4 个 | SaaS billing | placeholders | Paddle price IDs for PRO/UNLIMITED × monthly/yearly |

---

## 6. Database Migrations

Migrations are managed by Prisma Migrate.

```bash
# Apply all pending migrations (run this before every deployment)
npx prisma migrate deploy

# Create a new migration (development only)
npx prisma migrate dev --name add_new_field

# View migration status
npx prisma migrate status
```

In Docker, migrations run automatically at container startup via `CMD`:
```dockerfile
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/server.js"]
```

---

## 7. Monitoring & Logs

### Structured Logs (Pino)

All logs are emitted as JSON. In development, pipe through `pino-pretty`:

```bash
npm run dev | npx pino-pretty
```

In production, logs are readable by any log aggregator (Datadog, CloudWatch, Loki, etc.):

```bash
docker compose logs -f backend | jq '.'
```

Every response carries an `X-Request-Id` header (propagated from the incoming
request or generated) for cross-service correlation.

### Health Check

```bash
curl http://localhost:6066/api/health
```

Response:
```json
{
  "status": "ok",
  "timestamp": "2026-01-15T10:30:00.000Z",
  "version": "1.0.0",
  "mode": "self-hosted"
}
```

The Docker Compose healthcheck polls this endpoint every 30 s.
