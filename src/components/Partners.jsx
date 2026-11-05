import { useEffect, useRef, useState } from 'react'
import { partnersApi } from '../platform/api/client.js'
import { Icon } from './ui.jsx'
import { leadClick } from './LeadModal.jsx'

function PartnerLogo({ p }) {
  // Logo bo'lmasa: nom harfi va qisqa "wordmark" (birinchi so'z qalin, qolgani yengil)
  const [first, ...rest] = p.name.split(' ')
  return (
    <div className="plogo" style={{ '--pc': p.color }} title={p.type ? `${p.name} — ${p.type}` : p.name}>
      {p.logo ? (
        <img src={p.logo} alt={p.name} loading="lazy" />
      ) : (
        <>
          <span className="plogo__mark" aria-hidden="true">{first[0]?.toUpperCase()}</span>
          <span className="plogo__word">
            <b>{first}</b>{rest.length > 0 && <span>{rest.join(' ')}</span>}
          </span>
        </>
      )}
      {p.type && <span className="plogo__tip">{p.type}</span>}
    </div>
  )
}

// Har bir ustun: o‘z tezligi, yo‘nalishi va chuqurligi (parallaks uchun)
const COL_CFG = [
  { dur: 38, rev: false, depth: 10 },
  { dur: 46, rev: true, depth: 18 },
  { dur: 34, rev: false, depth: 26 },
  { dur: 42, rev: true, depth: 18 },
  { dur: 50, rev: false, depth: 10 },
]

const MOBILE = '(max-width: 640px)'
// Ustunda kamida shuncha logo bo'lsa, aylanayotgan lentada bo'shliq ko'rinmaydi
const MIN_PER_COL = 4

// Ro'yxat bo'sh bo'lsa (yoki server javob bermasa) bo'lim umuman chiqmaydi
export default function Partners() {
  const [partners, setPartners] = useState([])
  useEffect(() => { partnersApi.list().then((r) => setPartners(r.partners)).catch(() => {}) }, [])
  return partners.length > 0 ? <PartnersSection partners={partners} /> : null
}

function PartnersSection({ partners }) {
  const section = useRef(null)
  const wall = useRef(null)
  const [visible, setVisible] = useState(false)
  const [mobile, setMobile] = useState(() => window.matchMedia(MOBILE).matches)

  useEffect(() => {
    const mq = window.matchMedia(MOBILE)
    const on = () => setMobile(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])

  const cols = mobile ? 3 : 5
  // Hamkor kam bo'lsa — oddiy tartib; ko'paygach aylanadigan devor (har bir ustun to'lguncha takrorlanadi)
  const animated = partners.length >= cols * 2
  const filled = Array.from({ length: Math.max(partners.length, cols * MIN_PER_COL) }, (_, i) => partners[i % partners.length])
  const columns = Array.from({ length: cols }, (_, i) => filled.filter((_, j) => j % cols === i))

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
    if (!el || !animated || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
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
  }, [animated])

  return (
    <section className={`section partners ${visible ? 'is-in' : ''}`} id="hamkorlar" ref={section}>
      <div className="partners__intro">
        <p className="eyebrow">Hamkorlar</p>
        <h2 className="shead__title">Bizga ishonch bildirgan tashkilotlar</h2>
        <p className="shead__text">
          Islom banklari, takaful kompaniyalari va investitsiya fondlari o‘z xodimlarini
          biz bilan o‘qitadi hamda kurslarimizni amaliy keyslar bilan boyitadi.
        </p>

        <div className="partners__cta">
          <a href="#aloqa" className="btn btn--primary" onClick={leadClick({ kind: 'partner' })}>Hamkor bo‘lish</a>
          <span className="partners__note">
            <Icon name="check" size={14} /> Korporativ o‘qitish va birgalikdagi dasturlar
          </span>
        </div>
      </div>

      {animated ? (
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
      ) : (
        <div className="pwall-static" aria-label="Hamkorlar logotiplari">
          {partners.map((p) => <PartnerLogo key={p.id} p={p} />)}
        </div>
      )}
    </section>
  )
}
