// O'zlashtirish ko'rsatkichi: guruh bo'yicha (ustoz, administrator) yoki o'quvchining o'zi bo'yicha.
// Ballar saqlanmaydi — har so'rovda xom ma'lumotdan hisoblanadi (lib/mastery.js).
import { json, route, fail } from '@/lib/http.js'
import { requireUser } from '@/lib/auth.js'
import { one } from '@/lib/db.js'
import { computeGroup } from '@/lib/mastery.js'

export const GET = route(async (req) => {
  const u = await requireUser()
  const groupId = String(req.nextUrl.searchParams.get('groupId') || '')
  const g = groupId && await one('SELECT id, org_id, teacher_id FROM groups WHERE id = $1', [groupId])
  if (!g) fail(404, 'Guruh topilmadi')
  let onlyStudent = null
  if (u.role === 'student') {
    if (!(await one('SELECT 1 FROM group_members WHERE group_id = $1 AND user_id = $2', [g.id, u.id]))) fail(404, 'Guruh topilmadi')
    onlyStudent = u.id
  } else {
    const ok = u.role === 'superadmin' || (u.org_id === g.org_id && (u.role === 'org_admin'
      || (u.role === 'teacher' && !!(await one('SELECT 1 FROM group_teachers WHERE group_id = $1 AND user_id = $2', [g.id, u.id])))))
    if (!ok) fail(403, 'Bu guruh natijalarini ko‘rishga ruxsat yo‘q')
  }
  return json(await computeGroup(g.id, { onlyStudent }))
})
