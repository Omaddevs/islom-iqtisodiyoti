// Material faylini yuklash (ixtiyoriy tur, 500 MB gacha). Fayl xotiraga olinmaydi — diskka oqim bilan yoziladi.
import { createWriteStream } from 'node:fs'
import { mkdir, rm, statfs } from 'node:fs/promises'
import { join } from 'node:path'
import { Readable, Transform } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { json, route, fail } from '@/lib/http.js'
import { requireUser } from '@/lib/auth.js'
import { one } from '@/lib/db.js'
import { newId } from '@/lib/ids.js'
import { rateLimit } from '@/lib/rateLimit.js'
import { MAX_FILE_BYTES, enqueue, fileDir, fileOut, kindOf, materialsRoot, sourcePath } from '@/lib/materials.js'

const MIN_FREE_BYTES = 2 * 1024 * 1024 * 1024
const TOO_BIG = 'Fayl hajmi 500 MB dan oshmasligi kerak'

export const POST = route(async (req) => {
  const u = await requireUser()
  if (u.role === 'student') fail(403, 'Fayl yuklashga ruxsat yo‘q')
  if (!rateLimit(`material:${u.id}`, { limit: 60, windowMs: 3600e3 }).ok) fail(429, 'Juda ko‘p fayl yuklandi. Birozdan keyin urinib ko‘ring')
  const orgId = u.role === 'superadmin' ? req.headers.get('x-org-id') : u.org_id
  if (!orgId || !(await one('SELECT 1 FROM organizations WHERE id = $1', [orgId]))) fail(422, 'Avval tashkilotni tanlang')
  if (Number(req.headers.get('content-length') || 0) > MAX_FILE_BYTES) fail(413, TOO_BIG)
  if (!req.body) fail(400, 'Fayl bo‘sh')

  let name
  try { name = decodeURIComponent(req.headers.get('x-file-name') || '') } catch { fail(400, 'Fayl nomi noto‘g‘ri') }
  name = name.split(/[\\/]/).pop().replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 200)
  if (!name) fail(400, 'Fayl nomi kerak')
  const ext = (/\.([a-zA-Z0-9]{1,10})$/.exec(name)?.[1] || '').toLowerCase()

  await mkdir(materialsRoot(), { recursive: true })
  const disk = await statfs(materialsRoot())
  if (disk.bavail * disk.bsize < MIN_FREE_BYTES) fail(507, 'Serverda joy kam qolgan. Administratorga murojaat qiling')

  const id = newId('mf')
  await mkdir(fileDir(id), { recursive: true })
  let size = 0
  const limit = new Transform({
    transform(chunk, _enc, cb) {
      size += chunk.length
      cb(size > MAX_FILE_BYTES ? Object.assign(new Error('too big'), { tooBig: true }) : null, chunk)
    },
  })
  try {
    await pipeline(Readable.fromWeb(req.body), limit, createWriteStream(sourcePath(id)))
    if (!size) fail(400, 'Fayl bo‘sh')
  } catch (e) {
    await rm(fileDir(id), { recursive: true, force: true }).catch(() => {})
    if (e.tooBig) fail(413, TOO_BIG)
    throw e
  }
  const kind = kindOf(ext)
  const f = await one(`INSERT INTO material_files (id, org_id, owner_id, name, ext, size, kind, status)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`, [id, orgId, u.id, name, ext, size, kind, kind === 'none' ? 'ready' : 'processing'])
  if (kind !== 'none') enqueue(id)
  return json(fileOut(f, u), { status: 201 })
})
