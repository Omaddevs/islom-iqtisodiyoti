// Onlayn dars formasi: tashqi havola maydonlarini tekshirish. Faqat route'lar ishlatadi
// (meetings.js'ni WebSocket serveri ham import qiladi — u yerda http.js kerak emas).
import { fail } from './http.js'
import { isExternal, linkError, providerOf, digitsOnly, zoomIdFromUrl } from './meetingLinks.js'

// Yaratish/tahrirlashda tashqi havola maydonlarini tekshirish va tozalash.
// prev — tahrirlashda mavjud qator (berilmagan maydonlar undan olinadi)
export function cleanLinkFields(d, prev) {
  const provider = d.provider ?? prev?.provider ?? 'platform'
  if (!isExternal(provider)) {
    if (d.provider === undefined && !prev) return {}
    return { provider: 'platform', joinUrl: null, extMeetingId: null, extPasscode: null }
  }
  const url = (d.joinUrl !== undefined ? d.joinUrl : prev?.join_url) || ''
  const err = linkError(provider, url)
  if (err) fail(422, err, { field: 'joinUrl' })
  const detected = providerOf(url)
  // «Boshqa havola» tanlanib, Zoom/Meet/Teams havolasi kiritilsa — to'g'ri tur saqlanadi
  const p = provider === 'zoom' ? 'zoom' : detected
  let id = d.extMeetingId !== undefined ? d.extMeetingId : prev?.ext_meeting_id
  if (p === 'zoom') id = digitsOnly(id) || zoomIdFromUrl(url) || null
  if (p === 'zoom' && id && !/^\d{9,11}$/.test(id)) fail(422, 'Zoom ID 9–11 ta raqamdan iborat bo‘ladi', { field: 'extMeetingId' })
  const pass = d.extPasscode !== undefined ? d.extPasscode : prev?.ext_passcode
  return { provider: p, joinUrl: url.trim(), extMeetingId: id?.trim() || null, extPasscode: pass?.trim() || null }
}
