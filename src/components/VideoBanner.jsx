import { useEffect, useState } from 'react'

// YouTube video ID (masalan: "dQw4w9WgXcQ"). Bo'sh bo'lsa, modal "tez orada" xabarini ko'rsatadi.
const YOUTUBE_ID = ''

// Orqa fondagi yarim shaffof parallelogrammlar (1320 x 410 koordinatalarida)
const SHAPES = [
  '868,52 938,90 938,220 868,182',
  '1018,90 1088,52 1088,182 1018,220',
  '1170,50 1245,8 1245,140 1170,182',
  '1170,-40 1245,-82 1245,48 1170,90',
  '716,178 786,216 786,346 716,308',
  '792,216 862,178 862,308 792,346',
  '490,300 565,340 565,440 490,440',
  '640,340 715,300 715,440 640,440',
  '1245,90 1320,52 1320,182 1245,220',
]

// 3D oltin tangalar to'plami
const STAR = 'M0 -1 L0.29 -0.71 L0.71 -0.71 L0.71 -0.29 L1 0 L0.71 0.29 L0.71 0.71 L0.29 0.71 L0 1 L-0.29 0.71 L-0.71 0.71 L-0.71 0.29 L-1 0 L-0.71 -0.29 L-0.71 -0.71 L-0.29 -0.71 Z'

function Coin({ cx, y }) {
  const R = 50, RY = 18, T = 13
  const ridges = []
  for (let k = -46; k <= 46; k += 6) {
    const off = RY * Math.sqrt(1 - (k / R) ** 2)
    ridges.push(<line key={k} x1={cx + k} y1={y + off} x2={cx + k} y2={y + off + T} />)
  }
  return (
    <g>
      <path d={`M${cx - R} ${y} v${T} A${R} ${RY} 0 0 0 ${cx + R} ${y + T} v${-T} A${R} ${RY} 0 0 1 ${cx - R} ${y} Z`}
        fill="url(#coinSide)" />
      <g stroke="rgba(90,55,0,.35)" strokeWidth="1.2">{ridges}</g>
      <ellipse cx={cx} cy={y} rx={R} ry={RY} fill="url(#coinFace)" />
      <ellipse cx={cx} cy={y} rx={R - 9} ry={RY - 3.4} fill="none" stroke="#b97d0c" strokeWidth="2" opacity=".7" />
    </g>
  )
}

function Coins() {
  const stack = [{ cx: 80, y: 128 }, { cx: 83, y: 114 }, { cx: 79, y: 100 }, { cx: 82, y: 86 }]
  const top = stack[stack.length - 1]
  return (
    <svg className="vb__coins" viewBox="0 0 180 170">
      <defs>
        <radialGradient id="coinFace" cx="38%" cy="30%" r="80%">
          <stop offset="0" stopColor="#fff6c4" />
          <stop offset=".4" stopColor="#ffd34d" />
          <stop offset=".78" stopColor="#e3a51d" />
          <stop offset="1" stopColor="#b8790b" />
        </radialGradient>
        <linearGradient id="coinSide" x1="0" x2="1">
          <stop offset="0" stopColor="#9c6405" />
          <stop offset=".3" stopColor="#f5c94f" />
          <stop offset=".65" stopColor="#d0941a" />
          <stop offset="1" stopColor="#855504" />
        </linearGradient>
        <radialGradient id="coinFace2" cx="35%" cy="30%" r="85%">
          <stop offset="0" stopColor="#fff3b8" />
          <stop offset=".45" stopColor="#f7c53c" />
          <stop offset="1" stopColor="#b47509" />
        </radialGradient>
      </defs>

      {/* tik turgan tanga (orqada) */}
      <g transform="rotate(-14 132 62)">
        <ellipse cx="124" cy="62" rx="30" ry="38" fill="#9a6206" />
        <rect x="124" y="24" width="8" height="76" fill="#b77a0c" />
        <ellipse cx="132" cy="62" rx="30" ry="38" fill="url(#coinFace2)" />
        <ellipse cx="132" cy="62" rx="22" ry="29" fill="none" stroke="#b97d0c" strokeWidth="2" opacity=".75" />
        <path d={STAR} transform="translate(132 62) scale(12 15)" fill="#e7ac25" stroke="#a86f08" strokeWidth=".08" />
      </g>

      {stack.map((c) => <Coin key={c.y} {...c} />)}
      <path d={STAR} transform={`translate(${top.cx} ${top.y}) scale(20 7.2)`} fill="#eab22b" stroke="#a86f08" strokeWidth=".12" />
      <ellipse cx={top.cx - 16} cy={top.y - 6} rx="14" ry="3" fill="#fff" opacity=".45" />
    </svg>
  )
}

// 3D o'sish diagrammasi
function Chart() {
  const base = 118, w = 20, d = 12, dy = 7.2
  const bars = [{ x: 14, h: 34 }, { x: 42, h: 56 }, { x: 70, h: 80 }]
  return (
    <svg className="vb__chart" viewBox="0 0 130 130">
      <defs>
        <linearGradient id="barFront" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f7f9fc" />
          <stop offset="1" stopColor="#a9b4c2" />
        </linearGradient>
        <linearGradient id="barSide" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#8a96a6" />
          <stop offset="1" stopColor="#5d6878" />
        </linearGradient>
        <linearGradient id="arrowGold" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor="#e3a51d" />
          <stop offset=".5" stopColor="#ffd84f" />
          <stop offset="1" stopColor="#f2b52c" />
        </linearGradient>
      </defs>
      {bars.map(({ x, h }) => {
        const t = base - h
        return (
          <g key={x}>
            <polygon points={`${x + w},${t} ${x + w + d},${t - dy} ${x + w + d},${base - dy} ${x + w},${base}`} fill="url(#barSide)" />
            <polygon points={`${x},${t} ${x + d},${t - dy} ${x + w + d},${t - dy} ${x + w},${t}`} fill="#eef2f7" />
            <rect x={x} y={t} width={w} height={h} fill="url(#barFront)" />
          </g>
        )
      })}
      {/* strelka: soyasi + oltin */}
      <g strokeLinecap="round" strokeLinejoin="round" fill="none">
        <polyline points="8,90 44,62 64,74 108,34" stroke="#8a5a06" strokeWidth="10" transform="translate(2 4)" />
        <polyline points="8,90 44,62 64,74 108,34" stroke="url(#arrowGold)" strokeWidth="10" />
      </g>
      <polygon points="126,16 101,24 118,42" fill="#8a5a06" transform="translate(2 4)" />
      <polygon points="126,16 101,24 118,42" fill="#ffcf3f" />
      <polyline points="10,86 44,59 64,71 104,35" stroke="#fff" strokeOpacity=".5" strokeWidth="2" fill="none" strokeLinecap="round" />
    </svg>
  )
}

export default function VideoBanner() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    const onKey = (e) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open])

  return (
    <section className="vb-wrap" id="biz-haqimizda">
      <div className="vb">
        <svg className="vb__pattern" viewBox="0 0 1320 410" preserveAspectRatio="xMaxYMid slice" aria-hidden="true">
          {SHAPES.map((p) => <polygon key={p} points={p} />)}
        </svg>

        <div className="vb__content">
          <p className="vb__eyebrow">Islom iqtisodiyoti jamoasi</p>
          <h2 className="vb__title">
            Nima uchun Islom <br className="hide-sm" />
            iqtisodiyotida o‘qish kerak&nbsp;?
          </h2>
          <button type="button" className="btn btn--flat vb__btn" onClick={() => setOpen(true)}>
            <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
              <circle cx="8" cy="8" r="8" fill="currentColor" />
              <path d="M6.3 5v6l4.7-3z" fill="#4aa3f8" />
            </svg>
            Videoni ko‘rish
          </button>
        </div>

        <div className="vb__art" aria-hidden="true">
          <Coins />
          <div className="vb__mark">
            {Array.from({ length: 10 }, (_, i) => (
              <img key={i} src="/logo/logo-mark.png" alt="" className="vb__mark-layer"
                style={{ transform: `translateZ(${-i * 2}px)`, filter: i ? 'brightness(.62) saturate(1.1)' : 'none' }} />
            ))}
          </div>
          <Chart />
        </div>
      </div>

      {open && (
        <div className="modal" role="dialog" aria-modal="true" aria-label="Video" onClick={() => setOpen(false)}>
          <div className="modal__box" onClick={(e) => e.stopPropagation()}>
            <button className="modal__close" aria-label="Yopish" onClick={() => setOpen(false)}>×</button>
            {YOUTUBE_ID ? (
              <iframe
                src={`https://www.youtube.com/embed/${YOUTUBE_ID}?autoplay=1`}
                title="Islom Iqtisodiyoti video"
                allow="autoplay; encrypted-media; picture-in-picture"
                allowFullScreen
              />
            ) : (
              <div className="modal__empty">Video tez orada qo‘shiladi</div>
            )}
          </div>
        </div>
      )}
    </section>
  )
}
