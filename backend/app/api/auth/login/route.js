import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { one, query } from '@/lib/db.js'
import { json, route, body, fail } from '@/lib/http.js'
import { signSession, sessionCookie, publicUser } from '@/lib/auth.js'
import { rateLimit, rateReset, clientIp } from '@/lib/rateLimit.js'
import { digits } from '@/lib/ids.js'

const Schema = z.object({
  phone: z.string().min(9, 'Telefon raqamni kiriting'),
  password: z.string().min(1, 'Parolni kiriting').max(200),
})

export const POST = route(async (req) => {
  const { phone, password } = await body(req, Schema)
  // Faqat muvaffaqiyatsiz urinishlar sanaladi: to'g'ri parol bilan kirilganda hisob tozalanadi
  const rlKey = `login:${clientIp(req)}:${digits(phone)}`
  const rl = rateLimit(rlKey, { limit: 8, windowMs: 10 * 60e3 })
  if (!rl.ok) fail(429, `Juda ko‘p urinish. ${Math.ceil(rl.retryAfter / 60)} daqiqadan so‘ng qayta urining`)

  const u = await one('SELECT * FROM users WHERE phone = $1', [digits(phone)])
  // Foydalanuvchi yo'q bo'lsa ham hash solishtiramiz — javob vaqti orqali akkaunt borligini bilib bo'lmasin
  const ok = await bcrypt.compare(password, u?.password_hash ?? '$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinva')
  if (!u || !ok) fail(401, 'Telefon raqam yoki parol noto‘g‘ri')
  rateReset(rlKey)
  if (u.status === 'blocked') fail(403, 'Hisobingiz bloklangan. Administrator bilan bog‘laning')
  if (u.role !== 'superadmin') {
    const org = await one('SELECT status FROM organizations WHERE id = $1', [u.org_id])
    if (!org) fail(403, 'Hisobingiz tashkilotga biriktirilmagan. Administrator bilan bog‘laning')
    if (org.status !== 'active') fail(403, 'Tashkilotingiz faoliyati vaqtincha to‘xtatilgan')
  }

  await query('UPDATE users SET last_seen_at = now() WHERE id = $1', [u.id])
  const res = json({ user: publicUser(u) })
  res.cookies.set(sessionCookie(await signSession(u)))
  return res
})
