# Deployment Guide

## Contents

1. [Docker (Recommended)](#1-docker-recommended)
2. [Development Mode (Hot-reload)](#2-development-mode)
3. [Bare Metal](#3-bare-metal)
4. [Kubernetes / AWS EKS](#4-kubernetes--aws-eks)
5. [PaaS (Railway / Render / Fly.io)](#5-paas-quick-options)
6. [Environment Variables Reference](#6-environment-variables-reference)
7. [Database Migrations](#7-database-migrations)
8. [Monitoring & Logs](#8-monitoring--logs)

---

## 1. Docker (Recommended)

The simplest way to self-host share-installs.

### Prerequisites

- Docker Desktop (Mac/Windows) or Docker Engine + Compose plugin (Linux)
- Ports 3000, 5432, 6379 available on your host

### Steps

```bash
# Clone
git clone https://github.com/yourorg/share-installs.git
cd share-installs

# (Optional) create a .env file in the project root for overrides
cat > .env <<'EOF'
INVITE_LINK_BASE_URL=https://yourapp.com
IOS_APP_STORE_URL=https://apps.apple.com/app/id123456789
ANDROID_PLAY_STORE_URL=https://play.google.com/store/apps/details?id=com.yourapp
IOS_URI_SCHEME=yourapp
ANDROID_URI_SCHEME=yourapp
CORS_ORIGINS=https://yourapp.com
# ADMIN_SECRET=change-me-to-a-random-secret
EOF

# Start (first run builds the image, ~2-3 min)
docker compose up --build -d

# Follow logs
docker compose logs -f backend
```

### Verify

```bash
curl http://localhost:3000/health
# {"status":"ok","version":"1.0.0","uptime":12.3}

curl -X POST http://localhost:3000/v1/invites \
  -H "Content-Type: application/json" \
  -d '{"inviterId":"test_user"}'
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

Hot-reload via `ts-node-dev`. Source changes restart the server automatically.

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build
```

`backend/src/` is mounted into the container as read-only. Edit files locally, changes are picked up instantly.

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

## 4. Kubernetes / AWS EKS

### Infrastructure Provisioning (Terraform)

```bash
cd infrastructure/terraform

# Initialize
terraform init -backend-config="bucket=your-tf-state-bucket"

# Plan
terraform plan \
  -var="environment=production" \
  -var="domain_name=api.yourapp.com" \
  -var="db_password=$(openssl rand -base64 32)"

# Apply (~15 min)
terraform apply
```

Resources created:
- VPC with public/private subnets (2 AZs)
- EKS cluster with managed node group
- RDS PostgreSQL 16 (Multi-AZ in production)
- ElastiCache Redis 7
- ACM certificate (DNS validated)
- ECR repositories for Docker images

### Application Deployment

#### Option A: GitHub Actions (CI/CD)

Push to `main` triggers the deploy pipeline (`.github/workflows/deploy-backend.yml`):

1. Build Docker image
2. Push to ECR
3. Run `prisma migrate deploy`
4. `kubectl rollout` with zero-downtime rolling update

Required GitHub Secrets:
```
AWS_DEPLOY_ROLE_ARN   # IAM role ARN with ECR + EKS permissions
DATABASE_URL          # Full PostgreSQL connection string
```

#### Option B: Manual deploy

```bash
# Configure kubectl
aws eks update-kubeconfig --name share-installs-production --region us-east-1

# Create namespace
kubectl create namespace share-installs

# Create secrets
kubectl create secret generic share-installs-backend-secrets \
  --namespace share-installs \
  --from-literal=database-url="$DATABASE_URL" \
  --from-literal=redis-url="$REDIS_URL" \
  --from-literal=admin-secret="$ADMIN_SECRET"

# Create configmap
kubectl create configmap share-installs-backend-config \
  --namespace share-installs \
  --from-literal=invite-link-base-url="https://yourapp.com" \
  --from-literal=ios-app-store-url="$IOS_APP_STORE_URL" \
  --from-literal=android-play-store-url="$ANDROID_PLAY_STORE_URL" \
  --from-literal=ios-uri-scheme="yourapp" \
  --from-literal=android-uri-scheme="yourapp" \
  --from-literal=cors-origins="https://yourapp.com"

# Deploy
kubectl apply -f infrastructure/k8s/backend-deployment.yaml
kubectl apply -f infrastructure/k8s/ingress.yaml

# Check status
kubectl get pods -n share-installs
kubectl get ingress -n share-installs
```

### Scaling

The HPA (Horizontal Pod Autoscaler) is pre-configured:
- Min replicas: 2
- Max replicas: 10
- Scale up at: 70% CPU or 80% memory

Manual override:
```bash
kubectl scale deployment share-installs-backend \
  --replicas=4 -n share-installs
```

---

## 5. PaaS Quick Options

### Railway

```bash
# Install Railway CLI
npm install -g @railway/cli
railway login

# Create project
railway init

# Add PostgreSQL and Redis plugins in Railway dashboard, then:
railway variables set \
  INVITE_LINK_BASE_URL=https://yourapp.com \
  IOS_APP_STORE_URL=https://apps.apple.com/app/id123 \
  ANDROID_PLAY_STORE_URL=https://play.google.com/store/...

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
  REDIS_URL="<redis-connection-string>" \
  INVITE_LINK_BASE_URL="https://yourapp.com"
fly deploy
```

---

## 6. Environment Variables Reference

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | ✓ | — | `postgresql://user:pass@host:5432/share_installs` |
| `REDIS_URL` | ✓ | — | `redis://host:6379` or `rediss://` (TLS) |
| `INVITE_LINK_BASE_URL` | ✓ | — | Base URL of invite landing pages |
| `PORT` | — | `3000` | HTTP listen port |
| `HOST` | — | `0.0.0.0` | HTTP bind address |
| `NODE_ENV` | — | `production` | `development` / `production` |
| `ADMIN_SECRET` | — | _(open)_ | Protects `POST/GET/DELETE /v1/invites` |
| `IOS_APP_STORE_URL` | — | — | Returned to iOS users after click |
| `ANDROID_PLAY_STORE_URL` | — | — | Returned to Android users after click |
| `IOS_URI_SCHEME` | — | — | e.g. `yourapp` → `yourapp://invite?code=X` |
| `ANDROID_URI_SCHEME` | — | — | Same for Android |
| `CORS_ORIGINS` | — | `*` | Comma-separated allowed origins |
| `LOG_LEVEL` | — | `info` | `fatal`/`error`/`warn`/`info`/`debug`/`trace` |
| `INVITE_CODE_LENGTH` | — | `8` | Length of generated invite codes |
| `INVITE_DEFAULT_TTL_DAYS` | — | `30` | Default invite expiry |
| `FINGERPRINT_MATCH_THRESHOLD` | — | `0.85` | Fuzzy match min score (0.0–1.0) |
| `FINGERPRINT_MATCH_TTL_HOURS` | — | `24` | Click event match window |
| `REDIS_KEY_PREFIX` | — | `si:` | Prefix for all Redis keys |
| `RATE_LIMIT_WINDOW_MS` | — | `900000` | Rate limit window (15 min) |
| `RATE_LIMIT_MAX_REQUESTS` | — | `100` | Max requests per window |

---

## 7. Database Migrations

Migrations are managed by Prisma Migrate.

```bash
# Apply all pending migrations (run this before every deployment)
npx prisma migrate deploy

# Create a new migration (development only)
npx prisma migrate dev --name add_new_field

# View migration status
npx prisma migrate status

# Reset database (DESTRUCTIVE – dev only)
npx prisma migrate reset
```

In Docker, migrations run automatically at container startup via `CMD`:
```dockerfile
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/server.js"]
```

---

## 8. Monitoring & Logs

### Structured Logs (Pino)

All logs are emitted as JSON. In development, pipe through `pino-pretty`:

```bash
npm run dev | npx pino-pretty
```

In production, logs are readable by any log aggregator (Datadog, CloudWatch, Loki, etc.):

```bash
# Docker
docker compose logs -f backend | jq '.'

# Kubernetes
kubectl logs -f deployment/share-installs-backend -n share-installs | jq '.'
```

### Health Check

```bash
curl http://localhost:3000/health
```

Response:
```json
{
  "status": "ok",
  "version": "1.0.0",
  "uptime": 3600.2,
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

### Metrics

Prometheus scrape is pre-annotated in the Kubernetes manifests:
```yaml
prometheus.io/scrape: "true"
prometheus.io/port: "3000"
prometheus.io/path: "/metrics"
```
