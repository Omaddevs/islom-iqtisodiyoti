// O'zbekiston raqamlari: "+998 90 123 45 67" ko'rinishiga keltiradi
export function formatPhone(raw) {
  let d = raw.replace(/\D/g, '')
  if (d.startsWith('998')) d = d.slice(3)
  d = d.slice(0, 9)
  const parts = [d.slice(0, 2), d.slice(2, 5), d.slice(5, 7), d.slice(7, 9)].filter(Boolean)
  return '+998 ' + parts.join(' ')
}

// To'liq raqam: 998 + 9 ta raqam
export const isFullPhone = (value) => value.replace(/\D/g, '').length === 12
