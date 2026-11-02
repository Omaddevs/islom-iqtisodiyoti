// Autentifikatsiya: httpOnly cookie ichida JWT (HS256).
// Dars xonasi uchun alohida qisqa muddatli "ticket" (WebSocket ulanishida ishlatiladi).
import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'
import { config } from './config.js'
import { one } from './db.js'
import { fail } from './http.js'

export const SESSION_COOKIE = 'ii_session'
const SESSION_TTL = 60 * 60 * 24 * 14 // 14 kun

export async function signSession(user) {
  return new SignJWT({ role: user.role, org: user.org_id ?? null })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL}s`)
    .sign(config.jwtSecret)
}

export const sessionCookie = (token) => ({
  name: SESSION_COOKIE,
  value: token,
  httpOnly: true,
  sameSite: 'lax',
  secure: config.isProd,
  path: '/',
  maxAge: SESSION_TTL,
})

export const publicUser = (u) => u && ({
  id: u.id, orgId: u.org_id, role: u.role, name: u.name, phone: u.phone, avatarColor: u.avatar_color, status: u.status,
})

// Joriy foydalanuvchi (yoki null). Har safar bazadan o'qiladi: bloklangan akkaunt darhol chiqib ketadi.
export async function currentUser() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value
  if (!token) return null
  try {
    const { payload } = await jwtVerify(token, config.jwtSecret, { algorithms: ['HS256'] })
    // Bloklangan akkaunt yoki to'xtatilgan tashkilot a'zosi darhol chiqib ketadi
    return await one(`SELECT u.* FROM users u LEFT JOIN organizations o ON o.id = u.org_id
      WHERE u.id = $1 AND u.status = 'active' AND (u.role = 'superadmin' OR o.status = 'active')`, [payload.sub])
  } catch {
    return null
  }
}

export async function requireUser() {
  const u = await currentUser()
  if (!u) fail(401, 'Tizimga kiring')
  return u
}

export { signRoomTicket, verifyRoomTicket } from './tickets.js'
