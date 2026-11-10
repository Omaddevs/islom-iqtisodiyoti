// Kun bo'yicha darslar ro'yxati: aniq rejalashtirilgan onlayn darslar + Dars jadvalidagi darslar.
// Dashboard va Dars jadvali sahifalari bitta manbadan foydalanadi.
// Jadvaldagi sana/vaqt "devor soati" sifatida saqlanadi ('2026-11-12', '19:00') — server ham shunday hisoblaydi.
import { fmtTime, DAYS } from './format.js'

export const DAY_MS = 864e5

export const startOfDay = (ts) => { const d = new Date(ts); d.setHours(0, 0, 0, 0); return d.getTime() }
export const startOfWeek = (ts) => { const d = new Date(startOfDay(ts)); const day = (d.getDay() + 6) % 7; return d.getTime() - day * DAY_MS }

export const toMin = (t) => { const [h, m] = t.split(':').map(Number); return h * 60 + (m || 0) }
export const addMin = (t, n) => { const m = toMin(t) + n; return `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}` }

const pad = (n) => String(n).padStart(2, '0')
export const dayKey = (ts) => { const d = new Date(ts); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` }
export const keyToTs = (k) => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d).getTime() }
export const todayKey = () => dayKey(Date.now())

// Dars shu kuni bo'ladimi (bekor qilingani ham hisobga olinadi — u alohida ko'rsatiladi)
export const occursOn = (l, k) => k >= l.date && (l.repeat === 'weekly'
  ? l.days.includes(new Date(keyToTs(k)).getDay()) && (!l.until || k <= l.until)
  : k === l.date)
export const isSkipped = (l, k) => (l.skips || []).includes(k)
export const hasFuture = (l, k = todayKey()) => (l.repeat === 'weekly' ? !l.until || l.until >= k : l.date >= k)

export function nextOccurrence(l, from = todayKey()) {
  let ts = keyToTs(from > l.date ? from : l.date)
  for (let i = 0; i < 400; i++, ts += DAY_MS) {
    const k = dayKey(ts + 3600e3) // yozgi vaqt o'tishida ham to'g'ri kun
    if (l.until && k > l.until) return null
    if (occursOn(l, k) && !isSkipped(l, k)) return k
    if (l.repeat !== 'weekly' && k >= l.date) return null
  }
  return null
}

// "Har Du, Chor · 19:00" yoki "12-noyabr · 19:00"
export function lessonWhen(l) {
  if (l.repeat === 'weekly') return `Har ${l.days.map((d) => DAYS[d]).join(', ')}`
  const d = new Date(keyToTs(l.date))
  return d.toLocaleDateString('uz-UZ', { day: 'numeric', month: 'long' })
}
// Guruh kartasi uchun qisqa matn: "Dush, Chor 19:00 · 15 noy 10:00"
export const lessonShort = (l) => `${l.repeat === 'weekly' ? l.days.map((d) => DAYS[d]).join(', ') : lessonWhen(l)} ${l.time}`
export const groupLessonsText = (lessons, groupId) => lessons.filter((l) => l.groupId === groupId && hasFuture(l)).map(lessonShort).join(' · ')
// Guruhning eng yaqin (bekor qilinmagan) darsi boshlanish vaqti
export function nextLessonTs(lessons, groupId) {
  const now = Date.now()
  let best = null
  for (const l of lessons) {
    if (l.groupId !== groupId) continue
    let k = nextOccurrence(l)
    // Bugungi dars allaqachon tugagan bo'lsa — keyingisi
    if (k && keyToTs(k) + (toMin(l.time) + l.durationMin) * 60e3 < now) k = nextOccurrence(l, dayKey(keyToTs(k) + DAY_MS + 3600e3))
    if (!k) continue
    const ts = keyToTs(k) + toMin(l.time) * 60e3
    if (best == null || ts < best) best = ts
  }
  return best
}
export const lessonPlace =(l, g) => (l.online ? 'Onlayn' : l.room || g?.room || '')
export const lessonTime = (l) => `${l.time} – ${addMin(l.time, l.durationMin)}`

// Berilgan kun (00:00 timestamp) uchun tartiblangan darslar
export function eventsForDay(scope, db, dayTs) {
  const k = dayKey(dayTs)
  const events = []
  scope.meetings.filter((m) => m.startsAt >= dayTs && m.startsAt < dayTs + DAY_MS).forEach((m) => {
    const g = db.groups.find((x) => x.id === m.groupId)
    const t = fmtTime(m.startsAt)
    events.push({
      id: m.id, kind: 'meeting', time: t, end: addMin(t, m.durationMin), title: m.title, group: g, status: m.status,
      hostId: m.hostId, startsAt: m.startsAt, durationMin: m.durationMin, online: true,
      href: m.status === 'ended' && m.recordingId ? `#/platform/videos/${m.recordingId}` : `#/platform/meetings/${m.id}/room`,
    })
  })
  ;(scope.lessons || []).forEach((l) => {
    if (!occursOn(l, k)) return
    const g = db.groups.find((x) => x.id === l.groupId)
    const cancelled = isSkipped(l, k)
    // Shu guruhning shu vaqtdagi onlayn darsi bor bo'lsa — o'sha (xona havolasi bilan) ko'rsatiladi
    if (!cancelled && events.some((e) => e.kind === 'meeting' && e.group?.id === l.groupId && Math.abs(toMin(e.time) - toMin(l.time)) < 60)) return
    const startsAt = dayTs + toMin(l.time) * 60e3
    events.push({
      id: `${l.id}.${k}`, kind: 'lesson', lesson: l, date: k, time: l.time, end: addMin(l.time, l.durationMin), title: l.title, group: g,
      status: cancelled ? 'cancelled' : 'lesson', hostId: g?.teacherId, startsAt, durationMin: l.durationMin,
      online: !!l.online, place: lessonPlace(l, g), href: `#/platform/schedule/${l.id}.${k}`,
    })
  })
  return events.sort((a, b) => toMin(a.time) - toMin(b.time))
}

// Oy ko'rinishi uchun: berilgan kunlarda nechta dars bor (kun timestamp → soni). Bekor qilinganlar sanalmaydi.
export function lessonCountsFor(scope, db, dayList) {
  const map = new Map()
  dayList.forEach((ts) => { const n = eventsForDay(scope, db, ts).filter((e) => e.status !== 'cancelled').length; if (n) map.set(ts, n) })
  return map
}
