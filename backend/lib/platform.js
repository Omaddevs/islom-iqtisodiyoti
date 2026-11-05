// Platforma ma'lumotlari: tashkilotlar, foydalanuvchilar, guruhlar va kontent (video, test, maqola, …).
// Frontend o'z store'idagi o'zgarishlarni "op"lar ko'rinishida yuboradi (insert / patch / delete);
// bu yerda HAR BIR op rol va tashkilot bo'yicha tekshiriladi — brauzerga ishonilmaydi.
import bcrypt from 'bcryptjs'
import { many } from './db.js'
import { fail } from './http.js'
import { digits } from './ids.js'

export const CONTENT = ['videos', 'tests', 'vocabSets', 'library', 'articles', 'homework']
export const RECORD_COLS = [...CONTENT, 'testAttempts', 'submissions', 'vocabProgress', 'notifications', 'activity']
export const COLLECTIONS = ['organizations', 'users', 'groups', ...RECORD_COLS]

// Talaba (va boshqa ko'ruvchilar) faqat hisoblagichlarni o'zgartira oladi — server o'zi +1 qiladi
const COUNTERS = { videos: ['views'], articles: ['views', 'readBy'], library: ['downloads'] }
const ORG_FIELDS = ['slug', 'plan', 'color', 'phone', 'email', 'description']
const GROUP_FIELDS = ['level', 'room', 'schedule']
const STAFF_ROLES = ['org_admin', 'teacher', 'student']
const MAX_ITEM = 3 * 1024 * 1024

// ---- Yordamchilar ----
const isSA = (u) => u.role === 'superadmin'
const adminOf = (u, orgId) => isSA(u) || (u.role === 'org_admin' && !!orgId && u.org_id === orgId)
const inOrg = (u, orgId) => isSA(u) || (!!orgId && u.org_id === orgId)
const row = async (c, sql, p) => (await c.query(sql, p)).rows[0] ?? null
const pick = (o, keys) => Object.fromEntries(keys.filter((k) => o[k] !== undefined).map((k) => [k, o[k]]))
const deny = (msg = 'Bu amalga ruxsatingiz yo‘q') => fail(403, msg)

const text = (v, { min = 0, max = 200, label = 'Maydon' } = {}) => {
  const s = typeof v === 'string' ? v.trim() : ''
  if (s.length < min) fail(422, `${label} to‘ldirilmagan`)
  if (s.length > max) fail(422, `${label} juda uzun`)
  return s
}
const ID_RE = /^[A-Za-z0-9_-]{1,64}$/
const checkId = (id) => { if (!ID_RE.test(String(id || ''))) fail(422, 'Noto‘g‘ri identifikator'); return id }
const phoneDigits = (p) => {
  const d = digits(p)
  if (!/^998\d{9}$/.test(d)) fail(422, 'Telefon raqam +998 XX XXX XX XX ko‘rinishida bo‘lishi kerak')
  return d
}
export const prettyPhone = (p) => {
  const d = digits(p).replace(/^998/, '')
  return '+998 ' + [d.slice(0, 2), d.slice(2, 5), d.slice(5, 7), d.slice(7, 9)].filter(Boolean).join(' ')
}
// Havolalar: faqat http(s) yoki ichki marshrut — `javascript:` kabi XSS yo'llari yopiladi
const safeLinks = (o) => {
  for (const k of ['url', 'href']) {
    if (o[k] == null || o[k] === '') continue
    if (typeof o[k] !== 'string' || !/^(https?:\/\/|#\/)/i.test(o[k].trim())) fail(422, 'Havola http:// yoki https:// bilan boshlanishi kerak')
  }
  return o
}
// Rasmlar fayl sifatida (/api/uploads) saqlanadi — bazaga data-URL ko'rinishidagi katta rasm yozilmaydi
const noInlineImages = (v) => {
  if (typeof v === 'string') { if (v.length > 2048 && v.startsWith('data:')) fail(422, 'Rasm eski usulda yuborildi — sahifani yangilab, rasmni qayta yuklang'); return }
  if (v && typeof v === 'object') for (const x of Object.values(v)) noInlineImages(x)
}
const sizeOk = (o) => { if (JSON.stringify(o).length > MAX_ITEM) fail(413, 'Ma’lumot hajmi juda katta (rasmlarni kichraytiring)') }
const password = (v) => {
  if (typeof v !== 'string' || v.length < 6) fail(422, 'Parol kamida 6 belgidan iborat bo‘lishi kerak')
  if (v.length > 100) fail(422, 'Parol juda uzun')
  return bcrypt.hash(v, 10)
}

// ---- Bazadagi qator → frontend shakli ----
const orgOut = (o) => ({ ...o.data, id: o.id, name: o.name, status: o.status, createdAt: o.created_at })
const userOut = (x, full) => ({
  ...(full ? x.data : { title: x.data?.title }),
  id: x.id, orgId: x.org_id, role: x.role, name: x.name, avatarColor: x.avatar_color, status: x.status, createdAt: x.created_at,
  ...(full ? { phone: prettyPhone(x.phone), lastSeen: x.last_seen_at } : {}),
})
const groupOut = (g) => ({
  schedule: [], ...g.data,
  id: g.id, orgId: g.org_id, name: g.name, course: g.course, teacherId: g.teacher_id, color: g.color, createdAt: g.created_at,
  studentIds: g.student_ids || [],
})
const recOut = (r) => ({ ...r.data, id: r.id })

const GROUPS_SQL = `
  SELECT g.*, COALESCE(array_agg(gm.user_id ORDER BY gm.added_at) FILTER (WHERE gm.user_id IS NOT NULL), '{}') AS student_ids
    FROM groups g LEFT JOIN group_members gm ON gm.group_id = g.id`

// ---- O'qish: foydalanuvchi ko'rishi mumkin bo'lgan barcha ma'lumotlar ----
export async function loadState(u) {
  const sa = isSA(u)
  const [orgs, users, groups, records] = await Promise.all([
    sa ? many('SELECT * FROM organizations ORDER BY created_at DESC') : many('SELECT * FROM organizations WHERE id = $1', [u.org_id]),
    sa ? many('SELECT * FROM users ORDER BY created_at DESC')
      : many(`SELECT * FROM users WHERE org_id = $1 OR id = $2 OR role = 'superadmin' ORDER BY created_at DESC`, [u.org_id, u.id]),
    sa ? many(`${GROUPS_SQL} GROUP BY g.id ORDER BY g.created_at DESC`)
      : many(`${GROUPS_SQL} WHERE g.org_id = $1 GROUP BY g.id ORDER BY g.created_at DESC`, [u.org_id]),
    sa ? many(`SELECT * FROM records WHERE collection <> 'notifications' OR owner_id = $1 ORDER BY created_at DESC`, [u.id])
      : many(`SELECT * FROM records WHERE (org_id = $1 AND collection <> 'notifications') OR (collection = 'notifications' AND owner_id = $2)
              ORDER BY created_at DESC`, [u.org_id, u.id]),
  ])

  const state = Object.fromEntries(COLLECTIONS.map((c) => [c, []]))
  state.organizations = orgs.map(orgOut)
  const student = u.role === 'student'
  const myGroups = new Set(groups.filter((g) => g.student_ids.includes(u.id)).map((g) => g.id))
  // Talaba boshqa o'quvchilarning telefon raqamlarini ko'rmaydi
  state.users = users.map((x) => userOut(x, !student || x.id === u.id))
  state.groups = (student ? groups.filter((g) => myGroups.has(g.id)) : groups).map(groupOut)

  const attempted = new Set()
  for (const r of records) if (r.collection === 'testAttempts' && r.owner_id === u.id) attempted.add(r.data.testId)
  for (const r of records) {
    if (!state[r.collection]) continue
    let item = recOut(r)
    if (student) {
      if (CONTENT.includes(r.collection)) {
        const ids = item.groupIds ?? (item.groupId ? [item.groupId] : [])
        if (ids.length && !ids.some((id) => myGroups.has(id))) continue
        if (r.collection === 'articles' && !item.published) continue
        // To'g'ri javoblar faqat test topshirilgandan keyin ko'rinadi
        if (r.collection === 'tests' && !attempted.has(r.id)) {
          item = { ...item, questions: (item.questions || []).map(({ correct, ...q }) => q) } // eslint-disable-line no-unused-vars
        }
      }
      if (['testAttempts', 'submissions', 'vocabProgress'].includes(r.collection) && r.owner_id !== u.id) continue
      // Boshqaruv jurnali (kim kimni qo'shdi va h.k.) o'quvchilarga yuborilmaydi
      if (r.collection === 'activity') continue
    }
    state[r.collection].push(item)
  }
  state.me = userOut(users.find((x) => x.id === u.id) || u, true)
  return state
}

// ---- Yozish ----
export async function applyOps(c, u, ops) {
  const out = []
  for (const op of ops) {
    if (!op || !COLLECTIONS.includes(op.col)) fail(422, 'Noma’lum bo‘lim')
    if (!['insert', 'patch', 'delete'].includes(op.op)) fail(422, 'Noma’lum amal')
    if (op.op === 'insert') { if (!op.item || typeof op.item !== 'object') fail(422, 'Ma’lumot yo‘q'); sizeOk(op.item) }
    if (op.op === 'patch') { if (!op.changes || typeof op.changes !== 'object') fail(422, 'Ma’lumot yo‘q'); sizeOk(op.changes) }
    const id = checkId(op.op === 'insert' ? op.item.id : op.id)
    const h = op.col === 'organizations' ? orgOps : op.col === 'users' ? userOps : op.col === 'groups' ? groupOps : recordOps
    out.push({ col: op.col, id, item: (await h[op.op](c, u, op, id)) ?? null, deleted: op.op === 'delete' })
  }
  return out
}

// ---- Tashkilotlar ----
const orgOps = {
  async insert(c, u, { item }, id) {
    if (!isSA(u)) deny()
    if (item.plan && !['basic', 'pro'].includes(item.plan)) fail(422, 'Tarif noto‘g‘ri')
    const name = text(item.name, { min: 2, max: 120, label: 'Tashkilot nomi' })
    const r = await row(c, `INSERT INTO organizations (id, name, status, data) VALUES ($1, $2, 'active', $3) ON CONFLICT (id) DO NOTHING RETURNING *`,
      [id, name, safeLinks(pick(item, ORG_FIELDS))])
    if (!r) fail(409, 'Bunday tashkilot allaqachon mavjud')
    return orgOut(r)
  },
  async patch(c, u, { changes }, id) {
    const o = await row(c, 'SELECT * FROM organizations WHERE id = $1', [id])
    if (!o) fail(404, 'Tashkilot topilmadi')
    if (!adminOf(u, o.id)) deny()
    const sa = isSA(u)
    if (!sa && ['status', 'plan', 'slug'].some((k) => changes[k] !== undefined && changes[k] !== (k === 'status' ? o.status : o.data[k]))) {
      deny('Tarif va holatni faqat bosh administrator o‘zgartiradi')
    }
    if (changes.status !== undefined && !['active', 'suspended'].includes(changes.status)) fail(422, 'Holat noto‘g‘ri')
    if (changes.plan !== undefined && !['basic', 'pro'].includes(changes.plan)) fail(422, 'Tarif noto‘g‘ri')
    const name = changes.name !== undefined ? text(changes.name, { min: 2, max: 120, label: 'Tashkilot nomi' }) : o.name
    const status = sa && changes.status ? changes.status : o.status
    const r = await row(c, 'UPDATE organizations SET name = $2, status = $3, data = data || $4 WHERE id = $1 RETURNING *',
      [id, name, status, safeLinks(pick(changes, ORG_FIELDS))])
    return orgOut(r)
  },
  async delete(c, u, op, id) {
    if (!isSA(u)) deny()
    // Foydalanuvchilar org_id = NULL bo'lib qolmasin (aks holda tashkilotsiz kira olishardi)
    await c.query(`DELETE FROM users WHERE org_id = $1 AND role <> 'superadmin'`, [id])
    await c.query('DELETE FROM organizations WHERE id = $1', [id])
  },
}

// ---- Foydalanuvchilar ----
async function teaches(c, teacherId, studentId) {
  return !!(await row(c, `SELECT 1 FROM group_members gm JOIN groups g ON g.id = gm.group_id WHERE g.teacher_id = $1 AND gm.user_id = $2`, [teacherId, studentId]))
}
async function canManageUser(c, u, t) {
  if (t.role === 'superadmin' || t.id === u.id) return false
  if (isSA(u)) return true
  if (u.role === 'org_admin') return t.org_id === u.org_id && t.role !== 'org_admin'
  if (u.role === 'teacher') return t.role === 'student' && t.org_id === u.org_id && (t.data?.createdBy === u.id || await teaches(c, u.id, t.id))
  return false
}
async function phoneFree(c, phone, exceptId) {
  if (await row(c, 'SELECT 1 FROM users WHERE phone = $1 AND id <> $2', [phone, exceptId || ''])) fail(409, 'Bu telefon raqam allaqachon ro‘yxatdan o‘tgan')
}

const userOps = {
  async insert(c, u, { item }, id) {
    const role = item.role
    if (!STAFF_ROLES.includes(role)) deny('Bu rolni yaratib bo‘lmaydi')
    const orgId = item.orgId
    if (!orgId || !(await row(c, 'SELECT 1 FROM organizations WHERE id = $1', [orgId]))) fail(422, 'Avval tashkilotni tanlang')
    const allowed = isSA(u)
      || (u.role === 'org_admin' && u.org_id === orgId && role !== 'org_admin')
      || (u.role === 'teacher' && u.org_id === orgId && role === 'student')
    if (!allowed) deny('Bu turdagi foydalanuvchini yaratishga ruxsatingiz yo‘q')
    const name = text(item.name, { min: 2, max: 100, label: 'Ism' })
    const phone = phoneDigits(item.phone)
    await phoneFree(c, phone)
    const hash = await password(item.password)
    const data = { ...pick(item, ['title', 'bio']), createdBy: u.id }
    const r = await row(c, `INSERT INTO users (id, org_id, role, name, phone, password_hash, avatar_color, status, data)
      VALUES ($1,$2,$3,$4,$5,$6,$7,'active',$8) ON CONFLICT (id) DO NOTHING RETURNING *`,
    [id, orgId, role, name, phone, hash, typeof item.avatarColor === 'string' ? item.avatarColor.slice(0, 20) : null, data])
    if (!r) fail(409, 'Foydalanuvchi allaqachon mavjud')
    return userOut(r, true)
  },
  async patch(c, u, { changes }, id) {
    const t = await row(c, 'SELECT * FROM users WHERE id = $1', [id])
    if (!t) fail(404, 'Foydalanuvchi topilmadi')
    const self = t.id === u.id
    const manage = await canManageUser(c, u, t)
    if (!self && !manage) deny()
    if ((changes.role !== undefined && changes.role !== t.role) || (changes.orgId !== undefined && changes.orgId !== t.org_id)) {
      deny('Rol va tashkilotni o‘zgartirib bo‘lmaydi')
    }
    const set = { name: t.name, phone: t.phone, avatar_color: t.avatar_color, status: t.status, password_hash: t.password_hash }
    if (changes.name !== undefined) set.name = text(changes.name, { min: 2, max: 100, label: 'Ism' })
    if (changes.avatarColor !== undefined) set.avatar_color = String(changes.avatarColor).slice(0, 20)
    if (changes.phone !== undefined && digits(changes.phone) !== t.phone) {
      if (!manage) deny('Telefon raqamni administrator o‘zgartiradi')
      set.phone = phoneDigits(changes.phone)
      await phoneFree(c, set.phone, t.id)
    }
    if (changes.status !== undefined && changes.status !== t.status) {
      if (!manage || !['active', 'blocked'].includes(changes.status)) deny()
      set.status = changes.status
    }
    if (changes.password) {
      // O'z parolini almashtirishda joriy parol talab qilinadi
      if (self && !(await bcrypt.compare(String(changes.currentPassword || ''), t.password_hash))) fail(422, 'Joriy parol noto‘g‘ri', { field: 'currentPassword' })
      set.password_hash = await password(changes.password)
    }
    const data = pick(changes, ['title', 'bio'])
    for (const k in data) data[k] = text(data[k], { max: 1000, label: 'Maydon' })
    const r = await row(c, `UPDATE users SET name = $2, phone = $3, avatar_color = $4, status = $5, password_hash = $6, data = data || $7
      WHERE id = $1 RETURNING *`, [id, set.name, set.phone, set.avatar_color, set.status, set.password_hash, data])
    return userOut(r, true)
  },
  async delete(c, u, op, id) {
    const t = await row(c, 'SELECT * FROM users WHERE id = $1', [id])
    if (!t) return
    if (t.id === u.id || t.role === 'superadmin') deny('Bu hisobni o‘chirib bo‘lmaydi')
    if (!(isSA(u) || (u.role === 'org_admin' && t.org_id === u.org_id && t.role !== 'org_admin'))) deny()
    await c.query('DELETE FROM users WHERE id = $1', [id])
  },
}

// ---- Guruhlar ----
async function validMembers(c, orgId, teacherId, studentIds) {
  if (teacherId && !(await row(c, `SELECT 1 FROM users WHERE id = $1 AND org_id = $2 AND role = 'teacher'`, [teacherId, orgId]))) fail(422, 'Ustoz topilmadi')
  if (studentIds !== undefined) {
    if (!Array.isArray(studentIds) || studentIds.length > 2000) fail(422, 'O‘quvchilar ro‘yxati noto‘g‘ri')
    const ids = [...new Set(studentIds.map(String))]
    const ok = ids.length ? await c.query(`SELECT id FROM users WHERE id = ANY($1) AND org_id = $2 AND role = 'student'`, [ids, orgId]) : { rowCount: 0 }
    if (ok.rowCount !== ids.length) fail(422, 'Guruhga faqat shu tashkilot o‘quvchilarini qo‘shish mumkin')
    return ids
  }
}
async function setMembers(c, groupId, ids) {
  await c.query('DELETE FROM group_members WHERE group_id = $1 AND NOT (user_id = ANY($2))', [groupId, ids])
  for (const sid of ids) await c.query('INSERT INTO group_members (group_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [groupId, sid])
}
const groupData = (o) => {
  const d = pick(o, GROUP_FIELDS)
  if (d.schedule !== undefined && (!Array.isArray(d.schedule) || d.schedule.length > 14)) fail(422, 'Jadval noto‘g‘ri')
  return d
}
const loadGroup = async (c, id) => groupOut(await row(c, `${GROUPS_SQL} WHERE g.id = $1 GROUP BY g.id`, [id]))

const groupOps = {
  async insert(c, u, { item }, id) {
    const orgId = item.orgId
    if (!orgId || !(await row(c, 'SELECT 1 FROM organizations WHERE id = $1', [orgId]))) fail(422, 'Avval tashkilotni tanlang')
    // Ustoz o'z tashkilotida faqat o'zi dars beradigan guruhni yaratadi
    const ownTeacher = u.role === 'teacher' && u.org_id === orgId && item.teacherId === u.id
    if (!adminOf(u, orgId) && !ownTeacher) deny('Ustoz faqat o‘zi dars beradigan guruhni yaratadi')
    const ids = await validMembers(c, orgId, item.teacherId, item.studentIds || [])
    const r = await row(c, `INSERT INTO groups (id, org_id, name, course, teacher_id, color, data) VALUES ($1,$2,$3,$4,$5,$6,$7)
      ON CONFLICT (id) DO NOTHING RETURNING id`,
    [id, orgId, text(item.name, { min: 1, max: 60, label: 'Guruh nomi' }), text(item.course, { min: 1, max: 160, label: 'Kurs' }),
      item.teacherId || null, item.color ? String(item.color).slice(0, 20) : null, groupData(item)])
    if (!r) fail(409, 'Guruh allaqachon mavjud')
    await setMembers(c, id, ids)
    return loadGroup(c, id)
  },
  async patch(c, u, { changes }, id) {
    const g = await row(c, 'SELECT * FROM groups WHERE id = $1', [id])
    if (!g) fail(404, 'Guruh topilmadi')
    const admin = adminOf(u, g.org_id)
    const own = u.role === 'teacher' && g.teacher_id === u.id
    if (!admin && !own) deny()
    if (!admin && changes.teacherId !== undefined && changes.teacherId !== g.teacher_id) deny('Ustozni faqat administrator biriktiradi')
    const teacherId = changes.teacherId !== undefined ? changes.teacherId || null : g.teacher_id
    const ids = await validMembers(c, g.org_id, changes.teacherId !== undefined ? teacherId : null, changes.studentIds)
    await c.query('UPDATE groups SET name = $2, course = $3, teacher_id = $4, color = $5, data = data || $6 WHERE id = $1', [
      id,
      changes.name !== undefined ? text(changes.name, { min: 1, max: 60, label: 'Guruh nomi' }) : g.name,
      changes.course !== undefined ? text(changes.course, { min: 1, max: 160, label: 'Kurs' }) : g.course,
      teacherId,
      changes.color !== undefined ? String(changes.color).slice(0, 20) : g.color,
      groupData(changes),
    ])
    if (ids) await setMembers(c, id, ids)
    return loadGroup(c, id)
  },
  async delete(c, u, op, id) {
    const g = await row(c, 'SELECT * FROM groups WHERE id = $1', [id])
    if (!g) return
    if (!adminOf(u, g.org_id)) deny()
    await c.query('DELETE FROM groups WHERE id = $1', [id])
  },
}

// ---- Kontent va shaxsiy yozuvlar (records) ----
const getRec = (c, col, id) => row(c, 'SELECT * FROM records WHERE collection = $1 AND id = $2', [col, id])
async function insertRec(c, col, id, orgId, ownerId, data) {
  const r = await row(c, `INSERT INTO records (collection, id, org_id, owner_id, data) VALUES ($1,$2,$3,$4,$5)
    ON CONFLICT DO NOTHING RETURNING *`, [col, id, orgId, ownerId, { ...data, id }])
  if (!r) fail(409, 'Yozuv allaqachon mavjud')
  return recOut(r)
}
const updateRec = async (c, col, id, data) =>
  recOut(await row(c, `UPDATE records SET data = $3, updated_at = now() WHERE collection = $1 AND id = $2 RETURNING *`, [col, id, data]))
const noKeys = (o, keys) => { for (const k of keys) delete o[k]; return o }
const isMemberOf = async (c, userId, groupId) => !!(await row(c, 'SELECT 1 FROM group_members WHERE group_id = $1 AND user_id = $2', [groupId, userId]))

// Test bali serverda hisoblanadi — brauzer yuborgan ball inobatga olinmaydi
const scoreOf = (test, answers) => (test.questions || []).reduce((s, q) => s + (answers?.[q.id] === q.correct ? 1 : 0), 0)

const recordOps = {
  async insert(c, u, { col, item }, id) {
    const now = Date.now()
    if (CONTENT.includes(col)) {
      if (u.role === 'student') deny()
      const orgId = item.orgId
      if (!orgId || !inOrg(u, orgId) || !(await row(c, 'SELECT 1 FROM organizations WHERE id = $1', [orgId]))) fail(422, 'Avval tashkilotni tanlang')
      if (col === 'homework' && !(await row(c, 'SELECT 1 FROM groups WHERE id = $1 AND org_id = $2', [item.groupId, orgId]))) fail(422, 'Guruhni tanlang')
      noInlineImages(item)
      return insertRec(c, col, id, orgId, u.id, safeLinks({ createdAt: now, ...item, orgId, authorId: u.id }))
    }
    if (col === 'testAttempts') {
      if (u.role !== 'student') deny('Testni faqat o‘quvchi topshiradi')
      const t = await getRec(c, 'tests', String(item.testId))
      if (!t || t.org_id !== u.org_id) fail(404, 'Test topilmadi')
      const dup = await row(c, `SELECT 1 FROM records WHERE collection = 'testAttempts' AND owner_id = $1 AND data->>'testId' = $2`, [u.id, t.id])
      if (dup) fail(409, 'Bu test allaqachon topshirilgan')
      const answers = item.answers && typeof item.answers === 'object' ? item.answers : {}
      return insertRec(c, col, id, t.org_id, u.id, {
        testId: t.id, studentId: u.id, answers, score: scoreOf(t.data, answers), total: (t.data.questions || []).length,
        startedAt: Number(item.startedAt) || now, finishedAt: now,
      })
    }
    if (col === 'submissions') {
      if (u.role !== 'student') deny('Vazifani faqat o‘quvchi topshiradi')
      const h = await getRec(c, 'homework', String(item.homeworkId))
      if (!h || h.org_id !== u.org_id || !(await isMemberOf(c, u.id, h.data.groupId))) fail(404, 'Vazifa topilmadi')
      return insertRec(c, col, id, h.org_id, u.id, {
        homeworkId: h.id, studentId: u.id, text: text(item.text, { min: 1, max: 20000, label: 'Javob' }), submittedAt: now, status: 'submitted',
      })
    }
    if (col === 'vocabProgress') {
      const s = await getRec(c, 'vocabSets', String(item.setId))
      if (!s || s.org_id !== u.org_id) fail(404, 'To‘plam topilmadi')
      return insertRec(c, col, id, s.org_id, u.id, { setId: s.id, studentId: u.id, learned: Array.isArray(item.learned) ? item.learned.slice(0, 5000).map(String) : [] })
    }
    if (col === 'notifications') {
      const t = await row(c, 'SELECT id, org_id, role FROM users WHERE id = $1', [String(item.userId)])
      // Foydalanuvchi o'chirilgan yoki boshqa tashkilotda — bildirishnoma jim o'tkazib yuboriladi (asosiy amal buzilmasin).
      // Bosh admin muallif bo'lgan kontent bo'yicha xabarlar (test topshirildi va h.k.) unga yetadi.
      if (!t || !(isSA(u) || t.org_id === u.org_id || t.role === 'superadmin')) return null
      return insertRec(c, col, id, t.org_id, t.id, safeLinks({
        userId: t.id, text: text(item.text, { min: 1, max: 500, label: 'Matn' }), href: item.href || null, at: now, read: false,
      }))
    }
    if (col === 'activity') {
      const orgId = item.orgId || null
      if (!isSA(u) && orgId !== u.org_id) deny()
      if (orgId && !(await row(c, 'SELECT 1 FROM organizations WHERE id = $1', [orgId]))) return null
      return insertRec(c, col, id, orgId, u.id, {
        orgId, userId: u.id, text: text(item.text, { max: 200, label: 'Matn' }), target: text(item.target, { max: 300, label: 'Matn' }), at: now,
      })
    }
    deny()
  },

  async patch(c, u, { col, changes }, id) {
    const r = await getRec(c, col, id)
    if (!r) fail(404, 'Yozuv topilmadi (ehtimol o‘chirilgan)')
    const d = r.data
    if (CONTENT.includes(col)) {
      if (!inOrg(u, r.org_id)) deny()
      const manage = adminOf(u, r.org_id) || r.owner_id === u.id
      const counters = COUNTERS[col] || []
      const keys = Object.keys(changes)
      if (!manage || keys.every((k) => counters.includes(k))) {
        if (keys.some((k) => !counters.includes(k))) deny()
        const next = { ...d }
        if (keys.includes('views')) next.views = (Number(d.views) || 0) + 1
        if (keys.includes('downloads')) next.downloads = (Number(d.downloads) || 0) + 1
        if (keys.includes('readBy')) next.readBy = [...new Set([...(d.readBy || []), u.id])]
        return updateRec(c, col, id, next)
      }
      noInlineImages(changes)
      return updateRec(c, col, id, safeLinks({ ...d, ...noKeys({ ...changes }, ['id', 'orgId', 'authorId']) }))
    }
    if (col === 'submissions') {
      if (r.owner_id === u.id) {
        if (d.status === 'graded') deny('Baholangan javobni o‘zgartirib bo‘lmaydi')
        return updateRec(c, col, id, { ...d, text: text(changes.text ?? d.text, { min: 1, max: 20000, label: 'Javob' }), submittedAt: Date.now() })
      }
      const h = await getRec(c, 'homework', d.homeworkId)
      const g = h && await row(c, 'SELECT teacher_id FROM groups WHERE id = $1', [h.data.groupId])
      if (!h || !(adminOf(u, h.org_id) || h.owner_id === u.id || g?.teacher_id === u.id)) deny()
      const grade = Number(changes.grade)
      if (changes.grade !== undefined && (!Number.isFinite(grade) || grade < 0 || grade > (Number(h.data.maxGrade) || 100))) fail(422, 'Baho noto‘g‘ri')
      return updateRec(c, col, id, { ...d, ...pick(changes, ['status', 'grade', 'feedback', 'gradedAt']), gradedBy: u.id })
    }
    if (col === 'vocabProgress') {
      if (r.owner_id !== u.id) deny()
      return updateRec(c, col, id, { ...d, learned: Array.isArray(changes.learned) ? changes.learned.slice(0, 5000).map(String) : d.learned })
    }
    if (col === 'notifications') {
      if (r.owner_id !== u.id) deny()
      return updateRec(c, col, id, { ...d, read: !!changes.read })
    }
    deny()
  },

  async delete(c, u, { col }, id) {
    const r = await getRec(c, col, id)
    if (!r) return
    const ok = CONTENT.includes(col) ? adminOf(u, r.org_id) || r.owner_id === u.id
      : col === 'notifications' ? r.owner_id === u.id
        : ['testAttempts', 'submissions'].includes(col) ? adminOf(u, r.org_id)
          : false
    if (!ok) deny()
    await c.query('DELETE FROM records WHERE collection = $1 AND id = $2', [col, id])
    // Test / vazifa o'chirilsa — unga bog'liq natijalar ham
    if (col === 'tests') await c.query(`DELETE FROM records WHERE collection = 'testAttempts' AND data->>'testId' = $1`, [id])
    if (col === 'homework') await c.query(`DELETE FROM records WHERE collection = 'submissions' AND data->>'homeworkId' = $1`, [id])
    if (col === 'vocabSets') await c.query(`DELETE FROM records WHERE collection = 'vocabProgress' AND data->>'setId' = $1`, [id])
  },
}
