#!/usr/bin/env bash
# =============================================================================
# Souqrates — First Manual Deploy
# Run this ONCE from your local machine after setup-contabo.sh completes,
# OR wait for GitHub Actions to handle it automatically after the first push.
#
# Usage (from repo root):
#   CONTABO_HOST=185.x.x.x CONTABO_USER=root bash deploy/first-deploy.sh
# =============================================================================
set -euo pipefail

CONTABO_HOST="${CONTABO_HOST:-}"
CONTABO_USER="${CONTABO_USER:-root}"
APP_DIR="/opt/souqrates/api"
WEB_DIR="/var/www/souqrates"

[[ -n "$CONTABO_HOST" ]] || { echo "Set CONTABO_HOST"; exit 1; }

log() { echo -e "\033[1;36m[DEPLOY]\033[0m $*"; }

log "Building locally..."
pnpm install --frozen-lockfile
pnpm --filter @workspace/api-server run build
pnpm --filter @workspace/skz-bot run build

log "Syncing API dist..."
rsync -az --delete --exclude='*.map' \
  artifacts/api-server/dist/ \
  "$CONTABO_USER@$CONTABO_HOST:$APP_DIR/dist/"

rsync -az \
  artifacts/api-server/package.json \
  pnpm-workspace.yaml \
  pnpm-lock.yaml \
  "$CONTABO_USER@$CONTABO_HOST:$APP_DIR/"

log "Syncing frontend..."
rsync -az --delete \
  artifacts/skz-bot/dist/public/ \
  "$CONTABO_USER@$CONTABO_HOST:$WEB_DIR/"

log "Starting PM2 on server..."
ssh "$CONTABO_USER@$CONTABO_HOST" bash <<'REMOTE'
  set -e
  export PNPM_HOME="/root/.local/share/pnpm"
  export PATH="$PNPM_HOME:$PATH"
  cd /opt/souqrates/api

  pnpm install --prod --frozen-lockfile --ignore-scripts 2>/dev/null || true

  # Start or reload
  if pm2 show souqrates-api > /dev/null 2>&1; then
    pm2 reload souqrates-api --update-env
  else
    pm2 start ecosystem.config.cjs
  fi
  pm2 save

  # Run DB migrations
  echo "Running DB schema push..."
  # pnpm --filter @workspace/db run push  # uncomment if you want auto-push

  echo "✅ First deploy done"
REMOTE

log "✅ Deployed! Check: curl http://$CONTABO_HOST/api/healthz"
