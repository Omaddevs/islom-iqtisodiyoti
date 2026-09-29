// Sana/vaqt va raqam formatlari (o'zbek tilida)
export const DAYS = ['Yak', 'Dush', 'Sesh', 'Chor', 'Pay', 'Jum', 'Shan']
export const DAYS_FULL = ['Yakshanba', 'Dushanba', 'Seshanba', 'Chorshanba', 'Payshanba', 'Juma', 'Shanba']
export const MONTHS = ['yan', 'fev', 'mar', 'apr', 'may', 'iyn', 'iyl', 'avg', 'sen', 'okt', 'noy', 'dek']
export const MONTHS_FULL = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentyabr', 'oktyabr', 'noyabr', 'dekabr']
export const fmtDateFull = (ts) => { const d = new Date(ts); return `${d.getDate()} ${MONTHS_FULL[d.getMonth()]} ${d.getFullYear()}` }

const pad = (n) => String(n).padStart(2, '0')

export const fmtTime = (ts) => { const d = new Date(ts); return `${pad(d.getHours())}:${pad(d.getMinutes())}` }
export const fmtDate = (ts) => { const d = new Date(ts); return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}` }
export const fmtDateShort = (ts) => { const d = new Date(ts); return `${d.getDate()} ${MONTHS[d.getMonth()]}` }
export const fmtDateTime = (ts) => `${fmtDate(ts)}, ${fmtTime(ts)}`
export const fmtWeekday = (ts) => DAYS_FULL[new Date(ts).getDay()]

export const isToday = (ts) => new Date(ts).toDateString() === new Date().toDateString()
export const isTomorrow = (ts) => new Date(ts).toDateString() === new Date(Date.now() + 864e5).toDateString()

export const fmtWhen = (ts) => {
  if (isToday(ts)) return `Bugun, ${fmtTime(ts)}`
  if (isTomorrow(ts)) return `Ertaga, ${fmtTime(ts)}`
  return `${fmtDateShort(ts)}, ${fmtTime(ts)}`
}

// "3 daqiqa oldin", "2 soat oldin", "kecha"
export const fmtAgo = (ts) => {
  const s = Math.round((Date.now() - ts) / 1000)
  if (s < 60) return 'hozirgina'
  const m = Math.round(s / 60); if (m < 60) return `${m} daqiqa oldin`
  const h = Math.round(m / 60); if (h < 24) return `${h} soat oldin`
  const d = Math.round(h / 24); if (d === 1) return 'kecha'
  if (d < 7) return `${d} kun oldin`
  return fmtDate(ts)
}

// Muddatgacha qolgan vaqt
export const fmtLeft = (ts) => {
  const ms = ts - Date.now()
  if (ms <= 0) return 'muddat tugagan'
  const m = Math.floor(ms / 60e3)
  if (m < 60) return `${m} daqiqa qoldi`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} soat qoldi`
  return `${Math.floor(h / 24)} kun qoldi`
}

// Soniyani "1:29:00" yoki "40:00" ko'rinishida
export const fmtDuration = (sec) => {
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = Math.floor(sec % 60)
  return h ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`
}
export const fmtMinutes = (sec) => `${Math.round(sec / 60)} daq`

export const fmtNum = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')

export const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0)

// <input type="datetime-local"> uchun qiymat
export const toLocalInput = (ts) => {
  const d = new Date(ts)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}
export const fromLocalInput = (v) => (v ? new Date(v).getTime() : NaN)
