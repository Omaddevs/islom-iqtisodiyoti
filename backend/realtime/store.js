// Real vaqt qatlamining bazaga yozadigan amallari (davomat, chat, holat).
import { query, one, many } from '../lib/db.js'

export async function markLive(id) {
  await query(`UPDATE meetings SET status = 'live', started_at = coalesce(started_at, now()), updated_at = now()
                WHERE id = $1 AND status = 'scheduled'`, [id])
}

export async function endMeetingInDb(id) {
  await query(`UPDATE meetings SET status = 'ended', ended_at = now(), locked = false, updated_at = now() WHERE id = $1`, [id])
  await query('UPDATE meeting_attendance SET left_at = now() WHERE meeting_id = $1 AND left_at IS NULL', [id])
}

export async function setLocked(id, locked) {
  await query('UPDATE meetings SET locked = $2, updated_at = now() WHERE id = $1', [id, locked])
}

export async function attendanceOpen(meetingId, p) {
  const r = await one(`INSERT INTO meeting_attendance (meeting_id, user_id, display_name, is_guest, role)
                       VALUES ($1, $2, $3, $4, $5) RETURNING id`, [meetingId, p.userId, p.name, p.guest, p.role])
  return r.id
}

export async function attendanceClose(id) {
  if (id) await query('UPDATE meeting_attendance SET left_at = now() WHERE id = $1 AND left_at IS NULL', [id])
}

// Server qayta ishga tushganda ochiq qolgan sessiyalarni yopamiz
export async function closeDanglingAttendance() {
  await query('UPDATE meeting_attendance SET left_at = now() WHERE left_at IS NULL')
}

const msgOut = (r) => ({ id: r.id, userId: r.user_id, name: r.author_name, kind: r.kind, text: r.body, at: r.created_at })

export async function saveMessage(meetingId, { userId, name, kind = 'text', text }) {
  const r = await one(`INSERT INTO meeting_messages (meeting_id, user_id, author_name, kind, body)
                       VALUES ($1, $2, $3, $4, $5) RETURNING *`, [meetingId, userId, name, kind, text])
  return msgOut(r)
}

export async function recentMessages(meetingId, limit = 100) {
  const rows = await many(`SELECT * FROM (SELECT * FROM meeting_messages WHERE meeting_id = $1 ORDER BY id DESC LIMIT $2) t ORDER BY id`, [meetingId, limit])
  return rows.map(msgOut)
}
