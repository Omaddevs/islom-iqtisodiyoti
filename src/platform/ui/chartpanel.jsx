// Tanlanadigan grafiklar: bitta ma'lumot turli ko'rinishda (ustunli, gorizontal, chiziqli, maydonli, doiraviy, halqali, radar, jadval).
// Tashqi kutubxonasiz, SVG/HTML. Har bir qiymat kursor, klaviatura va jadval orqali o'qiladi.
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Icon, cx } from './kit.jsx'

const SERIES = '#2a78d6'
// Tekshirilgan tartib (scripts/validate_palette): ketma-ket ranglar rang ko'rligida ham ajraladi
const CATEGORICAL = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#6250d6', '#e34948']
const OTHER = '#aab4c2'
const INK = '#14213a', INK_2 = '#5b6779', GRID = '#e6ebf2', SURFACE = '#ffffff'

const G = ({ children }) => <svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>
export const CHART_TYPES = [
  { key: 'column', label: 'Ustunli', icon: <G><path d="M4 17V10M10 17V4M16 17v-5" strokeWidth="2.6" /></G> },
  { key: 'bar', label: 'Gorizontal', icon: <G><path d="M3 4h9M3 10h14M3 16h6" strokeWidth="2.6" /></G> },
  { key: 'line', label: 'Chiziqli', icon: <G><path d="M2.5 14.5 7.5 9l3.5 3 6.5-7.5" /></G> },
  { key: 'area', label: 'Maydonli', icon: <G><path d="M2.5 16.5v-4L7.5 8l3.5 3 6-6v11.5z" fill="currentColor" fillOpacity=".22" /></G> },
  { key: 'pie', label: 'Doiraviy', icon: <G><circle cx="10" cy="10" r="7.5" /><path d="M10 2.5V10l5.5 5" /></G> },
  { key: 'donut', label: 'Halqali', icon: <G><circle cx="10" cy="10" r="7.5" /><circle cx="10" cy="10" r="3.2" /></G> },
  { key: 'radar', label: 'Radar', icon: <G><path d="m10 2.5 7 5-2.7 8.5H5.7L3 7.5z" /><path d="m10 7 2.8 2-1 3.4H8.2l-1-3.4z" /></G> },
  { key: 'table', label: 'Jadval', icon: <G><rect x="2.5" y="3.5" width="15" height="13" rx="2" /><path d="M2.5 8.2h15M2.5 12.4h15M8 8.2v8.3" /></G> },
]

// Ushbu ma'lumot uchun grafik turi nega mavjud emas (bo'lsa — sabab matni)
function unavailable(type, ds) {
  const n = ds.rows.length
  if ((type === 'pie' || type === 'donut') && !ds.parts) return `«${ds.label}» umumiy miqdorning qismlari emas — doiraviy grafik noto‘g‘ri xulosaga olib keladi`
  if ((type === 'line' || type === 'area') && n < 2) return 'Bu grafik uchun kamida 2 ta qiymat kerak'
  if (type === 'radar' && n < 3) return 'Radar uchun kamida 3 ta qiymat kerak'
  if (type === 'radar' && n > 16) return 'Radar uchun qiymatlar juda ko‘p — ustunli yoki gorizontal grafikni tanlang'
  return null
}

function useWidth() {
  const ref = useRef(null)
  const [w, setW] = useState(0)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return undefined
    setW(el.clientWidth)
    const ro = new ResizeObserver(() => setW(el.clientWidth))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, w]
}

// Bitta maslahat oynasi: kursor va klaviatura uchun
function useTip(rootRef) {
  const [tip, setTip] = useState(null)
  const at = (row, clientX, clientY) => {
    const r = rootRef.current?.getBoundingClientRect()
    if (r) setTip({ row, x: clientX - r.left, y: clientY - r.top })
  }
  const bind = (row, onHover) => ({
    tabIndex: 0,
    role: 'img',
    'aria-label': `${row.label}: ${row.shown}`,
    onPointerEnter: (e) => { onHover?.(row); at(row, e.clientX, e.clientY) },
    onPointerMove: (e) => at(row, e.clientX, e.clientY),
    onPointerLeave: () => { onHover?.(null); setTip(null) },
    onFocus: (e) => { const b = e.currentTarget.getBoundingClientRect(); onHover?.(row); at(row, b.left + b.width / 2, b.top + Math.min(b.height / 2, 30)) },
    onBlur: () => { onHover?.(null); setTip(null) },
  })
  return [tip, bind]
}

function Tip({ tip, width }) {
  if (!tip) return null
  const half = Math.min(115, width / 2)
  const left = Math.max(half, Math.min(tip.x, width - half))
  const below = tip.y < 74
  return (
    <div className="pch__tip" style={{ left, top: tip.y, transform: `translate(-50%, ${below ? '16px' : 'calc(-100% - 12px)'})`, maxWidth: half * 2 }}>
      <b>{tip.row.shown}</b>
      <span>{tip.row.label}</span>
    </div>
  )
}

// ---- O'qlar ----
function niceTicks(max, fixed) {
  if (fixed) return [0, 0.25, 0.5, 0.75, 1].map((f) => f * fixed)
  const top = Math.max(1, max)
  const raw = top / 4
  const mag = 10 ** Math.floor(Math.log10(raw))
  const step = Math.max(1, [1, 2, 5, 10].map((m) => m * mag).find((s) => s >= raw))
  const out = []
  for (let v = 0; v < top + step; v += step) { out.push(v); if (v >= top) break }
  return out
}
const clip = (s, n) => (String(s).length > n ? `${String(s).slice(0, Math.max(1, n - 1))}…` : String(s))
const short = (r) => r.short ?? r.label

function useScale(rows, ds, width, height) {
  return useMemo(() => {
    const pad = { l: 42, r: 14, t: 26, b: 34 }
    const ticks = niceTicks(Math.max(...rows.map((r) => r.value), 0), ds.max)
    const top = ticks[ticks.length - 1] || 1
    const pw = Math.max(1, width - pad.l - pad.r), ph = height - pad.t - pad.b
    const band = pw / rows.length
    const y = (v) => pad.t + ph - (v / top) * ph
    const every = Math.max(1, Math.ceil(30 / band))
    return { pad, ticks, pw, ph, band, y, every, x: (i) => pad.l + band * (i + 0.5), base: pad.t + ph, chars: Math.max(2, Math.floor((band * every) / 7)) }
  }, [rows, ds.max, width, height])
}

function Axes({ s, rows, width, unit }) {
  return (
    <g className="pch__axes">
      {s.ticks.map((t) => (
        <g key={t}>
          <line x1={s.pad.l} x2={width - s.pad.r} y1={s.y(t)} y2={s.y(t)} stroke={GRID} />
          <text x={s.pad.l - 8} y={s.y(t) + 4} textAnchor="end" fill={INK_2} fontSize="11.5">{t}{unit}</text>
        </g>
      ))}
      {rows.map((r, i) => i % s.every === 0 && <text key={r.key} x={s.x(i)} y={s.base + 20} textAnchor="middle" fill={INK_2} fontSize="11.5">{clip(short(r), s.chars)}</text>)}
    </g>
  )
}

// ---- Ustunli ----
function Column({ ds, width, bind }) {
  const rows = ds.rows, height = 290
  const s = useScale(rows, ds, width, height)
  const [hover, setHover] = useState(null)
  const bw = Math.min(24, Math.max(4, s.band - 4)), rad = Math.min(4, bw / 2)
  const showCaps = rows.length <= 10 && s.band >= 38
  return (
    <svg width={width} height={height} className="pch__svg" role="group" aria-label={ds.label}>
      <Axes s={s} rows={rows} width={width} unit={ds.unit || ''} />
      {rows.map((r, i) => {
        const h = Math.max(s.base - s.y(r.value), r.value > 0 ? 3 : 0), x = s.x(i) - bw / 2, y = s.base - h
        return (
          <g key={r.key} className={cx('pch__mark', hover && hover.key !== r.key && 'is-dim')}>
            {h > 0
              ? <path d={`M${x},${s.base} V${y + Math.min(rad, h)} Q${x},${y} ${x + rad},${y} H${x + bw - rad} Q${x + bw},${y} ${x + bw},${y + Math.min(rad, h)} V${s.base} Z`} fill={r.color || SERIES} />
              : <rect x={x} y={s.base - 4} width={bw} height={4} rx="1.5" fill={r.color || OTHER} />}
            {showCaps && <text x={s.x(i)} y={y - 8} textAnchor="middle" fill={INK} fontSize="12" fontWeight="600">{r.value}{ds.unit || ''}</text>}
            <rect {...bind(r, setHover)} x={s.x(i) - s.band / 2} y={s.pad.t - 10} width={s.band} height={s.ph + 44} fill="transparent" className="pch__hit" />
          </g>
        )
      })}
    </svg>
  )
}

// ---- Gorizontal (HTML: uzun nomlar kesilmaydi) ----
function Bars({ ds, bind }) {
  const [hover, setHover] = useState(null)
  const top = ds.max || Math.max(...ds.rows.map((r) => r.value), 1)
  return (
    <div className="pch__bars" role="group" aria-label={ds.label}>
      {ds.rows.map((r) => (
        <div key={r.key} {...bind(r, setHover)} className={cx('pch__brow', hover && hover.key !== r.key && 'is-dim')}>
          <span className="pch__blabel" title={r.label}>{r.label}</span>
          <span className="pch__btrack"><i style={{ width: `${(r.value / top) * 100}%`, background: r.color || SERIES }} /></span>
          <b>{r.value}{ds.unit || ''}</b>
        </div>
      ))}
    </div>
  )
}

// ---- Chiziqli va maydonli ----
function Line({ ds, width, bind, area }) {
  const rows = ds.rows, height = 290
  const s = useScale(rows, ds, width, height)
  const [hover, setHover] = useState(null)
  const pts = rows.map((r, i) => [s.x(i), s.y(r.value)])
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0]},${p[1]}`).join(' ')
  const maxI = rows.reduce((b, r, i) => (r.value > rows[b].value ? i : b), 0)
  const labelled = rows.length <= 6 ? rows.map((_, i) => i) : [...new Set([maxI, rows.length - 1])]
  const hi = hover ? rows.findIndex((r) => r.key === hover.key) : -1
  return (
    <svg width={width} height={height} className="pch__svg" role="group" aria-label={ds.label}>
      <Axes s={s} rows={rows} width={width} unit={ds.unit || ''} />
      {area && <path d={`${d} L${pts[pts.length - 1][0]},${s.base} L${pts[0][0]},${s.base} Z`} fill={SERIES} fillOpacity=".12" />}
      <path d={d} fill="none" stroke={SERIES} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      {hi >= 0 && <line x1={pts[hi][0]} x2={pts[hi][0]} y1={s.pad.t} y2={s.base} stroke="#9aa7b8" />}
      {rows.map((r, i) => (
        <g key={r.key}>
          <circle cx={pts[i][0]} cy={pts[i][1]} r={i === hi ? 6 : rows.length > 30 ? 3 : 4.5} fill={r.color || SERIES} stroke={SURFACE} strokeWidth="2" />
          {labelled.includes(i) && <text x={pts[i][0]} y={pts[i][1] - 11} textAnchor="middle" fill={INK} fontSize="12" fontWeight="600">{r.value}{ds.unit || ''}</text>}
        </g>
      ))}
      {rows.map((r, i) => <rect key={r.key} {...bind(r, setHover)} x={s.x(i) - s.band / 2} y={s.pad.t - 10} width={s.band} height={s.ph + 44} fill="transparent" className="pch__hit" />)}
    </svg>
  )
}

// ---- Doiraviy va halqali ----
const arc = (cx0, cy, r, a0, a1) => {
  const p = (a) => [cx0 + r * Math.sin(a), cy - r * Math.cos(a)]
  const [x0, y0] = p(a0), [x1, y1] = p(a1)
  return { x0, y0, x1, y1, large: a1 - a0 > Math.PI ? 1 : 0 }
}
function foldParts(ds) {
  const val = ds.parts.value
  let list = ds.rows.map((r, i) => ({ ...r, part: val(r), color: r.color || CATEGORICAL[i % 8] }))
  if (list.length > 8) {
    const sorted = [...list].sort((a, b) => b.part - a.part)
    const rest = sorted.slice(7)
    list = [...sorted.slice(0, 7).map((r, i) => ({ ...r, color: r.color && ds.rows.length <= 8 ? r.color : CATEGORICAL[i] })),
      { key: 'other', label: `Boshqa (${rest.length} ta)`, part: rest.reduce((n, r) => n + r.part, 0), color: OTHER }]
  }
  const total = list.reduce((n, r) => n + r.part, 0)
  return { list, total }
}
function Pie({ ds, width, bind, donut }) {
  const { list, total } = useMemo(() => foldParts(ds), [ds])
  const [hover, setHover] = useState(null)
  if (!total) return <p className="pch__none">{ds.parts.empty || 'Ko‘rsatish uchun qiymat yo‘q.'}</p>
  const size = Math.min(248, Math.max(180, width < 520 ? width - 40 : 248)), c = size / 2, R = c - 3, inner = donut ? R * 0.63 : 0
  const unitOf = ds.parts.unit ?? ' ta'
  const rows = list.map((r) => ({ ...r, value: r.part, shown: `${r.part}${unitOf} · ${Math.round((r.part / total) * 100)}%` }))
  let a = 0
  const live = rows.filter((r) => r.part > 0)
  return (
    <div className="pch__pie">
      <div className="pch__piebox" style={{ width: size, height: size }}>
        <svg width={size} height={size} role="group" aria-label={ds.parts.label || ds.label}>
          {live.map((r) => {
            const share = r.part / total, a0 = a, a1 = a + share * Math.PI * 2
            a = a1
            const cls = cx('pch__mark', hover && hover.key !== r.key && 'is-dim', 'pch__hit')
            if (live.length === 1) {
              return <circle key={r.key} {...bind(r, setHover)} cx={c} cy={c} r={donut ? (R + inner) / 2 : R} fill={donut ? 'none' : r.color} stroke={donut ? r.color : 'none'} strokeWidth={donut ? R - inner : 0} className={cls} />
            }
            const o = arc(c, c, R, a0, a1), i = arc(c, c, inner, a0, a1)
            const path = inner
              ? `M${o.x0},${o.y0} A${R},${R} 0 ${o.large} 1 ${o.x1},${o.y1} L${i.x1},${i.y1} A${inner},${inner} 0 ${o.large} 0 ${i.x0},${i.y0} Z`
              : `M${c},${c} L${o.x0},${o.y0} A${R},${R} 0 ${o.large} 1 ${o.x1},${o.y1} Z`
            return <path key={r.key} {...bind(r, setHover)} d={path} fill={r.color} stroke={SURFACE} strokeWidth="2" strokeLinejoin="round" className={cls} />
          })}
        </svg>
        {donut && ds.center && <div className="pch__center"><b>{ds.center.value}</b><span>{ds.center.label}</span></div>}
      </div>
      <ul className="pch__legend">
        {rows.map((r) => (
          <li key={r.key} className={cx(hover?.key === r.key && 'is-on', r.part === 0 && 'is-zero')} onPointerEnter={() => setHover(r)} onPointerLeave={() => setHover(null)}>
            <i style={{ background: r.color }} />
            <span title={r.label}>{r.label}</span>
            <b>{r.part}{unitOf}</b>
            <small>{Math.round((r.part / total) * 100)}%</small>
          </li>
        ))}
      </ul>
    </div>
  )
}

// ---- Radar ----
function Radar({ ds, width, bind }) {
  const rows = ds.rows
  const [hover, setHover] = useState(null)
  const size = Math.min(width, 380), height = Math.min(size, 340), c = { x: width / 2, y: height / 2 }, R = height / 2 - 34
  const top = ds.max || Math.max(...rows.map((r) => r.value), 1)
  const ang = (i) => (i / rows.length) * Math.PI * 2
  const pt = (i, f) => [c.x + R * f * Math.sin(ang(i)), c.y - R * f * Math.cos(ang(i))]
  const poly = (f) => rows.map((_, i) => pt(i, f).join(',')).join(' ')
  const vals = rows.map((r, i) => pt(i, r.value / top))
  return (
    <svg width={width} height={height} className="pch__svg" role="group" aria-label={ds.label}>
      {[0.25, 0.5, 0.75, 1].map((f) => <polygon key={f} points={poly(f)} fill="none" stroke={GRID} />)}
      {rows.map((r, i) => { const [x, y] = pt(i, 1); return <line key={r.key} x1={c.x} y1={c.y} x2={x} y2={y} stroke={GRID} /> })}
      <text x={c.x + 4} y={c.y - R + 12} fill={INK_2} fontSize="11">{top}{ds.unit || ''}</text>
      <polygon points={vals.map((p) => p.join(',')).join(' ')} fill={SERIES} fillOpacity=".12" stroke={SERIES} strokeWidth="2" strokeLinejoin="round" />
      {rows.map((r, i) => {
        const [lx, ly] = pt(i, 1 + 18 / R), sin = Math.sin(ang(i))
        return <text key={r.key} x={lx} y={ly + 4} textAnchor={Math.abs(sin) < 0.2 ? 'middle' : sin > 0 ? 'start' : 'end'} fill={INK_2} fontSize="11.5">{clip(short(r), 12)}</text>
      })}
      {rows.map((r, i) => (
        <g key={r.key}>
          <circle cx={vals[i][0]} cy={vals[i][1]} r={hover?.key === r.key ? 6 : 4.5} fill={r.color || SERIES} stroke={SURFACE} strokeWidth="2" />
          <circle {...bind(r, setHover)} cx={vals[i][0]} cy={vals[i][1]} r="14" fill="transparent" className="pch__hit" />
        </g>
      ))}
    </svg>
  )
}

// ---- Jadval ----
function DataTable({ ds }) {
  return (
    <div className="pch__table">
      <table>
        <thead><tr><th>{ds.head?.[0] || 'Nomi'}</th><th>{ds.head?.[1] || 'Qiymat'}</th></tr></thead>
        <tbody>{ds.rows.map((r) => <tr key={r.key}><td>{r.color && <i style={{ background: r.color }} />}{r.label}</td><td>{r.shown}</td></tr>)}</tbody>
      </table>
    </div>
  )
}

const read = (k) => { try { return JSON.parse(localStorage.getItem(k)) || {} } catch { return {} } }
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)) } catch { /* xotira */ } }

// Asosiy panel: ma'lumot turi va grafik turini tanlash. Tanlov brauzerda eslab qolinadi.
export function ChartPanel({ title, icon = 'chart', datasets, storeKey, defaultType = 'column', actions, emptyText = 'Hozircha natija yo‘q.', className, id }) {
  const key = `ii_chart_${storeKey}`
  const [pref, setPref] = useState(() => read(key))
  const [note, setNote] = useState(null)
  const update = (p) => { const next = { ...pref, ...p }; setPref(next); write(key, next); setNote(null) }
  const ds = datasets.find((d) => d.key === pref.dataset) || datasets[0]
  const wanted = pref.type || ds.defaultType || defaultType
  // Tanlangan tur shu ma'lumotga mos kelmasa, afzallik o'zgarmaydi — mos keladigani vaqtincha ko'rsatiladi
  const type = !ds.rows.length || !unavailable(wanted, ds) ? wanted : (['column', 'bar', 'table'].find((t) => !unavailable(t, ds)))
  const rootRef = useRef(null)
  const [plotRef, width] = useWidth()
  const [tip, bind] = useTip(rootRef)
  useEffect(() => { setNote(null) }, [ds.key])
  const typeMeta = CHART_TYPES.find((t) => t.key === type)
  const usesParts = (type === 'pie' || type === 'donut') && ds.parts

  return (
    <section id={id} className={cx('pcard', 'pch', className)}>
      <header className="pch__head">
        <h3 className="pdt"><span className="pdt__ico"><Icon name={icon} size={18} /></span>{title}</h3>
        {actions && <div className="pch__actions">{actions}</div>}
      </header>
      {datasets.length > 1 && (
        <div className="pch__sets" role="group" aria-label="Ko‘rsatkich">
          {datasets.map((d) => <button key={d.key} type="button" aria-pressed={d.key === ds.key} className={cx(d.key === ds.key && 'is-on')} onClick={() => update({ dataset: d.key })}>{d.label}</button>)}
        </div>
      )}
      <div className="pch__types" role="group" aria-label="Grafik turi">
        {CHART_TYPES.map((t) => {
          const why = ds.rows.length ? unavailable(t.key, ds) : null
          return (
            <button key={t.key} type="button" aria-pressed={t.key === type} aria-disabled={!!why} title={why || t.label} aria-label={t.label}
              className={cx(t.key === type && 'is-on', why && 'is-off')}
              onClick={() => (why ? setNote(why) : update({ type: t.key }))}>
              {t.icon}<span>{t.label}</span>
            </button>
          )
        })}
      </div>
      {note && <p className="pch__note" role="status"><Icon name="info" size={15} />{note}</p>}
      <p className="pch__sub">{usesParts ? ds.parts.label : ds.sub}</p>
      <div className="pch__plot" ref={(el) => { plotRef.current = el; rootRef.current = el }}>
        {ds.rows.length === 0 ? <p className="pch__none">{ds.empty || emptyText}</p>
          : width > 0 && (
            <div key={`${ds.key}-${type}`} className="pch__anim">
              {type === 'column' && <Column ds={ds} width={width} bind={bind} />}
              {type === 'bar' && <Bars ds={ds} bind={bind} />}
              {type === 'line' && <Line ds={ds} width={width} bind={bind} />}
              {type === 'area' && <Line ds={ds} width={width} bind={bind} area />}
              {type === 'pie' && <Pie ds={ds} width={width} bind={bind} />}
              {type === 'donut' && <Pie ds={ds} width={width} bind={bind} donut />}
              {type === 'radar' && <Radar ds={ds} width={width} bind={bind} />}
              {type === 'table' && <DataTable ds={ds} />}
            </div>
          )}
        <Tip tip={tip} width={width} />
      </div>
      <span className="pch__sr" aria-live="polite">{typeMeta?.label}</span>
    </section>
  )
}
