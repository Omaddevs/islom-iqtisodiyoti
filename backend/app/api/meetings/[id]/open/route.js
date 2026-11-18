// Tashqi darsga (Zoom va h.k.) platforma orqali o'tish: havolani beradi va davomatga bir marta yozadi.
// Zoom ichidagi qatnashuvni server ko'rmaydi — davomat «havolani ochganlar» bo'yicha yuritiladi.
import { json, route, fail } from '@/lib/http.js'
import { requireUser } from '@/lib/auth.js'
import { query } from '@/lib/db.js'
import { getMeeting, isMember, canManage, effectiveStatus } from '@/lib/meetings.js'
import { isExternal } from '@/lib/meetingLinks.js'

export const POST = route(async (_req, { id }) => {
  const u = await requireUser()
  const m = await getMeeting(id)
  if (!m) fail(404, 'Dars topilmadi')
  if (!isExternal(m.provider) || !m.join_url) fail(409, 'Bu dars platforma xonasida o‘tadi')
  if (!(await isMember(u, m))) fail(403, 'Bu darsga ruxsat yo‘q')
  // Faqat dars vaqtida (yoki 10 daqiqa oldin) ochilganlar davomatga yoziladi; ustoz o'zi hisobga olinmaydi
  if (effectiveStatus(m) === 'live' && !canManage(u, m) && u.role === 'student') {
    await query(`INSERT INTO meeting_attendance (meeting_id, user_id, display_name, is_guest, role, joined_at, left_at)
      VALUES ($1, $2, $3, false, 'external', now(), now()) ON CONFLICT DO NOTHING`, [m.id, u.id, u.name])
  }
  return json({ url: m.join_url })
})
