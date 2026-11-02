// PostgreSQL ulanish havzasi. Next route'lari va WebSocket serveri bitta jarayonda
// ishlaydi, shuning uchun havza globalThis orqali bitta nusxada saqlanadi.
import pg from 'pg'
import { config } from './config.js'

// timestamptz → millisekund (frontend Date.now() bilan ishlaydi)
pg.types.setTypeParser(1184, (v) => (v === null ? null : new Date(v).getTime()))
// bigint (COUNT, bigserial) → number
pg.types.setTypeParser(20, (v) => (v === null ? null : Number(v)))

export const pool = globalThis.__iiPgPool ?? (globalThis.__iiPgPool = new pg.Pool({
  connectionString: config.databaseUrl,
  max: 10,
  idleTimeoutMillis: 30_000,
}))

export const query = (text, params) => pool.query(text, params)
export const one = async (text, params) => (await pool.query(text, params)).rows[0] ?? null
export const many = async (text, params) => (await pool.query(text, params)).rows

// Tranzaksiya: xato bo'lsa ROLLBACK
export async function tx(fn) {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const res = await fn(client)
    await client.query('COMMIT')
    return res
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {})
    throw e
  } finally {
    client.release()
  }
}
