// Mijoz tomonidagi reaktiv ma'lumotlar ombori (localStorage). Backend ulanganda
// shu modul API-ga so'rov yuboruvchi qatlam bilan almashtiriladi — sahifalar o'zgarmaydi.
import { useSyncExternalStore } from 'react'
import { makeSeed } from './seed.js'
import { uid, digits } from './ids.js'

const KEY = 'ii_platform_db_v1'
const listeners = new Set()

const load = () => {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const data = JSON.parse(raw)
    return data && data.version === 1 ? data : null
  } catch { return null }
}
const save = (s) => { try { localStorage.setItem(KEY, JSON.stringify(s)) } catch { /* xotira to'la */ } }

let state = load() || makeSeed()
if (!load()) save(state)

const emit = () => listeners.forEach((l) => l())
const subscribe = (l) => { listeners.add(l); return () => listeners.delete(l) }

export const getDB = () => state
export const setDB = (updater) => {
  state = typeof updater === 'function' ? updater(state) : updater
  save(state)
  emit()
}
export const resetDB = () => { state = makeSeed(); save(state); emit() }
export const useDB = () => useSyncExternalStore(subscribe, getDB)

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

export const notify = (userIds, text, href) =>
  setDB((s) => ({
    ...s,
    notifications: [
      ...[].concat(userIds).map((userId) => ({ id: uid('n'), userId, text, href, at: Date.now(), read: false })),
      ...s.notifications,
    ].slice(0, 500),
  }))

// ---- Autentifikatsiya yordamchilari ----
export const findByPhone = (phone) => state.users.find((u) => digits(u.phone) === digits(phone))

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

// Ruxsatlar: bitta jadval, sahifalarda `can('users.create')` tarzida ishlatiladi
const PERMS = {
  superadmin: ['*'],
  org_admin: ['users.create', 'users.manage', 'teachers.create', 'groups.manage', 'content.create', 'content.manage', 'org.settings', 'reports.view'],
  teacher: ['students.create', 'groups.assign', 'content.create', 'content.own', 'homework.grade', 'meetings.host'],
  student: ['content.view', 'homework.submit', 'tests.take'],
}
export const can = (user, perm) => !!user && (PERMS[user.role].includes('*') || PERMS[user.role].includes(perm))
