#!/bin/bash
# SSH deployment script for the Mastra agent server
# Usage: ./deploy/deploy.sh <SSH_HOST> [SSH_USER]
#
# Connects to the Oracle Cloud VM, pulls latest code, rebuilds the
# Docker image, and restarts the containers.

set -euo pipefail

SSH_HOST="${1:?Usage: ./deploy/deploy.sh <SSH_HOST> [SSH_USER]}"
SSH_USER="${2:-ubuntu}"
DEPLOY_DIR="/opt/lumenalta"

echo "Deploying to ${SSH_USER}@${SSH_HOST}..."

ssh "${SSH_USER}@${SSH_HOST}" << DEPLOY
  set -euo pipefail
  cd ${DEPLOY_DIR}
  echo "Pulling latest code..."
  git pull origin main
  echo "Building Docker image..."
  docker compose build --no-cache
  echo "Restarting services..."
  docker compose down
  docker compose up -d
DEPLOY

echo "Waiting for health check..."
sleep 8

ssh "${SSH_USER}@${SSH_HOST}" "curl -sf http://localhost:4111/health" && \
  echo "Deployment successful - health check passed" || \
  echo "WARNING: Health check failed - check container logs with: ssh ${SSH_USER}@${SSH_HOST} docker compose -f ${DEPLOY_DIR}/docker-compose.yml logs"
