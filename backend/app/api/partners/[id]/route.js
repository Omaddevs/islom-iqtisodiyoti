import { json, route, body, fail } from '@/lib/http.js'
import { requireUser } from '@/lib/auth.js'
import { one, query } from '@/lib/db.js'
import { PartnerInput } from '@/lib/schemas.js'

const admin = async () => { const u = await requireUser(); if (u.role !== 'superadmin') fail(403, 'Ruxsat yo‘q') }
const partnerId = (id) => { if (!/^\d{1,18}$/.test(id)) fail(404, 'Hamkor topilmadi'); return id }

export const PATCH = route(async (req, { id }) => {
  await admin()
  const d = await body(req, PartnerInput)
  const p = await one('UPDATE partners SET name = $2, type = $3, logo = $4, color = $5 WHERE id = $1 RETURNING *', [partnerId(id), d.name, d.type, d.logo, d.color])
  if (!p) fail(404, 'Hamkor topilmadi')
  return json({ partner: { id: String(p.id), name: p.name, type: p.type, logo: p.logo, color: p.color, createdAt: p.created_at } })
})

export const DELETE = route(async (req, { id }) => {
  await admin()
  await query('DELETE FROM partners WHERE id = $1', [partnerId(id)])
  return json({ ok: true })
})
