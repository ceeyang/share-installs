#!/bin/bash

# Exit on error
set -e

# ANSI escape codes for coloring
GREEN='\033[0;32m'
BOLD_GREEN='\033[1;32m'
BLUE='\033[0;34m'
BOLD_BLUE='\033[1;34m'
CYAN='\033[0;36m'
BOLD_CYAN='\033[1;36m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Print header
echo -e "${BOLD_CYAN}"
echo "========================================================="
echo "   🚀 share-installs – Docker Development Environment   "
echo "========================================================="
echo -e "${NC}"

# Function to safely get env var with fallback to .env and defaults
get_env_var() {
  local var_name=$1
  local default_val=$2
  local val=""
  # First check process environment
  if [ -n "${!var_name}" ]; then
    val="${!var_name}"
  # Then check .env file if it exists
  elif [ -f .env ]; then
    val=$(grep -E "^${var_name}=" .env | cut -d'=' -f2- | tr -d '\r' | tr -d '"' | tr -d "'")
  fi
  echo "${val:-$default_val}"
}

# Check if .env exists
if [ ! -f .env ]; then
  echo -e "${YELLOW}⚠️  No .env file found in project root. Running with fallback default configuration.${NC}"
else
  echo -e "${GREEN}ℹ️  Using configuration from .env file.${NC}"
fi

# Load ports and configurations
BACKEND_PORT=$(get_env_var BACKEND_PORT 6066)
DB_PORT=$(get_env_var DB_PORT 5432)
REDIS_PORT=$(get_env_var REDIS_PORT 6379)
MULTI_TENANT=$(get_env_var MULTI_TENANT true)
ADMIN_SECRET=$(get_env_var ADMIN_SECRET 05d92ec1489cf6120dc8072686437e0eb8300a493337908ba25ace0a6ee1273b)

# Run docker compose
echo -e "\n${BOLD_BLUE}⚙️  Spinning up containers in detached mode...${NC}"
export ACME_EMAIL=$(get_env_var ACME_EMAIL "")
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d

echo -e "\n${BOLD_BLUE}⌛ Waiting for backend health check API to respond...${NC}"
# Wait loop
MAX_RETRIES=40
RETRY_COUNT=0
IS_READY=false
while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
  STATUS_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:${BACKEND_PORT}/api/health || echo "000")
  if [ "$STATUS_CODE" = "200" ]; then
    IS_READY=true
    break
  fi
  echo -n "."
  sleep 1
  RETRY_COUNT=$((RETRY_COUNT+1))
done

if [ "$IS_READY" = true ]; then
  echo -e " ${BOLD_GREEN}[READY]${NC}\n"
else
  echo -e " ${RED}[TIMEOUT/FAILED]${NC}\n"
  echo -e "${RED}❌ Backend did not become healthy in time. Showing container statuses:${NC}"
  docker compose ps
  echo -e "\n${YELLOW}Streaming logs to diagnose the issue...${NC}"
  docker compose logs
  exit 1
fi

# Display Dashboard
DEPLOY_MODE="Single-tenant (Self-hosted)"
if [ "$MULTI_TENANT" = "true" ] || [ "$MULTI_TENANT" = "TRUE" ]; then
  DEPLOY_MODE="Multi-tenant (SaaS)"
fi

echo -e "${BOLD_GREEN}=========================================================================${NC}"
echo -e "🎉 Services started successfully!"
echo -e "${BOLD_GREEN}=========================================================================${NC}"
echo -e "🖥️  Frontend Console :  ${BOLD_CYAN}http://localhost:5173${NC}"
echo -e "⚙️  Backend API      :  ${BOLD_CYAN}http://localhost:${BACKEND_PORT}${NC}"
echo -e "🔌 Health Endpoint  :  ${BOLD_CYAN}http://localhost:${BACKEND_PORT}/api/health${NC}"
echo -e "-------------------------------------------------------------------------"
echo -e "🔑 Admin Secret     :  ${YELLOW}${ADMIN_SECRET}${NC}"
echo -e "🌐 Deployment Mode  :  ${CYAN}${DEPLOY_MODE}${NC}"
echo -e "-------------------------------------------------------------------------"
echo -e "📦 PostgreSQL Port  :  ${BLUE}${DB_PORT}${NC}"
echo -e "⚡ Redis Port       :  ${BLUE}${REDIS_PORT}${NC}"
echo -e "${BOLD_GREEN}=========================================================================${NC}"
echo ""

# Stream logs
echo -e "${BOLD_BLUE}📺 Streaming container logs (Press Ctrl+C to stop)...${NC}\n"
docker compose logs -f --tail=30
