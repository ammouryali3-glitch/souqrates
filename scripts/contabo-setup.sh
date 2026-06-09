#!/usr/bin/env bash
# Run once on a fresh Contabo VPS to prepare it for souqrates.
# Usage: bash contabo-setup.sh
set -euo pipefail

echo "=== 1. System update ==="
apt-get update -qq && apt-get upgrade -y -qq

echo "=== 2. Install Node.js 24 ==="
curl -fsSL https://deb.nodesource.com/setup_24.x | bash -
apt-get install -y nodejs

echo "=== 3. Install pnpm ==="
npm install -g pnpm@10

echo "=== 4. Install PM2 ==="
npm install -g pm2

echo "=== 5. Install Caddy ==="
apt-get install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' \
  | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' \
  | tee /etc/apt/sources.list.d/caddy-stable.list
apt-get update -qq && apt-get install -y caddy

echo "=== 6. Create app directories ==="
mkdir -p /opt/souqrates/api/dist
mkdir -p /var/www/souqrates

echo "=== 7. Write Caddyfile ==="
cat > /etc/caddy/Caddyfile << 'CADDY'
# Replace yourdomain.com with your actual domain
yourdomain.com {
    # Serve the Vite frontend
    root * /var/www/souqrates
    file_server

    # Proxy all /api/* requests to Node.js
    reverse_proxy /api/* localhost:8080

    # SPA fallback: all unknown paths go to index.html
    try_files {path} /index.html
}
CADDY

echo "=== 8. Write PM2 ecosystem file ==="
cat > /opt/souqrates/api/ecosystem.config.cjs << 'PM2'
module.exports = {
  apps: [{
    name: "souqrates-api",
    script: "./dist/index.mjs",
    interpreter: "node",
    interpreter_args: "--enable-source-maps",
    cwd: "/opt/souqrates/api",
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: "512M",
    env: {
      NODE_ENV: "production",
      PORT: 8080,
      BASE_PATH: "/api"
    }
  }]
};
PM2

echo ""
echo "=== ✅ Setup complete ==="
echo ""
echo "Next steps:"
echo "1. Add your env vars to /opt/souqrates/api/.env"
echo "   Required: DATABASE_URL, SESSION_SECRET, TELEGRAM_BOT_TOKEN"
echo ""
echo "2. Edit /etc/caddy/Caddyfile — replace 'yourdomain.com' with your domain"
echo ""
echo "3. Start services:"
echo "   systemctl enable caddy && systemctl start caddy"
echo "   cd /opt/souqrates/api && pm2 start ecosystem.config.cjs"
echo "   pm2 save && pm2 startup"
