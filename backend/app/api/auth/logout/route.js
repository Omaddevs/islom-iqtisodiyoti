import { json, route } from '@/lib/http.js'
import { SESSION_COOKIE } from '@/lib/auth.js'

export const POST = route(async () => {
  const res = json({ ok: true })
  res.cookies.set({ name: SESSION_COOKIE, value: '', path: '/', maxAge: 0 })
  return res
})
