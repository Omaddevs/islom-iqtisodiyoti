// Umumiy qidiruv (topbar): foydalanuvchi, guruh, tashkilot, dars, material… bo'yicha tez o'tish
import { useEffect, useMemo, useRef, useState } from 'react'
import { Icon, cx } from '../ui/kit.jsx'
import { useAuth } from '../store/auth.jsx'
import { ROLES } from '../store/seed.js'

// Tor ekran (telefon) — qisqa placeholder uchun
function useNarrow() {
  const [narrow, setNarrow] = useState(() => window.matchMedia('(max-width: 640px)').matches)
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 640px)')
    const on = (e) => setNarrow(e.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  return narrow
}

export default function GlobalSearch({ className }) {
  const { user, db, scope } = useAuth()
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const [cur, setCur] = useState(0)
  const ref = useRef(null)
  const inputRef = useRef(null)
  const staff = user.role !== 'student'
  const narrow = useNarrow()

  const results = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (s.length < 2) return []
    const hit = (...f) => f.some((v) => String(v || '').toLowerCase().includes(s))
    const out = []
    if (user.role === 'superadmin') db.organizations.filter((o) => hit(o.name)).forEach((o) => out.push({ id: o.id, icon: 'bank', title: o.name, sub: 'Tashkilot', href: '#/platform/organizations', color: o.color }))
    if (staff) scope.users.filter((u) => hit(u.name, u.phone)).forEach((u) => out.push({ id: u.id, icon: 'user', title: u.name, sub: ROLES[u.role].label, href: `#/platform/users?role=${u.role}`, color: u.avatarColor }))
    scope.groups.filter((g) => hit(g.name, g.course)).forEach((g) => out.push({ id: g.id, icon: 'layers', title: `${g.name} · ${g.course}`, sub: 'Guruh', href: staff ? `#/platform/groups/${g.id}` : '#/platform/schedule', color: g.color }))
    scope.meetings.filter((m) => hit(m.title)).forEach((m) => out.push({ id: m.id, icon: 'video', title: m.title, sub: m.status === 'live' ? 'Jonli dars' : 'Onlayn dars', href: `#/platform/meetings/${m.id}/room` }))
    scope.videos.filter((v) => hit(v.title)).forEach((v) => out.push({ id: v.id, icon: 'play', title: v.title, sub: 'Video dars', href: `#/platform/videos/${v.id}` }))
    scope.tests.filter((t) => hit(t.title)).forEach((t) => out.push({ id: t.id, icon: 'clipboard', title: t.title, sub: 'Test', href: `#/platform/tests/${t.id}` }))
    scope.homework.filter((h) => hit(h.title)).forEach((h) => out.push({ id: h.id, icon: 'fileText', title: h.title, sub: 'Uy vazifasi', href: `#/platform/homework/${h.id}` }))
    scope.library.filter((l) => hit(l.title, l.author)).forEach((l) => out.push({ id: l.id, icon: 'bookOpen', title: l.title, sub: 'Kutubxona', href: '#/platform/library' }))
    scope.articles.filter((a) => hit(a.title)).forEach((a) => out.push({ id: a.id, icon: 'bookmark', title: a.title, sub: 'Maqola', href: `#/platform/articles/${a.id}` }))
    return out.slice(0, 8)
  }, [q, db, scope, user.role, staff])

  useEffect(() => { setCur(0) }, [results])

  // Tashqariga bosilganda yopish; Ctrl+K — fokus
  useEffect(() => {
    const onDoc = (e) => !ref.current?.contains(e.target) && setOpen(false)
    const onKey = (e) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); inputRef.current?.focus(); setOpen(true) } }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey) }
  }, [])

  const go = (r) => { setOpen(false); setQ(''); window.location.hash = r.href }
  const onKeyDown = (e) => {
    if (e.key === 'Escape') { setOpen(false); inputRef.current?.blur() }
    else if (e.key === 'ArrowDown') { e.preventDefault(); setCur((c) => Math.min(c + 1, results.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setCur((c) => Math.max(c - 1, 0)) }
    else if (e.key === 'Enter' && results[cur]) go(results[cur])
  }
  const show = open && q.trim().length >= 2

  return (
    <div className={cx('pgs', className)} ref={ref}>
      <label className="pgs__box">
        <Icon name="search" size={18} />
        <input ref={inputRef} value={q} onChange={(e) => { setQ(e.target.value); setOpen(true) }} onFocus={() => setOpen(true)} onKeyDown={onKeyDown}
          placeholder={narrow ? 'Qidirish…' : staff ? 'Dars, guruh yoki foydalanuvchini qidiring…' : 'Dars, test yoki materialni qidiring…'} aria-label="Qidiruv" />
        {q ? <button type="button" className="pgs__clear" onClick={() => { setQ(''); inputRef.current?.focus() }} aria-label="Tozalash"><Icon name="x" size={14} /></button> : <kbd className="pgs__kbd">Ctrl K</kbd>}
      </label>
      {show && (
        <div className="pgs__list" role="listbox">
          {results.length === 0 && <div className="pgs__empty">«{q}» bo‘yicha hech narsa topilmadi</div>}
          {results.map((r, i) => (
            <button key={`${r.sub}-${r.id}`} type="button" role="option" aria-selected={i === cur} className={cx('pgs__item', i === cur && 'is-cur')} onMouseEnter={() => setCur(i)} onClick={() => go(r)}>
              <span className="pgs__ico" style={r.color ? { background: r.color + '1f', color: r.color } : undefined}><Icon name={r.icon} size={17} /></span>
              <span style={{ minWidth: 0 }}><b>{r.title}</b><span>{r.sub}</span></span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
