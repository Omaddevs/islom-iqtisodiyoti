// Fayl holati: ko'ruvchi tayyor bo'lishini shu orqali kutadi
import { json, route } from '@/lib/http.js'
import { requireUser } from '@/lib/auth.js'
import { enqueue, fileOut, requireView } from '@/lib/materials.js'

export const GET = route(async (_req, { id }) => {
  const u = await requireUser()
  const f = await requireView(u, id)
  if (f.status === 'processing') enqueue(f.id) // Server qayta yongan bo'lsa, ish davom etadi
  return json(fileOut(f, u), { headers: { 'Cache-Control': 'no-store' } })
})
