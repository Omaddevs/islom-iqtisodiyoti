// O'quvchi faolligi: o'qishga sarflangan vaqtni yozish va ustozga ko'rsatish qoidalari
import { one, many, query } from './db.js'

// Faollik turi → records to'plami (material shu tashkilotda mavjudligi tekshiriladi)
export const STUDY_KINDS = { video: 'videos', library: 'library', vocab: 'vocabSets', test: 'tests', article: 'articles', homework: 'homework' }
export const MAX_BEAT_SEC = 70
const TZ = 'Asia/Tashkent'

export async function recordBeat(u, { kind, refId, seconds, progress }) {
  const col = STUDY_KINDS[kind]
  const sec = Math.round(Number(seconds))
  if (!col || !refId || !Number.isFinite(sec) || sec < 1) return false
  const rec = await one('SELECT id, data->>\'title\' AS title FROM records WHERE collection = $1 AND id = $2 AND org_id = $3', [col, String(refId).slice(0, 80), u.org_id])
  if (!rec) return false
  const p = Number.isFinite(Number(progress)) && progress !== null ? Math.max(0, Math.min(100, Math.round(Number(progress)))) : null
  await query(`INSERT INTO study_time (user_id, org_id, day, kind, ref_id, title, seconds, progress)
      VALUES ($1, $2, (now() AT TIME ZONE '${TZ}')::date, $3, $4, $5, $6, $7)
    ON CONFLICT (user_id, day, kind, ref_id) DO UPDATE SET
      seconds = study_time.seconds + EXCLUDED.seconds,
      progress = GREATEST(study_time.progress, EXCLUDED.progress),
      title = EXCLUDED.title, last_at = now()`,
  [u.id, u.org_id, kind, rec.id, (rec.title || '').slice(0, 200), Math.min(sec, MAX_BEAT_SEC), p])
  await query('UPDATE users SET last_seen_at = now() WHERE id = $1', [u.id])
  return true
}

// Kim kimning statistikasini ko'radi: o'zi, guruh ustozi, tashkilot admini, bosh admin
export async function canViewStudent(viewer, studentId) {
  if (viewer.id === studentId) return true
  const s = await one('SELECT id, org_id, role FROM users WHERE id = $1', [studentId])
  if (!s || s.role !== 'student') return false
  if (viewer.role === 'superadmin') return true
  if (viewer.org_id !== s.org_id) return false
  if (viewer.role === 'org_admin') return true
  if (viewer.role !== 'teacher') return false
  return !!(await one(`SELECT 1 FROM group_members gm JOIN groups g ON g.id = gm.group_id
    WHERE gm.user_id = $1 AND g.teacher_id = $2 LIMIT 1`, [studentId, viewer.id]))
}

const sinceDay = (days) => `(now() AT TIME ZONE '${TZ}')::date - ${Math.max(0, days - 1)}`
const ms = (d) => (d ? new Date(d).getTime() : null)
// Toshkent bo'yicha bugungi sana (YYYY-MM-DD)
export const tashkentToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date())
const dayStr = (d) => (typeof d === 'string' ? d.slice(0, 10) : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`)

// Bitta o'quvchi: kunlik vaqt, materiallar bo'yicha jami, kutubxona fayllarini ochishlar, onlayn darslar
export async function studentActivity(studentId, days) {
  const [daily, items, opens, meetings, today] = await Promise.all([
    many(`SELECT day, kind, sum(seconds)::int AS seconds FROM study_time
      WHERE user_id = $1 AND day >= ${sinceDay(days)} GROUP BY day, kind ORDER BY day`, [studentId]),
    many(`SELECT kind, ref_id, max(title) AS title, sum(seconds)::int AS seconds, max(progress) AS progress,
        count(*)::int AS days, min(first_at) AS first_at, max(last_at) AS last_at
      FROM study_time WHERE user_id = $1 GROUP BY kind, ref_id ORDER BY max(last_at) DESC LIMIT 400`, [studentId]),
    many(`SELECT r.id AS ref_id, count(*) FILTER (WHERE e.type = 'open')::int AS opens, count(*) FILTER (WHERE e.type = 'print')::int AS prints, max(e.created_at) AS last_at
      FROM material_events e JOIN records r ON r.collection = 'library' AND r.data->>'fileId' = e.file_id
      WHERE e.user_id = $1 GROUP BY r.id`, [studentId]),
    many(`SELECT m.id, m.title, m.starts_at, m.duration_min, min(a.joined_at) AS joined_at,
        bool_or(a.role = 'external') AS external,
        sum(CASE WHEN a.role = 'external' THEN 0 ELSE GREATEST(0, EXTRACT(EPOCH FROM (COALESCE(a.left_at, LEAST(now(), m.starts_at + make_interval(mins => m.duration_min))) - a.joined_at))) END)::int AS seconds
      FROM meeting_attendance a JOIN meetings m ON m.id = a.meeting_id
      WHERE a.user_id = $1 GROUP BY m.id ORDER BY m.starts_at DESC LIMIT 200`, [studentId]),
    one(`SELECT (now() AT TIME ZONE '${TZ}')::date AS d`),
  ])
  return {
    days, today: dayStr(today.d),
    daily: daily.map((r) => ({ day: dayStr(r.day), kind: r.kind, seconds: r.seconds })),
    items: items.map((r) => ({ kind: r.kind, refId: r.ref_id, title: r.title, seconds: r.seconds, progress: r.progress, days: r.days, firstAt: ms(r.first_at), lastAt: ms(r.last_at) })),
    opens: opens.map((r) => ({ refId: r.ref_id, opens: r.opens, prints: r.prints, lastAt: ms(r.last_at) })),
    meetings: meetings.map((r) => ({ id: r.id, title: r.title, startsAt: ms(r.starts_at), durationMin: r.duration_min, joinedAt: ms(r.joined_at), external: !!r.external, seconds: Math.max(0, r.seconds || 0) })),
  }
}

// Ko'ruvchiga tegishli barcha o'quvchilar: davr bo'yicha jami vaqt, turlar va kunlar kesimida
export async function studentsOverview(viewer, days, orgId) {
  const params = [], where = []
  if (viewer.role === 'teacher') {
    params.push(viewer.id)
    where.push(`s.user_id IN (SELECT gm.user_id FROM group_members gm JOIN groups g ON g.id = gm.group_id WHERE g.teacher_id = $${params.length})`)
  } else if (viewer.role === 'org_admin' || (viewer.role === 'superadmin' && orgId)) {
    params.push(viewer.role === 'org_admin' ? viewer.org_id : orgId)
    where.push(`s.org_id = $${params.length}`)
  } else if (viewer.role !== 'superadmin') return []
  const rows = await many(`SELECT s.user_id, s.day, s.kind, sum(s.seconds)::int AS seconds, max(s.last_at) AS last_at
    FROM study_time s WHERE s.day >= ${sinceDay(days)} ${where.length ? `AND ${where.join(' AND ')}` : ''}
    GROUP BY s.user_id, s.day, s.kind`, params)
  const by = new Map()
  for (const r of rows) {
    const x = by.get(r.user_id) || { userId: r.user_id, seconds: 0, kinds: {}, daily: {}, dailyKinds: {}, lastAt: 0 }
    x.seconds += r.seconds
    x.kinds[r.kind] = (x.kinds[r.kind] || 0) + r.seconds
    const d = dayStr(r.day)
    x.daily[d] = (x.daily[d] || 0) + r.seconds
    const dk = x.dailyKinds[d] || (x.dailyKinds[d] = {})
    dk[r.kind] = (dk[r.kind] || 0) + r.seconds
    x.lastAt = Math.max(x.lastAt, ms(r.last_at))
    by.set(r.user_id, x)
  }
  return [...by.values()]
}
