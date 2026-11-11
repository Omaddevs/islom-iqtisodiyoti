// Telegram Bot API yordamchilari + Mini App initData imzosini tekshirish.
// Next.js'ga bog'liq emas: server.mjs (bot) va API route'lari birga ishlatadi.
import { createHmac, timingSafeEqual } from 'node:crypto'

export const botToken = () => process.env.BOT_TOKEN || ''
// Mini App manzili (https shart). Kirish sahifasi — bog'langan akkaunt avtomatik kiradi
export const appUrl = () => process.env.BOT_APP_URL || 'https://islom-iqtisodiyoti.uz/#/kirish'
// .env dagi doimiy bot adminlari (o'chirib bo'lmaydi): BOT_ADMIN_IDS=8083504130,123
export const envAdminIds = () => (process.env.BOT_ADMIN_IDS || '').split(',').map((s) => Number(s.trim())).filter(Boolean)

export class TgError extends Error {
  constructor(method, j) { super(`${method}: ${j.description}`); this.code = j.error_code; this.retryAfter = j.parameters?.retry_after }
}

export async function tgCall(method, body = {}, { signal } = {}) {
  const r = await fetch(`https://api.telegram.org/bot${botToken()}/${method}`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal,
  })
  const j = await r.json().catch(() => ({ ok: false, description: `HTTP ${r.status}` }))
  if (!j.ok) throw new TgError(method, j)
  return j.result
}

// https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
export function verifyInitData(initData, { maxAgeSec = 24 * 3600 } = {}) {
  const token = botToken()
  if (!token || !initData) return null
  const params = new URLSearchParams(initData)
  const hash = params.get('hash')
  if (!hash || !/^[a-f0-9]{64}$/.test(hash)) return null
  params.delete('hash')
  const check = [...params.entries()].map(([k, v]) => `${k}=${v}`).sort().join('\n')
  const secret = createHmac('sha256', 'WebAppData').update(token).digest()
  const calc = createHmac('sha256', secret).update(check).digest()
  if (!timingSafeEqual(calc, Buffer.from(hash, 'hex'))) return null
  const authDate = Number(params.get('auth_date'))
  if (!authDate || Date.now() / 1000 - authDate > maxAgeSec) return null
  try { return { user: JSON.parse(params.get('user') || 'null'), authDate } } catch { return null }
}
