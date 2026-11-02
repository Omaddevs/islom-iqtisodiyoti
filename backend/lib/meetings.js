// Onlayn darslar domeni: kim ko'radi, kim boshqaradi, kim qanday qo'shiladi.
// Route handler'lar ham, WebSocket serveri ham shu qoidalardan foydalanadi.
import { one, many } from './db.js'

const isAdmin = (u) => u?.role === 'superadmin' || u?.role === 'org_admin'

export const MEETING_SELECT = `
  SELECT m.*, h.name AS host_name, h.avatar_color AS host_color,
         g.name AS group_name, g.course AS group_course, g.color AS group_color,
         (SELECT count(*) FROM group_members gm WHERE gm.group_id = m.group_id) AS invited_count,
         (SELECT r.id FROM meeting_recordings r WHERE r.meeting_id = m.id ORDER BY r.created_at DESC LIMIT 1) AS recording_id
    FROM meetings m
    JOIN users h ON h.id = m.host_id
    LEFT JOIN groups g ON g.id = m.group_id`

// Bazadagi qator → frontend shakli (mavjud localStorage modeliga mos)
export function serializeMeeting(m, viewer) {
  const manage = canManage(viewer, m)
  return {
    id: m.id,
    code: m.code,
    orgId: m.org_id,
    groupId: m.group_id,
    hostId: m.host_id,
    hostName: m.host_name,
    hostColor: m.host_color,
    groupName: m.group_name,
    groupCourse: m.group_course,
    groupColor: m.group_color,
    title: m.title,
    topic: m.topic,
    description: m.description,
    startsAt: m.starts_at,
    durationMin: m.duration_min,
    status: m.status,
    startedAt: m.started_at,
    endedAt: m.ended_at,
    invitedCount: m.invited_count ?? 0,
    recordingId: m.recording_id ?? null,
    allowGuests: m.allow_guests,
    waitingRoom: m.waiting_room,
    muteOnEntry: m.mute_on_entry,
    locked: m.locked,
    hasPasscode: !!m.passcode,
    // Parolni faqat boshqaruvchi ko'radi (taklif matniga qo'shish uchun)
    ...(manage ? { passcode: m.passcode } : {}),
    createdAt: m.created_at,
    canManage: manage,
  }
}

export const canManage = (u, m) =>
  !!u && (u.role === 'superadmin' || (u.role === 'org_admin' && u.org_id === m.org_id) || u.id === m.host_id)

// Guruh a'zosi yoki tashkilot xodimi: kutish zalisiz, parolsiz kiradi
export async function isMember(u, m) {
  if (!u) return false
  if (canManage(u, m)) return true
  if (u.org_id !== m.org_id) return false
  if (u.role === 'teacher') return true
  if (!m.group_id) return true
  return !!(await one('SELECT 1 FROM group_members WHERE group_id = $1 AND user_id = $2', [m.group_id, u.id]))
}

export async function getMeeting(id) {
  return one(`${MEETING_SELECT} WHERE m.id = $1`, [id])
}
export async function getMeetingByCode(code) {
  return one(`${MEETING_SELECT} WHERE m.code = $1`, [code])
}

// Foydalanuvchi ko'radigan darslar ro'yxati
export async function listMeetings(u, { orgId } = {}) {
  if (u.role === 'superadmin') {
    return orgId
      ? many(`${MEETING_SELECT} WHERE m.org_id = $1 ORDER BY m.starts_at DESC LIMIT 500`, [orgId])
      : many(`${MEETING_SELECT} ORDER BY m.starts_at DESC LIMIT 500`)
  }
  if (u.role === 'org_admin') {
    return many(`${MEETING_SELECT} WHERE m.org_id = $1 ORDER BY m.starts_at DESC LIMIT 500`, [u.org_id])
  }
  if (u.role === 'teacher') {
    return many(`${MEETING_SELECT}
      WHERE m.org_id = $2 AND (m.host_id = $1 OR g.teacher_id = $1)
      ORDER BY m.starts_at DESC LIMIT 500`, [u.id, u.org_id])
  }
  return many(`${MEETING_SELECT}
    WHERE m.org_id = $2 AND (m.group_id IS NULL OR m.group_id IN (SELECT group_id FROM group_members WHERE user_id = $1))
    ORDER BY m.starts_at DESC LIMIT 500`, [u.id, u.org_id])
}

// Dars yaratishda qaysi guruhga ruxsat bor
export async function assertCanCreateFor(u, groupId) {
  const g = await one('SELECT * FROM groups WHERE id = $1', [groupId])
  if (!g) return { error: 'Guruh topilmadi' }
  if (u.role === 'superadmin') return { group: g }
  if (u.role === 'org_admin' && u.org_id === g.org_id) return { group: g }
  if (u.role === 'teacher' && g.teacher_id === u.id) return { group: g }
  return { error: 'Bu guruh uchun dars yaratishga ruxsat yo‘q' }
}

export { isAdmin }
