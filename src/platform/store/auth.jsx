import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { useDB, loadDB, clearDB, onSyncError, scopeFor, can as canFn } from './db.js'
import { authApi } from '../api/client.js'

// Sessiya — serverdagi httpOnly cookie. Brauzerda faqat bosh admin tanlagan tashkilot eslab qolinadi.
const VIEW_KEY = 'ii_view_org'
const readView = () => { try { return localStorage.getItem(VIEW_KEY) || null } catch { return null } }
const AuthCtx = createContext(null)

export function AuthProvider({ children }) {
  const db = useDB()
  const [meId, setMeId] = useState(null)
  const [ready, setReady] = useState(false) // birinchi tekshiruv tugadimi
  const [viewOrg, setViewOrgState] = useState(readView)

  // Sahifa ochilganda: cookie amal qilsa — ma'lumotlar yuklanadi
  useEffect(() => {
    loadDB().then((me) => setMeId(me.id)).catch(() => setMeId(null)).finally(() => setReady(true))
  }, [])

  // Sessiya muddati tugasa yoki hisob bloklansa — tizimdan chiqariladi
  useEffect(() => onSyncError((e) => { if (e.status === 401) { clearDB(); setMeId(null) } }), [])

  const user = useMemo(() => (meId ? db.users.find((u) => u.id === meId) || null : null), [db.users, meId])

  // Bosh admin qaysi tashkilot ichida ishlayotgani (null = barcha tashkilotlar)
  // Yagona tashkilot bo'lsa — avtomatik o'sha tanlanadi (bosh admin darhol kontent qo'sha oladi)
  const viewOrgId = user?.role === 'superadmin'
    ? (viewOrg && db.organizations.some((o) => o.id === viewOrg) ? viewOrg : db.organizations.length === 1 ? db.organizations[0].id : null)
    : user?.orgId ?? null

  const login = useCallback(async (phone, password) => {
    try {
      await authApi.login(phone, password)
      const me = await loadDB()
      setMeId(me.id)
      return { ok: true, user: me }
    } catch (e) {
      return { ok: false, error: e.message }
    }
  }, [])

  const setViewOrg = useCallback((orgId) => {
    setViewOrgState(orgId)
    try { orgId ? localStorage.setItem(VIEW_KEY, orgId) : localStorage.removeItem(VIEW_KEY) } catch { /* ruxsat yo'q */ }
  }, [])

  const logout = useCallback(() => {
    authApi.logout().catch(() => {})
    clearDB()
    setMeId(null)
    setViewOrg(null)
  }, [setViewOrg])

  const scope = useMemo(() => (user ? scopeFor(db, user, viewOrgId) : null), [db, user, viewOrgId])
  const can = useCallback((perm) => canFn(user, perm), [user])

  const value = useMemo(() => ({ db, user, ready, scope, viewOrgId, login, logout, setViewOrg, can }), [db, user, ready, scope, viewOrgId, login, logout, setViewOrg, can])
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>
}

export const useAuth = () => useContext(AuthCtx)
