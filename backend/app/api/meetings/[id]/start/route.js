import { json, route, fail } from '@/lib/http.js'
import { requireUser } from '@/lib/auth.js'
import { query } from '@/lib/db.js'
import { getMeeting, serializeMeeting, canManage } from '@/lib/meetings.js'

export const POST = route(async (_req, { id }) => {
  const u = await requireUser()
  const m = await getMeeting(id)
  if (!m) fail(404, 'Dars topilmadi')
  if (!canManage(u, m)) fail(403, 'Darsni faqat ustoz boshlay oladi')
  if (m.status === 'ended') fail(409, 'Dars allaqachon yakunlangan')
  if (m.status !== 'live') await query(`UPDATE meetings SET status = 'live', started_at = now(), updated_at = now() WHERE id = $1`, [id])
  const fresh = await getMeeting(id)
  globalThis.__iiHub?.meetingUpdated(fresh)
  return json({ meeting: serializeMeeting(fresh, u) })
})
