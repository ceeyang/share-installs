# Stage 1: deps
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

# Stage 2: development (hot-reload via Vite)
FROM deps AS development
COPY . .
EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]

# Stage 3: builder (compile Vue → dist)
FROM deps AS builder
COPY . .
# Declare build args so Docker passes them through from docker-compose build.args.
# Vite reads these as regular env vars during `npm run build` (via loadEnv with '' prefix).
ARG PADDLE_ENV
ARG PADDLE_CLIENT_TOKEN
ARG PADDLE_PRICE_PRO_MONTHLY
ARG PADDLE_PRICE_PRO_YEARLY
ARG PADDLE_PRICE_UNLIMITED_MONTHLY
ARG PADDLE_PRICE_UNLIMITED_YEARLY
RUN npm run build

# Stage 4: production (nginx serving dist)
FROM nginx:alpine AS production
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
