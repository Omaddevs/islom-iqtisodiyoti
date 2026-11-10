// Bitta sahifa rasmi: faqat ruxsati bor foydalanuvchiga, keshlanmasdan beriladi.
import { readFile } from 'node:fs/promises'
import { route, fail } from '@/lib/http.js'
import { requireUser } from '@/lib/auth.js'
import { rateLimit } from '@/lib/rateLimit.js'
import { ensurePage, requireView } from '@/lib/materials.js'

export const GET = route(async (_req, { id, n }) => {
  const u = await requireUser()
  const f = await requireView(u, id)
  const page = Number(n)
  if (f.kind !== 'pages' || f.status !== 'ready' || !Number.isInteger(page) || page < 1 || page > f.pages) fail(404, 'Sahifa topilmadi')
  // Odatdagi o'qish tezligidan ancha yuqori: butun hujjatni avtomatik yig'ib olishni qiyinlashtiradi
  const rl = rateLimit(`mpage:${u.id}`, { limit: 240, windowMs: 60e3 })
  if (!rl.ok) fail(429, 'Sahifalar juda tez so‘ralmoqda', { retryAfter: rl.retryAfter })
  const body = await readFile(await ensurePage(f.id, page))
  return new Response(body, {
    headers: { 'Content-Type': 'image/jpeg', 'Content-Length': String(body.length), 'Cache-Control': 'private, no-store', 'Content-Disposition': 'inline', 'X-Content-Type-Options': 'nosniff' },
  })
})
