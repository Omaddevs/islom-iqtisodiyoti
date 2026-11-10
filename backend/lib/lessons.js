// Dars jadvali: ustoz yoki administrator guruh uchun bir martalik yoki haftalik dars qo'shadi.
// Sana va vaqt Toshkent vaqti bo'yicha "devor soati" sifatida saqlanadi ('2026-11-12', '19:00').
// O'quvchilarga xabarlar shu yerda tuziladi; dars boshlanishidan oldingi eslatmani server o'zi yuboradi.
// Next.js'ga bog'liq emas: server.mjs ham shu modulni ishlatadi.
import { createHash, randomBytes } from 'node:crypto'
import { many, query } from './db.js'

export const TZ_OFFSET = 5 * 3600e3 // Asia/Tashkent, yozgi vaqt yo'q
export const REMIND_MIN = 60

const DAYS = ['yakshanba', 'dushanba', 'seshanba', 'chorshanba', 'payshanba', 'juma', 'shanba']
const DAYS_SHORT = ['Yak', 'Du', 'Se', 'Chor', 'Pay', 'Ju', 'Sha']
const MONTHS = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentyabr', 'oktyabr', 'noyabr', 'dekabr']
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/

const parts = (ds) => ds.split('-').map(Number)
const validDate = (ds) => {
  if (typeof ds !== 'string' || !DATE_RE.test(ds)) return false
  const [y, m, d] = parts(ds)
  const t = new Date(Date.UTC(y, m - 1, d))
  return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d && y >= 2020 && y <= 2100
}
export const dowOf = (ds) => { const [y, m, d] = parts(ds); return new Date(Date.UTC(y, m - 1, d)).getUTCDay() }
export const wallDate = (ts) => new Date(ts + TZ_OFFSET).toISOString().slice(0, 10)
const addDays = (ds, n) => { const [y, m, d] = parts(ds); return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10) }
// Darsning haqiqiy boshlanish vaqti (epoch ms)
export const startTs = (ds, time) => { const [y, m, d] = parts(ds); const [h, mi] = time.split(':').map(Number); return Date.UTC(y, m - 1, d, h, mi) - TZ_OFFSET }

export const occursOn = (l, ds) => ds >= l.date && (l.repeat === 'weekly'
  ? l.days.includes(dowOf(ds)) && (!l.until || ds <= l.until)
  : ds === l.date)
// Bugundan (shu jumladan) keyingi birinchi bekor qilinmagan dars kuni
export function nextDate(l, from) {
  let ds = from > l.date ? from : l.date
  for (let i = 0; i < 400; i++, ds = addDays(ds, 1)) {
    if (l.until && ds > l.until) return null
    if (occursOn(l, ds) && !(l.skips || []).includes(ds)) return ds
    if (l.repeat !== 'weekly' && ds >= l.date) return null
  }
  return null
}
export const hasFuture = (l, today) => (l.repeat === 'weekly' ? !l.until || l.until >= today : l.date >= today)

// ---- Tekshiruv: brauzer yuborgan ma'lumotdan faqat ruxsat etilgan maydonlar ----
const FIELDS = ['groupId', 'title', 'date', 'time', 'durationMin', 'repeat', 'days', 'until', 'online', 'room', 'url', 'note', 'skips']
const str = (v) => (typeof v === 'string' ? v.trim() : '')

// Xato bo'lsa matnini qaytaradi (chaqiruvchi 422 beradi), aks holda tozalangan dars
export function cleanLesson(src) {
  const l = Object.fromEntries(FIELDS.filter((k) => src[k] !== undefined).map((k) => [k, src[k]]))
  l.title = str(l.title)
  if (l.title.length < 1) return 'Dars nomini kiriting'
  if (l.title.length > 120) return 'Dars nomi juda uzun'
  if (!validDate(l.date)) return 'Sanani to‘g‘ri kiriting'
  if (!TIME_RE.test(l.time || '')) return 'Boshlanish vaqtini kiriting'
  l.durationMin = Number(l.durationMin)
  if (!Number.isInteger(l.durationMin) || l.durationMin < 15 || l.durationMin > 600) return 'Davomiylik 15 daqiqadan 10 soatgacha bo‘lishi kerak'
  l.repeat = l.repeat === 'weekly' ? 'weekly' : 'once'
  if (l.repeat === 'weekly') {
    if (!Array.isArray(l.days)) return 'Hafta kunlarini tanlang'
    l.days = [...new Set(l.days.map(Number))].filter((d) => Number.isInteger(d) && d >= 0 && d <= 6).sort()
    if (!l.days.length) return 'Kamida bitta hafta kunini tanlang'
    l.until = l.until ? String(l.until) : null
    if (l.until && !validDate(l.until)) return 'Tugash sanasi noto‘g‘ri'
    if (l.until && l.until < l.date) return 'Tugash sanasi boshlanish sanasidan oldin bo‘lishi mumkin emas'
  } else {
    l.days = []
    l.until = null
  }
  l.online = !!l.online
  l.room = l.online ? '' : str(l.room).slice(0, 80)
  l.url = l.online ? str(l.url) : ''
  if (l.url && (l.url.length > 500 || !/^https?:\/\/\S+$/i.test(l.url))) return 'Havola http:// yoki https:// bilan boshlanishi kerak'
  l.note = str(l.note)
  if (l.note.length > 1000) return 'Izoh juda uzun'
  l.skips = Array.isArray(l.skips) ? [...new Set(l.skips.map(String))].filter(validDate).sort().slice(-300) : []
  return l
}

// ---- Xabar matnlari ----
export const fmtDay = (ds) => { const [, m, d] = parts(ds); return `${d}-${MONTHS[m - 1]} (${DAYS[dowOf(ds)]})` }
export const placeOf = (l) => (l.online ? 'onlayn' : l.room ? `${l.room}` : '')
export function whenOf(l, today) {
  const at = l.repeat === 'weekly'
    ? `har ${l.days.map((d) => DAYS_SHORT[d]).join(', ')} soat ${l.time}da${l.date > today ? ` (${fmtDay(l.date).replace(/ \(.*/, '')}dan)` : ''}`
    : `${fmtDay(l.date)} soat ${l.time}da`
  const p = placeOf(l)
  return p ? `${at} · ${p}` : at
}
export const lessonHref = (id, ds) => `#/platform/schedule/${id}${ds ? `.${ds}` : ''}`

const SCHEDULE_KEYS = ['date', 'time', 'durationMin', 'repeat', 'days', 'until', 'online', 'room', 'url']
const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null)

// Yaratish / o'zgartirish / o'chirishdan keyin kimga qanday xabar borishini aniqlaydi
export function lessonMessages(kind, prev, next, today) {
  const l = next || prev
  const t = `«${l.title}»`
  if (kind === 'created') {
    if (!hasFuture(next, today)) return []
    return [{ text: `Jadvalga yangi dars qo‘shildi: ${t} — ${whenOf(next, today)}`, date: nextDate(next, today) }]
  }
  if (kind === 'deleted') {
    if (!hasFuture(prev, today)) return []
    return [{ text: prev.repeat === 'weekly' ? `${t} darslari jadvaldan olib tashlandi` : `${t} darsi (${fmtDay(prev.date)}) bekor qilindi`, date: null }]
  }
  const out = []
  const was = new Set(prev.skips || []), now = new Set(next.skips || [])
  for (const ds of now) if (!was.has(ds) && ds >= today) out.push({ text: `${t} darsi ${fmtDay(ds)} kuni bo‘lmaydi`, date: ds })
  for (const ds of was) if (!now.has(ds) && ds >= today) out.push({ text: `${t} darsi ${fmtDay(ds)} kuni odatdagidek bo‘ladi`, date: ds })
  if (SCHEDULE_KEYS.some((k) => !same(prev[k], next[k])) && hasFuture(next, today)) {
    out.push({ text: `${t} darsi o‘zgartirildi: ${whenOf(next, today)}`, date: nextDate(next, today) })
  }
  return out
}

// ---- Bildirishnomalarni yozish ----
// `c` — tranzaksiya (yoki pool). Faqat faol foydalanuvchilarga; idFor berilsa takroriy yozuv hosil bo'lmaydi.
export async function writeNotes(c, userIds, text, href, idFor) {
  const ids = [...new Set(userIds.filter(Boolean))]
  if (!ids.length) return 0
  const users = (await c.query(`SELECT id, org_id FROM users WHERE id = ANY($1) AND status = 'active'`, [ids])).rows
  const at = Date.now()
  let n = 0
  for (const x of users) {
    const id = idFor ? idFor(x.id) : `n${randomBytes(9).toString('hex')}`
    const r = await c.query(`INSERT INTO records (collection, id, org_id, owner_id, data) VALUES ('notifications', $1, $2, $3, $4)
      ON CONFLICT DO NOTHING`, [id, x.org_id, x.id, { id, userId: x.id, text: text.slice(0, 500), href, at, read: false }])
    n += r.rowCount
  }
  return n
}

// ---- Dars boshlanishidan oldin eslatma ----
const hashId = (s) => `lr${createHash('sha1').update(s).digest('hex').slice(0, 30)}`
const leftText = (min) => (min >= 55 ? '1 soatdan keyin' : `${Math.max(1, min)} daqiqadan keyin`)

export async function remindLessons(now = Date.now()) {
  const days = [wallDate(now), wallDate(now + 864e5)]
  const rows = await many(`
    SELECT r.id, r.data, g.teacher_id, COALESCE(array_agg(gm.user_id) FILTER (WHERE gm.user_id IS NOT NULL), '{}') AS members
      FROM records r JOIN groups g ON g.id = r.data->>'groupId' LEFT JOIN group_members gm ON gm.group_id = g.id
     WHERE r.collection = 'lessons' AND (r.data->>'until' IS NULL OR r.data->>'until' >= $1) AND r.data->>'date' <= $2
     GROUP BY r.collection, r.id, g.id`, [days[0], days[1]])
  let sent = 0
  for (const r of rows) {
    const l = r.data
    for (const ds of days) {
      if (!occursOn(l, ds) || (l.skips || []).includes(ds)) continue
      const left = startTs(ds, l.time) - now
      if (left <= 0 || left > REMIND_MIN * 60e3) continue
      const p = placeOf(l)
      const text = `Eslatma: «${l.title}» darsi ${leftText(Math.round(left / 60e3))}, soat ${l.time}da boshlanadi${p ? ` · ${p}` : ''}`
      sent += await writeNotes({ query: (...a) => query(...a) }, [...r.members, r.teacher_id], text, lessonHref(r.id, ds), (uid) => hashId(`${r.id}|${ds}|${l.time}|${uid}`))
    }
  }
  return sent
}

// Har daqiqada tekshiradi. Xato server ishini to'xtatmaydi.
export function startLessonReminders(log = console) {
  let busy = false
  const tick = async () => {
    if (busy) return
    busy = true
    try { await remindLessons() } catch (e) { log.error('[eslatma]', e.message) } finally { busy = false }
  }
  const t = setInterval(tick, 60e3)
  t.unref?.()
  setTimeout(tick, 5e3).unref?.()
  return t
}
