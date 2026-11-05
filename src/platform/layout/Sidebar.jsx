import { Fragment } from 'react'
import { Icon, UAvatar, cx } from '../ui/kit.jsx'
import { useAuth } from '../store/auth.jsx'
import { ROLES } from '../store/seed.js'

// Rolga qarab menyu bo'limlari. `count` — o'ng tarafdagi raqam, `live` — jonli dars belgisi.
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

  const L = {
    home: { href: '#/platform', label: 'Bosh sahifa', icon: 'home', exact: true },
    meetings: { href: '#/platform/meetings', label: 'Onlayn darslar', icon: 'video', live: liveCount },
    schedule: { href: '#/platform/schedule', label: 'Dars jadvali', icon: 'calendar' },
    groups: { href: '#/platform/groups', label: user.role === 'teacher' ? 'Guruhlarim' : 'Guruhlar', icon: 'layers' },
    homework: { href: '#/platform/homework', label: 'Uy vazifalari', icon: 'fileText', count: pendingHw || undefined },
    tests: { href: '#/platform/tests', label: 'Testlar', icon: 'clipboard', count: pendingTests || undefined },
    videos: { href: '#/platform/videos', label: 'Video darslar', icon: 'play' },
    vocabulary: { href: '#/platform/vocabulary', label: 'Lug‘at', icon: 'translate' },
    library: { href: '#/platform/library', label: 'Kutubxona', icon: 'bookOpen' },
    articles: { href: '#/platform/articles', label: 'Maqolalar', icon: 'bookmark' },
    users: { href: '#/platform/users', label: user.role === 'teacher' ? 'O‘quvchilarim' : 'Foydalanuvchilar', icon: 'users' },
    orgs: { href: '#/platform/organizations', label: 'Tashkilotlar', icon: 'building' },
    leads: { href: '#/platform/leads', label: 'Arizalar', icon: 'mail' },
    partners: { href: '#/platform/partners', label: 'Hamkorlar', icon: 'briefcase' },
    settings: { href: '#/platform/settings', label: 'Sozlamalar', icon: 'settings' },
  }
  const materials = { title: 'Materiallar', links: [L.videos, L.vocabulary, L.library, L.articles] }
  // Har bir rol o'z vazifasiga mos menyuni ko'radi
  let sections
  if (user.role === 'superadmin' && !scope.orgId) {
    // Barcha tashkilotlar rejimi: platforma boshqaruvi (o'quv bo'limlari tashkilot ichida)
    sections = [{ title: 'Platforma', links: [L.home, L.orgs, L.leads, L.partners, L.users] }]
  } else if (user.role === 'superadmin' || user.role === 'org_admin') {
    sections = [
      { title: 'Asosiy', links: [L.home, L.meetings, L.schedule] },
      { title: 'O‘quv jarayoni', links: [L.groups, L.homework, L.tests] },
      materials,
      { title: 'Boshqaruv', links: user.role === 'superadmin' ? [L.users, L.orgs, L.leads, L.partners] : [L.users] },
    ]
  } else if (user.role === 'teacher') {
    sections = [
      { title: 'Asosiy', links: [L.home, L.meetings, L.schedule] },
      { title: 'Mening sinfim', links: [L.groups, L.users, L.homework, L.tests] },
      materials,
    ]
  } else {
    sections = [
      { title: 'Asosiy', links: [L.home, L.meetings, L.schedule] },
      { title: 'Topshiriqlar', links: [L.homework, L.tests] },
      materials,
    ]
  }
  sections.push({ title: 'Boshqa', links: [L.settings] })
  return sections

}

// Tashkilot kartochkasidagi ikkinchi qator
const orgSub = (user, scope) => {
  if (user.role === 'superadmin' || user.role === 'org_admin') return scope.org.plan === 'pro' ? 'Pro tarif' : 'Boshlang‘ich tarif'
  const names = scope.groups.map((g) => g.name)
  if (!names.length) return user.role === 'teacher' ? 'Guruh biriktirilmagan' : 'Guruhga qo‘shilmagan'
  return names.length > 2 ? `${names.slice(0, 2).join(', ')} +${names.length - 2}` : names.join(', ')
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
            {/* Tarif — faqat boshqaruvchilar uchun; ustoz/o'quvchi o'z guruhlarini ko'radi */}
            <span>{scope.org.name}<small>{orgSub(user, scope)}</small></span>
          </div>
        )}
        {!scope.org && user.role === 'superadmin' && (
          <div className="pside__org"><i style={{ background: '#6366f1' }} /><span>Barcha tashkilotlar<small>Bosh boshqaruv</small></span></div>
        )}
        <nav className="pside__nav" aria-label="Platforma menyusi">
          {nav.map((sec) => (
            <Fragment key={sec.title}>
              <div className="pside__group">{sec.title}</div>
              {sec.links.map((l) => <Link key={l.href} l={l} />)}
            </Fragment>
          ))}
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
