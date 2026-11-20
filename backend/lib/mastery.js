// O'quvchining o'zlashtirish ko'rsatkichi (metodika: «O'quvchining o'zlashtirish ko'rsatkichini hisoblash»).
//
// Dars — Kutubxona → Darslar kartasi (library, type: 'unit'). Darsga ustoz quyidagilarni bog'laydi:
//   onlayn dars (meetingId), dars yozuvi (videoId), test (testId), standart (standardId), lug'at (vocabSetId),
//   dars sanasi (date), topshiriqlar muddati (due), vazni (hours). Offline qatnashish va standartni chop etganini
//   ustoz darsning o'zida belgilaydi (offline / printed: { o'quvchiId: vaqt }).
//
// Bitta dars: O = D + T + S + L (0–100). Ballar HECH QAYERDA saqlanmaydi — har safar xom ma'lumotdan
// (davomat, urinishlar, o'qish vaqti, chop etish) qayta hisoblanadi, shuning uchun vaznlar o'zgarsa
// barcha natijalar avtomatik yangilanadi.
import { createHash } from 'node:crypto'
import { many, one, query } from './db.js'
import { startTs, wallDate, writeNotes } from './lessons.js'

// ---- Sozlamalar (tashkilot ma'lumotida: organizations.data.mastery) ----
export const DEFAULT_CFG = Object.freeze({
  w: { D: 60, T: 20, S: 10, L: 10 }, // komponentlar vazni, yig'indisi 100
  minT: 0,            // T shu balldan past bo'lsa dars «o'zlashtirilmagan» (0 — o'chiq)
  recFactor: 0.8,     // dars yozuvini keyin ko'rish koeffitsiyenti
  retryPenalty: 0.1,  // 2- va 3-urinish uchun jarima (har biri −10%)
  late: 0.8,          // muddatdan keyin bajarilgan T, S, L
  readMin: 10,        // standartni onlayn o'qishning eng kam faol vaqti (daqiqa)
  alerts: true,       // xavf signali: ustoz va o'quvchiga avtomatik xabar
  cert: { u: 70, att: 80, final: 56 },
})
const KEYS = ['D', 'T', 'S', 'L']
const num = (v, lo, hi, d) => { const n = Number(v); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d }

// Brauzerdan kelgan sozlamani tekshiradi (xato bo'lsa — matn qaytaradi)
export function cleanCfg(src) {
  if (!src || typeof src !== 'object') return 'Sozlamalar noto‘g‘ri'
  const w = {}
  for (const k of KEYS) {
    const v = Number(src.w?.[k])
    if (!Number.isInteger(v) || v < 0 || v > 100) return 'Vaznlar 0 dan 100 gacha butun son bo‘lishi kerak'
    w[k] = v
  }
  if (KEYS.reduce((s, k) => s + w[k], 0) !== 100) return 'Vaznlar yig‘indisi 100 bo‘lishi kerak'
  if (w.D === 0) return 'Davomat vazni 0 bo‘lishi mumkin emas'
  const minT = Number(src.minT ?? 0)
  if (!Number.isFinite(minT) || minT < 0 || minT > w.T) return `Testning eng kam chegarasi 0 dan ${w.T} gacha bo‘lishi kerak`
  const cert = {}
  for (const k of ['u', 'att', 'final']) {
    const v = Number(src.cert?.[k] ?? DEFAULT_CFG.cert[k])
    if (!Number.isFinite(v) || v < 0 || v > 100) return 'Sertifikat chegaralari 0 dan 100 gacha bo‘lishi kerak'
    cert[k] = v
  }
  return { w, minT, alerts: src.alerts !== false, cert }
}
export function cfgOf(orgData) {
  const m = orgData?.mastery
  const c = m ? cleanCfg(m) : null
  return { ...DEFAULT_CFG, ...(c && typeof c === 'object' ? c : {}), w: { ...(c?.w || DEFAULT_CFG.w) }, cert: { ...(c?.cert || DEFAULT_CFG.cert) } }
}

// ---- Baholash shkalasi ----
export const GRADES = [
  { key: 'a', min: 86, label: 'A’lo', mark: 5, tone: 'green' },
  { key: 'b', min: 71, label: 'Yaxshi', mark: 4, tone: 'blue' },
  { key: 'c', min: 55, label: 'Qoniqarli', mark: 3, tone: 'amber' },
  { key: 'd', min: 0, label: 'Qoniqarsiz', mark: 2, tone: 'red' },
]
export const gradeOf = (o) => GRADES.find((g) => Math.round(o * 10) / 10 >= g.min) || GRADES[3]
const r1 = (x) => Math.round(x * 10) / 10
const clamp01 = (x) => Math.max(0, Math.min(1, Number(x) || 0))

/**
 * Bitta dars bo'yicha ko'rsatkich (sof funksiya).
 * inp = {
 *   offline: bool,                  — ustoz offline qatnashganini belgilagan
 *   live: 0..1 | null,              — onlayn jonli efirda qatnashgan vaqt / dars davomiyligi (null — onlayn dars bog'lanmagan)
 *   rec: 0..1 | null,               — dars yozuvining ko'rilgan ulushi
 *   test: null | [{ share: 0..1, n: 1..3, late: bool }],   — null: test bog'lanmagan; [] — hali topshirmagan
 *   std: null | { printed: bool, printedLate: bool, onTime: 0..1, all: 0..1 },   — onTime/all: onlayn o'qilgan ulush
 *   vocab: null | { onTime: 0..1, all: 0..1 },
 * }
 * Bog'lanmagan komponentning vazni qolganlariga mutanosib taqsimlanadi (O baribir 0–100).
 */
export function lessonScore(cfg, inp) {
  const { w } = cfg
  const dParts = [['offline', inp.offline ? 1 : 0], ['live', clamp01(inp.live)], ['rec', clamp01(inp.rec) * cfg.recFactor]]
  const [dVia, dShare] = dParts.reduce((b, p) => (p[1] > b[1] ? p : b), [null, 0])
  const out = { D: w.D * dShare, T: null, S: null, L: null, via: { D: dVia } }
  if (inp.test) {
    // Eng yaxshi urinish: n-urinish uchun −10%·(n−1), muddatdan keyin ×0,8
    let best = 0, bestN = null
    for (const a of inp.test) {
      const v = clamp01(a.share) * Math.max(0, 1 - cfg.retryPenalty * (Math.max(1, a.n) - 1)) * (a.late ? cfg.late : 1)
      if (v > best || bestN === null) { best = Math.max(best, v); bestN = a.n }
    }
    out.T = w.T * best
    out.attempts = inp.test.length
  }
  if (inp.std) {
    const printed = inp.std.printed ? (inp.std.printedLate ? cfg.late : 1) : 0
    const online = Math.max(clamp01(inp.std.onTime), clamp01(inp.std.all) * cfg.late)
    out.S = w.S * Math.max(printed, online)
    out.via.S = !printed && !online ? null : printed >= online ? 'print' : 'online'
  }
  if (inp.vocab) out.L = w.L * Math.max(clamp01(inp.vocab.onTime), clamp01(inp.vocab.all) * cfg.late)
  const present = KEYS.filter((k) => out[k] !== null)
  const wsum = present.reduce((s, k) => s + w[k], 0) || 1
  let O = (present.reduce((s, k) => s + out[k], 0) * 100) / wsum
  out.failed = !!(inp.test && cfg.minT > 0 && out.T < cfg.minT)
  if (out.failed) O = Math.min(O, 54)
  for (const k of KEYS) if (out[k] !== null) out[k] = r1(out[k])
  out.O = r1(O)
  out.scaled = wsum !== 100
  return out
}

/**
 * Umumiy ko'rsatkichlar. lessons = [{ O, weight, passed, closed, D }] (kurs tartibida), N — kursdagi jami darslar.
 *   joriy = Σ(w·O)/Σw — o'tilgan darslar bo'yicha; kurs = ΣO / N — o'tilmaganlar 0 ball.
 */
export function totals(cfg, lessons, N) {
  const passed = lessons.filter((l) => l.passed)
  const ws = passed.reduce((s, l) => s + l.weight, 0)
  const uNow = ws ? passed.reduce((s, l) => s + l.weight * l.O, 0) / ws : null
  const uCourse = N ? passed.reduce((s, l) => s + l.O, 0) / N : 0
  const att = passed.length ? (passed.reduce((s, l) => s + l.D, 0) / (passed.length * cfg.w.D)) * 100 : null
  // Xavf signali — faqat muddati tugagan darslar bo'yicha (hali topshirishga vaqti borlar hisobga olinmaydi)
  const closed = lessons.filter((l) => l.closed)
  const last2 = closed.slice(-2)
  const low2 = last2.length === 2 && last2.every((l) => l.O < 55)
  const attClosed = closed.length ? (closed.reduce((s, l) => s + l.D, 0) / (closed.length * cfg.w.D)) * 100 : null
  const lowAtt = closed.length >= 2 && attClosed < 70
  return {
    uNow: uNow === null ? null : r1(uNow), uCourse: r1(uCourse), att: att === null ? null : r1(att), passed: passed.length, N,
    risk: low2 || lowAtt ? { low2, lowAtt, at: closed[closed.length - 1]?.id || null } : null,
  }
}

// ---- Sana yordamchilari (Toshkent vaqti) ----
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const addDays = (ds, n) => { const [y, m, d] = ds.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10) }
export const lessonDates = (u) => {
  const date = DATE_RE.test(u.date || '') ? u.date : wallDate(Number(u.createdAt) || Date.now())
  const due = DATE_RE.test(u.due || '') && u.due >= date ? u.due : addDays(date, 7)
  return { date, due, dueEnd: startTs(due, '23:59') + 60e3 }
}
const dayStr = (d) => (typeof d === 'string' ? d.slice(0, 10) : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`)
const ms = (d) => (d ? new Date(d).getTime() : 0)

// ---- Ma'lumotlarni yig'ish ----
export const isUnitFor = (u, groupId) => u.type === 'unit' && (!(u.groupIds || []).length || u.groupIds.includes(groupId))
export const sortUnits = (a, b) => (a.num || 0) - (b.num || 0) || (a.createdAt || 0) - (b.createdAt || 0)

export async function loadGroup(groupId) {
  const g = await one(`SELECT g.*, o.data AS org_data,
      COALESCE((SELECT array_agg(gm.user_id ORDER BY gm.added_at) FROM group_members gm JOIN users u ON u.id = gm.user_id WHERE gm.group_id = g.id AND u.role = 'student'), '{}') AS student_ids
    FROM groups g JOIN organizations o ON o.id = g.org_id WHERE g.id = $1`, [groupId])
  if (!g) return null
  const units = (await many(`SELECT id, data FROM records WHERE collection = 'library' AND org_id = $1 AND data->>'type' = 'unit'`, [g.org_id]))
    .map((r) => ({ ...r.data, id: r.id })).filter((u) => isUnitFor(u, g.id)).sort(sortUnits)
  return { g, units, cfg: cfgOf(g.org_data) }
}

// Bitta guruh, bir yoki bir nechta o'quvchi bo'yicha barcha xom ma'lumot → hisoblangan natija
export async function computeGroup(groupId, { onlyStudent = null, now = Date.now() } = {}) {
  const L = await loadGroup(groupId)
  if (!L) return null
  const { g, units, cfg } = L
  const sids = onlyStudent ? g.student_ids.filter((x) => x === onlyStudent) : g.student_ids
  const ids = (k) => [...new Set(units.map((u) => u[k]).filter(Boolean).map(String))]
  const testIds = ids('testId'), setIds = ids('vocabSetId'), videoIds = ids('videoId'), stdIds = ids('standardId'), meetingIds = ids('meetingId')
  const finalTestId = g.data?.finalTestId || null
  const allTests = [...new Set([...testIds, ...(finalTestId ? [finalTestId] : [])])]
  const none = Promise.resolve([])
  const [tests, attempts, sets, progress, study, stds, meetings, attend, prints] = sids.length ? await Promise.all([
    allTests.length ? many(`SELECT id, data->>'title' AS title, jsonb_array_length(COALESCE(data->'questions', '[]'::jsonb)) AS n FROM records WHERE collection = 'tests' AND id = ANY($1)`, [allTests]) : none,
    allTests.length ? many(`SELECT owner_id, data FROM records WHERE collection = 'testAttempts' AND owner_id = ANY($1) AND data->>'testId' = ANY($2)`, [sids, allTests]) : none,
    setIds.length ? many(`SELECT id, data->>'title' AS title, data->'terms' AS terms FROM records WHERE collection = 'vocabSets' AND id = ANY($1)`, [setIds]) : none,
    setIds.length ? many(`SELECT owner_id, data FROM records WHERE collection = 'vocabProgress' AND owner_id = ANY($1) AND data->>'setId' = ANY($2)`, [sids, setIds]) : none,
    videoIds.length || stdIds.length ? many(`SELECT user_id, kind, ref_id, day, seconds, progress FROM study_time
      WHERE user_id = ANY($1) AND ((kind = 'video' AND ref_id = ANY($2)) OR (kind = 'library' AND ref_id = ANY($3)))`, [sids, videoIds, stdIds]) : none,
    stdIds.length ? many(`SELECT id, data->>'title' AS title, data->>'fileId' AS file_id FROM records WHERE collection = 'library' AND id = ANY($1)`, [stdIds]) : none,
    meetingIds.length ? many('SELECT id, title, starts_at, duration_min, status FROM meetings WHERE id = ANY($1)', [meetingIds]) : none,
    meetingIds.length ? many(`SELECT meeting_id, user_id, sum(GREATEST(0, EXTRACT(EPOCH FROM (COALESCE(a.left_at, LEAST(now(), m.starts_at + make_interval(mins => m.duration_min))) - a.joined_at))))::int AS seconds
      FROM meeting_attendance a JOIN meetings m ON m.id = a.meeting_id WHERE a.meeting_id = ANY($1) AND a.user_id = ANY($2) GROUP BY meeting_id, user_id`, [meetingIds, sids]) : none,
    stdIds.length ? many(`SELECT e.user_id, r.id AS std_id, min(e.created_at) AS first_at FROM material_events e
      JOIN records r ON r.collection = 'library' AND r.id = ANY($1) AND r.data->>'fileId' = e.file_id
      WHERE e.type = 'print' AND e.user_id = ANY($2) GROUP BY e.user_id, r.id`, [stdIds, sids]) : none,
  ]) : [[], [], [], [], [], [], [], [], []]

  const testById = new Map(tests.map((t) => [t.id, t]))
  const setById = new Map(sets.map((s) => [s.id, { ...s, termIds: new Set((s.terms || []).map((t) => String(t.id))) }]))
  const stdById = new Map(stds.map((s) => [s.id, s]))
  const meetById = new Map(meetings.map((m) => [m.id, m]))
  const key = (...a) => a.join('|')
  const attBy = new Map(), progBy = new Map(), studyBy = new Map(), meetBy = new Map(), printBy = new Map()
  for (const a of attempts) { const k = key(a.owner_id, a.data.testId); attBy.set(k, [...(attBy.get(k) || []), a.data]) }
  for (const p of progress) progBy.set(key(p.owner_id, p.data.setId), p.data)
  for (const s of study) { const k = key(s.user_id, s.kind, s.ref_id); studyBy.set(k, [...(studyBy.get(k) || []), s]) }
  for (const a of attend) meetBy.set(key(a.user_id, a.meeting_id), a.seconds)
  for (const p of prints) printBy.set(key(p.user_id, p.std_id), ms(p.first_at))

  const today = wallDate(now)
  const readSec = cfg.readMin * 60
  const N = Math.max(units.length, Number(g.data?.plannedLessons) || 0)

  const lessonsMeta = units.map((u) => {
    const d = lessonDates(u)
    const m = u.meetingId ? meetById.get(u.meetingId) : null
    // Kuzatiladigan dars: unga topshiriq bog'langan yoki ustoz davomat/chop etishni belgilagan.
    // Bo'sh dars kartasi (hech narsa o'lchanmaydi) natijani pasaytirmaydi va xavf signali bermaydi.
    const tracked = !!(u.meetingId || u.videoId || u.testId || u.standardId || u.vocabSetId
      || Object.keys(u.offline || {}).length || Object.keys(u.printed || {}).length)
    const held = d.date <= today
    return {
      id: u.id, num: u.num, title: u.title, date: d.date, due: d.due, weight: Math.max(0.5, Math.min(20, Number(u.hours) || 1)),
      held, tracked, passed: held && tracked, closed: tracked && d.due < today, dueEnd: d.dueEnd,
      links: {
        meeting: m ? { id: m.id, title: m.title } : null,
        video: u.videoId || null,
        test: u.testId && testById.has(u.testId) ? { id: u.testId, title: testById.get(u.testId).title } : null,
        standard: u.standardId && stdById.has(u.standardId) ? { id: u.standardId, title: stdById.get(u.standardId).title } : null,
        vocab: u.vocabSetId && setById.has(u.vocabSetId) ? { id: u.vocabSetId, title: setById.get(u.vocabSetId).title } : null,
      },
      unit: u,
    }
  })

  const students = sids.map((sid) => {
    const rows = lessonsMeta.map((lm) => {
      const u = lm.unit
      // Davomat
      const m = u.meetingId ? meetById.get(u.meetingId) : null
      const live = m ? clamp01((meetBy.get(key(sid, m.id)) || 0) / (m.duration_min * 60)) : null
      const vrows = u.videoId ? studyBy.get(key(sid, 'video', u.videoId)) || [] : null
      const rec = vrows ? Math.max(0, ...vrows.map((r) => r.progress || 0)) / 100 : null
      // Test: barcha urinishlar, tartib raqami bilan
      let test = null
      if (lm.links.test) {
        const list = (attBy.get(key(sid, u.testId)) || []).sort((a, b) => a.finishedAt - b.finishedAt)
        test = list.map((a, i) => ({ share: a.total ? a.score / a.total : 0, n: Number(a.n) || i + 1, late: a.finishedAt > lm.dueEnd, score: a.score, total: a.total, at: a.finishedAt }))
      }
      // Standart: chop etish (ustoz belgisi yoki platformadagi «Chop etish») yoki onlayn o'qish
      let std = null
      if (lm.links.standard) {
        const mark = Number(u.printed?.[sid]) || 0
        const ev = printBy.get(key(sid, u.standardId)) || 0
        const printedAt = mark && ev ? Math.min(mark, ev) : mark || ev
        const srows = studyBy.get(key(sid, 'library', u.standardId)) || []
        const share = (list) => {
          const sec = list.reduce((s, r) => s + r.seconds, 0)
          const scroll = Math.max(0, ...list.map((r) => r.progress || 0)) / 100
          return Math.min(scroll, sec / readSec)
        }
        std = { printed: !!printedAt, printedLate: printedAt > lm.dueEnd, onTime: share(srows.filter((r) => dayStr(r.day) <= lm.due)), all: share(srows), sec: srows.reduce((s, r) => s + r.seconds, 0) }
      }
      // Lug'at: o'rganilgan atamalar / to'plamdagi jami (muddatdan keyin o'rganilganlar ×0,8)
      let vocab = null
      if (lm.links.vocab) {
        const set = setById.get(u.vocabSetId)
        const p = progBy.get(key(sid, u.vocabSetId))
        const learned = (p?.learned || []).map(String).filter((id) => set.termIds.has(id))
        const total = set.termIds.size || 1
        const onTime = learned.filter((id) => !(Number(p?.at?.[id]) > lm.dueEnd)).length
        vocab = { onTime: onTime / total, all: learned.length / total, learned: learned.length, total: set.termIds.size }
      }
      const offline = !!Number(u.offline?.[sid])
      const s = lessonScore(cfg, { offline, live, rec, test, std, vocab })
      return {
        id: lm.id, ...s, passed: lm.passed, closed: lm.closed, weight: lm.weight,
        detail: {
          offline, live: live === null ? null : r1(live * 100), rec: rec === null ? null : r1(rec * 100),
          test: test && { attempts: test.map(({ score, total, n, late, at }) => ({ score, total, n, late, at })) },
          std: std && { printed: std.printed, printedLate: std.printedLate, read: r1(std.all * 100), minutes: Math.round(std.sec / 60) },
          vocab: vocab && { learned: vocab.learned, total: vocab.total },
        },
      }
    })
    const t = totals(cfg, rows, N)
    // Sertifikat sharti: Ukurs ≥ 70, davomat ≥ 80%, yakuniy test ≥ 56%
    const fin = finalTestId ? (attBy.get(key(sid, finalTestId)) || []).reduce((b, a) => Math.max(b, a.total ? (a.score / a.total) * 100 : 0), -1) : null
    const cert = {
      u: t.uCourse >= cfg.cert.u, att: t.att !== null && t.att >= cfg.cert.att,
      final: fin === null ? null : fin >= cfg.cert.final, finalPct: fin === null || fin < 0 ? null : Math.round(fin),
    }
    cert.ok = cert.u && cert.att && cert.final === true
    return { id: sid, lessons: rows, ...t, grade: t.uNow === null ? null : gradeOf(t.uNow).key, cert }
  })

  return {
    cfg, today, N,
    group: { id: g.id, name: g.name, orgId: g.org_id, teacherId: g.teacher_id, plannedLessons: Number(g.data?.plannedLessons) || 0, finalTestId,
      finalTest: finalTestId && testById.has(finalTestId) ? testById.get(finalTestId).title : null },
    lessons: lessonsMeta.map(({ unit, dueEnd, ...x }) => x), // eslint-disable-line no-unused-vars
    students,
  }
}

// ---- Testni ochish sharti: davomat qayd etilgan yoki standart ochilgan bo'lishi kerak ----
// Faqat darsga bog'langan testlarga tegishli (dars kartasida «gate» o'chirilmagan bo'lsa).
export async function testGate(studentId, testId) {
  const rows = await many(`SELECT r.id, r.data FROM records r WHERE r.collection = 'library' AND r.data->>'type' = 'unit' AND r.data->>'testId' = $1`, [String(testId)])
  if (!rows.length) return { locked: false }
  const groups = new Set((await many('SELECT group_id FROM group_members WHERE user_id = $1', [studentId])).map((r) => r.group_id))
  const units = rows.map((r) => ({ ...r.data, id: r.id })).filter((u) => !(u.groupIds || []).length || u.groupIds.some((x) => groups.has(x)))
  if (!units.length) return { locked: false }
  for (const u of units) {
    if (u.gate === false) return { locked: false }
    if (Number(u.offline?.[studentId]) || Number(u.printed?.[studentId])) return { locked: false }
    if (u.meetingId && await one('SELECT 1 FROM meeting_attendance WHERE meeting_id = $1 AND user_id = $2 LIMIT 1', [u.meetingId, studentId])) return { locked: false }
    if (u.videoId && await one(`SELECT 1 FROM study_time WHERE user_id = $1 AND kind = 'video' AND ref_id = $2 AND seconds > 0 LIMIT 1`, [studentId, u.videoId])) return { locked: false }
    if (u.standardId) {
      if (await one(`SELECT 1 FROM study_time WHERE user_id = $1 AND kind = 'library' AND ref_id = $2 AND seconds > 0 LIMIT 1`, [studentId, u.standardId])) return { locked: false }
      if (await one(`SELECT 1 FROM material_events e JOIN records r ON r.collection = 'library' AND r.id = $2 AND r.data->>'fileId' = e.file_id
        WHERE e.user_id = $1 AND e.type IN ('open', 'print') LIMIT 1`, [studentId, u.standardId])) return { locked: false }
    }
  }
  const u = units[0]
  return { locked: true, unitId: u.id, unitTitle: u.title, standardId: u.standardId || null, meetingId: u.meetingId || null, videoId: u.videoId || null }
}

// ---- Xavf signali: ketma-ket 2 ta darsda O < 55 yoki davomat < 70% ----
const noteId = (s) => `ms${createHash('sha1').update(s).digest('hex').slice(0, 30)}`
export async function sendRiskAlerts(now = Date.now()) {
  const groups = await many(`SELECT DISTINCT g.id FROM groups g JOIN records r ON r.org_id = g.org_id AND r.collection = 'library' AND r.data->>'type' = 'unit'`)
  let sent = 0
  for (const { id } of groups) {
    const res = await computeGroup(id, { now })
    if (!res || !res.cfg.alerts) continue
    const names = new Map((await many('SELECT id, name FROM users WHERE id = ANY($1)', [res.students.map((s) => s.id)])).map((u) => [u.id, u.name]))
    for (const s of res.students) {
      if (!s.risk) continue
      const why = [s.risk.low2 && 'ketma-ket 2 ta darsda o‘zlashtirish 55 balldan past', s.risk.lowAtt && `davomat ${Math.round(s.att ?? 0)}% (70% dan past)`].filter(Boolean).join(', ')
      const tag = `${s.risk.low2 ? 'l' : ''}${s.risk.lowAtt ? 'a' : ''}`
      const db = { query: (...a) => query(...a) }
      sent += await writeNotes(db, [s.id], `Diqqat: ${why}. Darslarni takrorlab, topshiriqlarni bajaring — ustozingiz yordam beradi.`, '#/platform/mastery', (uid) => noteId(`risk|${uid}|${s.id}|${s.risk.at}|${tag}`))
      if (res.group.teacherId) {
        sent += await writeNotes(db, [res.group.teacherId], `Xavf signali: ${names.get(s.id) || 'O‘quvchi'} (${res.group.name}) — ${why}`, `#/platform/mastery/${res.group.id}.${s.id}`, (uid) => noteId(`risk|${uid}|${s.id}|${s.risk.at}|${tag}`))
      }
    }
  }
  return sent
}

export function startRiskAlerts(log = console) {
  let busy = false
  const tick = async () => {
    if (busy) return
    busy = true
    try { await sendRiskAlerts() } catch (e) { log.error('[xavf signali]', e.message) } finally { busy = false }
  }
  const t = setInterval(tick, 30 * 60e3)
  t.unref?.()
  setTimeout(tick, 60e3).unref?.()
  return t
}
