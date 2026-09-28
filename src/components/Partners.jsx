import { useEffect, useRef, useState } from 'react'
import { PARTNERS } from '../data/content.js'
import { Icon } from './ui.jsx'

// Hamkor logosi uchun belgi shakllari (40×40). Haqiqiy logo bo‘lsa `p.logo` rasmi ishlatiladi.
const MARKS = {
  ring: (c) => (<><circle cx="18" cy="21" r="12" fill="none" stroke={c} strokeWidth="6" /><circle cx="30" cy="10" r="5" fill={c} /></>),
  star: (c) => (
    <g fill={c}>
      <rect x="9" y="9" width="22" height="22" rx="4" />
      <rect x="9" y="9" width="22" height="22" rx="4" transform="rotate(45 20 20)" />
      <circle cx="20" cy="20" r="5" fill="#fff" />
    </g>
  ),
  bars: (c) => (<g fill={c}><rect x="6" y="20" width="7" height="14" rx="2" /><rect x="16.5" y="12" width="7" height="22" rx="2" /><rect x="27" y="5" width="7" height="29" rx="2" opacity=".55" /></g>),
  shield: (c) => (<><path d="M20 4 34 9v10c0 8-6 14-14 17C12 33 6 27 6 19V9z" fill={c} /><path d="m14 20 4.5 4.5L27 16" fill="none" stroke="#fff" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" /></>),
  arc: (c) => (<><path d="M31 11a14 14 0 1 0 2 14H21" fill="none" stroke={c} strokeWidth="6" strokeLinecap="round" /><path d="M35 8a18 18 0 0 1 3 7" fill="none" stroke={c} strokeWidth="3" strokeLinecap="round" opacity=".5" /></>),
  leaf: (c) => (<><path d="M8 32C8 16 18 7 34 6c0 16-9 27-26 26z" fill={c} /><path d="M9 31 24 16" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" /></>),
  drop: (c) => (<><path d="M20 4c7 9 12 15 12 21a12 12 0 0 1-24 0c0-6 5-12 12-21z" fill={c} /><path d="M14 25a6 6 0 0 0 6 6" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" /></>),
  crescent: (c) => (<><path d="M24 5a15 15 0 1 0 11 24A12 12 0 1 1 24 5z" fill={c} /><path d="m29 10 1.6 3.4 3.7.5-2.7 2.6.7 3.7-3.3-1.8-3.3 1.8.6-3.7-2.6-2.6 3.7-.5z" fill={c} /></>),
  hex: (c) => (<><path d="M20 3 35 11.5v17L20 37 5 28.5v-17z" fill={c} /><path d="M20 12 28 16.5v7L20 28l-8-4.5v-7z" fill="#fff" opacity=".9" /></>),
  check: (c) => (<><rect x="4" y="4" width="32" height="32" rx="10" fill={c} /><path d="m12 20.5 5.5 5.5L29 14" fill="none" stroke="#fff" strokeWidth="3.6" strokeLinecap="round" strokeLinejoin="round" /></>),
  book: (c) => (<><path d="M5 9c5-2 10-2 15 1v25c-5-3-10-3-15-1z" fill={c} /><path d="M35 9c-5-2-10-2-15 1v25c5-3 10-3 15-1z" fill={c} opacity=".6" /></>),
  diamond: (c) => (<><path d="M20 3 37 20 20 37 3 20z" fill={c} /><path d="M20 11 29 20 20 29 11 20z" fill="#fff" /><path d="M20 16 24 20 20 24 16 20z" fill={c} /></>),
}

function PartnerLogo({ p }) {
  // Nomdan qisqa "wordmark": ko‘p so‘zli bo‘lsa birinchi so‘z qalin, qolgani yengil
  const [first, ...rest] = p.name.split(' ')
  return (
    <div className="plogo" style={{ '--pc': p.color }} title={`${p.name} — ${p.type}`}>
      {p.logo ? (
        <img src={p.logo} alt={p.name} loading="lazy" />
      ) : (
        <>
          <svg viewBox="0 0 40 40" width="38" height="38" aria-hidden="true">{(MARKS[p.mark] || MARKS.ring)(p.color)}</svg>
          <span className="plogo__word">
            <b>{first}</b>{rest.length > 0 && <span>{rest.join(' ')}</span>}
          </span>
        </>
      )}
      <span className="plogo__tip">{p.type}</span>
    </div>
  )
}

const COLS = 5
// Har bir ustun: o‘z tezligi, yo‘nalishi va chuqurligi (parallaks uchun)
const COL_CFG = [
  { dur: 38, rev: false, depth: 10 },
  { dur: 46, rev: true, depth: 18 },
  { dur: 34, rev: false, depth: 26 },
  { dur: 42, rev: true, depth: 18 },
  { dur: 50, rev: false, depth: 10 },
]

const STATS = [
  { value: '40+', label: 'Hamkor tashkilot' },
  { value: '12', label: 'Bank va moliya instituti' },
  { value: '5 000+', label: 'Hamkorlar orqali o‘qigan xodimlar' },
]

export default function Partners() {
  const section = useRef(null)
  const wall = useRef(null)
  const [visible, setVisible] = useState(false)

  const columns = Array.from({ length: COLS }, (_, i) => PARTNERS.filter((_, j) => j % COLS === i))

  // Bo‘lim ko‘rinishga kirganda animatsiya boshlanadi
  useEffect(() => {
    const el = section.current
    if (!el || !('IntersectionObserver' in window)) { setVisible(true); return }
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setVisible(true); io.disconnect() }
    }, { threshold: 0.2 })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  // Sichqoncha bo‘yicha yumshoq parallaks + hover paytida lentani silliq sekinlatish (rAF + lerp)
  useEffect(() => {
    const el = wall.current
    if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    let raf = 0
    const target = { x: 0, y: 0, rate: 1 }
    const cur = { x: 0, y: 0, rate: 1 }
    const anims = () => el.getAnimations ? el.getAnimations({ subtree: true }).filter((a) => a.animationName === 'pwall-loop') : []
    const tick = () => {
      cur.x += (target.x - cur.x) * 0.08
      cur.y += (target.y - cur.y) * 0.08
      cur.rate += (target.rate - cur.rate) * 0.06
      el.style.setProperty('--px', cur.x.toFixed(4))
      el.style.setProperty('--py', cur.y.toFixed(4))
      anims().forEach((a) => { a.playbackRate = cur.rate })
      const moving = Math.abs(target.x - cur.x) + Math.abs(target.y - cur.y) + Math.abs(target.rate - cur.rate) > 0.001
      raf = moving ? requestAnimationFrame(tick) : 0
    }
    const kick = () => { if (!raf) raf = requestAnimationFrame(tick) }
    const move = (e) => {
      const r = el.getBoundingClientRect()
      target.x = (e.clientX - r.left) / r.width - 0.5
      target.y = (e.clientY - r.top) / r.height - 0.5
      target.rate = 0.12
      kick()
    }
    const leave = () => { target.x = 0; target.y = 0; target.rate = 1; kick() }
    el.addEventListener('pointermove', move)
    el.addEventListener('pointerleave', leave)
    return () => {
      cancelAnimationFrame(raf)
      el.removeEventListener('pointermove', move)
      el.removeEventListener('pointerleave', leave)
    }
  }, [])

  return (
    <section className={`section partners ${visible ? 'is-in' : ''}`} id="hamkorlar" ref={section}>
      <div className="partners__intro">
        <p className="eyebrow">Hamkorlar</p>
        <h2 className="shead__title">Bizga ishonch bildirgan tashkilotlar</h2>
        <p className="shead__text">
          Islom banklari, takaful kompaniyalari va investitsiya fondlari o‘z xodimlarini
          biz bilan o‘qitadi hamda kurslarimizni amaliy keyslar bilan boyitadi.
        </p>

        <ul className="partners__stats">
          {STATS.map((s, i) => (
            <li key={s.label} style={{ '--d': `${0.15 + i * 0.08}s` }}>
              <b>{s.value}</b>
              <span>{s.label}</span>
            </li>
          ))}
        </ul>

        <div className="partners__cta">
          <a href="#aloqa" className="btn btn--primary">Hamkor bo‘lish</a>
          <span className="partners__note">
            <Icon name="check" size={14} /> Korporativ o‘qitish va birgalikdagi dasturlar
          </span>
        </div>
      </div>

      <div className="pwall" ref={wall} aria-label="Hamkorlar logotiplari">
        {columns.map((items, i) => {
          const c = COL_CFG[i]
          return (
            <div key={i} className="pwall__col"
              style={{ '--i': i, '--depth': c.depth, '--dur': `${c.dur}s` }}>
              <div className={`pwall__track ${c.rev ? 'is-rev' : ''}`}>
                {/* Uzluksiz aylanish uchun ro‘yxat ikki marta takrorlanadi */}
                {[...items, ...items].map((p, k) => (
                  <div key={k} className="pwall__cell" aria-hidden={k >= items.length}>
                    <PartnerLogo p={p} />
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
