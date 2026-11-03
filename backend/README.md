# Backend — Next.js API + WebSocket + PostgreSQL

Platformaning butun serveri: auth, tashkilot/foydalanuvchi/guruhlar, kontent (video, test, maqola, …), onlayn darslar (REST + `/ws` signaling), saytdagi arizalar va PostgreSQL.
Brauzerda (localStorage) hech qanday ma'lumot yoki parol saqlanmaydi.

## Ishga tushirish

```bash
# 1. Baza (loyiha ildizida)
docker compose up -d db            # PostgreSQL 17, port 5436

# 2. Backend
cd backend
cp .env.example .env               # JWT_SECRET ni o'zgartiring
npm install
npm run db:migrate                 # sxema
npm run db:seed                    # faqat bosh administrator (SUPERADMIN_* .env dan)
npm run dev                        # http://localhost:4020

# 3. Frontend (loyiha ildizida, alohida terminalda)
npm run dev                        # http://localhost:2026 — /api va /ws backend'ga proksi qilinadi
```

Tekshirish: `npm run test:smoke` — rollar, ruxsatlar, arizalar, darslar va WebSocket bo'yicha 56 ta end-to-end tekshiruv
(server ishlab turishi kerak; vaqtinchalik test tashkiloti yaratib, oxirida o'chiradi).

## Arxitektura

| Qism | Fayl | Vazifasi |
|---|---|---|
| Custom server | `server.mjs` | Next.js + WebSocket bitta portda |
| API | `app/api/**/route.js` | auth, darslar, havola orqali kirish, davomat, yozuvlar |
| Signaling hub | `realtime/hub.js` | xonalar, kutish zali, host boshqaruvi, chat, WebRTC signal relay |
| Baza | `db/migrations/*.sql` | jadvallar; `npm run db:migrate` qo'llaydi |
| Qoidalar | `lib/meetings.js` | kim ko'radi / boshqaradi / qo'shiladi |
| Platforma | `lib/platform.js`, `app/api/data` | barcha modullar: o'qish (rolga qarab filtr) va yozish (har bir amal rol/tashkilot bo'yicha tekshiriladi) |
| Arizalar | `app/api/leads` | saytdagi formalar → bosh admin «Arizalar» bo'limi |

**Media** serverdan o'tmaydi: brauzerlar WebRTC orqali to'g'ridan-to'g'ri (P2P mesh) ulanadi. Bu 8–10 kamerali ishtirokchigacha yaxshi
ishlaydi. Katta darslar (30+ kamera) uchun keyingi qadam — SFU (LiveKit yoki mediasoup): signaling va UI o'zgarmaydi, faqat
`src/meet/rtc.js` dagi ulanish qatlami almashtiriladi.

## Production eslatmalari

- **TURN server shart.** Faqat STUN bilan qattiq NAT/korporativ tarmoqdagi foydalanuvchilar ulana olmaydi.
  coturn o'rnating va `ICE_SERVERS` ga qo'shing: `[{"urls":"stun:..."},{"urls":"turn:turn.example.uz:3478","username":"...","credential":"..."}]`.
- **HTTPS shart** — brauzer kamera/mikrofonga faqat HTTPS (yoki localhost) da ruxsat beradi.
- `APP_ORIGIN` — frontend domeni (WebSocket origin tekshiruvi).
- Xona holati va login cheklovchisi xotirada: bitta server nusxasi uchun. Gorizontal masshtabda Redis'ga o'tkazing.
- Yozuvlar `STORAGE_DIR/recordings` da saqlanadi — zaxira nusxasini oling yoki S3'ga ko'chiring.
- `npm run build && npm start`.

## Rollar (server tomonida majburiy)

| Rol | Kim yaratadi | Nima qila oladi |
|---|---|---|
| Bosh administrator | `db:seed` (yagona, ikkinchisini yaratib bo'lmaydi) | hamma narsa: tashkilot, admin, ustoz, o'quvchi, arizalar |
| Tashkilot admini | bosh admin | o'z tashkilotida ustoz/o'quvchi, guruh, kontent; boshqa adminlarni boshqara olmaydi |
| Ustoz | bosh admin yoki tashkilot admini | o'z guruhlariga o'quvchi qo'shadi, kontent, baholash |
| O'quvchi | admin yoki ustoz | faqat o'z guruhi kontenti; test bali serverda hisoblanadi |

Rol va tashkilot yaratilgandan keyin o'zgartirilmaydi. Parollar bcrypt bilan saqlanadi — admin ko'ra olmaydi, faqat yangisini beradi.

## Serverga chiqarish (launch)

```bash
# Serverda (Ubuntu): Node 22+, PostgreSQL 15+, nginx
git clone … /var/www/islom-iqtisodiyoti && cd /var/www/islom-iqtisodiyoti

# Frontend
npm ci && npm run build                     # → dist/ (nginx shu papkani beradi)

# Backend
cd backend && npm ci
cp .env.example .env                        # quyidagilarni albatta to'ldiring:
#   NODE_ENV=production
#   HOST=127.0.0.1                          # faqat nginx orqali
#   APP_ORIGIN=https://islomiqtisod.uz
#   DATABASE_URL=postgres://…               # kuchli parol bilan
#   JWT_SECRET=…                            # node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
#   SUPERADMIN_PHONE / SUPERADMIN_PASSWORD  # bosh admin
npm run build
npm run db:migrate
npm run db:seed                             # bosh administrator (qayta ishga tushirish xavfsiz)
npm start                                   # pm2 start npm --name ii-backend -- start  (yoki systemd)
```

nginx namunasi: [`../deploy/nginx.conf`](../deploy/nginx.conf). Keyingi yangilanishlarda: `git pull`, frontend `npm run build`,
backend `npm ci && npm run build && npm run db:migrate`, so'ng qayta ishga tushirish.

**Eski demo bazasi bo'lsa** (oldingi versiyadagi Dilnoza, Jasur va h.k.): `npm run db:migrate && npm run db:purge-demo`
(avval nima o'chishini ko'rsatadi) → `npm run db:purge-demo -- --yes` → `npm run db:seed`.
Bosh admin parolini unutib qo'yilsa: `.env` dagi `SUPERADMIN_PASSWORD` ni yangilab, `npm run db:seed -- --reset-password`.

**Zaxira nusxa** avtomatik: har kuni 03:30 da `deploy/backup.sh` (cron, `deploy.sh` o'rnatadi).
Baza — `/var/backups/islom-iqtisodiyoti/db/` (oxirgi 14 kun), fayllar — `/var/backups/islom-iqtisodiyoti/files/`.
Jurnal: `/var/log/islom-backup.log`. Qo'lda: `sudo bash deploy/backup.sh`.

Zaxira shu serverning o'zida turadi — server butunlay ishdan chiqsa yo'qolmasligi uchun vaqti-vaqti bilan
kompyuterga ham ko'chirib oling:
```bash
scp -i ~/.ssh/islom_vds.rsa -r ubuntu@89.39.95.150:/var/backups/islom-iqtisodiyoti/db ./zaxira
```

**Zaxiradan tiklash:**
```bash
sudo systemctl stop islom-backend
sudo -u postgres pg_restore --clean --if-exists -d islom_iqtisodiyoti /var/backups/islom-iqtisodiyoti/db/db-YYYYMMDD-HHMM.dump
sudo rsync -a /var/backups/islom-iqtisodiyoti/files/ /var/www/islom-iqtisodiyoti-storage/
sudo systemctl start islom-backend
```

**Rasmlar** (video muqovalari, maqola rasmlari) `STORAGE_DIR/uploads` da fayl sifatida saqlanadi, bazada faqat havola.
Ishlatilmay qolganlari kunlik zaxira oldidan o'chiriladi (`npm run gc:uploads`).
