// Platforma UI to'plami: karta, tugma, belgi, modal, jadval, tab, bo'sh holat, toast va h.k.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { Icon } from '../../components/ui.jsx'
import { initials } from '../store/ids.js'

export { Icon }

export const cx = (...a) => a.filter(Boolean).join(' ')

// ---------- Tugma ----------
export function Btn({ variant = 'default', size = 'md', icon, children, className, as: Tag = 'button', ...rest }) {
  return (
    <Tag className={cx('pbtn', `pbtn--${variant}`, size !== 'md' && `pbtn--${size}`, !children && 'pbtn--icon', className)} {...rest}>
      {icon && <Icon name={icon} size={size === 'sm' ? 15 : 17} stroke={2} />}
      {children}
    </Tag>
  )
}

// ---------- Karta ----------
export function Card({ title, sub, action, children, className, pad = true, ...rest }) {
  return (
    <section className={cx('pcard', !pad && 'pcard--flush', className)} {...rest}>
      {(title || action) && (
        <header className="pcard__head">
          <div>
            {title && <h3 className="pcard__title">{title}</h3>}
            {sub && <p className="pcard__sub">{sub}</p>}
          </div>
          {action && <div className="pcard__action">{action}</div>}
        </header>
      )}
      {children}
    </section>
  )
}

// ---------- Belgi (badge) ----------
export function Badge({ tone = 'gray', dot, children, className }) {
  return <span className={cx('pbadge', `pbadge--${tone}`, dot && 'pbadge--dot', className)}>{children}</span>
}

// ---------- Avatar ----------
export function UAvatar({ user, size = 36, ring, className }) {
  if (!user) return <span className="pavatar pavatar--empty" style={{ width: size, height: size }} />
  return (
    <span className={cx('pavatar', ring && 'pavatar--ring', className)} title={user.name}
      style={{ width: size, height: size, fontSize: size * 0.36, background: user.avatarColor || '#4aa3f8' }}>
      {initials(user.name)}
    </span>
  )
}

// Guruh avatarlari qatori: bir nechta foydalanuvchi + "+N"
export function AvatarStack({ users = [], max = 4, size = 28 }) {
  const shown = users.slice(0, max)
  const rest = users.length - shown.length
  return (
    <span className="pstack" style={{ '--sz': `${size}px` }}>
      {shown.map((u) => <UAvatar key={u.id} user={u} size={size} ring />)}
      {rest > 0 && <span className="pstack__more" style={{ width: size, height: size }}>+{rest}</span>}
    </span>
  )
}

// ---------- Statistika plitkasi ----------
export function Stat({ icon, label, value, hint, trend, tone = 'blue', href }) {
  const Tag = href ? 'a' : 'div'
  return (
    <Tag href={href} className={cx('pstat', `pstat--${tone}`)}>
      <span className="pstat__icon"><Icon name={icon} size={22} /></span>
      <span className="pstat__body">
        <span className="pstat__value">{value}</span>
        <span className="pstat__label">{label}</span>
        {trend && <span className="pstat__trend"><Icon name="trending" size={13} stroke={2.2} />{trend}</span>}
        {hint && !trend && <span className="pstat__hint">{hint}</span>}
      </span>
      {href && <span className="pstat__arrow"><Icon name="arrowRight" size={16} /></span>}
    </Tag>
  )
}

// ---------- Progress ----------
export function Progress({ value = 0, tone = 'blue', label, size = 'md' }) {
  const v = Math.max(0, Math.min(100, Math.round(value)))
  return (
    <span className={cx('pprog', `pprog--${tone}`, size === 'sm' && 'pprog--sm')} role="progressbar" aria-valuenow={v} aria-valuemin={0} aria-valuemax={100}>
      <span className="pprog__bar" style={{ width: `${v}%` }} />
      {label && <span className="pprog__label">{label}</span>}
    </span>
  )
}

// ---------- Bo'sh holat ----------
export function Empty({ icon = 'layers', title, text, action }) {
  return (
    <div className="pempty">
      <span className="pempty__icon"><Icon name={icon} size={28} /></span>
      <h4>{title}</h4>
      {text && <p>{text}</p>}
      {action && <div className="pempty__action">{action}</div>}
    </div>
  )
}

// ---------- Tablar ----------
export function Tabs({ items, value, onChange, className }) {
  return (
    <div className={cx('ptabs', className)} role="tablist">
      {items.map((t) => (
        <button key={t.value} role="tab" aria-selected={value === t.value} className={cx('ptabs__tab', value === t.value && 'is-active')}
          onClick={() => onChange(t.value)}>
          {t.icon && <Icon name={t.icon} size={16} />}
          {t.label}
          {t.count != null && <span className="ptabs__count">{t.count}</span>}
        </button>
      ))}
    </div>
  )
}

// ---------- Qidiruv ----------
export function Search({ value, onChange, placeholder = 'Qidirish…', className }) {
  return (
    <label className={cx('psearch', className)}>
      <Icon name="search" size={17} />
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
      {value && <button type="button" onClick={() => onChange('')} aria-label="Tozalash"><Icon name="x" size={14} /></button>}
    </label>
  )
}

// ---------- Forma elementlari ----------
export function FField({ label, hint, error, children, className }) {
  return (
    <label className={cx('pfield', error && 'is-error', className)}>
      {label && <span className="pfield__label">{label}</span>}
      {children}
      {error ? <span className="pfield__error">{error}</span> : hint ? <span className="pfield__hint">{hint}</span> : null}
    </label>
  )
}
export const Input = (p) => <input className="pinput" {...p} />
export const Textarea = (p) => <textarea className="pinput pinput--area" {...p} />
export function Select({ options, value, onChange, placeholder, ...rest }) {
  return (
    <span className="pselect">
      <select className="pinput" value={value ?? ''} onChange={(e) => onChange(e.target.value)} {...rest}>
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <Icon name="chevDown" size={16} />
    </span>
  )
}
// Bir nechta guruh tanlash: chip'lar
export function ChipSelect({ options, value = [], onChange, allLabel }) {
  const toggle = (v) => onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v])
  return (
    <div className="pchips">
      {allLabel && (
        <button type="button" className={cx('pchip', value.length === 0 && 'is-on')} onClick={() => onChange([])}>{allLabel}</button>
      )}
      {options.map((o) => (
        <button key={o.value} type="button" className={cx('pchip', value.includes(o.value) && 'is-on')} onClick={() => toggle(o.value)}
          style={o.color ? { '--chip': o.color } : undefined}>
          {o.color && <i />}{o.label}
        </button>
      ))}
    </div>
  )
}

// ---------- Modal ----------
export function Modal({ open, onClose, title, sub, children, footer, width = 560 }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e) => e.key === 'Escape' && onClose?.()
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = '' }
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="pmodal" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className="pmodal__box" style={{ maxWidth: width }} role="dialog" aria-modal="true">
        <header className="pmodal__head">
          <div>
            <h3>{title}</h3>
            {sub && <p>{sub}</p>}
          </div>
          <button className="pmodal__x" onClick={onClose} aria-label="Yopish"><Icon name="x" size={18} /></button>
        </header>
        <div className="pmodal__body">{children}</div>
        {footer && <footer className="pmodal__foot">{footer}</footer>}
      </div>
    </div>
  )
}

// Tasdiqlash oynasi
export function Confirm({ open, onClose, onConfirm, title, text, danger, confirmLabel = 'Tasdiqlash' }) {
  return (
    <Modal open={open} onClose={onClose} title={title} width={440}
      footer={<>
        <Btn onClick={onClose}>Bekor qilish</Btn>
        <Btn variant={danger ? 'danger' : 'primary'} onClick={() => { onConfirm(); onClose() }}>{confirmLabel}</Btn>
      </>}>
      <p className="pmuted">{text}</p>
    </Modal>
  )
}

// ---------- Ochiluvchi menyu ----------
export function Menu({ items, align = 'right', trigger }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  useEffect(() => {
    if (!open) return
    const onDoc = (e) => !ref.current?.contains(e.target) && setOpen(false)
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])
  return (
    <span className="pmenu" ref={ref}>
      <span onClick={() => setOpen((v) => !v)}>{trigger || <Btn variant="ghost" icon="moreV" aria-label="Amallar" />}</span>
      {open && (
        <div className={cx('pmenu__list', `pmenu__list--${align}`)}>
          {items.filter(Boolean).map((it, i) => it === 'sep'
            ? <hr key={i} />
            : (
              <button key={it.label} className={cx('pmenu__item', it.danger && 'is-danger')} onClick={() => { setOpen(false); it.onClick() }}>
                {it.icon && <Icon name={it.icon} size={16} />}{it.label}
              </button>
            ))}
        </div>
      )}
    </span>
  )
}

// ---------- Jadval ----------
export function Table({ cols, rows, keyFn = (r) => r.id, empty, onRow }) {
  if (!rows.length && empty) return empty
  return (
    <div className="ptable-wrap">
      <table className="ptable">
        <thead>
          <tr>{cols.map((c) => <th key={c.key} style={{ width: c.w }} className={c.align ? `is-${c.align}` : ''}>{c.label}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={keyFn(r)} onClick={onRow ? () => onRow(r) : undefined} className={onRow ? 'is-click' : ''}>
              {cols.map((c) => <td key={c.key} className={c.align ? `is-${c.align}` : ''}>{c.render ? c.render(r) : r[c.key]}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ---------- Nusxalash tugmasi ----------
export function CopyBtn({ text, label = 'Nusxalash' }) {
  const [done, setDone] = useState(false)
  const copy = async () => {
    try { await navigator.clipboard.writeText(text) } catch { /* clipboard bloklangan */ }
    setDone(true); setTimeout(() => setDone(false), 1500)
  }
  return <Btn size="sm" variant={done ? 'success' : 'default'} icon={done ? 'check' : 'copy'} onClick={copy}>{done ? 'Nusxalandi' : label}</Btn>
}

// Yaratilgan login/parolni ko'rsatish
export function Credentials({ user, note }) {
  if (!user) return null
  const text = `Platforma: ${location.origin}${location.pathname}#/kirish\nIsm: ${user.name}\nTelefon: ${user.phone}\nParol: ${user.password}`
  return (
    <div className="pcreds">
      <div className="pcreds__head">
        <Icon name="key" size={18} />
        <div>
          <b>Kirish ma’lumotlari</b>
          <span>{note || 'Ushbu ma’lumotlarni foydalanuvchiga yetkazing. Parolni keyin o‘zgartirish mumkin.'}</span>
        </div>
      </div>
      <dl>
        <div><dt>Ism</dt><dd>{user.name}</dd></div>
        <div><dt>Telefon (login)</dt><dd className="mono">{user.phone}</dd></div>
        <div><dt>Parol</dt><dd className="mono">{user.password}</dd></div>
      </dl>
      <CopyBtn text={text} label="Hammasini nusxalash" />
    </div>
  )
}

// ---------- Toast ----------
const ToastCtx = createContext(() => {})
export function ToastProvider({ children }) {
  const [list, setList] = useState([])
  const push = useCallback((text, tone = 'ok') => {
    const id = Math.random().toString(36).slice(2)
    setList((l) => [...l, { id, text, tone }])
    setTimeout(() => setList((l) => l.filter((t) => t.id !== id)), 3200)
  }, [])
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="ptoasts" aria-live="polite">
        {list.map((t) => (
          <div key={t.id} className={cx('ptoast', `ptoast--${t.tone}`)}>
            <Icon name={t.tone === 'ok' ? 'checkCircle' : 'alertCircle'} size={18} />{t.text}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  )
}
export const useToast = () => useContext(ToastCtx)

// ---------- Sahifa sarlavhasi ----------
export function PageHead({ title, sub, actions, crumbs, icon }) {
  return (
    <div className="phead">
      <div className={cx(icon && 'phead__ttl')}>
        {icon && <span className="phead__icon"><Icon name={icon} size={26} /></span>}
        <div>
          {crumbs && (
            <nav className="pcrumbs">
              {crumbs.map((c, i) => (
                <span key={i}>{c.href ? <a href={c.href}>{c.label}</a> : <b>{c.label}</b>}{i < crumbs.length - 1 && <Icon name="chevRight" size={14} />}</span>
              ))}
            </nav>
          )}
          <h1>{title}</h1>
          {sub && <p>{sub}</p>}
        </div>
      </div>
      {actions && <div className="phead__actions">{actions}</div>}
    </div>
  )
}

// Foydali hook: `useMemo` bilan qidiruv
export function useFilter(list, query, fields) {
  return useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return list
    return list.filter((x) => fields.some((f) => String(x[f] ?? '').toLowerCase().includes(q)))
  }, [list, query, fields])
}
