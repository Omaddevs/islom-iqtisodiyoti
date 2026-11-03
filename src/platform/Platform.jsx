// Platforma: himoyalangan marshrutlar + umumiy layout (sidebar, topbar)
import { useEffect, useState } from 'react'
import { useAuth } from './store/auth.jsx'
import { loadDB, onSyncError } from './store/db.js'
import { ToastProvider, useToast, ErrorBoundary } from './ui/kit.jsx'
import Sidebar from './layout/Sidebar.jsx'
import Topbar from './layout/Topbar.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Meetings, { MeetingRedirect } from './pages/Meetings.jsx'
import { useMeetingsSync } from './api/meetings.js'
import Videos from './pages/Videos.jsx'
import Tests from './pages/Tests.jsx'
import Vocabulary from './pages/Vocabulary.jsx'
import Library from './pages/Library.jsx'
import Articles from './pages/Articles.jsx'
import Homework from './pages/Homework.jsx'
import Groups from './pages/Groups.jsx'
import Users from './pages/Users.jsx'
import Organizations from './pages/Organizations.jsx'
import Leads from './pages/Leads.jsx'
import Schedule from './pages/Schedule.jsx'
import Settings from './pages/Settings.jsx'

const PAGES = {
  '': { comp: Dashboard, icon: 'home', title: 'Bosh sahifa' },
  meetings: { comp: Meetings, icon: 'video', title: 'Onlayn darslar', sub: 'Jonli darslar, uchrashuvlar va yozuvlar' },
  schedule: { comp: Schedule, icon: 'calendar', title: 'Dars jadvali', sub: 'Haftalik jadval' },
  videos: { comp: Videos, icon: 'play', title: 'Video darslar', sub: 'Yozib olingan darslar va video kurslar' },
  tests: { comp: Tests, icon: 'clipboard', title: 'Testlar', sub: 'Bilimni tekshirish' },
  homework: { comp: Homework, icon: 'fileText', title: 'Uy vazifalari', sub: 'Topshiriqlar va baholar' },
  vocabulary: { comp: Vocabulary, icon: 'translate', title: 'Lug‘at', sub: 'Atamalar va so‘z boyligi' },
  library: { comp: Library, icon: 'bookOpen', title: 'Kutubxona', sub: 'Kitoblar, maqolalar, audio va boshqa manbalar' },
  articles: { comp: Articles, icon: 'bookmark', title: 'Maqolalar', sub: 'O‘quv materiallari va maqolalar' },
  groups: { comp: Groups, icon: 'layers', title: 'Guruhlar', sub: 'Guruhlar, ustozlar va o‘quvchilar' },
  users: { comp: Users, icon: 'users', title: 'Foydalanuvchilar', sub: 'Ustozlar va o‘quvchilar', roles: ['superadmin', 'org_admin', 'teacher'] },
  organizations: { comp: Organizations, icon: 'building', title: 'Tashkilotlar', sub: 'Platformadan foydalanuvchi tashkilotlar', roles: ['superadmin'] },
  leads: { comp: Leads, icon: 'mail', title: 'Arizalar', sub: 'Saytdan kelgan so‘rovlar', roles: ['superadmin'] },
  settings: { comp: Settings, icon: 'settings', title: 'Sozlamalar', sub: 'Profil va tizim sozlamalari' },
}

// Boshqa foydalanuvchilarning o'zgarishlari: har 30 soniyada va oyna qayta faollashganda yangilanadi
function useDataSync(enabled) {
  useEffect(() => {
    if (!enabled) return
    const run = () => { if (document.visibilityState === 'visible') loadDB().catch(() => {}) }
    const t = setInterval(run, 30_000)
    document.addEventListener('visibilitychange', run)
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', run) }
  }, [enabled])
}

// Server o'zgarishni rad etsa — sababini ko'rsatamiz (holat avtomatik tiklanadi)
function SyncErrors() {
  const toast = useToast()
  useEffect(() => onSyncError((e) => { if (e.status !== 401) toast(e.message || 'Saqlab bo‘lmadi', 'err') }), [toast])
  return null
}

export default function Platform({ path }) {
  const auth = useAuth()
  const { user, ready } = auth
  const [menuOpen, setMenuOpen] = useState(false)

  // Kirilmagan bo'lsa — kirish sahifasiga (qaytish manzili saqlanadi)
  useEffect(() => { if (ready && !user) window.location.hash = `#/kirish?next=${encodeURIComponent(path)}` }, [ready, user]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setMenuOpen(false) }, [path])
  // Onlayn darslar va qolgan ma'lumotlar serverdan — butun platforma bo'ylab sinxron
  useMeetingsSync(!!user)
  useDataSync(!!user)

  if (!ready) return <div className="pf-boot" role="status" aria-label="Yuklanmoqda"><span className="spinner" /></div>
  if (!user) return null

  const seg = path.replace(/^\/platform\/?/, '').split('/')
  const key = seg[0] || ''
  const param = seg[1] ? decodeURIComponent(seg[1]) : null

  // Eski havolalar (#/platform/meetings/<id>/room) → #/join/<kod>
  if (key === 'meetings' && param && seg[2] === 'room') return <MeetingRedirect id={param} />

  // Rolga ruxsat etilmagan bo'lim (masalan, o'quvchi uchun Foydalanuvchilar) — bosh sahifa ko'rsatiladi
  const allowed = PAGES[key] && (!PAGES[key].roles || PAGES[key].roles.includes(user.role))
  const page = allowed ? PAGES[key] : PAGES['']
  const Comp = page.comp
  const title = key === 'users' && user.role === 'teacher' ? 'O‘quvchilarim' : page.title

  return (
    <ToastProvider>
      <SyncErrors />
      <div className="pf">
        <div className="pf__shell">
          <Sidebar route={path} open={menuOpen} onClose={() => setMenuOpen(false)} />
          <div className="pf__main">
            <Topbar title={title} sub={page.sub} icon={page.icon} home={key === ''} onBurger={() => setMenuOpen(true)} />
            <div className="pf__content" key={path}>
              <ErrorBoundary><Comp param={param} /></ErrorBoundary>
            </div>
          </div>
        </div>
      </div>
    </ToastProvider>
  )
}
