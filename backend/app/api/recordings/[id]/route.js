// Yozuvni ko'rish: HTTP Range qo'llab-quvvatlanadi (video pleerda oldinga/orqaga surish uchun)
import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { Readable } from 'node:stream'
import { route, fail } from '@/lib/http.js'
import { requireUser } from '@/lib/auth.js'
import { one } from '@/lib/db.js'
import { getMeeting, isMember } from '@/lib/meetings.js'
import { config } from '@/lib/config.js'

export const GET = route(async (req, { id }) => {
  const u = await requireUser()
  const r = await one('SELECT * FROM meeting_recordings WHERE id = $1', [id])
  if (!r) fail(404, 'Yozuv topilmadi')
  const m = await getMeeting(r.meeting_id)
  if (!m || !(await isMember(u, m))) fail(403, 'Ruxsat yo‘q')

  const path = join(resolve(config.storageDir, 'recordings'), r.file_name)
  const { size } = await stat(path).catch(() => fail(404, 'Fayl serverda topilmadi'))
  const headers = { 'Content-Type': r.mime, 'Accept-Ranges': 'bytes', 'Cache-Control': 'private, max-age=3600' }
  if (req.nextUrl.searchParams.get('download')) {
    // filename — eski brauzerlar uchun ASCII zaxira, filename* — asl (UTF-8) nom
    const name = `${m.title}.${r.file_name.split('.').pop()}`
    headers['Content-Disposition'] = `attachment; filename="${name.replace(/[^\x20-\x7e]|["\\]/g, '_')}"; filename*=UTF-8''${encodeURIComponent(name)}`
  }

  const range = /bytes=(\d*)-(\d*)/.exec(req.headers.get('range') || '')
  if (range) {
    let start = range[1] ? Number(range[1]) : size - Number(range[2])
    let end = range[1] && range[2] ? Number(range[2]) : size - 1
    start = Math.max(0, start); end = Math.min(end, size - 1)
    if (start > end) return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${size}` } })
    return new Response(Readable.toWeb(createReadStream(path, { start, end })), {
      status: 206,
      headers: { ...headers, 'Content-Range': `bytes ${start}-${end}/${size}`, 'Content-Length': String(end - start + 1) },
    })
  }
  return new Response(Readable.toWeb(createReadStream(path)), { headers: { ...headers, 'Content-Length': String(size) } })
})
