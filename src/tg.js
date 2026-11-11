// Telegram Mini App integratsiyasi.
// Sayt bot ichida (Telegram WebApp) ochilganda: to'liq ekran, mavzu ranglari,
// tizim "Orqaga" tugmasi va haptik javob. Oddiy brauzerda hech narsa qilmaydi.
const wa = typeof window !== 'undefined' ? window.Telegram?.WebApp : null

// initData bo'sh bo'lsa — skript yuklangan, lekin sahifa Telegram'dan ochilmagan
export const isTg = !!(wa && wa.initData)
export const tg = isTg ? wa : null

const ROOT = '#/platform'
const atRoot = () => {
  const h = window.location.hash.split('?')[0].replace(/\/+$/, '')
  return h === ROOT || h === '#/kirish' || h === '' || h === '#'
}

function syncBackButton() {
  if (!tg?.BackButton) return
  if (atRoot()) tg.BackButton.hide()
  else tg.BackButton.show()
}

export function haptic(kind = 'light') {
  try {
    if (kind === 'select') tg?.HapticFeedback?.selectionChanged()
    else tg?.HapticFeedback?.impactOccurred(kind)
  } catch { /* eski klientlar */ }
}

export function initTelegram() {
  if (!tg) return
  const html = document.documentElement
  html.classList.add('is-tg')

  // Mini App to'g'ridan-to'g'ri platformadan boshlanadi (landing sahifa emas)
  const h = window.location.hash
  if (!h || h === '#' || h === '#/') window.location.replace(`${window.location.pathname}${window.location.search}${ROOT}`)

  try {
    tg.ready()
    tg.expand()
    tg.disableVerticalSwipes?.() // pastga surib yopib yuborishni oldini oladi (ro'yxatlarni aylantirishda)
    tg.setHeaderColor?.('#eef2f7')
    tg.setBackgroundColor?.('#eef2f7')
    tg.setBottomBarColor?.('#ffffff')
  } catch { /* eski versiyalar */ }

  // Viewport balandligi (klaviatura ochilganda o'zgaradi) — CSS o'zgaruvchisi sifatida
  const setVh = () => html.style.setProperty('--tg-vh', `${tg.viewportStableHeight || window.innerHeight}px`)
  setVh()
  tg.onEvent?.('viewportChanged', setVh)

  // Tizim "Orqaga" tugmasi: bosh sahifadan boshqa joyda ko'rinadi
  tg.BackButton?.onClick(() => {
    haptic('light')
    if (window.history.length > 1) window.history.back()
    else window.location.hash = ROOT
  })
  window.addEventListener('hashchange', syncBackButton)
  syncBackButton()
}
