// Dars xonasi chiptasi: WebSocket ulanishida ishlatiladigan qisqa muddatli JWT.
// Next.js importlarisiz — custom server (server.mjs) ham shu modulni ishlatadi.
import { SignJWT, jwtVerify } from 'jose'
import { config } from './config.js'

const TICKET_TTL = 120 // soniya: faqat ulanish paytida tekshiriladi

export async function signRoomTicket(t) {
  return new SignJWT({ mid: t.meetingId, uid: t.userId ?? null, name: t.name, role: t.role, guest: !!t.guest, color: t.color ?? null, member: !!t.member })
    .setProtectedHeader({ alg: 'HS256', typ: 'room' })
    .setIssuedAt()
    .setExpirationTime(`${TICKET_TTL}s`)
    .sign(config.jwtSecret)
}

export async function verifyRoomTicket(token) {
  const { payload, protectedHeader } = await jwtVerify(token, config.jwtSecret, { algorithms: ['HS256'] })
  if (protectedHeader.typ !== 'room') throw new Error('bad ticket')
  return payload
}
