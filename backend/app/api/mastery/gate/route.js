// Darsga bog'langan test o'quvchi uchun ochiqmi: davomat qayd etilgan yoki standart ochilgan bo'lishi kerak.
import { json, route } from '@/lib/http.js'
import { requireUser } from '@/lib/auth.js'
import { testGate } from '@/lib/mastery.js'

export const GET = route(async (req) => {
  const u = await requireUser()
  if (u.role !== 'student') return json({ locked: false })
  return json(await testGate(u.id, String(req.nextUrl.searchParams.get('testId') || '').slice(0, 80)))
})
