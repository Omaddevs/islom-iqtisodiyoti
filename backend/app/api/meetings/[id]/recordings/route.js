// Dars yozuvlari: host brauzerda yozadi (MediaRecorder) va shu yerga oqim sifatida yuklaydi.
import { createWriteStream } from 'node:fs'
import { mkdir, stat, unlink } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { Readable, Transform } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { json, route, fail } from '@/lib/http.js'
import { requireUser } from '@/lib/auth.js'
import { query, many } from '@/lib/db.js'
import { getMeeting, canManage, isMember } from '@/lib/meetings.js'
import { config } from '@/lib/config.js'
import { newId } from '@/lib/ids.js'

const MAX_BYTES = 4 * 1024 ** 3 // 4 GB
const MIMES = { 'video/webm': 'webm', 'video/mp4': 'mp4' }

const recordingsDir = () => resolve(config.storageDir, 'recordings')

export const GET = route(async (_req, { id }) => {
  const u = await requireUser()
  const m = await getMeeting(id)
  if (!m) fail(404, 'Dars topilmadi')
  if (!(await isMember(u, m))) fail(403, 'Ruxsat yo‘q')
  const rows = await many('SELECT id, mime, size_bytes, duration_sec, created_at FROM meeting_recordings WHERE meeting_id = $1 ORDER BY created_at DESC', [id])
  return json({ recordings: rows.map((r) => ({ id: r.id, mime: r.mime, size: r.size_bytes, duration: r.duration_sec, createdAt: r.created_at })) })
})

export const POST = route(async (req, { id }) => {
  const u = await requireUser()
  const m = await getMeeting(id)
  if (!m) fail(404, 'Dars topilmadi')
  if (!canManage(u, m)) fail(403, 'Yozuvni faqat ustoz yuklay oladi')

  const mime = (req.headers.get('content-type') || '').split(';')[0].trim()
  const ext = MIMES[mime]
  if (!ext) fail(415, 'Faqat video/webm yoki video/mp4 qabul qilinadi')
  if (!req.body) fail(400, 'Fayl bo‘sh')
  const duration = Math.max(0, Math.round(Number(req.nextUrl.searchParams.get('duration')) || 0))

  const recId = newId('rec')
  const fileName = `${recId}.${ext}`
  await mkdir(recordingsDir(), { recursive: true })
  const path = join(recordingsDir(), fileName)

  let size = 0
  const limiter = new Transform({
    transform(chunk, _enc, cb) {
      size += chunk.length
      cb(size > MAX_BYTES ? new Error('too large') : null, chunk)
    },
  })
  try {
    await pipeline(Readable.fromWeb(req.body), limiter, createWriteStream(path))
  } catch (e) {
    await unlink(path).catch(() => {})
    if (size > MAX_BYTES) fail(413, 'Fayl juda katta (4 GB dan oshmasin)')
    throw e
  }
  if (!size) { await unlink(path).catch(() => {}); fail(400, 'Fayl bo‘sh') }
  const { size: onDisk } = await stat(path)

  await query('INSERT INTO meeting_recordings (id, meeting_id, created_by, file_name, mime, size_bytes, duration_sec) VALUES ($1,$2,$3,$4,$5,$6,$7)',
    [recId, id, u.id, fileName, mime, onDisk, duration || null])
  return json({ recording: { id: recId, mime, size: onDisk, duration } }, { status: 201 })
})
