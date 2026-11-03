// Rasm yuklash (video muqovasi, maqola rasmlari). Brauzer rasmni avval siqadi, bu yerga tayyor fayl keladi.
// Bazaga fayl emas, faqat qisqa havola (/api/files/<nom>) yoziladi — ma'lumotlar yengil qoladi.
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { json, route, fail } from '@/lib/http.js'
import { requireUser } from '@/lib/auth.js'
import { newId } from '@/lib/ids.js'
import { uploadsDir } from '@/lib/files.js'

const MAX_BYTES = 5 * 1024 * 1024
const TYPES = {
  'image/jpeg': { ext: 'jpg', magic: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  'image/png': { ext: 'png', magic: (b) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 },
  'image/webp': { ext: 'webp', magic: (b) => b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP' },
}

export const POST = route(async (req) => {
  const u = await requireUser()
  if (u.role === 'student') fail(403, 'Rasm yuklashga ruxsat yo‘q')
  const mime = (req.headers.get('content-type') || '').split(';')[0].trim()
  const type = TYPES[mime]
  if (!type) fail(415, 'Faqat JPG, PNG yoki WEBP rasm yuklash mumkin')
  if (Number(req.headers.get('content-length') || 0) > MAX_BYTES) fail(413, 'Rasm hajmi 5 MB dan oshmasligi kerak')
  const buf = Buffer.from(await req.arrayBuffer())
  if (!buf.length) fail(400, 'Fayl bo‘sh')
  if (buf.length > MAX_BYTES) fail(413, 'Rasm hajmi 5 MB dan oshmasligi kerak')
  // Kengaytma emas, fayl tarkibi tekshiriladi — rasm niqobidagi boshqa fayl o'tmaydi
  if (!type.magic(buf)) fail(415, 'Fayl rasm emas yoki shikastlangan')

  const name = `${newId('img')}.${type.ext}`
  await mkdir(uploadsDir(), { recursive: true })
  await writeFile(join(uploadsDir(), name), buf)
  return json({ url: `/api/files/${name}` }, { status: 201 })
})
