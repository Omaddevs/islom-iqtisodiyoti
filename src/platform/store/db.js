// Platforma ma'lumotlari ombori. Manba — server (PostgreSQL): kirishda yuklanadi, xotirada saqlanadi.
// Sahifalar avvalgidek add / patch / remove / setDB chaqiradi: har bir o'zgarish darhol ekranda ko'rinadi,
// farqi esa (insert / patch / delete) serverga navbat bilan yuboriladi. Server rad etsa — xato
// ko'rsatiladi va holat serverdagi haqiqiy ma'lumot bilan qayta yuklanadi.
import { useSyncExternalStore } from 'react'
import { api } from '../api/client.js'
import { uid } from './ids.js'

// Tartib muhim: avval tashkilot, keyin foydalanuvchi, keyin guruh, keyin kontent
export const COLLECTIONS = ['organizations', 'users', 'groups', 'videos', 'tests', 'testAttempts', 'vocabSets', 'vocabProgress', 'library', 'articles', 'homework', 'submissions', 'notifications', 'activity']
// Darslar o'z API'si orqali sinxronlanadi (api/meetings.js) — bu yerdan serverga yuborilmaydi
const LOCAL = ['meetings', 'messages']
// Faqat qo'shiladigan jurnallar: ro'yxatni qisqartirish (slice) serverdan o'chirish degani emas
const APPEND_ONLY = new Set(['activity', 'notifications'])

const empty = () => ({ version: 1, ...Object.fromEntries([...COLLECTIONS, ...LOCAL].map((c) => [c, []])) })

// Eski demo rejimdan brauzerda qolgan ma'lumotlar (baza, sessiya, arizalar) — tozalanadi
try { ['ii_platform_db_v1', 'ii_session_v1', 'ii_leads'].forEach((k) => localStorage.removeItem(k)) } catch { /* ruxsat yo'q */ }

let state = empty()
const listeners = new Set()
const emit = () => listeners.forEach((l) => l())
const subscribe = (l) => { listeners.add(l); return () => listeners.delete(l) }

export const getDB = () => state
export const useDB = () => useSyncExternalStore(subscribe, getDB)

// ---- Xatolar va sessiya tugashi haqida xabar ----
const errorSubs = new Set()
export const onSyncError = (f) => { errorSubs.add(f); return () => errorSubs.delete(f) }
const report = (e) => errorSubs.forEach((f) => f(e))

// ---- Server bilan almashinuv ----
// Ikki holat orasidagi farq → serverga yuboriladigan amallar
function diff(prev, next) {
  const up = [], del = []
  for (const col of COLLECTIONS) {
    const a = prev[col], b = next[col]
    if (a === b || !a || !b) continue
    const old = new Map(a.map((x) => [x.id, x]))
    const seen = new Set()
    for (const x of b) {
      seen.add(x.id)
      const o = old.get(x.id)
      if (!o) { up.push({ col, op: 'insert', item: x }); continue }
      if (o === x) continue
      const changes = {}
      for (const k of new Set([...Object.keys(o), ...Object.keys(x)])) if (o[k] !== x[k]) changes[k] = x[k]
      if (Object.keys(changes).length) up.push({ col, op: 'patch', id: x.id, changes })
    }
    if (!APPEND_ONLY.has(col)) for (const o of a) if (!seen.has(o.id)) del.push({ col, op: 'delete', id: o.id })
  }
  // O'chirish teskari tartibda: avval bog'liq yozuvlar, keyin ularning egasi
  return [...up, ...del.reverse()]
}

// Parol hech qachon xotirada qolmaydi — serverga yuborilgach olib tashlanadi
const stripSecrets = (s) => (s.users.some((u) => 'password' in u || 'currentPassword' in u)
  ? { ...s, users: s.users.map(({ password, currentPassword, ...u }) => u) } // eslint-disable-line no-unused-vars
  : s)

let chain = Promise.resolve()
let gen = 0 // xatodan keyin navbatdagi eskirgan to'plamlar tashlab yuboriladi

async function load() {
  const { me, ...cols } = await api('/api/data')
  state = { ...empty(), ...Object.fromEntries(COLLECTIONS.map((c) => [c, cols[c] || []])), meetings: state.meetings }
  emit()
  return me
}

// Server qaytargan yakuniy yozuvlar (masalan, serverda hisoblangan test bali) lokal nusxaning o'rniga qo'yiladi
function applyResults(results) {
  let s = state
  for (const r of results) {
    if (r.deleted) continue
    const list = s[r.col]
    const has = list.some((x) => x.id === r.id)
    s = { ...s, [r.col]: !r.item ? list.filter((x) => x.id !== r.id) : has ? list.map((x) => (x.id === r.id ? r.item : x)) : [r.item, ...list] }
  }
  state = s
  emit()
}

function push(ops) {
  const g = gen
  chain = chain.then(async () => {
    if (g !== gen) return
    try {
      const { results } = await api('/api/data', { method: 'POST', body: { ops } })
      applyResults(results)
    } catch (e) {
      gen++
      report(e)
      await load().catch(() => {})
    }
  })
  return chain
}

export const setDB = (updater) => {
  const prev = state
  const next = typeof updater === 'function' ? updater(prev) : updater
  if (next === prev) return
  const ops = diff(prev, next)
  state = stripSecrets(next)
  emit()
  if (ops.length) push(ops)
}

// Natijasi kutiladigan amal (parol almashtirish, test topshirish): avval server tasdiqlaydi,
// keyin lokal holat yangilanadi. Xato bo'lsa — chaqiruvchiga qaytariladi (forma ichida ko'rsatish uchun)
export const commit = (ops) => {
  const p = chain.then(async () => {
    const { results } = await api('/api/data', { method: 'POST', body: { ops } })
    applyResults(results)
    return results
  })
  chain = p.catch(() => {})
  return p
}

// Navbatdagi barcha o'zgarishlar serverga yetib borgunicha kutish
export const flush = () => chain
// Serverdan qayta yuklash (navbatdagi o'zgarishlardan keyin). `me` — joriy foydalanuvchi
export const loadDB = () => {
  const p = chain.then(load)
  // Sessiya tugagan yoki hisob bloklangan bo'lsa (davriy yangilanishda ham) — tizimdan chiqariladi
  chain = p.catch((e) => { if (e.status === 401) report(e) }) // navbat hech qachon "rad etilgan" holatda qolmasin
  return p
}
export const clearDB = () => { gen++; state = empty(); emit() }

// ---- Umumiy CRUD ----
export const add = (col, item) => {
  const full = { id: uid(col.slice(0, 2)), createdAt: Date.now(), ...item }
  setDB((s) => ({ ...s, [col]: [full, ...s[col]] }))
  return full
}
export const patch = (col, id, changes) =>
  setDB((s) => ({ ...s, [col]: s[col].map((x) => (x.id === id ? { ...x, ...(typeof changes === 'function' ? changes(x) : changes) } : x)) }))
export const remove = (col, id) => setDB((s) => ({ ...s, [col]: s[col].filter((x) => x.id !== id) }))
export const byId = (col, id) => state[col].find((x) => x.id === id)

export const logActivity = (orgId, userId, text, target) =>
  setDB((s) => ({ ...s, activity: [{ id: uid('ac'), orgId, userId, text, target, at: Date.now() }, ...s.activity].slice(0, 200) }))

export const notify = (userIds, text, href) => {
  const ids = [].concat(userIds).filter(Boolean)
  if (!ids.length) return
  setDB((s) => ({
    ...s,
    notifications: [
      ...ids.map((userId) => ({ id: uid('n'), userId, text, href, at: Date.now(), read: false })),
      ...s.notifications,
    ].slice(0, 500),
  }))
}

// Bosh admin «Barcha tashkilotlar» rejimida kontent yaratsa — u qaysi tashkilotga tegishli ekani noma'lum
export const NO_ORG = 'Avval tashkilotni tanlang: yuqoridagi «Barcha tashkilotlar» menyusidan (tashkilot bo‘lmasa — «Tashkilotlar» bo‘limida yarating)'

// ---- Ko'rinish doirasi (scope) ----
// Har bir rol qaysi ma'lumotlarni ko'rishini bitta joyda hisoblaymiz.
export function scopeFor(db, user, viewOrgId) {
  const orgId = user.role === 'superadmin' ? viewOrgId : user.orgId
  const inOrg = (x) => !orgId || x.orgId === orgId
  let groups = db.groups.filter(inOrg)
  if (user.role === 'teacher') groups = groups.filter((g) => g.teacherId === user.id)
  if (user.role === 'student') groups = groups.filter((g) => g.studentIds.includes(user.id))
  const gids = new Set(groups.map((g) => g.id))
  const isStaff = user.role !== 'student'
  const own = (x) => x.authorId === user.id || x.hostId === user.id
  // Guruhga bog'liq kontent: admin hammasini, ustoz o'z guruhlari + o'zi yaratganini, talaba faqat o'z guruhlarini ko'radi
  const byGroups = (x) => {
    if (!inOrg(x)) return false
    if (user.role === 'superadmin' || user.role === 'org_admin') return true
    const ids = x.groupIds ?? (x.groupId ? [x.groupId] : [])
    if (ids.length === 0) return isStaff || x.groupIds !== undefined // groupIds: [] = butun tashkilot uchun
    return ids.some((id) => gids.has(id)) || (isStaff && own(x))
  }
  const users = db.users.filter((u) => u.role !== 'superadmin' && inOrg(u))
  const students = users.filter((u) => u.role === 'student')
  const teachers = users.filter((u) => u.role === 'teacher')
  const myStudents = user.role === 'teacher'
    ? students.filter((s) => groups.some((g) => g.studentIds.includes(s.id)))
    : students
  return {
    orgId,
    org: db.organizations.find((o) => o.id === orgId) || null,
    groups,
    groupIds: gids,
    users,
    students,
    teachers,
    myStudents,
    meetings: db.meetings.filter(byGroups),
    videos: db.videos.filter(byGroups),
    tests: db.tests.filter(byGroups),
    vocabSets: db.vocabSets.filter(byGroups),
    library: db.library.filter(byGroups),
    articles: db.articles.filter(byGroups),
    homework: db.homework.filter(byGroups),
    activity: db.activity.filter(inOrg),
  }
}

// Ruxsatlar: bitta jadval, sahifalarda `can('users.create')` tarzida ishlatiladi.
// Bu faqat interfeys uchun — haqiqiy tekshiruv serverda (backend/lib/platform.js).
const PERMS = {
  superadmin: ['*'],
  org_admin: ['users.create', 'users.manage', 'teachers.create', 'groups.create', 'groups.manage', 'content.create', 'content.manage', 'org.settings', 'reports.view'],
  teacher: ['students.create', 'groups.create', 'groups.assign', 'content.create', 'content.own', 'homework.grade', 'meetings.host'],
  student: ['content.view', 'homework.submit', 'tests.take'],
}
export const can = (user, perm) => !!user && (PERMS[user.role].includes('*') || PERMS[user.role].includes(perm))
