# share-installs Backend – Multi-stage Dockerfile
#
# Build targets:
#   development  hot-reload via ts-node-dev
#   production   minimal runtime image (default)
#
# Usage:
#   docker build --target production -t share-installs-backend .
#   docker build --target development -t share-installs-backend:dev .

# ── Stage 1: deps (shared install layer) ──────────────────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app
# Prisma's migration engine requires OpenSSL (not included in Alpine by default)
RUN apk add --no-cache openssl
COPY package*.json prisma.config.ts* ./
COPY prisma ./prisma/
# Install all deps (including devDeps needed for build & prisma generate)
RUN npm ci --ignore-scripts && npx prisma generate

# ── Stage 2: development (hot-reload with ts-node-dev) ───────────────────────
FROM node:20-alpine AS development
WORKDIR /app
RUN apk add --no-cache openssl
ENV NODE_ENV=development
COPY --from=deps /app/node_modules ./node_modules
COPY package*.json tsconfig.json prisma.config.ts* ./
COPY prisma ./prisma/
COPY src ./src/
EXPOSE 6066
CMD ["npm", "run", "dev"]

# ── Stage 3: builder (compile TypeScript) ─────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY package*.json tsconfig.json prisma.config.ts* ./
COPY prisma ./prisma/
COPY src ./src/
RUN npm run build

# ── Stage 4: production (minimal runtime) ─────────────────────────────────────
FROM node:20-alpine AS production
WORKDIR /app
# Prisma's migration engine requires OpenSSL
RUN apk add --no-cache openssl
ENV NODE_ENV=production

# Security: non-root user
RUN addgroup -g 1001 -S nodejs && adduser -S appuser -u 1001

# Production-only node_modules
COPY package*.json prisma.config.ts* ./
RUN npm ci --omit=dev --ignore-scripts

# Compiled output + Prisma artifacts
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY prisma ./prisma/

RUN chown -R appuser:nodejs /app
USER appuser

EXPOSE 6066

HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD wget -qO- http://127.0.0.1:6066/api/health || exit 1

# Run DB migrations then start server
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/server.js"]
