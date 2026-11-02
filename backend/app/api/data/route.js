import { json, route, fail } from '@/lib/http.js'
import { requireUser } from '@/lib/auth.js'
import { tx } from '@/lib/db.js'
import { loadState, applyOps } from '@/lib/platform.js'

// Joriy foydalanuvchi ko'radigan barcha platforma ma'lumotlari (kirishda va davriy yangilanishda)
export const GET = route(async () => {
  const u = await requireUser()
  return json(await loadState(u), { headers: { 'Cache-Control': 'no-store' } })
})

// O'zgarishlar to'plami: hammasi bitta tranzaksiyada — biri rad etilsa, hech biri saqlanmaydi
export const POST = route(async (req) => {
  const u = await requireUser()
  if (Number(req.headers.get('content-length') || 0) > 8 * 1024 * 1024) fail(413, 'So‘rov hajmi juda katta')
  let data
  try { data = await req.json() } catch { fail(400, 'So‘rov tanasi JSON bo‘lishi kerak') }
  const ops = data?.ops
  if (!Array.isArray(ops) || ops.length === 0 || ops.length > 500) fail(422, 'O‘zgarishlar ro‘yxati noto‘g‘ri')
  const results = await tx((c) => applyOps(c, u, ops))
  return json({ results })
})
