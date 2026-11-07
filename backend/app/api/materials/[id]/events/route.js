// Ko'rish jurnali: kim ochdi, kim skrinshot tugmasini bosdi. Yozish — ko'ruvchi, o'qish — yuklagan ustoz yoki administrator.
import { json, route, fail, body } from '@/lib/http.js'
import { requireUser } from '@/lib/auth.js'
import { many, query } from '@/lib/db.js'
import { rateLimit } from '@/lib/rateLimit.js'
import { canManageFile, loadFile, requireView } from '@/lib/materials.js'

export const POST = route(async (req, { id }) => {
  const u = await requireUser()
  const f = await requireView(u, id)
  const { type, detail } = await body(req)
  if (!['open', 'capture'].includes(type)) fail(422, 'Hodisa turi noto‘g‘ri')
  if (!rateLimit(`mevent:${u.id}`, { limit: 60, windowMs: 60e3 }).ok) return new Response(null, { status: 204 })
  await query('INSERT INTO material_events (file_id, user_id, type, detail) VALUES ($1,$2,$3,$4)', [f.id, u.id, type, detail ? String(detail).slice(0, 60) : null])
  return new Response(null, { status: 204 })
})

export const GET = route(async (_req, { id }) => {
  const u = await requireUser()
  const f = await loadFile(id)
  if (!canManageFile(u, f)) fail(403, 'Jurnalni ko‘rishga ruxsat yo‘q')
  const rows = await many(`SELECT e.user_id, u.name, u.role,
      count(*) FILTER (WHERE e.type = 'open')::int AS opens,
      count(*) FILTER (WHERE e.type = 'capture')::int AS captures,
      max(e.created_at) AS last_at
    FROM material_events e JOIN users u ON u.id = e.user_id
    WHERE e.file_id = $1 GROUP BY e.user_id, u.name, u.role ORDER BY max(e.created_at) DESC LIMIT 500`, [f.id])
  return json({ viewers: rows.map((r) => ({ id: r.user_id, name: r.name, role: r.role, opens: r.opens, captures: r.captures, lastAt: new Date(r.last_at).getTime() })) })
})
