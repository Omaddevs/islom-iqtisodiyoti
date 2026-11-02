// Kichik grafik komponentlari: sparkline'li statistika kartasi va donut
import { Icon, cx } from './kit.jsx'

const D = 864e5

// Kunlik qatorni (oxirgi n kun) yig'ish — sparkline uchun
export const series = (n, fn) => Array.from({ length: n }, (_, i) => fn(Date.now() - (n - 1 - i) * D))
export const endOfDay = (ts) => { const d = new Date(ts); d.setHours(23, 59, 59, 999); return d.getTime() }

export function Sparkline({ data, color }) {
  const w = 104, h = 40, max = Math.max(...data), min = Math.min(...data), span = max - min || 1
  const pts = data.map((v, i) => [(i / (data.length - 1)) * w, h - 6 - ((v - min) / span) * (h - 14)])
  // Silliq egri chiziq (catmull-rom → bezier)
  const d = pts.reduce((acc, p, i, a) => {
    if (!i) return `M${p[0]},${p[1]}`
    const p0 = a[i - 2] || a[i - 1], p1 = a[i - 1], p3 = a[i + 1] || p
    const c1 = [p1[0] + (p[0] - p0[0]) / 6, p1[1] + (p[1] - p0[1]) / 6], c2 = [p[0] - (p3[0] - p1[0]) / 6, p[1] - (p3[1] - p1[1]) / 6]
    return `${acc} C${c1[0]},${c1[1]} ${c2[0]},${c2[1]} ${p[0]},${p[1]}`
  }, '')
  const id = `sp${color.replace('#', '')}`
  return (
    <svg className="ptst__spark" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden="true">
      <defs><linearGradient id={id} x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor={color} stopOpacity=".22" /><stop offset="1" stopColor={color} stopOpacity="0" /></linearGradient></defs>
      <path d={`${d} L${w},${h} L0,${h} Z`} fill={`url(#${id})`} />
      <path d={d} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

export function StatSpark({ icon, tone, color, value, label, data, onClick }) {
  return (
    <button type="button" className={cx('pstat', `pstat--${tone}`, 'ptst')} onClick={onClick}>
      <span className="pstat__icon"><Icon name={icon} size={28} /></span>
      <span className="pstat__body"><span className="pstat__value">{value}</span><span className="pstat__label">{label}</span></span>
      <Sparkline data={data} color={color} />
      <span className="pstat__arrow"><Icon name="chevRight" size={16} /></span>
    </button>
  )
}

export function Donut({ parts, center, sub }) {
  const total = parts.reduce((s, p) => s + p.value, 0)
  const r = 54, c = 2 * Math.PI * r, gap = total > 1 ? 3 : 0
  let off = 0
  return (
    <div className="ptdonut">
      <svg viewBox="0 0 140 140" aria-hidden="true">
        <circle cx="70" cy="70" r={r} fill="none" stroke="#edf1f6" strokeWidth="16" />
        {total > 0 && parts.filter((p) => p.value).map((p) => {
          const len = (p.value / total) * c
          const el = <circle key={p.key} cx="70" cy="70" r={r} fill="none" stroke={p.color} strokeWidth="16" strokeDasharray={`${Math.max(len - gap, 0.1)} ${c}`} strokeDashoffset={-off} transform="rotate(-90 70 70)" />
          off += len
          return el
        })}
      </svg>
      <div className="ptdonut__c"><b>{center}</b><span>{sub}</span></div>
    </div>
  )
}

// Kichik ustunli grafik — oxirgi qiymatlar dinamikasi (ochdan to'qqa)
export function MiniBars({ data, color }) {
  const max = Math.max(...data, 1)
  return (
    <span className="pbars" aria-hidden="true">
      {data.map((v, i) => (
        <i key={i} style={{ height: `${Math.max(14, (v / max) * 100)}%`, background: color, opacity: 0.28 + (0.72 * (i + 1)) / data.length }} />
      ))}
    </span>
  )
}

export function StatBars({ icon, tone, color, value, label, trend, data, onClick }) {
  return (
    <button type="button" className={cx('pstat', `pstat--${tone}`, 'ptst', 'pastat')} onClick={onClick}>
      <span className="pstat__icon"><Icon name={icon} size={28} /></span>
      <span className="pstat__body">
        <span className="pstat__value">{value}</span>
        <span className="pstat__label">{label}</span>
        {trend && <span className="pstat__trend"><Icon name="trending" size={13} stroke={2.2} />{trend}</span>}
      </span>
      <MiniBars data={data} color={color} />
    </button>
  )
}
