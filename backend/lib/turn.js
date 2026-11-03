// WebRTC ICE serverlari. TURN (o'z coturn serverimiz) uchun doimiy parol yo'q: har bir dars ulanishiga
// vaqtinchalik login beriladi (coturn "use-auth-secret" / TURN REST API) — muddati o'tgach yaroqsiz.
import { createHmac } from 'node:crypto'
import { config } from './config.js'

const TTL = 12 * 3600 // 12 soat — eng uzun dars uchun ham yetarli

export function iceServersFor(who) {
  const { turnSecret: secret, turnHost: host } = config
  if (!secret || !host) return config.iceServers
  const username = `${Math.floor(Date.now() / 1000) + TTL}:${String(who).replace(/:/g, '')}`
  const credential = createHmac('sha1', secret).update(username).digest('base64')
  return [
    { urls: [`stun:${host}:3478`] },
    // UDP — eng tez; TCP va TLS (443-ga o'xshash 5349) — UDP yopiq tarmoqlar (korporativ, ba'zi mobil) uchun
    { urls: [`turn:${host}:3478?transport=udp`, `turn:${host}:3478?transport=tcp`, `turns:${host}:5349?transport=tcp`], username, credential },
  ]
}
