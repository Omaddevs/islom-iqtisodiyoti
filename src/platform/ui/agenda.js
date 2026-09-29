// Kun bo'yicha darslar ro'yxati: aniq rejalashtirilgan uchrashuvlar + guruh jadvalidagi doimiy darslar.
// Dashboard va Dars jadvali sahifalari bitta manbadan foydalanadi.
import { fmtTime } from './format.js'

export const DAY_MS = 864e5
export const LESSON_MIN = 90 // doimiy dars uchun standart davomiylik

export const startOfDay = (ts) => { const d = new Date(ts); d.setHours(0, 0, 0, 0); return d.getTime() }
export const startOfWeek = (ts) => { const d = new Date(startOfDay(ts)); const day = (d.getDay() + 6) % 7; return d.getTime() - day * DAY_MS }

export const toMin = (t) => { const [h, m] = t.split(':').map(Number); return h * 60 + (m || 0) }
export const addMin = (t, n) => { const m = toMin(t) + n; return `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}` }

// Berilgan kun (00:00 timestamp) uchun tartiblangan darslar
export function eventsForDay(scope, db, dayTs) {
  const dow = new Date(dayTs).getDay()
  const events = []
  scope.meetings.filter((m) => m.startsAt >= dayTs && m.startsAt < dayTs + DAY_MS).forEach((m) => {
    const g = db.groups.find((x) => x.id === m.groupId)
    const t = fmtTime(m.startsAt)
    events.push({
      id: m.id, time: t, end: addMin(t, m.durationMin), title: m.title, group: g, status: m.status,
      hostId: m.hostId, startsAt: m.startsAt, durationMin: m.durationMin,
      href: m.status === 'ended' && m.recordingId ? `#/platform/videos/${m.recordingId}` : `#/platform/meetings/${m.id}/room`,
    })
  })
  scope.groups.forEach((g) => g.schedule.filter((s) => s.day === dow).forEach((s) => {
    if (events.some((e) => e.group?.id === g.id && Math.abs(toMin(e.time) - toMin(s.time)) < 60)) return
    const startsAt = dayTs + toMin(s.time) * 60e3
    events.push({
      id: `${g.id}-${s.day}-${s.time}`, time: s.time, end: addMin(s.time, g.durationMin || LESSON_MIN), title: g.course, group: g,
      status: 'regular', hostId: g.teacherId, startsAt, durationMin: g.durationMin || LESSON_MIN, href: `#/platform/groups/${g.id}`,
    })
  }))
  return events.sort((a, b) => toMin(a.time) - toMin(b.time))
}

// Oy ko'rinishi uchun: berilgan kunlarda nechta dars bor (kun timestamp → soni)
export function lessonCountsFor(scope, db, dayList) {
  const map = new Map()
  dayList.forEach((ts) => { const n = eventsForDay(scope, db, ts).length; if (n) map.set(ts, n) })
  return map
}
