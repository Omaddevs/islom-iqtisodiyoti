import { randomBytes, randomInt } from 'node:crypto'

export const newId = (prefix) => `${prefix}_${Date.now().toString(36)}${randomBytes(5).toString('hex')}`

// Google Meet uslubidagi o'qilishi oson kod: "kqz-mwpt-hrd" (chalkash harflarsiz)
const ALPHA = 'abcdefghjkmnpqrstuvwxyz'
const part = (n) => Array.from({ length: n }, () => ALPHA[randomInt(ALPHA.length)]).join('')
export const newMeetingCode = () => `${part(3)}-${part(4)}-${part(3)}`
export const isMeetingCode = (s) => /^[a-z]{3}-[a-z]{4}-[a-z]{3}$/.test(String(s || ''))

export const digits = (phone) => String(phone || '').replace(/\D/g, '')
