// Muhit sozlamalari — bir joyda tekshiriladi, xato bo'lsa server darhol to'xtaydi.
const req = (name, fallback) => {
  const v = process.env[name] ?? fallback
  if (v === undefined || v === '') throw new Error(`Muhit o'zgaruvchisi topilmadi: ${name} (backend/.env ni tekshiring)`)
  return v
}

const parseIce = (raw) => {
  try { return JSON.parse(raw) } catch { throw new Error('ICE_SERVERS JSON formatida bo‘lishi kerak') }
}

export const config = {
  get databaseUrl() { return req('DATABASE_URL') },
  get jwtSecret() {
    const s = req('JWT_SECRET')
    if (s.length < 32) throw new Error('JWT_SECRET kamida 32 belgi bo‘lishi kerak')
    return new TextEncoder().encode(s)
  },
  get appOrigins() { return req('APP_ORIGIN', 'http://localhost:2026').split(',').map((s) => s.trim()) },
  get iceServers() { return parseIce(req('ICE_SERVERS', '[{"urls":["stun:stun.l.google.com:19302"]}]')) },
  // O'z TURN serverimiz (deploy/turn-setup.sh). Bo'sh bo'lsa faqat ICE_SERVERS ishlatiladi
  get turnSecret() { return process.env.TURN_SECRET || '' },
  get turnHost() { return process.env.TURN_HOST || '' },
  get storageDir() { return req('STORAGE_DIR', './storage') },
  get isProd() { return process.env.NODE_ENV === 'production' },
  // HTTPS bo'lmagan vaqtinchalik ishga tushirishda (faqat IP) COOKIE_SECURE=false — aks holda brauzer cookie'ni saqlamaydi
  get cookieSecure() { return process.env.COOKIE_SECURE ? process.env.COOKIE_SECURE === 'true' : this.isProd },
}
