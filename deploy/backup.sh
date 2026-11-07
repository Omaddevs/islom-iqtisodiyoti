#!/usr/bin/env bash
# Kunlik zaxira (cron, root): PostgreSQL dump + yuklangan fayllar (rasmlar, dars yozuvlari).
#   /etc/cron.d/islom-backup → har kuni 03:30
# Tiklash: README → "Zaxiradan tiklash".
set -euo pipefail
APP=/var/www/islom-iqtisodiyoti
STORAGE=/var/www/islom-iqtisodiyoti-storage
DIR=/var/backups/islom-iqtisodiyoti
KEEP_DAYS=${KEEP_DAYS:-14}
STAMP=$(date +%Y%m%d-%H%M)

mkdir -p "$DIR/db" "$DIR/files"
chmod 700 "$DIR"

# 1) Ishlatilmayotgan rasmlarni tozalash (zaxiraga keraksiz fayl tushmasin)
runuser -u ubuntu -- bash -c "cd $APP/backend && node --env-file=.env scripts/gc-uploads.mjs" || echo "! rasm tozalash o'tkazib yuborildi"

# 2) Baza: siqilgan dump, oxirgi $KEEP_DAYS kunlik nusxa saqlanadi
runuser -u postgres -- pg_dump -Fc islom_iqtisodiyoti > "$DIR/db/db-$STAMP.dump.tmp"
mv "$DIR/db/db-$STAMP.dump.tmp" "$DIR/db/db-$STAMP.dump"
find "$DIR/db" -name 'db-*.dump' -mtime +"$KEEP_DAYS" -delete

# 3) Fayllar: o'sib boruvchi nusxa (faqat yangi/o'zgargan fayllar ko'chiriladi, o'chirilganlari zaxirada qoladi)
# Sahifa rasmlari asl fayldan qayta hosil bo'ladi, zaxiraga kerak emas
rsync -a --exclude 'materials/*/p-*.jpg' "$STORAGE/" "$DIR/files/"

echo "✓ $(date '+%F %T') zaxira: $(du -sh "$DIR/db/db-$STAMP.dump" | cut -f1) baza, $(du -sh "$DIR/files" | cut -f1) fayllar, bo'sh joy: $(df -h / | awk 'NR==2{print $4}')"
