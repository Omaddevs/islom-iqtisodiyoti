// Audio va video: bo'lib-bo'lib uzatiladi (Range). Keshlanmaydi, faqat ruxsati bor foydalanuvchiga beriladi.
import { createReadStream } from 'node:fs'
import { Readable } from 'node:stream'
import { route, fail } from '@/lib/http.js'
import { requireUser } from '@/lib/auth.js'
import { MEDIA, requireView, sourcePath } from '@/lib/materials.js'

export const GET = route(async (req, { id }) => {
  const u = await requireUser()
  const f = await requireView(u, id)
  if (f.kind !== 'video' && f.kind !== 'audio') fail(404, 'Fayl topilmadi')
  const size = Number(f.size)
  const base = { 'Content-Type': MEDIA[f.ext], 'Accept-Ranges': 'bytes', 'Cache-Control': 'private, no-store', 'Content-Disposition': 'inline', 'X-Content-Type-Options': 'nosniff' }
  const m = /^bytes=(\d*)-(\d*)$/.exec(req.headers.get('range') || '')
  if (!m || (!m[1] && !m[2])) {
    return new Response(Readable.toWeb(createReadStream(sourcePath(f.id))), { headers: { ...base, 'Content-Length': String(size) } })
  }
  const start = m[1] ? Number(m[1]) : Math.max(0, size - Number(m[2]))
  const end = m[1] && m[2] ? Math.min(Number(m[2]), size - 1) : size - 1
  if (start >= size || start > end) return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${size}` } })
  return new Response(Readable.toWeb(createReadStream(sourcePath(f.id), { start, end })), {
    status: 206, headers: { ...base, 'Content-Length': String(end - start + 1), 'Content-Range': `bytes ${start}-${end}/${size}` },
  })
})
