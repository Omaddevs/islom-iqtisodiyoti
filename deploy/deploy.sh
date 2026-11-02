#!/usr/bin/env bash
# Har bir yangilanishda serverda ishga tushiriladi (kod /var/www/islom-iqtisodiyoti ga yuklangandan keyin):
#   bash deploy/deploy.sh
# Frontend build → dist/, backend build → migratsiya → bosh admin (bir marta) → xizmatni qayta ishga tushirish.
set -euo pipefail
APP=/var/www/islom-iqtisodiyoti
cd "$APP"

echo "• Frontend"
npm ci --no-audit --no-fund --loglevel=error
npm run build --silent

echo "• Backend"
cd backend
npm ci --no-audit --no-fund --loglevel=error
NODE_OPTIONS=--max-old-space-size=1536 npm run build --silent
npm run db:migrate --silent
npm run db:seed --silent

# systemd xizmati (birinchi marta o'rnatiladi)
if [ ! -f /etc/systemd/system/islom-backend.service ]; then
  sudo cp "$APP/deploy/islom-backend.service" /etc/systemd/system/
  sudo systemctl daemon-reload
  sudo systemctl enable islom-backend
fi
sudo systemctl restart islom-backend

# nginx (birinchi marta) — domen ulangach deploy/nginx.conf (HTTPS) ga almashtiring
if [ ! -f /etc/nginx/sites-enabled/islom-iqtisodiyoti ]; then
  sudo cp "$APP/deploy/nginx-ip.conf" /etc/nginx/sites-available/islom-iqtisodiyoti
  sudo ln -sf /etc/nginx/sites-available/islom-iqtisodiyoti /etc/nginx/sites-enabled/islom-iqtisodiyoti
  sudo rm -f /etc/nginx/sites-enabled/default
fi
sudo nginx -t -q && sudo systemctl reload nginx

for i in $(seq 1 30); do curl -sf http://127.0.0.1:4020/api/health >/dev/null && break; sleep 1; done
curl -sf http://127.0.0.1:4020/api/health && echo && echo "✓ Deploy tugadi"
