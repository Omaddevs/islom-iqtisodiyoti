import { json, route, body, fail } from '@/lib/http.js'
import { requireUser } from '@/lib/auth.js'
import { one, query } from '@/lib/db.js'

const admin = async () => { const u = await requireUser(); if (u.role !== 'superadmin') fail(403, 'Ruxsat yo‘q') }
const leadId = (id) => { if (!/^\d{1,18}$/.test(id)) fail(404, 'Ariza topilmadi'); return id }

// Holat: yangi ↔ ko'rib chiqildi
export const PATCH = route(async (req, { id }) => {
  await admin()
  const { status } = await body(req)
  if (!['new', 'done'].includes(status)) fail(422, 'Holat noto‘g‘ri')
  const r = await one('UPDATE leads SET status = $2 WHERE id = $1 RETURNING id', [leadId(id), status])
  if (!r) fail(404, 'Ariza topilmadi')
  return json({ ok: true })
})

export const DELETE = route(async (req, { id }) => {
  await admin()
  await query('DELETE FROM leads WHERE id = $1', [leadId(id)])
  return json({ ok: true })
})
