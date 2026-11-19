// O'quvchi faolligi: sarflangan vaqtni yuborish va ustozga statistika
import { useEffect, useRef } from 'react'
import { api } from './client.js'
import { useAuth } from '../store/auth.jsx'

const BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '')

export const studyApi = {
  student: (id, days) => api(`/api/study/students/${encodeURIComponent(id)}?days=${days}`),
  overview: (days, orgId) => api(`/api/study/overview?days=${days}${orgId ? `&orgId=${encodeURIComponent(orgId)}` : ''}`),
}

// keepalive — sahifa yopilayotganda ham so'rov yetib boradi
const beat = (data) => fetch(`${BASE}/api/study`, { method: 'POST', credentials: 'include', keepalive: true, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }).catch(() => {})

const INPUTS = ['pointerdown', 'pointermove', 'keydown', 'wheel', 'scroll', 'touchstart']
const FLUSH_MS = 30e3

/**
 * O'quvchi materialda haqiqatan o'tkazgan vaqtni hisoblaydi va serverga yuboradi.
 * Vaqt faqat sahifa ko'rinib turganda va o'quvchi so'nggi `idle` ms ichida harakat qilgan bo'lsa hisoblanadi
 * (video uchun `idle` katta: tomosha paytida sichqoncha qimirlamaydi).
 * progress() — 0–100, materialning qancha qismi ko'rilgani (ixtiyoriy).
 */
export function useStudyTimer(kind, refId, { enabled = true, idle = 3 * 60e3, progress, scroll = false } = {}) {
  const { user } = useAuth()
  const on = enabled && !!refId && user?.role === 'student'
  const prog = useRef(progress)
  prog.current = progress
  useEffect(() => {
    if (!on) return undefined
    let last = Date.now(), input = Date.now(), acc = 0, maxScroll = 0
    const poke = () => { input = Date.now() }
    const onScroll = () => {
      const el = document.scrollingElement || document.documentElement
      const h = el.scrollHeight - window.innerHeight
      maxScroll = Math.max(maxScroll, h > 40 ? Math.min(100, ((window.scrollY + 1) / h) * 100) : 100)
    }
    const tick = () => {
      const now = Date.now(), dt = Math.min(now - last, 5000)
      last = now
      if (document.visibilityState === 'visible' && now - input < idle) acc += dt
    }
    const flush = () => {
      tick()
      const seconds = Math.floor(acc / 1000)
      if (seconds < 1) return
      acc -= seconds * 1000
      let p = null
      try { p = prog.current?.() ?? null } catch { /* hisoblab bo'lmadi */ }
      if (scroll) p = Math.max(p ?? 0, Math.round(maxScroll))
      beat({ kind, refId, seconds, progress: p })
    }
    INPUTS.forEach((e) => window.addEventListener(e, poke, { passive: true, capture: true }))
    if (scroll) { window.addEventListener('scroll', onScroll, { passive: true }); onScroll() }
    const t1 = setInterval(tick, 1000)
    const t2 = setInterval(flush, FLUSH_MS)
    const onVis = () => { if (document.visibilityState === 'hidden') flush(); else { last = Date.now(); input = Date.now() } }
    document.addEventListener('visibilitychange', onVis)
    window.addEventListener('pagehide', flush)
    return () => {
      INPUTS.forEach((e) => window.removeEventListener(e, poke, { capture: true }))
      if (scroll) window.removeEventListener('scroll', onScroll)
      clearInterval(t1); clearInterval(t2)
      document.removeEventListener('visibilitychange', onVis)
      window.removeEventListener('pagehide', flush)
      flush()
    }
  }, [on, kind, refId, idle, scroll])
}
