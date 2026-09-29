// ID, telefon va parol generatorlari (backend ulanguncha mijoz tomonida)
let counter = 0
export const uid = (prefix = 'id') =>
  `${prefix}_${Date.now().toString(36)}${(counter++).toString(36)}${Math.random().toString(36).slice(2, 6)}`

export const digits = (phone) => String(phone || '').replace(/\D/g, '')

// "+998 90 123 45 67" ko'rinishi
export const prettyPhone = (phone) => {
  let d = digits(phone)
  if (d.startsWith('998')) d = d.slice(3)
  const parts = [d.slice(0, 2), d.slice(2, 5), d.slice(5, 7), d.slice(7, 9)].filter(Boolean)
  return '+998 ' + parts.join(' ')
}

// Oson eslab qolinadigan, ammo tasodifiy parol: "Ilm-4821"
const WORDS = ['Ilm', 'Nur', 'Zakot', 'Sabr', 'Adl', 'Rizq', 'Hikmat', 'Baraka', 'Ihsan', 'Amal']
export const genPassword = () =>
  `${WORDS[Math.floor(Math.random() * WORDS.length)]}-${1000 + Math.floor(Math.random() * 9000)}`

// Band bo'lmagan telefon raqam: +998 9X XXX XX XX
export const genPhone = (taken = new Set()) => {
  for (let i = 0; i < 50; i++) {
    const p = '9989' + [0, 1, 3, 4, 5, 7, 8, 9][Math.floor(Math.random() * 8)] + String(Math.floor(Math.random() * 1e7)).padStart(7, '0')
    if (!taken.has(p)) return prettyPhone(p)
  }
  return prettyPhone('998900000000')
}

export const initials = (name = '') => name.split(' ').filter(Boolean).map((w) => w[0]).slice(0, 2).join('').toUpperCase()
