// Platforma: himoyalangan marshrutlar + umumiy layout (sidebar, topbar)
import { useEffect, useState } from 'react'
import { useAuth } from './store/auth.jsx'
import { ToastProvider } from './ui/kit.jsx'
import Sidebar from './layout/Sidebar.jsx'
import Topbar from './layout/Topbar.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Meetings from './pages/Meetings.jsx'
import MeetingRoom from './pages/MeetingRoom.jsx'
import Videos from './pages/Videos.jsx'
import Tests from './pages/Tests.jsx'
import Vocabulary from './pages/Vocabulary.jsx'
import Library from './pages/Library.jsx'
import Articles from './pages/Articles.jsx'
import Homework from './pages/Homework.jsx'
import Groups from './pages/Groups.jsx'
import Users from './pages/Users.jsx'
import Organizations from './pages/Organizations.jsx'
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
  library: { comp: Library, icon: 'bookOpen', title: 'Kutubxona', sub: 'Kitoblar, PDF, audio va havolalar' },
  articles: { comp: Articles, icon: 'bookmark', title: 'Maqolalar', sub: 'O‘quv materiallari va maqolalar' },
  groups: { comp: Groups, icon: 'layers', title: 'Guruhlar', sub: 'Guruhlar, ustozlar va o‘quvchilar' },
  users: { comp: Users, icon: 'users', title: 'Foydalanuvchilar', sub: 'Ustozlar va o‘quvchilar' },
  organizations: { comp: Organizations, icon: 'building', title: 'Tashkilotlar', sub: 'Platformadan foydalanuvchi tashkilotlar' },
  settings: { comp: Settings, icon: 'settings', title: 'Sozlamalar', sub: 'Profil va tizim sozlamalari' },
}

export default function Platform({ path }) {
  const auth = useAuth()
  const { user } = auth
  const [menuOpen, setMenuOpen] = useState(false)

  // Kirilmagan bo'lsa — kirish sahifasiga
  useEffect(() => { if (!user) window.location.hash = '#/kirish' }, [user])
  useEffect(() => { setMenuOpen(false) }, [path])

  if (!user) return null

  const seg = path.replace(/^\/platform\/?/, '').split('/')
  const key = seg[0] || ''
  const param = seg[1] ? decodeURIComponent(seg[1]) : null

  // Dars xonasi — to'liq ekran, layoutsiz
  if (key === 'meetings' && param && seg[2] === 'room') {
    return <ToastProvider><MeetingRoom id={param} /></ToastProvider>
  }

  const page = PAGES[key] || PAGES['']
  const Comp = page.comp
  const title = key === 'users' && user.role === 'teacher' ? 'O‘quvchilarim' : page.title

  return (
    <ToastProvider>
      <div className="pf">
        <div className="pf__shell">
          <Sidebar route={path} open={menuOpen} onClose={() => setMenuOpen(false)} />
          <div className="pf__main">
            <Topbar title={title} sub={page.sub} icon={page.icon} home={key === ''} onBurger={() => setMenuOpen(true)} />
            <div className="pf__content" key={path}>
              <Comp param={param} />
            </div>
          </div>
        </div>
      </div>
    </ToastProvider>
  )
}
