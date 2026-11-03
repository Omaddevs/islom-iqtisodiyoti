import { createHash } from 'node:crypto'
import { NextResponse } from 'next/server'
import { json, route, fail } from '@/lib/http.js'
import { requireUser, signSession, sessionCookie } from '@/lib/auth.js'
import { tx, one } from '@/lib/db.js'
import { loadState, applyOps } from '@/lib/platform.js'

// Joriy foydalanuvchi ko'radigan barcha platforma ma'lumotlari (kirishda va har 30 soniyada).
// ETag: ma'lumot o'zgarmagan bo'lsa brauzer 304 oladi va keshdagi nusxani ishlatadi — trafik tejaladi.
export const GET = route(async (req) => {
  const u = await requireUser()
  const body = JSON.stringify(await loadState(u))
  const etag = `"${createHash('sha1').update(body).digest('base64url')}"`
  const headers = { 'Cache-Control': 'private, no-cache', ETag: etag, Vary: 'Cookie' }
  if (req.headers.get('if-none-match') === etag) return new NextResponse(null, { status: 304, headers })
  return new NextResponse(body, { headers: { ...headers, 'Content-Type': 'application/json' } })
})

// O'zgarishlar to'plami: hammasi bitta tranzaksiyada — biri rad etilsa, hech biri saqlanmaydi
export const POST = route(async (req) => {
  const u = await requireUser()
  if (Number(req.headers.get('content-length') || 0) > 8 * 1024 * 1024) fail(413, 'So‘rov hajmi juda katta')
  let data
  try { data = await req.json() } catch { fail(400, 'So‘rov tanasi JSON bo‘lishi kerak') }
  const ops = data?.ops
  if (!Array.isArray(ops) || ops.length === 0 || ops.length > 500) fail(422, 'O‘zgarishlar ro‘yxati noto‘g‘ri')
  const results = await tx((c) => applyOps(c, u, ops))
  const res = json({ results })
  // O'z parolini almashtirgan foydalanuvchi: eski sessiyalar bekor, joriy qurilmaga yangi sessiya
  if (ops.some((o) => o.col === 'users' && o.op === 'patch' && o.id === u.id && o.changes?.password)) {
    res.cookies.set(sessionCookie(await signSession(await one('SELECT * FROM users WHERE id = $1', [u.id]))))
  }
  return res
})
