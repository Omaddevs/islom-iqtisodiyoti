// Havola orqali qo'shilish: /#/join/<code>
// GET  — darsning ochiq ma'lumotlari (lobby uchun) + kiruvchining holati
// POST — WebSocket'ga ulanish uchun qisqa muddatli chipta (ticket) beradi
import { timingSafeEqual } from 'node:crypto'
import { z } from 'zod'
import { json, route, body, fail } from '@/lib/http.js'
import { currentUser, publicUser, signRoomTicket } from '@/lib/auth.js'
import { getMeetingByCode, isMember, canManage } from '@/lib/meetings.js'
import { config } from '@/lib/config.js'
import { rateLimit, clientIp } from '@/lib/rateLimit.js'
import { isMeetingCode } from '@/lib/ids.js'

async function load(code) {
  if (!isMeetingCode(code)) fail(404, 'Havola noto‘g‘ri')
  const m = await getMeetingByCode(code)
  if (!m) fail(404, 'Dars topilmadi yoki o‘chirilgan')
  return m
}

const safeEq = (a, b) => {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b))
  return x.length === y.length && timingSafeEqual(x, y)
}

export const GET = route(async (_req, { code }) => {
  const m = await load(code)
  const u = await currentUser()
  const member = await isMember(u, m)
  return json({
    meeting: {
      id: m.id, code: m.code, title: m.title, topic: m.topic, description: member ? m.description : null,
      hostName: m.host_name, hostColor: m.host_color, groupName: m.group_name, groupCourse: m.group_course,
      startsAt: m.starts_at, durationMin: m.duration_min, status: m.status, startedAt: m.started_at,
      allowGuests: m.allow_guests, hasPasscode: !!m.passcode, locked: m.locked, invitedCount: m.invited_count ?? 0,
      recordingId: member ? m.recording_id : null,
      online: globalThis.__iiHub?.count(m.id) ?? 0,
    },
    viewer: { user: publicUser(u), isMember: member, isHost: canManage(u, m), needsPasscode: !!m.passcode && !member },
  })
})

const Schema = z.object({
  name: z.string().trim().min(2, 'Ismingizni kiriting').max(40, 'Ism juda uzun').optional(),
  passcode: z.string().max(40).optional(),
})

export const POST = route(async (req, { code }) => {
  const m = await load(code)
  const d = await body(req, Schema)
  if (m.status === 'ended') fail(410, 'Dars yakunlangan')

  const u = await currentUser()
  const host = canManage(u, m)
  const member = await isMember(u, m)
  if (!u && !m.allow_guests) fail(401, 'Bu darsga faqat platforma foydalanuvchilari qo‘shila oladi. Tizimga kiring', { needLogin: true })
  if (!u && !d.name) fail(422, 'Ismingizni kiriting', { field: 'name' })
  if (m.locked && !host) fail(423, 'Ustoz darsni qulflagan — yangi ishtirokchilar kira olmaydi')

  if (m.passcode && !member) {
    const rl = rateLimit(`pass:${clientIp(req)}:${m.id}`, { limit: 10, windowMs: 10 * 60e3 })
    if (!rl.ok) fail(429, 'Juda ko‘p noto‘g‘ri urinish. Birozdan so‘ng qayta urining')
    if (!d.passcode) fail(403, 'Dars parolini kiriting', { needPasscode: true, field: 'passcode' })
    if (!safeEq(d.passcode.trim(), m.passcode)) fail(403, 'Parol noto‘g‘ri', { needPasscode: true, field: 'passcode' })
  }

  const ticket = await signRoomTicket({
    meetingId: m.id,
    userId: u?.id ?? null,
    name: u?.name ?? d.name,
    color: u?.avatar_color ?? null,
    role: host ? 'host' : 'participant',
    guest: !u,
    member,
  })
  return json({ ticket, iceServers: config.iceServers, role: host ? 'host' : 'participant', meetingId: m.id })
})
