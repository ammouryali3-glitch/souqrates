#!/usr/bin/env bash
# =============================================================================
# Souqrates — Contabo Server Setup Script
# Ubuntu 24.04 LTS
#
# Run once as root on a fresh Contabo VPS:
#   curl -fsSL https://raw.githubusercontent.com/ammouryali3-glitch/souqrates/main/deploy/setup-contabo.sh | bash
#
# Required env vars (set before running or edit the CONFIGURE section below):
#   DATABASE_URL          — PostgreSQL connection string
#   TELEGRAM_BOT_TOKEN    — Telegram bot token
#   SESSION_SECRET        — Random 64-char string (openssl rand -hex 32)
#   DOMAIN                — Your domain or IP (e.g. souqrates.com or 185.x.x.x)
# =============================================================================
set -euo pipefail

# ── CONFIGURE ────────────────────────────────────────────────────────────────
DATABASE_URL="${DATABASE_URL:-}"
TELEGRAM_BOT_TOKEN="${TELEGRAM_BOT_TOKEN:-}"
SESSION_SECRET="${SESSION_SECRET:-$(openssl rand -hex 32)}"
DOMAIN="${DOMAIN:-_}"           # set to your actual domain or server IP
APP_DIR="/opt/souqrates/api"
WEB_DIR="/var/www/souqrates"
API_PORT=8080
NODE_VERSION=20
PNPM_VERSION=10
# ─────────────────────────────────────────────────────────────────────────────

log() { echo -e "\033[1;32m[SETUP]\033[0m $*"; }
err() { echo -e "\033[1;31m[ERROR]\033[0m $*" >&2; exit 1; }

[[ $EUID -eq 0 ]] || err "Run as root"
[[ -n "$DATABASE_URL" ]] || err "DATABASE_URL is required"
[[ -n "$TELEGRAM_BOT_TOKEN" ]] || err "TELEGRAM_BOT_TOKEN is required"

# ── 1. System packages ────────────────────────────────────────────────────────
log "Updating system packages..."
apt-get update -qq
apt-get install -y -qq \
  curl wget gnupg2 ca-certificates \
  nginx certbot python3-certbot-nginx \
  git rsync unzip \
  ufw htop

# ── 2. Node.js ────────────────────────────────────────────────────────────────
log "Installing Node.js $NODE_VERSION..."
curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash -
apt-get install -y nodejs
node -v

# ── 3. pnpm ───────────────────────────────────────────────────────────────────
log "Installing pnpm $PNPM_VERSION..."
npm install -g pnpm@$PNPM_VERSION
export PNPM_HOME="/root/.local/share/pnpm"
export PATH="$PNPM_HOME:$PATH"
echo 'export PNPM_HOME="/root/.local/share/pnpm"' >> /root/.bashrc
echo 'export PATH="$PNPM_HOME:$PATH"' >> /root/.bashrc

# ── 4. PM2 ────────────────────────────────────────────────────────────────────
log "Installing PM2..."
npm install -g pm2
pm2 startup systemd -u root --hp /root | tail -1 | bash || true

# ── 5. App directories ────────────────────────────────────────────────────────
log "Creating app directories..."
mkdir -p "$APP_DIR/dist" "$WEB_DIR"

# ── 6. Environment file ───────────────────────────────────────────────────────
log "Writing .env file..."
cat > "$APP_DIR/.env" <<EOF
NODE_ENV=production
PORT=$API_PORT
DATABASE_URL=$DATABASE_URL
TELEGRAM_BOT_TOKEN=$TELEGRAM_BOT_TOKEN
SESSION_SECRET=$SESSION_SECRET
EOF
chmod 600 "$APP_DIR/.env"

# ── 7. PM2 ecosystem config ───────────────────────────────────────────────────
log "Writing PM2 ecosystem..."
cat > "$APP_DIR/ecosystem.config.cjs" <<EOF
module.exports = {
  apps: [{
    name: "souqrates-api",
    script: "./dist/index.mjs",
    cwd: "$APP_DIR",
    instances: "max",           // one per CPU core
    exec_mode: "cluster",
    env_file: "$APP_DIR/.env",
    node_args: "--enable-source-maps",
    max_memory_restart: "512M",
    exp_backoff_restart_delay: 100,
    log_date_format: "YYYY-MM-DD HH:mm:ss Z",
    merge_logs: true,
    out_file: "/var/log/souqrates/api-out.log",
    error_file: "/var/log/souqrates/api-err.log",
  }]
}
EOF
mkdir -p /var/log/souqrates

# ── 8. Nginx config ───────────────────────────────────────────────────────────
log "Configuring Nginx..."
cat > /etc/nginx/sites-available/souqrates <<NGINXCONF
# Rate limiting zones
limit_req_zone \$binary_remote_addr zone=api_general:10m rate=60r/m;
limit_req_zone \$binary_remote_addr zone=api_init:10m    rate=30r/m;
limit_req_zone \$binary_remote_addr zone=api_login:10m   rate=10r/m;

server {
    listen 80;
    server_name $DOMAIN;

    # Security headers
    add_header X-Frame-Options           DENY           always;
    add_header X-Content-Type-Options    nosniff        always;
    add_header X-XSS-Protection         "1; mode=block" always;
    add_header Referrer-Policy           strict-origin  always;

    # ── Static frontend ──────────────────────────────────────────────────────
    root $WEB_DIR;
    index index.html;

    location / {
        try_files \$uri \$uri/ /index.html;
        expires 1h;
        add_header Cache-Control "public, must-revalidate";
    }

    # Immutable hashed assets (Vite generates content-hashed filenames)
    location ~* \.(js|css|woff2?|png|svg|ico)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # ── API proxy ────────────────────────────────────────────────────────────
    location /api/ {
        limit_req zone=api_general burst=20 nodelay;

        proxy_pass         http://127.0.0.1:$API_PORT;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade           \$http_upgrade;
        proxy_set_header   Connection        keep-alive;
        proxy_set_header   Host              \$host;
        proxy_set_header   X-Real-IP         \$remote_addr;
        proxy_set_header   X-Forwarded-For   \$proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto \$scheme;
        proxy_read_timeout 60s;
        proxy_send_timeout 60s;
        client_max_body_size 10m;
    }

    location /api/admin/login {
        limit_req zone=api_login burst=5 nodelay;
        proxy_pass http://127.0.0.1:$API_PORT;
        proxy_set_header Host              \$host;
        proxy_set_header X-Real-IP         \$remote_addr;
        proxy_set_header X-Forwarded-For   \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    location /api/user/init {
        limit_req zone=api_init burst=10 nodelay;
        proxy_pass http://127.0.0.1:$API_PORT;
        proxy_set_header Host              \$host;
        proxy_set_header X-Real-IP         \$remote_addr;
        proxy_set_header X-Forwarded-For   \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    # Health check (no rate limit, no logging)
    location = /api/healthz {
        access_log off;
        proxy_pass http://127.0.0.1:$API_PORT;
        proxy_set_header Host \$host;
    }
}
NGINXCONF

ln -sf /etc/nginx/sites-available/souqrates /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx

# ── 9. Firewall ───────────────────────────────────────────────────────────────
log "Configuring firewall..."
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

# ── 10. Done ──────────────────────────────────────────────────────────────────
log ""
log "✅ Server setup complete!"
log ""
log "Next steps:"
log "  1. Push your code to GitHub — the GitHub Action will deploy automatically"
log "  2. After the first deploy, start PM2:"
log "       cd $APP_DIR && pm2 start ecosystem.config.cjs && pm2 save"
log "  3. (Optional) Add HTTPS with Let's Encrypt:"
log "       certbot --nginx -d your-domain.com"
log "  4. Check logs: pm2 logs souqrates-api"
log ""
log "🔑 SESSION_SECRET saved to $APP_DIR/.env"
log "   (Back it up! Losing it invalidates all admin sessions)"
