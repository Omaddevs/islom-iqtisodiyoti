// Hech qayerda ishlatilmayotgan yuklangan rasmlarni o'chiradi (kontent yoki tashkilot o'chirilgandan keyin qolganlar).
// Yangi yuklangan, hali saqlanmagan rasmga tegmaslik uchun faqat 1 kundan eski fayllar o'chiriladi.
// Kunlik zaxira (deploy/backup.sh) bilan birga ishga tushadi.
import { readdir, rm, stat, unlink } from 'node:fs/promises'
import { join } from 'node:path'
import { pool } from '../lib/db.js'
import { uploadsDir } from '../lib/files.js'
import { resolve } from 'node:path'
import { config } from '../lib/config.js'

// lib/materials.js bilan bir xil joylashuv (u yerdagi sharp'ni bu skriptga yuklamaslik uchun alohida)
const materialsRoot = () => resolve(config.storageDir, 'materials')
const isFileId = (id) => /^mf_[a-z0-9]+$/.test(id)
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

// Hech bir kutubxona yozuvida ishlatilmayotgan material fayllari (1 kundan eski) va bazada yozuvi yo'q papkalar
const root = materialsRoot()
const dirs = await readdir(root).catch(() => [])
if (dirs.length) {
  const { rows: known } = await pool.query(`SELECT id, created_at < now() - interval '1 day' AS old,
    EXISTS (SELECT 1 FROM records r WHERE r.collection = 'library' AND r.data->>'fileId' = m.id) AS used FROM material_files m`)
  const byId = new Map(known.map((m) => [m.id, m]))
  let gone = 0
  for (const d of dirs) {
    if (!isFileId(d)) continue
    const m = byId.get(d)
    if (!m && Date.now() - (await stat(join(root, d))).mtimeMs < 864e5) continue // endigina yuklanayotgan bo'lishi mumkin
    if (m && (m.used || !m.old)) continue
    if (m) await pool.query('DELETE FROM material_files WHERE id = $1', [d])
    await rm(join(root, d), { recursive: true, force: true })
    gone++
  }
  console.log(`✓ Materiallar: ${dirs.length} ta, ishlatilmayotgan ${gone} ta o‘chirildi`)
}
await pool.end()
