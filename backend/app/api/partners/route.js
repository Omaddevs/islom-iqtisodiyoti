import { json, route, body, fail } from '@/lib/http.js'
import { requireUser } from '@/lib/auth.js'
import { one, many } from '@/lib/db.js'
import { PartnerInput } from '@/lib/schemas.js'

export const dynamic = 'force-dynamic'

const out = (p) => ({ id: String(p.id), name: p.name, type: p.type, logo: p.logo, color: p.color, createdAt: p.created_at })

// Ochiq: saytdagi «Hamkorlar» bo'limi shu ro'yxat bo'sh bo'lmasa ko'rinadi
export const GET = route(async () => {
  const rows = await many('SELECT * FROM partners ORDER BY created_at, id')
  return json({ partners: rows.map(out) }, { headers: { 'Cache-Control': 'no-cache' } })
})

export const POST = route(async (req) => {
  const u = await requireUser()
  if (u.role !== 'superadmin') fail(403, 'Ruxsat yo‘q')
  const d = await body(req, PartnerInput)
  const p = await one('INSERT INTO partners (name, type, logo, color) VALUES ($1,$2,$3,$4) RETURNING *', [d.name, d.type, d.logo, d.color])
  return json({ partner: out(p) }, { status: 201 })
})
