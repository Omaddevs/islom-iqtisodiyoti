// Yuklangan rasmlarni berish — tizimga kirgan foydalanuvchilarga; hamkor logolari esa saytda ko'rinadi, ular hammaga ochiq.
// Nomlar noyob va o'zgarmaydi, shuning uchun brauzer ularni uzoq muddat keshlaydi.
import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { join } from 'node:path'
import { Readable } from 'node:stream'
import { route, fail } from '@/lib/http.js'
import { requireUser } from '@/lib/auth.js'
import { one } from '@/lib/db.js'
import { uploadsDir } from '@/lib/files.js'

const MIME = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp' }

export const GET = route(async (_req, { name }) => {
  const m = /^img_[a-z0-9]+\.(jpg|png|webp)$/.exec(name || '')
  const isPublic = !!m && !!(await one('SELECT 1 FROM partners WHERE logo = $1', [`/api/files/${name}`]))
  if (!isPublic) await requireUser()
  if (!m) fail(404, 'Fayl topilmadi')
  const path = join(uploadsDir(), name)
  const { size } = await stat(path).catch(() => fail(404, 'Fayl topilmadi'))
  return new Response(Readable.toWeb(createReadStream(path)), {
    headers: {
      'Content-Type': MIME[m[1]],
      'Content-Length': String(size),
      'Cache-Control': `${isPublic ? 'public' : 'private'}, max-age=31536000, immutable`,
      'X-Content-Type-Options': 'nosniff',
    },
  })
})
