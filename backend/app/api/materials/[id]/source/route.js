// Asl fayl: faqat uni yuklagan ustoz yoki administrator yuklab oladi. O'quvchiga bu yo'l yopiq.
import { createReadStream } from 'node:fs'
import { Readable } from 'node:stream'
import { route, fail } from '@/lib/http.js'
import { requireUser } from '@/lib/auth.js'
import { canManageFile, loadFile, sourcePath } from '@/lib/materials.js'

export const GET = route(async (_req, { id }) => {
  const u = await requireUser()
  const f = await loadFile(id)
  if (!canManageFile(u, f)) fail(403, 'Asl faylni yuklab olishga ruxsat yo‘q')
  const ascii = f.name.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_')
  return new Response(Readable.toWeb(createReadStream(sourcePath(f.id))), {
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Length': String(f.size),
      'Content-Disposition': `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(f.name)}`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  })
})
