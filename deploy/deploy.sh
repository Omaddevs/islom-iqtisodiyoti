#!/usr/bin/env bash
# Serverda: GitHub'dan oxirgi kodni olib, hammasini yangilaydi.
#   bash /var/www/islom-iqtisodiyoti/deploy/deploy.sh
# git pull → frontend build → backend build → migratsiya → bosh admin (bir marta) → xizmatni qayta ishga tushirish.
# .env, dist/, node_modules git'da yo'q — ularga tegilmaydi.
set -euo pipefail
APP=/var/www/islom-iqtisodiyoti
cd "$APP"

if [ "${1:-}" != "--no-pull" ]; then
  git fetch -q origin main
  git reset -q --hard origin/main
  echo "• Kod: $(git log --oneline -1)"
  # Skript o'zi yangilangan bo'lishi mumkin — yangi nusxasini ishga tushiramiz
  exec bash "$APP/deploy/deploy.sh" --no-pull
fi

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

# nginx: SSL sertifikati bo'lsa — HTTPS (deploy/nginx.conf), aks holda IP orqali HTTP (deploy/nginx-ip.conf)
if sudo test -f /etc/letsencrypt/live/islom-iqtisodiyoti.uz/fullchain.pem; then
  sudo cp "$APP/deploy/nginx.conf" /etc/nginx/sites-available/islom-iqtisodiyoti
else
  sudo cp "$APP/deploy/nginx-ip.conf" /etc/nginx/sites-available/islom-iqtisodiyoti
fi
sudo ln -sf /etc/nginx/sites-available/islom-iqtisodiyoti /etc/nginx/sites-enabled/islom-iqtisodiyoti
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t -q && sudo systemctl reload nginx

for i in $(seq 1 30); do curl -sf http://127.0.0.1:4020/api/health >/dev/null && break; sleep 1; done
curl -sf http://127.0.0.1:4020/api/health && echo && echo "✓ Deploy tugadi"
