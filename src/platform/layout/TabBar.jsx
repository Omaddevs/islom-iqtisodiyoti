// Mobil / Telegram Mini App uchun pastki tab bar.
// Rolga qarab 4 ta asosiy bo'lim + «Menyu» (to'liq menyu — yon panel ochiladi).
import { Icon, cx } from '../ui/kit.jsx'
import { useAuth } from '../store/auth.jsx'
import { navFor } from './Sidebar.jsx'
import { haptic } from '../../tg.js'

const TABS = {
  student: ['home', 'meetings', 'tests', 'homework'],
  teacher: ['home', 'meetings', 'groups', 'homework'],
  org_admin: ['home', 'meetings', 'groups', 'users'],
  superadmin: ['home', 'meetings', 'groups', 'users'],
  platform: ['home', 'organizations', 'leads', 'users'], // superadmin, «Barcha tashkilotlar» rejimi
}
// Tab ostidagi qisqa yozuvlar (sidebar'dagi to'liq nomlar sig'maydi)
const SHORT = { home: 'Asosiy', meetings: 'Darslar', tests: 'Testlar', homework: 'Vazifalar', groups: 'Guruhlar', users: 'Odamlar', organizations: 'Tashkilot', leads: 'Arizalar' }

const keyOf = (href) => href.replace(/^#\/platform\/?/, '').split('/')[0] || 'home'

export default function TabBar({ route, menuOpen, onMenu }) {
  const { user, scope, db } = useAuth()
  const links = navFor(user, scope, db).flatMap((s) => s.links)
  const set = user.role === 'superadmin' && !scope.orgId ? TABS.platform : TABS[user.role] || TABS.student
  const tabs = set.map((k) => links.find((l) => keyOf(l.href) === k)).filter(Boolean)
  const cur = route.replace(/^\/platform\/?/, '').split('/')[0] || 'home'
  const onTab = tabs.some((t) => keyOf(t.href) === cur)

  return (
    <nav className="ptab" aria-label="Asosiy bo‘limlar">
      {tabs.map((t) => {
        const k = keyOf(t.href)
        const active = !menuOpen && cur === k
        const badge = t.live > 0 ? t.live : t.count
        return (
          <a key={k} href={t.href} className={cx('ptab__i', active && 'is-active')} aria-current={active ? 'page' : undefined}
            onClick={() => { if (!active) haptic('select') }}>
            <span className="ptab__ic">
              <Icon name={t.icon} size={22} stroke={active ? 2.2 : 1.8} />
              {badge > 0 && <em className={cx('ptab__badge', t.live > 0 && 'is-live')}>{badge > 99 ? '99+' : badge}</em>}
            </span>
            <span className="ptab__l">{SHORT[k] || t.label}</span>
          </a>
        )
      })}
      <button type="button" className={cx('ptab__i', (menuOpen || !onTab) && 'is-active')} onClick={() => { haptic('select'); onMenu() }} aria-label="To‘liq menyu" aria-expanded={menuOpen}>
        <span className="ptab__ic"><Icon name="layoutGrid" size={22} stroke={menuOpen || !onTab ? 2.2 : 1.8} /></span>
        <span className="ptab__l">Menyu</span>
      </button>
    </nav>
  )
}
