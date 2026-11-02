import { json, route, body, fail } from '@/lib/http.js'
import { requireUser } from '@/lib/auth.js'
import { query } from '@/lib/db.js'
import { getMeeting, serializeMeeting, canManage, isMember, assertCanCreateFor } from '@/lib/meetings.js'
import { MeetingPatch, MEETING_COLUMNS } from '@/lib/schemas.js'

async function load(id) {
  const u = await requireUser()
  const m = await getMeeting(id)
  if (!m) fail(404, 'Dars topilmadi')
  return { u, m }
}

export const GET = route(async (_req, { id }) => {
  const { u, m } = await load(id)
  if (!(await isMember(u, m))) fail(403, 'Bu darsga ruxsat yo‘q')
  return json({ meeting: serializeMeeting(m, u) })
})

export const PATCH = route(async (req, { id }) => {
  const { u, m } = await load(id)
  if (!canManage(u, m)) fail(403, 'Darsni faqat ustoz yoki administrator o‘zgartira oladi')
  const d = await body(req, MeetingPatch)
  if (m.status === 'ended' && Object.keys(d).some((k) => k !== 'title' && k !== 'description')) fail(409, 'Yakunlangan darsni o‘zgartirib bo‘lmaydi')
  if (d.groupId && d.groupId !== m.group_id) {
    const { error } = await assertCanCreateFor(u, d.groupId)
    if (error) fail(403, error)
  }

  const sets = []
  const vals = []
  for (const [k, v] of Object.entries(d)) {
    const col = MEETING_COLUMNS[k]
    if (!col || v === undefined) continue
    vals.push(v)
    sets.push(col === 'starts_at' ? `${col} = to_timestamp($${vals.length} / 1000.0)` : `${col} = $${vals.length}`)
  }
  if (sets.length) {
    vals.push(id)
    await query(`UPDATE meetings SET ${sets.join(', ')}, updated_at = now() WHERE id = $${vals.length}`, vals)
  }
  const fresh = await getMeeting(id)
  globalThis.__iiHub?.meetingUpdated(fresh)
  return json({ meeting: serializeMeeting(fresh, u) })
})

export const DELETE = route(async (_req, { id }) => {
  const { u, m } = await load(id)
  if (!canManage(u, m)) fail(403, 'Darsni faqat ustoz yoki administrator o‘chira oladi')
  globalThis.__iiHub?.endMeeting(id, 'deleted')
  await query('DELETE FROM meetings WHERE id = $1', [id])
  return json({ ok: true })
})
