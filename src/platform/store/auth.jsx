import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { useDB, findByPhone, patch, scopeFor, can as canFn } from './db.js'

const SESSION_KEY = 'ii_session_v1'
const AuthCtx = createContext(null)

const readSession = () => {
  try { return JSON.parse(localStorage.getItem(SESSION_KEY)) || null } catch { return null }
}

export function AuthProvider({ children }) {
  const db = useDB()
  const [session, setSession] = useState(readSession)

  useEffect(() => {
    if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session))
    else localStorage.removeItem(SESSION_KEY)
  }, [session])

  const user = useMemo(() => (session ? db.users.find((u) => u.id === session.userId) || null : null), [db.users, session])

  // Bosh admin qaysi tashkilot ichida ishlayotgani (null = barcha tashkilotlar)
  const viewOrgId = user?.role === 'superadmin' ? session?.viewOrgId ?? null : user?.orgId ?? null

  const login = useCallback((phone, password) => {
    const u = findByPhone(phone)
    if (!u || u.password !== password) return { ok: false, error: 'Telefon raqam yoki parol noto‘g‘ri' }
    if (u.status === 'blocked') return { ok: false, error: 'Hisobingiz bloklangan. Administrator bilan bog‘laning' }
    patch('users', u.id, { lastSeen: Date.now() })
    setSession({ userId: u.id, viewOrgId: u.role === 'superadmin' ? null : u.orgId, at: Date.now() })
    return { ok: true, user: u }
  }, [])

  const logout = useCallback(() => setSession(null), [])
  const setViewOrg = useCallback((orgId) => setSession((s) => (s ? { ...s, viewOrgId: orgId } : s)), [])

  const scope = useMemo(() => (user ? scopeFor(db, user, viewOrgId) : null), [db, user, viewOrgId])
  const can = useCallback((perm) => canFn(user, perm), [user])

  const value = useMemo(() => ({ db, user, scope, viewOrgId, login, logout, setViewOrg, can }), [db, user, scope, viewOrgId, login, logout, setViewOrg, can])
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>
}

export const useAuth = () => useContext(AuthCtx)
