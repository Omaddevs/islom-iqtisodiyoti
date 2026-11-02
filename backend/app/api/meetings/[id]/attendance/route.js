import { json, route, fail } from '@/lib/http.js'
import { requireUser } from '@/lib/auth.js'
import { many } from '@/lib/db.js'
import { getMeeting, canManage } from '@/lib/meetings.js'

// Davomat: har bir ishtirokchi bo'yicha jami vaqt; guruhdan kelmaganlar alohida
export const GET = route(async (_req, { id }) => {
  const u = await requireUser()
  const m = await getMeeting(id)
  if (!m) fail(404, 'Dars topilmadi')
  if (!canManage(u, m)) fail(403, 'Davomatni faqat ustoz ko‘ra oladi')
  const present = await many(`
    SELECT coalesce(user_id, 'guest:' || display_name) AS key, user_id, max(display_name) AS name, bool_or(is_guest) AS guest,
           min(joined_at) AS first_join, max(coalesce(left_at, now())) AS last_leave,
           sum(extract(epoch FROM coalesce(left_at, now()) - joined_at))::int AS seconds
      FROM meeting_attendance WHERE meeting_id = $1
     GROUP BY 1, 2 ORDER BY first_join`, [id])
  const absent = m.group_id ? await many(`
    SELECT u.id, u.name FROM group_members gm JOIN users u ON u.id = gm.user_id
     WHERE gm.group_id = $1 AND NOT EXISTS (SELECT 1 FROM meeting_attendance a WHERE a.meeting_id = $2 AND a.user_id = u.id)
     ORDER BY u.name`, [m.group_id, id]) : []
  return json({ present, absent })
})
