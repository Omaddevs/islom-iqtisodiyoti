// Bitta o'quvchining faolligi (ustoz, admin yoki o'quvchining o'zi uchun)
import { json, route, fail } from '@/lib/http.js'
import { requireUser } from '@/lib/auth.js'
import { canViewStudent, studentActivity } from '@/lib/study.js'

export const GET = route(async (req, { id }) => {
  const u = await requireUser()
  if (!(await canViewStudent(u, id))) fail(403, 'Bu o‘quvchi statistikasini ko‘rishga ruxsat yo‘q')
  const days = Math.max(1, Math.min(365, Number(req.nextUrl.searchParams.get('days')) || 30))
  return json(await studentActivity(id, days))
})
