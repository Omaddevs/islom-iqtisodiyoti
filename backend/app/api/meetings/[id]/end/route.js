import { json, route, fail } from '@/lib/http.js'
import { requireUser } from '@/lib/auth.js'
import { getMeeting, serializeMeeting, canManage } from '@/lib/meetings.js'
import { endMeetingInDb } from '@/realtime/store.js'

export const POST = route(async (_req, { id }) => {
  const u = await requireUser()
  const m = await getMeeting(id)
  if (!m) fail(404, 'Dars topilmadi')
  if (!canManage(u, m)) fail(403, 'Darsni faqat ustoz yakunlay oladi')
  if (m.status !== 'ended') {
    await endMeetingInDb(id)
    globalThis.__iiHub?.endMeeting(id, 'ended')
  }
  return json({ meeting: serializeMeeting(await getMeeting(id), u) })
})
