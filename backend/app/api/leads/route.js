import { json, route, body, fail } from '@/lib/http.js'
import { requireUser } from '@/lib/auth.js'
import { one, many } from '@/lib/db.js'
import { rateLimit, clientIp } from '@/lib/rateLimit.js'
import { LeadCreate } from '@/lib/schemas.js'

const out = (l) => ({ id: String(l.id), kind: l.kind, name: l.name, phone: l.phone, email: l.email, course: l.course, topic: l.topic, message: l.message, status: l.status, createdAt: l.created_at })

// Saytdagi formalar — akkauntsiz, IP bo'yicha cheklangan
export const POST = route(async (req) => {
  const ip = clientIp(req)
  // Mobil operatorlarda ko'p foydalanuvchi bitta IP'dan chiqadi (CGNAT) — limit yumshoq, botlarga esa yetarli to'siq
  const rl = rateLimit(`lead:${ip}`, { limit: 30, windowMs: 10 * 60e3 })
  if (!rl.ok) fail(429, 'Juda ko‘p so‘rov. Birozdan so‘ng qayta urining')
  const d = await body(req, LeadCreate)
  if (d.website) return json({ ok: true }) // bot — jim qabul qilinadi, saqlanmaydi
  await one(`INSERT INTO leads (kind, name, phone, email, course, topic, message, ip) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [d.kind, d.name, d.phone ?? null, d.email ?? null, d.course, d.topic, d.message, ip])
  return json({ ok: true }, { status: 201 })
})

// Arizalar ro'yxati — faqat bosh administrator
export const GET = route(async () => {
  const u = await requireUser()
  if (u.role !== 'superadmin') fail(403, 'Ruxsat yo‘q')
  return json({ leads: (await many('SELECT * FROM leads ORDER BY created_at DESC LIMIT 1000')).map(out) }, { headers: { 'Cache-Control': 'no-store' } })
})
