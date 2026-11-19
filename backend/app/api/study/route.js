// O'quvchi brauzeri yuboradigan faol vaqt («yurak urishi»). Faqat o'quvchilar yoziladi; boshqalar jim o'tkazib yuboriladi.
import { route, fail } from '@/lib/http.js'
import { requireUser } from '@/lib/auth.js'
import { rateLimit } from '@/lib/rateLimit.js'
import { recordBeat } from '@/lib/study.js'

const done = () => new Response(null, { status: 204 })

export const POST = route(async (req) => {
  const u = await requireUser()
  if (u.role !== 'student' || !u.org_id) return done()
  let d
  try { d = JSON.parse(await req.text()) } catch { fail(400, 'So‘rov tanasi JSON bo‘lishi kerak') }
  // Bir nechta ochiq oyna bo'lsa ham — daqiqasiga 12 tadan oshmaydi (har biri ≤ 70 soniya)
  if (!rateLimit(`study:${u.id}`, { limit: 12, windowMs: 60e3 }).ok) return done()
  await recordBeat(u, d || {})
  return done()
})
