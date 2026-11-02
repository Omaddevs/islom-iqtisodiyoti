import { one } from '@/lib/db.js'
import { json, route } from '@/lib/http.js'

export const GET = route(async () => {
  const r = await one('SELECT now() AS now')
  return json({ ok: true, db: !!r, rooms: globalThis.__iiHub?.stats() ?? null })
})
