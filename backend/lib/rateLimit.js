// Oddiy xotiradagi cheklovchi (bitta server nusxasi uchun). Ko'p nusxada — Redis'ga o'tkazing.
const buckets = globalThis.__iiRate ?? (globalThis.__iiRate = new Map())

export function rateLimit(key, { limit, windowMs }) {
  const now = Date.now()
  const b = buckets.get(key)
  if (!b || b.reset < now) { buckets.set(key, { count: 1, reset: now + windowMs }); return { ok: true } }
  b.count++
  return b.count > limit ? { ok: false, retryAfter: Math.ceil((b.reset - now) / 1000) } : { ok: true }
}

export const clientIp = (req) =>
  req.headers.get('x-forwarded-for')?.split(',')[0].trim() || req.headers.get('x-real-ip') || 'local'
