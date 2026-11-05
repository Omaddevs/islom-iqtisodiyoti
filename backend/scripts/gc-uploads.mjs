// Hech qayerda ishlatilmayotgan yuklangan rasmlarni o'chiradi (kontent yoki tashkilot o'chirilgandan keyin qolganlar).
// Yangi yuklangan, hali saqlanmagan rasmga tegmaslik uchun faqat 1 kundan eski fayllar o'chiriladi.
// Kunlik zaxira (deploy/backup.sh) bilan birga ishga tushadi.
import { readdir, stat, unlink } from 'node:fs/promises'
import { join } from 'node:path'
import { pool } from '../lib/db.js'
import { uploadsDir } from '../lib/files.js'

const dir = uploadsDir()
const files = await readdir(dir).catch(() => [])
if (files.length) {
  // Rasm havolalari records (kontent) va tashkilot/foydalanuvchi/guruh ma'lumotlarida bo'lishi mumkin
  const { rows } = await pool.query(`
    SELECT data::text AS t FROM records
    UNION ALL SELECT data::text FROM organizations
    UNION ALL SELECT data::text FROM users
    UNION ALL SELECT data::text FROM groups
    UNION ALL SELECT logo FROM partners WHERE logo IS NOT NULL`)
  const used = new Set()
  for (const { t } of rows) for (const m of t.matchAll(/img_[a-z0-9]+\.(?:jpg|png|webp)/g)) used.add(m[0])
  const dayAgo = Date.now() - 864e5
  let removed = 0
  for (const f of files) {
    if (used.has(f) || !/^img_/.test(f)) continue
    const p = join(dir, f)
    if ((await stat(p)).mtimeMs > dayAgo) continue
    await unlink(p); removed++
  }
  console.log(`✓ Rasmlar: ${files.length} ta, ishlatilmayotgan ${removed} ta o‘chirildi`)
}
await pool.end()
