#!/usr/bin/env bash
# Hujjatlarni (Word, Excel, PowerPoint) sahifa rasmlariga aylantirish vositalari. Takroran ishga tushirish xavfsiz.
#   LibreOffice alohida huquqsiz foydalanuvchi (ii-convert) ostida ishlaydi: backend/.env va boshqa materiallarni
#   o'qiy olmaydi, tarmoqqa chiqa olmaydi. Zararli hujjat shu chegaradan tashqariga ta'sir qila olmasin.
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive

if ! command -v soffice >/dev/null || ! command -v pdftoppm >/dev/null; then
  # Boshqa apt ishi tugashini kutadi, osilib qolgan tarmoq so'rovi deploy'ni to'xtatib qo'ymaydi
  APT_OPTS="-o DPkg::Lock::Timeout=180 -o Acquire::http::Timeout=30 -o Acquire::https::Timeout=30 -o Acquire::Retries=3"
  sudo timeout 300 apt-get $APT_OPTS update -q
  sudo apt-get $APT_OPTS install -yq --no-install-recommends libreoffice-writer libreoffice-calc libreoffice-impress poppler-utils \
    fonts-liberation fonts-dejavu-core fonts-crosextra-carlito fonts-crosextra-caladea fonts-noto-core
fi

id ii-convert >/dev/null 2>&1 || sudo useradd --system --create-home --shell /usr/sbin/nologin ii-convert
sudo chmod 700 /home/ii-convert

printf 'ubuntu ALL=(ii-convert) NOPASSWD: /usr/bin/timeout\n' | sudo tee /etc/sudoers.d/islom-convert >/dev/null
sudo chmod 440 /etc/sudoers.d/islom-convert
sudo visudo -cf /etc/sudoers.d/islom-convert >/dev/null

# Tarmoq taqiqi: server qayta yonganda ham qo'llanadi
sudo tee /etc/systemd/system/islom-convert-net.service >/dev/null <<'UNIT'
[Unit]
Description=ii-convert foydalanuvchisi uchun tarmoq taqiqi
After=network-pre.target
[Service]
Type=oneshot
RemainAfterExit=yes
ExecStart=/bin/sh -c 'iptables -C OUTPUT -m owner --uid-owner ii-convert -j REJECT 2>/dev/null || iptables -A OUTPUT -m owner --uid-owner ii-convert -j REJECT'
ExecStart=/bin/sh -c 'ip6tables -C OUTPUT -m owner --uid-owner ii-convert -j REJECT 2>/dev/null || ip6tables -A OUTPUT -m owner --uid-owner ii-convert -j REJECT'
[Install]
WantedBy=multi-user.target
UNIT
sudo systemctl daemon-reload
sudo systemctl enable --now islom-convert-net >/dev/null 2>&1
sudo systemctl restart islom-convert-net

# Backend shu sozlamalar bo'yicha ii-convert ostida ishga tushiradi
ENV=/var/www/islom-iqtisodiyoti/backend/.env
grep -q '^CONVERT_USER=' "$ENV" || printf 'CONVERT_USER=ii-convert\nCONVERT_PROFILE=/home/ii-convert/lo-profile\nCONVERT_HOME=/home/ii-convert\n' >> "$ENV"
chmod 600 "$ENV"
echo "✓ Konvertatsiya vositalari tayyor: $(soffice --version 2>/dev/null | head -1)"
