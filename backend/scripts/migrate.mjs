// SQL migratsiyalarni tartib bilan qo'llaydi (db/migrations/*.sql).
// --reset: sxemani butunlay o'chirib, qaytadan yaratadi (faqat lokal ishlab chiqishda!).
import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { pool, tx } from '../lib/db.js'

const dir = join(import.meta.dirname, '..', 'db', 'migrations')

if (process.argv.includes('--reset')) {
  if (process.env.NODE_ENV === 'production') throw new Error('Productionda --reset taqiqlangan')
  await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;')
  console.log('• sxema tozalandi')
}

await pool.query(`CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())`)
const done = new Set((await pool.query('SELECT name FROM schema_migrations')).rows.map((r) => r.name))
const files = (await readdir(dir)).filter((f) => f.endsWith('.sql')).sort()

let n = 0
for (const f of files) {
  if (done.has(f)) continue
  const sql = await readFile(join(dir, f), 'utf8')
  await tx(async (c) => {
    await c.query(sql)
    await c.query('INSERT INTO schema_migrations (name) VALUES ($1)', [f])
  })
  console.log(`✓ ${f}`)
  n++
}
console.log(n ? `${n} ta migratsiya qo‘llandi` : 'Sxema dolzarb')
await pool.end()
