// Tashqi video xizmatlar (Zoom, Google Meet, Teams) havolalari: aniqlash, tekshirish va taklif matnini ajratish.
// Backend ham, frontend ham (Vite orqali) shu faylni ishlatadi — qoidalar bir xil bo'lsin. Node API ishlatilmaydi.

// da — «…da o'tadi», ni — «…ni ochish» (chet nomlarga qo'shimcha tutuq belgisi bilan qo'shiladi)
export const PROVIDERS = {
  platform: { label: 'Platforma xonasi', short: 'Platforma', da: 'platforma xonasida', ni: 'xonani' },
  zoom: { label: 'Zoom', short: 'Zoom', da: 'Zoom’da', ni: 'Zoom’ni' },
  meet: { label: 'Google Meet', short: 'Meet', da: 'Google Meet’da', ni: 'Google Meet’ni' },
  teams: { label: 'Microsoft Teams', short: 'Teams', da: 'Microsoft Teams’da', ni: 'Teams’ni' },
  link: { label: 'Tashqi havola', short: 'Havola', da: 'tashqi havola orqali', ni: 'havolani' },
}
const P = (p) => PROVIDERS[p] || PROVIDERS.zoom
export const provDa = (p) => P(p).da
export const provNi = (p) => P(p).ni
export const isExternal = (p) => !!p && p !== 'platform'

const hostOf = (url) => { try { return new URL(url).hostname.toLowerCase() } catch { return '' } }
const under = (host, domain) => host === domain || host.endsWith(`.${domain}`)

// Havoladan xizmat turini aniqlash
export function providerOf(url) {
  const h = hostOf(url)
  if (!h) return null
  if (['zoom.us', 'zoom.com', 'zoomgov.com'].some((d) => under(h, d))) return 'zoom'
  if (h === 'meet.google.com') return 'meet'
  if (under(h, 'teams.microsoft.com') || under(h, 'teams.live.com')) return 'teams'
  return 'link'
}

// Zoom ID: 9–11 raqam, «812 3456 7890» ko'rinishida
export const digitsOnly = (s) => String(s || '').replace(/\D/g, '')
export function fmtZoomId(id) {
  const d = digitsOnly(id)
  if (d.length === 11) return `${d.slice(0, 3)} ${d.slice(3, 7)} ${d.slice(7)}`
  if (d.length === 10) return `${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}`
  if (d.length === 9) return `${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}`
  return String(id || '').trim()
}
export const zoomIdFromUrl = (url) => {
  const m = /\/(?:j|w|wc\/join|s)\/(\d{9,11})(?:\D|$)/.exec(String(url || ''))
  return m ? m[1] : ''
}

// Zoom/Meet/Teams taklif matnidan havola, ID va kodni ajratish (ustoz butun matnni joylashtirishi mumkin)
export function parseInvite(text) {
  const t = String(text || '')
  const urls = t.match(/https?:\/\/[^\s<>"')\]]+/gi) || []
  const pick = urls.find((u) => providerOf(u) !== 'link') || urls[0] || ''
  const url = pick.replace(/[.,;]+$/, '')
  const provider = url ? providerOf(url) : null
  let meetingId = ''
  const idm = /(?:meeting\s*id|id\s*конференции|идентификатор(?:\s+конференции)?|konferensiya\s*id|uchrashuv\s*id|\bID)\s*[:：]?\s*([\d][\d\s]{7,14}\d)/i.exec(t)
  if (idm) meetingId = digitsOnly(idm[1])
  if (!meetingId && provider === 'zoom') meetingId = zoomIdFromUrl(url)
  const pm = /(?:passcode|password|код\s*доступа|пароль|parol|kod)\s*[:：]\s*(\S{1,40})/i.exec(t)
  const passcode = pm ? pm[1].replace(/[.,;]+$/, '') : ''
  return { url, provider, meetingId, passcode }
}

// Tekshirish: xato bo'lsa matn qaytaradi, aks holda null
export function linkError(provider, url) {
  const u = String(url || '').trim()
  if (!u) return provider === 'zoom' ? 'Zoom havolasini kiriting' : 'Dars havolasini kiriting'
  if (u.length > 500) return 'Havola juda uzun'
  if (!/^https:\/\/\S+$/i.test(u) || !hostOf(u)) return 'Havola https:// bilan boshlanishi kerak'
  const p = providerOf(u)
  if (provider === 'zoom' && p !== 'zoom') return 'Bu Zoom havolasi emas (…zoom.us/j/… ko‘rinishida bo‘lishi kerak)'
  return null
}
