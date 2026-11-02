import { json, route, body, fail } from '@/lib/http.js'
import { requireUser } from '@/lib/auth.js'
import { tx } from '@/lib/db.js'
import { listMeetings, serializeMeeting, assertCanCreateFor, getMeeting } from '@/lib/meetings.js'
import { MeetingCreate } from '@/lib/schemas.js'
import { newId, newMeetingCode } from '@/lib/ids.js'

export const GET = route(async (req) => {
  const u = await requireUser()
  const orgId = req.nextUrl.searchParams.get('orgId') || undefined
  const rows = await listMeetings(u, { orgId })
  // Xonada hozir nechta odam borligi (real vaqt holati)
  const hub = globalThis.__iiHub
  return json({ meetings: rows.map((m) => ({ ...serializeMeeting(m, u), online: hub?.count(m.id) ?? 0 })) })
})

export const POST = route(async (req) => {
  const u = await requireUser()
  if (u.role === 'student') fail(403, 'Dars yaratish faqat ustoz va administratorlarga ruxsat etilgan')
  const d = await body(req, MeetingCreate)
  const { group, error } = await assertCanCreateFor(u, d.groupId)
  if (error) fail(403, error)

  const id = newId('m')
  const hostId = u.role === 'teacher' ? u.id : group.teacher_id || u.id
  await tx(async (c) => {
    // Kod noyob bo'lishi kerak — to'qnashuv ehtimoli juda kichik, lekin baribir qayta urinamiz
    for (let i = 0; i < 5; i++) {
      const r = await c.query(`INSERT INTO meetings (id, code, org_id, group_id, host_id, title, topic, description, starts_at, duration_min, passcode, allow_guests, waiting_room, mute_on_entry)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,to_timestamp($9 / 1000.0),$10,$11,$12,$13,$14) ON CONFLICT (code) DO NOTHING`,
      [id, newMeetingCode(), group.org_id, group.id, hostId, d.title, d.topic || null, d.description || null, d.startsAt, d.durationMin,
        d.passcode ?? null, d.allowGuests ?? true, d.waitingRoom ?? true, d.muteOnEntry ?? false])
      if (r.rowCount) return
    }
    throw new Error('meeting code collision')
  })
  return json({ meeting: serializeMeeting(await getMeeting(id), u) }, { status: 201 })
})
