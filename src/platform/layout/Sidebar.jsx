import { Icon, UAvatar, cx } from '../ui/kit.jsx'
import { useAuth } from '../store/auth.jsx'
import { ROLES } from '../store/seed.js'

// Rolga qarab menyu. `count` — o'ng tarafdagi raqam, `live` — jonli dars belgisi.
export function navFor(user, scope, db) {
  const liveCount = scope.meetings.filter((m) => m.status === 'live').length
  const pendingHw = user.role === 'teacher' || user.role === 'org_admin'
    ? db.submissions.filter((s) => s.status === 'submitted' && scope.homework.some((h) => h.id === s.homeworkId)).length
    : user.role === 'student'
      ? scope.homework.filter((h) => !db.submissions.some((s) => s.homeworkId === h.id && s.studentId === user.id) && h.dueAt > Date.now()).length
      : 0
  const pendingTests = user.role === 'student'
    ? scope.tests.filter((t) => !db.testAttempts.some((a) => a.testId === t.id && a.studentId === user.id) && t.dueAt > Date.now()).length
    : 0

  const main = [
    { href: '#/platform', label: 'Bosh sahifa', icon: 'home', exact: true },
    { href: '#/platform/meetings', label: 'Onlayn darslar', icon: 'video', live: liveCount },
    { href: '#/platform/schedule', label: 'Dars jadvali', icon: 'calendar' },
    { href: '#/platform/videos', label: 'Video darslar', icon: 'play' },
    { href: '#/platform/tests', label: 'Testlar', icon: 'clipboard', count: pendingTests || undefined },
    { href: '#/platform/homework', label: 'Uy vazifalari', icon: 'fileText', count: pendingHw || undefined },
    { href: '#/platform/vocabulary', label: 'Lug‘at', icon: 'translate' },
    { href: '#/platform/library', label: 'Kutubxona', icon: 'bookOpen' },
    { href: '#/platform/articles', label: 'Maqolalar', icon: 'bookmark' },
  ]
  const manage = []
  if (user.role !== 'student') manage.push({ href: '#/platform/groups', label: 'Guruhlar', icon: 'layers' })
  if (user.role === 'teacher') manage.push({ href: '#/platform/users', label: 'O‘quvchilarim', icon: 'users' })
  if (user.role === 'org_admin' || user.role === 'superadmin') manage.push({ href: '#/platform/users', label: 'Foydalanuvchilar', icon: 'users' })
  if (user.role === 'superadmin') manage.push({ href: '#/platform/organizations', label: 'Tashkilotlar', icon: 'building' })
  const other = [{ href: '#/platform/settings', label: 'Sozlamalar', icon: 'settings' }]
  return { main, manage, other }
}

export default function Sidebar({ route, open, onClose }) {
  const { user, scope, db, logout } = useAuth()
  const nav = navFor(user, scope, db)
  const isActive = (l) => (l.exact ? route === '/platform' : route.startsWith(l.href.slice(1)))

  const Link = ({ l }) => (
    <a href={l.href} className={cx('pside__link', isActive(l) && 'is-active')} onClick={onClose}>
      <Icon name={l.icon} size={19} />
      {l.label}
      {l.live > 0 && <span className="pside__live" title={`${l.live} ta jonli dars`}>{l.live}</span>}
      {!l.live && l.count != null && <span className="pside__n">{l.count}</span>}
    </a>
  )

  return (
    <>
      {open && <div className="pf__scrim" onClick={onClose} />}
      <aside className={cx('pside', open && 'is-open')}>
        <button className="pside__close" onClick={onClose} aria-label="Menyuni yopish"><Icon name="x" size={18} /></button>
        <a href="#/platform" className="pside__brand">
          <img src="/logo/logo-white.png" alt="Islom Iqtisodiyoti" />
        </a>
        {scope.org && (
          <div className="pside__org" title={scope.org.name}>
            <i style={{ background: scope.org.color }} />
            <span>{scope.org.name}<small>{scope.org.plan === 'pro' ? 'Pro tarif' : 'Boshlang‘ich tarif'}</small></span>
          </div>
        )}
        {!scope.org && user.role === 'superadmin' && (
          <div className="pside__org"><i style={{ background: '#6366f1' }} /><span>Barcha tashkilotlar<small>Bosh boshqaruv</small></span></div>
        )}
        <nav className="pside__nav" aria-label="Platforma menyusi">
          <div className="pside__group">Bosh menu</div>
          {nav.main.map((l) => <Link key={l.href} l={l} />)}
          {nav.manage.length > 0 && <div className="pside__group">Boshqaruv</div>}
          {nav.manage.map((l) => <Link key={l.href} l={l} />)}
          <div className="pside__group">Boshqa</div>
          {nav.other.map((l) => <Link key={l.href} l={l} />)}
        </nav>
        <div className="pside__foot">
          <div className="pside__me">
            <UAvatar user={user} size={36} />
            <div style={{ minWidth: 0 }}>
              <b>{user.name}</b>
              <span>{ROLES[user.role].label}</span>
            </div>
            <button onClick={() => { logout(); window.location.hash = '#/kirish' }} title="Chiqish" aria-label="Chiqish"><Icon name="logOut" size={18} /></button>
          </div>
        </div>
      </aside>
    </>
  )
}
