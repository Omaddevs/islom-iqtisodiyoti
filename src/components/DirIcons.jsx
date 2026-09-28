import { useId } from 'react'

// Yo‘nalishlar uchun 3D uslubidagi ikonlar.
// Har bir ikon: yuza gradienti + qalinlik (extrusion) + yaltiroq blik + yumshoq soya.
// Logodagi 8 qirrali yulduz motivi ikonlar ichida takrorlanadi.

const PALETTES = {
  book:      { light: '#9dd6ff', base: '#4aa3f8', dark: '#1f6fd1', deep: '#1557a8' },
  bank:      { light: '#b4bdff', base: '#6366f1', dark: '#4338ca', deep: '#312e81' },
  chart:     { light: '#6ff0dc', base: '#14b8a6', dark: '#0f766e', deep: '#134e4a' },
  shield:    { light: '#fde68a', base: '#f59e0b', dark: '#d97706', deep: '#92400e' },
  briefcase: { light: '#7ef0c4', base: '#10b981', dark: '#047857', deep: '#064e3b' },
  heart:     { light: '#ffb1bc', base: '#f43f5e', dark: '#be123c', deep: '#881337' },
  quote:     { light: '#9dd6ff', base: '#4aa3f8', dark: '#1f6fd1', deep: '#1557a8' },
}
const GOLD = { light: '#fff3b0', base: '#fbbf24', dark: '#d97706', deep: '#92400e' }
PALETTES.trophy = GOLD

// Logodagi 8 qirrali yulduz (ikki burilgan kvadrat)
function Star8({ cx, cy, s, fill, dot }) {
  const h = s / 2
  return (
    <g fill={fill}>
      <rect x={cx - h} y={cy - h} width={s} height={s} rx={s * 0.14} />
      <rect x={cx - h} y={cy - h} width={s} height={s} rx={s * 0.14} transform={`rotate(45 ${cx} ${cy})`} />
      {dot && <circle cx={cx} cy={cy} r={s * 0.24} fill={dot} />}
    </g>
  )
}

function Defs({ id, p }) {
  return (
    <defs>
      <linearGradient id={`${id}-top`} x1="0" y1="0" x2="0.35" y2="1">
        <stop offset="0" stopColor={p.light} />
        <stop offset="0.55" stopColor={p.base} />
        <stop offset="1" stopColor={p.dark} />
      </linearGradient>
      <linearGradient id={`${id}-side`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor={p.dark} />
        <stop offset="1" stopColor={p.deep} />
      </linearGradient>
      <linearGradient id={`${id}-col`} x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor={p.dark} />
        <stop offset="0.45" stopColor={p.light} />
        <stop offset="1" stopColor={p.base} />
      </linearGradient>
      <linearGradient id={`${id}-gold`} x1="0" y1="0" x2="0.4" y2="1">
        <stop offset="0" stopColor={GOLD.light} />
        <stop offset="0.5" stopColor={GOLD.base} />
        <stop offset="1" stopColor={GOLD.dark} />
      </linearGradient>
      <linearGradient id={`${id}-paper`} x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor="#e6edf6" />
        <stop offset="1" stopColor="#ffffff" />
      </linearGradient>
      <linearGradient id={`${id}-gloss`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#fff" stopOpacity="0.75" />
        <stop offset="1" stopColor="#fff" stopOpacity="0" />
      </linearGradient>
      <filter id={`${id}-sh`} x="-30%" y="-30%" width="160%" height="170%">
        <feDropShadow dx="0" dy="3" stdDeviation="2.4" floodColor={p.deep} floodOpacity="0.35" />
      </filter>
    </defs>
  )
}

const SHAPES = {
  book: (id, p) => (
    <>
      {/* sahifalar */}
      <rect x="13" y="9.5" width="27" height="32.5" rx="3.5" fill={`url(#${id}-paper)`} />
      <path d="M36 13v25M38.2 13v25" stroke="#c9d6e6" strokeWidth="0.8" />
      {/* muqova qalinligi */}
      <rect x="8" y="8.5" width="27" height="34" rx="4.5" fill={`url(#${id}-side)`} />
      {/* muqova */}
      <rect x="8" y="6" width="27" height="34" rx="4.5" fill={`url(#${id}-top)`} />
      <rect x="8" y="6" width="6" height="34" rx="3" fill={p.deep} opacity="0.28" />
      <path d="M14 6h16.5a4.5 4.5 0 0 1 4.5 4.5V17C27 14 20 15.5 14 19Z" fill={`url(#${id}-gloss)`} opacity="0.6" />
      <Star8 cx={24.5} cy={22} s={9.5} fill="#fff" dot={p.base} />
      <rect x="18" y="32.5" width="13" height="2.2" rx="1.1" fill="#fff" opacity="0.7" />
    </>
  ),

  bank: (id, p) => (
    <>
      {/* poydevor */}
      <rect x="5" y="37.5" width="38" height="5" rx="2" fill={`url(#${id}-side)`} />
      <rect x="5" y="35" width="38" height="4.5" rx="2" fill={`url(#${id}-top)`} />
      <rect x="8" y="32" width="32" height="4" rx="1.5" fill={p.base} />
      {/* ustunlar */}
      {[10, 17.5, 25, 32.5].map((x) => (
        <rect key={x} x={x} y="19" width="5.5" height="13.5" rx="1.4" fill={`url(#${id}-col)`} />
      ))}
      {/* peshtoq */}
      <rect x="6" y="17" width="36" height="4" rx="1.5" fill={`url(#${id}-side)`} />
      <path d="M22.6 4.8a2.6 2.6 0 0 1 2.8 0l16.4 9.6c1.3.8.8 2.6-.7 2.6H6.9c-1.5 0-2-1.8-.7-2.6Z" fill={`url(#${id}-top)`} />
      <path d="M22.6 4.8a2.6 2.6 0 0 1 2.8 0l7 4.1C27 10 19 12 11 15.5H7Z" fill={`url(#${id}-gloss)`} opacity="0.55" />
      <Star8 cx={24} cy={11.6} s={4.6} fill="#fff" />
    </>
  ),

  chart: (id, p) => {
    const bars = [{ x: 7, h: 12 }, { x: 18, h: 19 }, { x: 29, h: 27 }]
    const b = 42
    return (
      <>
        {bars.map(({ x, h }) => {
          const y = b - h
          return (
            <g key={x}>
              <path d={`M${x + 8} ${y} l3.5 -2.5 V${b - 2.5} L${x + 8} ${b} Z`} fill={`url(#${id}-side)`} />
              <path d={`M${x} ${y} l3.5 -2.5 h8 L${x + 8} ${y} Z`} fill={p.light} />
              <rect x={x} y={y} width="8" height={h} fill={`url(#${id}-top)`} />
              <rect x={x} y={y} width="2.6" height={h} fill="#fff" opacity="0.28" />
            </g>
          )
        })}
        {/* o‘sish strelkasi */}
        <path d="M6 24.5 15.5 17l6 3.5L35 8.5" fill="none" stroke={GOLD.deep} strokeOpacity="0.35"
          strokeWidth="3.6" strokeLinecap="round" strokeLinejoin="round" transform="translate(0 1.4)" />
        <path d="M6 24.5 15.5 17l6 3.5L35 8.5" fill="none" stroke={`url(#${id}-gold)`}
          strokeWidth="3.6" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M30 6.5h7.5V14Z" fill={GOLD.base} stroke={GOLD.base} strokeWidth="2" strokeLinejoin="round" />
      </>
    )
  },

  shield: (id, p) => {
    const d = 'M22.5 4.6a4 4 0 0 1 3 0l12.3 4.8A3 3 0 0 1 39.7 12v10.5c0 10-7 17.2-14.4 20.2a3.4 3.4 0 0 1-2.6 0C15.3 39.7 8.3 32.5 8.3 22.5V12a3 3 0 0 1 1.9-2.6Z'
    return (
      <>
        <path d={d} fill={`url(#${id}-side)`} transform="translate(0 2.6)" />
        <path d={d} fill={`url(#${id}-top)`} />
        <path d={d} fill="none" stroke="#fff" strokeOpacity="0.45" strokeWidth="1.6"
          transform="translate(24 23) scale(.8) translate(-24 -23)" />
        <path d="M22.5 4.6a4 4 0 0 1 3 0L37 9.1C31 12 21 13 10 19v-7a3 3 0 0 1 1.9-2.6Z" fill={`url(#${id}-gloss)`} opacity="0.6" />
        <path d="M17 23.5l5 5 9.5-10" fill="none" stroke={p.deep} strokeOpacity="0.35" strokeWidth="4"
          strokeLinecap="round" strokeLinejoin="round" transform="translate(0 1.3)" />
        <path d="M17 23.5l5 5 9.5-10" fill="none" stroke="#fff" strokeWidth="4"
          strokeLinecap="round" strokeLinejoin="round" />
      </>
    )
  },

  briefcase: (id, p) => (
    <>
      <path d="M17.5 14v-3.5A3.5 3.5 0 0 1 21 7h6a3.5 3.5 0 0 1 3.5 3.5V14" fill="none"
        stroke={p.deep} strokeWidth="3.2" strokeLinecap="round" />
      <rect x="5" y="15.5" width="38" height="26" rx="5.5" fill={`url(#${id}-side)`} />
      <rect x="5" y="13" width="38" height="26" rx="5.5" fill={`url(#${id}-top)`} />
      <path d="M5 24.5c6 2.2 12 3.3 19 3.3s13-1.1 19-3.3" fill="none" stroke={p.deep} strokeOpacity="0.35" strokeWidth="1.6" />
      <path d="M10.5 13h27a5.5 5.5 0 0 1 5.5 5.5v1.5C30 17 18 17 5 21v-2.5a5.5 5.5 0 0 1 5.5-5.5Z" fill={`url(#${id}-gloss)`} opacity="0.55" />
      {/* qulf */}
      <rect x="19.5" y="23.8" width="9" height="8" rx="2.2" fill={GOLD.deep} opacity="0.45" />
      <rect x="19.5" y="22.2" width="9" height="8" rx="2.2" fill={`url(#${id}-gold)`} />
      <Star8 cx={24} cy={26.2} s={3.4} fill={GOLD.deep} />
    </>
  ),

  heart: (id, p) => {
    const d = 'M24 40c-13-8-19-15.3-19-23C5 11 9.4 6.5 15 6.5c3.7 0 6.8 2 9 5 2.2-3 5.3-5 9-5 5.6 0 10 4.5 10 10.5 0 7.7-6 15-19 23Z'
    return (
      <>
        <path d={d} fill={`url(#${id}-side)`} transform="translate(0 2.6)" />
        <path d={d} fill={`url(#${id}-top)`} />
        <ellipse cx="14.5" cy="14" rx="5.5" ry="3.8" fill="#fff" opacity="0.55" transform="rotate(-30 14.5 14)" />
        <circle cx="10.8" cy="19.6" r="1.3" fill="#fff" opacity="0.7" />
        {/* zakot tangasi */}
        <circle cx="35" cy="36.5" r="8.4" fill={GOLD.dark} />
        <circle cx="35" cy="34.8" r="8.4" fill={`url(#${id}-gold)`} />
        <circle cx="35" cy="34.8" r="6" fill="none" stroke={GOLD.dark} strokeOpacity="0.5" strokeWidth="1" />
        <Star8 cx={35} cy={34.8} s={5.4} fill="#fff" dot={GOLD.base} />
      </>
    )
  },
}

SHAPES.quote = (id, p) => {
  // bitta qo‘shtirnoq: dumaloq bosh + egilgan dum
  const q = 'M0 0a7.5 7.5 0 1 1 12.4 5.7C10.6 11 7.4 15 2.4 17.6c-1 .5-1.9-.7-1.2-1.6 1.7-2.3 2.6-4.6 2.8-7.1A7.5 7.5 0 0 1 0 0Z'
  return (
    <>
      {[6.5, 26].map((x) => (
        <g key={x} transform={`translate(${x} 14.5)`}>
          <path d={q} fill={`url(#${id}-side)`} transform="translate(0 2.6)" />
          <path d={q} fill={`url(#${id}-top)`} />
          <ellipse cx="4.6" cy="-3.2" rx="3.4" ry="2.1" fill="#fff" opacity="0.6" transform="rotate(-28 4.6 -3.2)" />
        </g>
      ))}
    </>
  )
}

SHAPES.trophy = (id, p) => (
  <>
    {/* tutqichlar */}
    <path d="M13.5 11H8.2a1.6 1.6 0 0 0-1.6 1.8c.6 5.2 3.6 8.4 8.4 9.2M34.5 11h5.3a1.6 1.6 0 0 1 1.6 1.8c-.6 5.2-3.6 8.4-8.4 9.2"
      fill="none" stroke={p.dark} strokeWidth="3" strokeLinecap="round" />
    {/* kosa */}
    <path d="M13 7.5h22v10.5a11 11 0 0 1-22 0Z" fill={`url(#${id}-side)`} transform="translate(0 2.2)" />
    <path d="M13 7.5h22v10.5a11 11 0 0 1-22 0Z" fill={`url(#${id}-top)`} />
    <rect x="13" y="6" width="22" height="3.4" rx="1.7" fill={p.light} />
    <path d="M16 10h5v8.5c0 2.8 1 5 2.6 6.6C19 24.6 16 21.4 16 17Z" fill="#fff" opacity="0.4" />
    <Star8 cx={26.5} cy={17} s={6.4} fill="#fff" dot={p.base} />
    {/* oyoq va poydevor */}
    <rect x="21.5" y="28.5" width="5" height="6" fill={`url(#${id}-side)`} />
    <rect x="14" y="37" width="20" height="5.5" rx="2" fill={p.deep} />
    <rect x="14" y="34.5" width="20" height="5.5" rx="2" fill={`url(#${id}-top)`} />
    <rect x="16" y="35.3" width="7" height="1.4" rx=".7" fill="#fff" opacity="0.6" />
  </>
)

export default function DirIcon({ name, size = 48 }) {
  const id = 'di' + useId().replace(/[^a-zA-Z0-9]/g, '')
  const p = PALETTES[name] || PALETTES.book
  const shape = SHAPES[name] || SHAPES.book
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true" className="dir-icon3d">
      <Defs id={id} p={p} />
      <g filter={`url(#${id}-sh)`}>{shape(id, p)}</g>
    </svg>
  )
}
