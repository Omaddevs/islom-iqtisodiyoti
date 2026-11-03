#!/usr/bin/env bash
# TURN server (coturn) — onlayn darslarda qattiq NAT/korporativ tarmoq ortidagi foydalanuvchilar ham ulana olishi uchun.
# Bir marta ishga tushiriladi (qayta ishga tushirish xavfsiz): sudo bash deploy/turn-setup.sh
# Login doimiy emas: backend har ulanishga vaqtinchalik login beradi (TURN_SECRET bilan imzolangan).
set -euo pipefail
DOMAIN=islom-iqtisodiyoti.uz
APP=/var/www/islom-iqtisodiyoti
ENVF=$APP/backend/.env
IP=$(ip -4 addr show scope global | awk '/inet /{print $2}' | cut -d/ -f1 | head -1)

DEBIAN_FRONTEND=noninteractive apt-get -o DPkg::Lock::Timeout=600 install -yq coturn >/dev/null

# Maxfiy kalit: faqat serverda, backend .env bilan umumiy
SECRET=$(grep -s '^TURN_SECRET=' "$ENVF" | cut -d= -f2- || true)
if [ -z "$SECRET" ]; then
  SECRET=$(openssl rand -hex 32)
  printf '\n# TURN (deploy/turn-setup.sh)\nTURN_HOST=%s\nTURN_SECRET=%s\n' "$DOMAIN" "$SECRET" >> "$ENVF"
fi

# TLS (turns:5349) uchun Let's Encrypt sertifikati nusxasi — coturn root fayllarini o'qiy olmaydi.
# Sertifikat yangilanganda ham avtomatik nusxalanadi.
HOOK=/etc/letsencrypt/renewal-hooks/deploy/coturn-certs.sh
cat > "$HOOK" <<EOF
#!/bin/sh
install -d -o turnserver -g turnserver -m 700 /etc/coturn/certs
install -o turnserver -g turnserver -m 600 /etc/letsencrypt/live/$DOMAIN/fullchain.pem /etc/coturn/certs/fullchain.pem
install -o turnserver -g turnserver -m 600 /etc/letsencrypt/live/$DOMAIN/privkey.pem /etc/coturn/certs/privkey.pem
systemctl restart coturn 2>/dev/null || true
EOF
chmod +x "$HOOK"
sh "$HOOK"

umask 077
cat > /etc/turnserver.conf <<EOF
# deploy/turn-setup.sh tomonidan yaratilgan
listening-port=3478
tls-listening-port=5349
listening-ip=$IP
relay-ip=$IP
external-ip=$IP
realm=$DOMAIN
server-name=$DOMAIN

# Vaqtinchalik loginlar (backend lib/turn.js)
use-auth-secret
static-auth-secret=$SECRET

cert=/etc/coturn/certs/fullchain.pem
pkey=/etc/coturn/certs/privkey.pem
no-tlsv1
no-tlsv1_1

# Media relay portlari
min-port=49160
max-port=49999

# Xavfsizlik: server ichki tarmoqqa "proksi" bo'lib qolmasin, suiiste'mol cheklansin
fingerprint
no-cli
no-multicast-peers
no-loopback-peers
denied-peer-ip=0.0.0.0-0.255.255.255
denied-peer-ip=10.0.0.0-10.255.255.255
denied-peer-ip=100.64.0.0-100.127.255.255
denied-peer-ip=127.0.0.0-127.255.255.255
denied-peer-ip=169.254.0.0-169.254.255.255
denied-peer-ip=172.16.0.0-172.31.255.255
denied-peer-ip=192.0.0.0-192.0.0.255
denied-peer-ip=192.168.0.0-192.168.255.255
denied-peer-ip=198.18.0.0-198.19.255.255
user-quota=12
total-quota=400
stale-nonce=600
syslog
EOF
chown root:turnserver /etc/turnserver.conf
chmod 640 /etc/turnserver.conf

ufw allow 3478/udp >/dev/null
ufw allow 3478/tcp >/dev/null
ufw allow 5349/tcp >/dev/null
ufw allow 49160:49999/udp >/dev/null

systemctl enable coturn >/dev/null 2>&1
systemctl restart coturn
sleep 1
systemctl is-active coturn
echo "✓ TURN tayyor: $DOMAIN ($IP) — 3478 udp/tcp, 5349 tls, relay 49160-49999/udp"
