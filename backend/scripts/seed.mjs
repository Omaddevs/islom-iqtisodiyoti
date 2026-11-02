// Boshlang'ich ma'lumot: faqat bosh administrator. Qolgan barcha tashkilot, admin, ustoz va o'quvchilarni
// bosh admin platformaning o'zida yaratadi. Skript idempotent — har deployda xavfsiz ishga tushiriladi:
// admin mavjud bo'lsa, uning paroli va ma'lumotlari o'zgartirilmaydi (--reset-password bilan majburlash mumkin).
import bcrypt from 'bcryptjs'
import { pool, tx } from '../lib/db.js'
import { digits } from '../lib/ids.js'

const ADMIN = {
  id: 'u_admin',
  name: process.env.SUPERADMIN_NAME || 'Anvar Tursunov',
  phone: digits(process.env.SUPERADMIN_PHONE || '+998 90 739 21 11'),
  password: process.env.SUPERADMIN_PASSWORD || '',
}
if (!/^998\d{9}$/.test(ADMIN.phone)) throw new Error('SUPERADMIN_PHONE noto‘g‘ri: +998 XX XXX XX XX')
// Parol kodda saqlanmaydi — faqat .env (SUPERADMIN_PASSWORD) orqali
if (ADMIN.password.length < 6) throw new Error('backend/.env da SUPERADMIN_PASSWORD (kamida 6 belgi) ni kiriting')

const resetPassword = process.argv.includes('--reset-password')

await tx(async (c) => {
  const existing = (await c.query(`SELECT id FROM users WHERE role = 'superadmin' ORDER BY created_at LIMIT 1`)).rows[0]
  if (existing && !resetPassword) {
    console.log('✓ Bosh administrator mavjud — o‘zgartirilmadi')
    return
  }
  const hash = await bcrypt.hash(ADMIN.password, 10)
  if (existing) {
    await c.query('UPDATE users SET phone = $2, password_hash = $3, status = $4 WHERE id = $1', [existing.id, ADMIN.phone, hash, 'active'])
    console.log('✓ Bosh administrator paroli va telefoni yangilandi')
    return
  }
  // Telefon boshqa foydalanuvchida band bo'lsa — aniq xato
  const taken = (await c.query('SELECT id FROM users WHERE phone = $1', [ADMIN.phone])).rows[0]
  if (taken) throw new Error(`Telefon ${ADMIN.phone} boshqa foydalanuvchida band (${taken.id})`)
  await c.query(`INSERT INTO users (id, org_id, role, name, phone, password_hash, avatar_color, status, data)
    VALUES ($1, NULL, 'superadmin', $2, $3, $4, '#6366f1', 'active', $5)`,
  [ADMIN.id, ADMIN.name, ADMIN.phone, hash, { title: 'Platforma egasi' }])
  console.log(`✓ Bosh administrator yaratildi: ${ADMIN.name}, +${ADMIN.phone}`)
})
await pool.end()
