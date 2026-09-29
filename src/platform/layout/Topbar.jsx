import { useEffect, useRef, useState } from 'react'
import { Icon, UAvatar, Search } from '../ui/kit.jsx'
import { useAuth } from '../store/auth.jsx'
import { patch, setDB } from '../store/db.js'
import { ROLES } from '../store/seed.js'
import { fmtAgo } from '../ui/format.js'
import GlobalSearch from './GlobalSearch.jsx'

// `home` — bosh sahifada sarlavha o'rniga umumiy qidiruv ko'rsatiladi
export default function Topbar({ title, sub, icon, onBurger, search, onSearch, home }) {
  const { user, db, viewOrgId, setViewOrg } = useAuth()
  const [notifOpen, setNotifOpen] = useState(false)
  const ref = useRef(null)
  const mine = db.notifications.filter((n) => n.userId === user.id)
  const unread = mine.filter((n) => !n.read).length

  useEffect(() => {
    if (!notifOpen) return
    const onDoc = (e) => !ref.current?.contains(e.target) && setNotifOpen(false)
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [notifOpen])

  const readAll = () => setDB((s) => ({ ...s, notifications: s.notifications.map((n) => (n.userId === user.id ? { ...n, read: true } : n)) }))
  const openOne = (n) => { patch('notifications', n.id, { read: true }); setNotifOpen(false); if (n.href) window.location.hash = n.href }

  return (
    <header className="ptop">
      <button className="ptop__burger" onClick={onBurger} aria-label="Menyu"><Icon name="menu" size={20} /></button>
      {home ? <GlobalSearch className="ptop__gsearch" /> : (
        <>
          {icon && <span className="ptop__icon"><Icon name={icon} size={22} /></span>}
          <div className="ptop__title">
            <b>{title}</b>
            {sub && <span>{sub}</span>}
          </div>
        </>
      )}
      <div className="ptop__spacer" />
      {onSearch && <Search className="ptop__search" value={search} onChange={onSearch} placeholder="Qidirish…" />}
      {user.role === 'superadmin' && (
        <label className="ptop__orgsel">
          <Icon name="building" size={16} />
          <select value={viewOrgId || ''} onChange={(e) => setViewOrg(e.target.value || null)}>
            <option value="">Barcha tashkilotlar</option>
            {db.organizations.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
        </label>
      )}
      <div style={{ position: 'relative' }} ref={ref}>
        <button className="ptop__ibtn" onClick={() => setNotifOpen((v) => !v)} aria-label="Bildirishnomalar">
          <Icon name="bell" size={20} />
          {unread > 0 && <span className="dot" />}
        </button>
        {notifOpen && (
          <div className="pnotif">
            <div className="pnotif__head">
              <span>Bildirishnomalar {unread > 0 && <span className="pbadge pbadge--blue">{unread}</span>}</span>
              {unread > 0 && <button onClick={readAll}>Barchasini o‘qilgan qilish</button>}
            </div>
            <div className="pnotif__list">
              {mine.length === 0 && <div className="pnotif__item">Hozircha bildirishnomalar yo‘q</div>}
              {mine.slice(0, 20).map((n) => (
                <div key={n.id} className={`pnotif__item ${n.read ? '' : 'is-new'}`} onClick={() => openOne(n)} style={{ cursor: 'pointer' }}>
                  <i />
                  <div>{n.text}<small>{fmtAgo(n.at)}</small></div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      <a href="#/platform/settings" className="ptop__me">
        <UAvatar user={user} size={38} />
        <div>
          <b>{user.name}</b>
          <span>{ROLES[user.role].label}</span>
        </div>
        <Icon name="chevDown" size={16} className="ptop__chev" />
      </a>
    </header>
  )
}
