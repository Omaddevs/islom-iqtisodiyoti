#!/usr/bin/env bash
# Toza Ubuntu 24.04 serverni tayyorlash (bir marta): swap, firewall, Node 22, PostgreSQL, nginx.
# Ishga tushirish: sudo bash deploy/server-setup.sh
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive

# "sudo: unable to resolve host" ogohlantirishi
grep -q "$(hostname)" /etc/hosts || echo "127.0.1.1 $(hostname)" >> /etc/hosts

# 2 GB RAM'da build uchun swap
if ! swapon --show | grep -q /swapfile; then
  fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

apt-get update -q
apt-get install -yq curl ca-certificates gnupg nginx postgresql ufw git

if ! command -v node >/dev/null || [ "$(node -v | cut -d. -f1 | tr -d v)" -lt 22 ]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -yq nodejs
fi

# Firewall: faqat SSH va web
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable

systemctl enable --now postgresql nginx
echo "✓ Server tayyor: node $(node -v), $(psql --version), $(nginx -v 2>&1)"
