// Ko'ruvchiga tegishli o'quvchilar: davr bo'yicha sarflangan vaqt (O'quvchilarim jadvali uchun)
import { json, route, fail } from '@/lib/http.js'
import { requireUser } from '@/lib/auth.js'
import { studentsOverview, tashkentToday } from '@/lib/study.js'

export const GET = route(async (req) => {
  const u = await requireUser()
  if (u.role === 'student') fail(403, 'Ruxsat yo‘q')
  const sp = req.nextUrl.searchParams
  const days = Math.max(1, Math.min(365, Number(sp.get('days')) || 7))
  return json({ days, today: tashkentToday(), students: await studentsOverview(u, days, sp.get('orgId') || null) })
})
