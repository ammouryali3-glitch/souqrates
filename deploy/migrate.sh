#!/usr/bin/env bash
# =============================================================================
# Souqrates — Push DB Schema to Supabase
#
# Runs drizzle-kit push against the DIRECT Supabase connection (not the pooler).
# Safe to run multiple times — drizzle only applies missing changes.
#
# Usage:
#   DATABASE_DIRECT_URL="postgresql://postgres:PASS@db.XXX.supabase.co:5432/postgres" \
#     bash deploy/migrate.sh
#
# Or with the pooler URL as fallback:
#   DATABASE_URL="..." bash deploy/migrate.sh
# =============================================================================
set -euo pipefail

log() { echo -e "\033[1;35m[MIGRATE]\033[0m $*"; }

# Prefer direct URL for migrations, fall back to pooler URL
MIGRATE_URL="${DATABASE_DIRECT_URL:-${DATABASE_URL:-}}"

[[ -n "$MIGRATE_URL" ]] || {
  echo "❌  Set DATABASE_DIRECT_URL (or DATABASE_URL) before running"
  exit 1
}

log "Checking pnpm..."
command -v pnpm &>/dev/null || npm install -g pnpm@10

log "Installing workspace deps..."
pnpm install --frozen-lockfile --ignore-scripts

log "Pushing schema to Supabase..."
NODE_ENV=production \
  DATABASE_DIRECT_URL="$MIGRATE_URL" \
  DATABASE_URL="$MIGRATE_URL" \
  pnpm --filter @workspace/db run push

log "✅ Schema push complete!"
log ""
log "Tip: run again whenever you add a new table or column in lib/db/src/schema/"
