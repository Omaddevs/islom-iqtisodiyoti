// Bosh sahifa (dashboard): har bir rol o'z vazifasiga mos alohida ko'rinishga ega.
// Bosh admin — platforma boshqaruvi, tashkilot admini — o'quv markazi, ustoz — darslar va baholash, o'quvchi — o'qish.
import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../store/auth.jsx'
import { Card, Stat, Btn, Badge, UAvatar, Icon, Progress, Empty, Menu, Table, cx } from '../ui/kit.jsx'
import { leadsApi } from '../api/client.js'
import { fmtWhen, fmtAgo, fmtLeft, fmtDateFull, pct, DAYS_FULL, MONTHS_FULL } from '../ui/format.js'
import { DAY_MS, startOfDay, eventsForDay, lessonCountsFor } from '../ui/agenda.js'

const greet = () => { const h = new Date().getHours(); return h < 5 ? 'Xayrli tun' : h < 12 ? 'Xayrli tong' : h < 18 ? 'Xayrli kun' : 'Xayrli kech' }
const dayOfYear = () => Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 1)) / DAY_MS)

// Kunlik almashib turadigan shior va iqtibos
const MOTTOS = [
  'Ilm – hayotga nur, jamiyatga taraqqiyotdir.',
  'Bugungi bir soat ilm – ertangi yillik foyda.',
  'Halol kasb – eng ulug‘ ibodatlardan biri.',
  'Adolat – iqtisodiyotning poydevoridir.',
]
const QUOTES = [
  ['Bilimli jamiyat barqaror kelajak quradi.', null],
  ['Ilm olish har bir musulmon uchun farzdir.', 'Hadis'],
  ['Beshikdan qabrgacha ilm izlang.', 'Hikmat'],
  ['Kim ilm yo‘lida yursa, Alloh unga jannat yo‘lini oson qiladi.', 'Hadis, Muslim'],
  ['Halol rizq – ibodatning bir bo‘lagidir.', 'Hikmat'],
]

// Ikonka fonlari (ohang → [fon, rang])
const TONES = {
  blue: ['var(--pf-primary-soft)', 'var(--pf-primary-2)'],
  green: ['var(--pf-green-soft)', '#059669'],
  amber: ['var(--pf-amber-soft)', '#d97706'],
  violet: ['var(--pf-violet-soft)', 'var(--pf-violet)'],
  teal: ['var(--pf-teal-soft)', '#0d9488'],
  red: ['var(--pf-red-soft)', '#dc2626'],
  gray: ['#eef1f5', '#4b5563'],
}
const toneStyle = (t) => ({ background: TONES[t][0], color: TONES[t][1] })

// Toshkent ob-havosi (open-meteo, kalitsiz). 30 daqiqa keshlanadi; xatoda shunchaki ko'rsatilmaydi.
function useWeather() {
  const [w, setW] = useState(() => {
    try { const c = JSON.parse(sessionStorage.getItem('ii_weather')); if (c && Date.now() - c.at < 30 * 60e3) return c } catch { /* bo'sh */ }
    return null
  })
  useEffect(() => {
    if (w) return
    const ctrl = new AbortController()
    fetch('https://api.open-meteo.com/v1/forecast?latitude=41.31&longitude=69.28&current=temperature_2m,weather_code&timezone=Asia%2FTashkent', { signal: ctrl.signal })
      .then((r) => r.json())
      .then((d) => {
        const c = { temp: Math.round(d.current.temperature_2m), code: d.current.weather_code, at: Date.now() }
        setW(c); try { sessionStorage.setItem('ii_weather', JSON.stringify(c)) } catch { /* bo'sh */ }
      })
      .catch(() => {})
    return () => ctrl.abort()
  }, [w])
  return w
}
const weatherIcon = (code) => (code <= 1 ? 'sun' : code <= 48 ? 'cloud' : (code >= 71 && code <= 77) || code === 85 || code === 86 ? 'snow' : 'rain')

export default function Dashboard() {
  const { user, viewOrgId } = useAuth()
  // Bosh admin tashkilot ichiga kirganda — o'sha tashkilot boshqaruvi ko'rinadi
  if (user.role === 'superadmin' && !viewOrgId) return <PlatformDash />
  if (user.role === 'superadmin' || user.role === 'org_admin') return <OrgAdminDash />
  if (user.role === 'teacher') return <TeacherDash />
  return <StudentDash />
}

// Umumiy karkas: chapda asosiy ustunlar, o'ngda yon panel
function Layout({ stats, left, right, side, notice }) {
  return (
    <div className="pdash">
      <div className="pdash__main">
        <HeroBanner />
        {notice}
        <div className="pgrid pgrid--4 pdash__stats">{stats.map((s) => <Stat key={s.label} {...s} />)}</div>
        <div className="pdash__cols">
          <div className="pdash__col">{left}</div>
          <div className="pdash__col">{right}</div>
        </div>
      </div>
      <aside className="pdash__side">{side}</aside>
    </div>
  )
}

const useDay = () => useState(() => startOfDay(Date.now()))
const todayCount = (scope, db) => eventsForDay(scope, db, startOfDay(Date.now())).filter((e) => e.status !== 'cancelled').length
const plusWeek = (list, since) => { const n = list.filter((x) => x.createdAt > since).length; return n ? `+${n} bu hafta` : undefined }

/* ================= Bosh administrator (barcha tashkilotlar) ================= */
function PlatformDash() {
  const { db } = useAuth()
  const [leads, setLeads] = useState(null)
  useEffect(() => { leadsApi.list().then((r) => setLeads(r.leads)).catch(() => setLeads([])) }, [])
  const users = db.users.filter((u) => u.role !== 'superadmin')
  const students = users.filter((u) => u.role === 'student')
  const freshLeads = (leads || []).filter((l) => l.status === 'new')
  const stats = [
    { icon: 'bank', label: 'Tashkilotlar', value: db.organizations.length, hint: `${db.organizations.filter((o) => o.status === 'active').length} ta faol`, tone: 'violet', href: '#/platform/organizations' },
    { icon: 'users', label: 'O‘quvchilar', value: students.length, trend: plusWeek(students, Date.now() - 7 * DAY_MS), tone: 'blue', href: '#/platform/users' },
    { icon: 'user', label: 'Ustozlar', value: users.filter((u) => u.role === 'teacher').length, tone: 'teal', href: '#/platform/users?role=teacher' },
    { icon: 'mail', label: 'Yangi arizalar', value: leads ? freshLeads.length : '…', hint: leads ? `jami ${leads.length} ta` : undefined, tone: 'amber', href: '#/platform/leads' },
  ]
  const actions = [
    { label: 'Tashkilot qo‘shish', icon: 'bank', tone: 'violet', href: '#/platform/organizations?new=1' },
    { label: 'Arizalarni ko‘rish', icon: 'mail', tone: 'amber', href: '#/platform/leads' },
    { label: 'Foydalanuvchilar', icon: 'users', tone: 'green', href: '#/platform/users' },
    { label: 'Sozlamalar', icon: 'settings', tone: 'blue', href: '#/platform/settings' },
  ]
  return (
    <Layout stats={stats}
      left={<OrgOverview />}
      right={<><QuickActions items={actions} /><LeadsWidget leads={freshLeads} loading={!leads} /></>}
      side={<ActivityFeed items={db.activity} title="Platforma faoliyati" />} />
  )
}

/* ================= Tashkilot admini ================= */
function OrgAdminDash() {
  const { db, scope } = useAuth()
  const [day, setDay] = useDay()
  const live = scope.meetings.filter((m) => m.status === 'live').length
  const stats = [
    { icon: 'users', label: 'O‘quvchilar', value: scope.students.length, trend: plusWeek(scope.students, Date.now() - 7 * DAY_MS), tone: 'blue', href: '#/platform/users' },
    { icon: 'user', label: 'Ustozlar', value: scope.teachers.length, tone: 'teal', href: '#/platform/users?role=teacher' },
    { icon: 'layers', label: 'Guruhlar', value: scope.groups.length, tone: 'green', href: '#/platform/groups' },
    { icon: 'video', label: 'Bugungi darslar', value: todayCount(scope, db), hint: live ? `${live} ta jonli` : undefined, tone: 'red', href: '#/platform/schedule' },
  ]
  const actions = [
    { label: 'O‘quvchi qo‘shish', icon: 'userPlus', tone: 'green', href: '#/platform/users?new=1' },
    { label: 'Guruh yaratish', icon: 'layers', tone: 'amber', href: '#/platform/groups?new=1' },
    { label: 'Dars rejalashtirish', icon: 'plus', tone: 'blue', href: '#/platform/meetings?new=1' },
    { label: 'Material yuklash', icon: 'upload', tone: 'violet', href: '#/platform/library' },
  ]
  return (
    <Layout stats={stats}
      left={<><TodayLessons day={day} setDay={setDay} /><GroupsHealth /></>}
      right={<><Attention /><QuickActions items={actions} /></>}
      side={<><MiniCalendar day={day} setDay={setDay} /><ActivityFeed items={scope.activity} /></>} />
  )
}

/* ================= Ustoz ================= */
function TeacherDash() {
  const { user, db, scope } = useAuth()
  const [day, setDay] = useDay()
  const queue = gradingQueue(db, scope)
  const stats = [
    { icon: 'video', label: 'Bugungi darslarim', value: todayCount(scope, db), tone: 'blue', href: '#/platform/schedule' },
    { icon: 'edit', label: 'Baholash kutmoqda', value: queue.length, tone: 'amber', href: '#/platform/homework' },
    { icon: 'users', label: 'O‘quvchilarim', value: scope.myStudents.length, tone: 'teal', href: '#/platform/users' },
    { icon: 'layers', label: 'Guruhlarim', value: scope.groups.length, tone: 'green', href: '#/platform/groups' },
  ]
  const actions = [
    { label: 'Dars rejalashtirish', icon: 'plus', tone: 'blue', href: '#/platform/meetings?new=1' },
    { label: 'Vazifa berish', icon: 'fileText', tone: 'amber', href: '#/platform/homework' },
    { label: 'Test yaratish', icon: 'clipboard', tone: 'violet', href: '#/platform/tests' },
    { label: 'Video qo‘shish', icon: 'upload', tone: 'green', href: '#/platform/videos' },
  ]
  // Faqat o'z o'quvchilari va o'zining harakatlari — admin amallari ustozga ko'rsatilmaydi
  const mine = new Set([user.id, ...scope.myStudents.map((s) => s.id)])
  return (
    <Layout stats={stats}
      notice={!scope.groups.length && <NoGroups text="Hali guruhingiz yo‘q. Guruh yarating yoki administrator biriktirishini kuting — darslar va o‘quvchilaringiz shu yerda ko‘rinadi." action={<Btn size="sm" variant="primary" icon="plus" as="a" href="#/platform/groups?new=1">Guruh yaratish</Btn>} />}
      left={<><TodayLessons day={day} setDay={setDay} /><MyGroups groups={scope.groups} staff /></>}
      right={<><QuickActions items={actions} /><GradingQueue items={queue} /></>}
      side={<><MiniCalendar day={day} setDay={setDay} /><Reminders items={teacherReminders(db, scope, user)} /><ActivityFeed items={scope.activity.filter((a) => mine.has(a.userId))} title="O‘quvchilar faolligi" /></>} />
  )
}

/* ================= O'quvchi ================= */
function StudentDash() {
  const { user, db, scope } = useAuth()
  const [day, setDay] = useDay()
  const now = Date.now()
  const attempts = db.testAttempts.filter((a) => a.studentId === user.id)
  const avg = attempts.length ? Math.round(attempts.reduce((s, a) => s + pct(a.score, a.total), 0) / attempts.length) : null
  const pendingHw = scope.homework.filter((h) => h.dueAt > now && !db.submissions.some((s) => s.homeworkId === h.id && s.studentId === user.id))
  const pendingTests = scope.tests.filter((t) => t.dueAt > now && !attempts.some((a) => a.testId === t.id))
  const learned = db.vocabProgress.filter((p) => p.studentId === user.id).reduce((s, p) => s + p.learned.length, 0)
  const totalTerms = scope.vocabSets.reduce((s, v) => s + v.terms.length, 0)
  const stats = [
    { icon: 'fileText', label: 'Kutilayotgan vazifalar', value: pendingHw.length, tone: 'amber', href: '#/platform/homework' },
    { icon: 'clipboard', label: 'Topshirilmagan testlar', value: pendingTests.length, tone: 'violet', href: '#/platform/tests' },
    { icon: 'award', label: 'Testlar o‘rtachasi', value: avg === null ? '—' : `${avg}%`, hint: attempts.length ? `${attempts.length} ta topshirilgan` : 'hali topshirilmagan', tone: 'green', href: '#/platform/tests' },
    { icon: 'translate', label: 'O‘rganilgan so‘zlar', value: `${learned}/${totalTerms}`, tone: 'blue', href: '#/platform/vocabulary' },
  ]
  return (
    <Layout stats={stats}
      notice={!scope.groups.length && <NoGroups text="Siz hali guruhga biriktirilmagansiz. Administrator sizni guruhga qo‘shgach, darslar, vazifalar va testlar shu yerda paydo bo‘ladi." />}
      left={<><TodayLessons day={day} setDay={setDay} /><MyGroups groups={scope.groups} /></>}
      right={<><Deadlines homework={pendingHw} tests={pendingTests} /><RecentGrades /></>}
      side={<><MiniCalendar day={day} setDay={setDay} /><NewMaterials /><LibraryPromo /></>} />
  )
}

// Baholanishi kerak bo'lgan javoblar (eng eskisi birinchi)
const gradingQueue = (db, scope) => db.submissions
  .filter((s) => s.status === 'submitted' && scope.homework.some((h) => h.id === s.homeworkId))
  .sort((a, b) => a.submittedAt - b.submittedAt)

// Ustoz eslatmalari: yaqin darslar, muddati yaqin vazifalar, o'qilmagan bildirishnomalar
function teacherReminders(db, scope, user) {
  const now = Date.now()
  const items = []
  scope.meetings.filter((m) => m.status !== 'ended' && m.startsAt > now - 30 * 60e3 && m.startsAt < now + 2 * DAY_MS)
    .forEach((m) => items.push({ id: m.id, at: m.startsAt, icon: 'video', tone: m.status === 'live' ? 'red' : 'blue', title: m.title, sub: m.status === 'live' ? 'Hozir jonli' : fmtWhen(m.startsAt), href: m.code ? `#/join/${m.code}` : '#/platform/meetings' }))
  scope.homework.filter((h) => h.dueAt > now && h.dueAt < now + 2 * DAY_MS)
    .forEach((h) => items.push({ id: h.id, at: h.dueAt, icon: 'fileText', tone: 'teal', title: h.title, sub: `Topshirish muddati: ${fmtWhen(h.dueAt)}`, href: `#/platform/homework/${h.id}` }))
  db.notifications.filter((n) => n.userId === user.id && !n.read).slice(0, 2)
    .forEach((n) => items.push({ id: n.id, at: n.at, icon: 'bell', tone: 'gray', title: n.text, sub: fmtAgo(n.at), href: n.href }))
  return items.sort((a, b) => a.at - b.at).slice(0, 4)
}

/* ---------------- Rolga xos vidjetlar ---------------- */
function NoGroups({ text, action }) {
  return (
    <div className="pdnote">
      <span className="pdr__ico" style={toneStyle('amber')}><Icon name="info" size={20} /></span>
      <p>{text}</p>
      {action}
    </div>
  )
}

const MoreBtn = ({ href }) => <Btn size="sm" variant="ghost" icon="arrowRight" as="a" href={href} style={{ flexDirection: 'row-reverse' }}>Barchasi</Btn>

// Bosh admin: tashkilotlar holati
function OrgOverview() {
  const { db, setViewOrg } = useAuth()
  const rows = db.organizations.map((o) => {
    const us = db.users.filter((u) => u.orgId === o.id)
    return { ...o, students: us.filter((u) => u.role === 'student').length, teachers: us.filter((u) => u.role === 'teacher').length, groups: db.groups.filter((g) => g.orgId === o.id).length }
  })
  const enter = (o) => { setViewOrg(o.id); window.location.hash = '#/platform' }
  return (
    <Card pad={false} title={<CardTitle icon="bank">Tashkilotlar</CardTitle>} action={<MoreBtn href="#/platform/organizations" />}>
      <Table rows={rows} empty={<Empty icon="bank" title="Hali tashkilot yo‘q" text="Birinchi tashkilotni yarating — shundan so‘ng ustoz, o‘quvchi va materiallar qo‘shiladi." action={<Btn variant="primary" icon="plus" as="a" href="#/platform/organizations?new=1">Tashkilot qo‘shish</Btn>} />} cols={[
        { key: 'name', label: 'Tashkilot', render: (o) => <div className="pcell-user"><span className="pdorg__dot" style={{ background: o.color || '#4aa3f8' }}>{o.name[0]}</span><div><b>{o.name}</b><span>{o.plan === 'pro' ? 'Pro tarif' : 'Boshlang‘ich tarif'}</span></div></div> },
        { key: 'students', label: 'O‘quvchi', align: 'center' },
        { key: 'teachers', label: 'Ustoz', align: 'center' },
        { key: 'groups', label: 'Guruh', align: 'center' },
        { key: 'status', label: 'Holat', render: (o) => o.status === 'active' ? <Badge tone="green" dot>Faol</Badge> : <Badge tone="red" dot>To‘xtatilgan</Badge> },
        { key: 'go', label: '', align: 'right', render: (o) => <Btn size="sm" variant="soft" icon="logIn" onClick={() => enter(o)}>Kirish</Btn> },
      ]} />
    </Card>
  )
}

// Bosh admin: yangi arizalar
function LeadsWidget({ leads, loading }) {
  return (
    <Card title={<CardTitle icon="mail">Yangi arizalar</CardTitle>} action={<MoreBtn href="#/platform/leads" />}>
      {loading ? <p className="pmuted">Yuklanmoqda…</p> : leads.length ? leads.slice(0, 5).map((l) => (
        <a key={l.id} href="#/platform/leads" className="pdr">
          <span className="pdr__ico" style={toneStyle('amber')}><Icon name={l.kind === 'contact' ? 'mail' : 'userPlus'} size={19} /></span>
          <div className="pdr__body"><b>{l.name || l.phone || l.email}</b><span>{l.course || l.topic || l.phone || l.email} · {fmtAgo(l.createdAt)}</span></div>
        </a>
      )) : <Empty icon="checkCircle" title="Yangi ariza yo‘q" text="Saytdagi formalar orqali kelgan arizalar shu yerda ko‘rinadi." />}
    </Card>
  )
}

// Tashkilot admini: guruhlar holati
function GroupsHealth() {
  const { db, scope } = useAuth()
  const rows = scope.groups.map((g) => ({ ...g, teacher: db.users.find((u) => u.id === g.teacherId) }))
  return (
    <Card pad={false} title={<CardTitle icon="layers">Guruhlar</CardTitle>} action={<MoreBtn href="#/platform/groups" />}>
      <Table rows={rows.slice(0, 6)} onRow={(g) => { window.location.hash = `#/platform/groups/${g.id}` }}
        empty={<Empty icon="layers" title="Hali guruh yo‘q" text="Guruh yarating, ustoz va o‘quvchilarni biriktiring." action={<Btn variant="primary" icon="plus" as="a" href="#/platform/groups?new=1">Guruh yaratish</Btn>} />} cols={[
          { key: 'name', label: 'Guruh', render: (g) => <div><b style={{ color: g.color }}>{g.name}</b><div className="pmuted" style={{ fontSize: 12.5 }}>{g.course}</div></div> },
          { key: 'teacher', label: 'Ustoz', render: (g) => g.teacher ? g.teacher.name : <Badge tone="red">Biriktirilmagan</Badge> },
          { key: 'n', label: 'O‘quvchi', align: 'center', render: (g) => g.studentIds.length || <Badge tone="amber">0</Badge> },
        ]} />
    </Card>
  )
}

// Tashkilot admini: e'tibor talab qiladigan holatlar
function Attention() {
  const { db, scope } = useAuth()
  const items = []
  scope.groups.filter((g) => !g.teacherId).forEach((g) => items.push({ id: `t${g.id}`, icon: 'alertCircle', tone: 'red', title: `${g.name}: ustoz biriktirilmagan`, sub: g.course, href: `#/platform/groups/${g.id}` }))
  scope.groups.filter((g) => !g.studentIds.length).forEach((g) => items.push({ id: `s${g.id}`, icon: 'users', tone: 'amber', title: `${g.name}: o‘quvchi yo‘q`, sub: 'O‘quvchilarni guruhga qo‘shing', href: `#/platform/groups/${g.id}` }))
  const idle = scope.teachers.filter((t) => !scope.groups.some((g) => g.teacherId === t.id))
  if (idle.length) items.push({ id: 'idle', icon: 'user', tone: 'gray', title: `${idle.length} ta ustozga guruh biriktirilmagan`, sub: idle.map((t) => t.name).slice(0, 2).join(', '), href: '#/platform/users?role=teacher' })
  const lonely = scope.students.filter((s) => !scope.groups.some((g) => g.studentIds.includes(s.id)))
  if (lonely.length) items.push({ id: 'lonely', icon: 'userPlus', tone: 'amber', title: `${lonely.length} ta o‘quvchi guruhsiz`, sub: 'Ular dars va vazifalarni ko‘rmaydi', href: '#/platform/users' })
  const queue = gradingQueue(db, scope)
  if (queue.length) items.push({ id: 'grade', icon: 'edit', tone: 'teal', title: `${queue.length} ta javob baholanmagan`, sub: 'Uy vazifalari', href: '#/platform/homework' })
  return (
    <Card title={<CardTitle icon="alertCircle">Diqqat talab</CardTitle>}>
      {items.length ? items.slice(0, 5).map((r) => <ReminderRow key={r.id} r={r} />)
        : <Empty icon="checkCircle" title="Hammasi joyida" text="Guruhlar, ustozlar va o‘quvchilar to‘g‘ri biriktirilgan." />}
    </Card>
  )
}

// Ustoz: baholash navbati
function GradingQueue({ items }) {
  const { db } = useAuth()
  return (
    <Card title={<CardTitle icon="edit">Baholash kutmoqda</CardTitle>} action={<MoreBtn href="#/platform/homework" />}>
      {items.length ? items.slice(0, 5).map((s) => {
        const st = db.users.find((u) => u.id === s.studentId)
        const h = db.homework.find((x) => x.id === s.homeworkId)
        return (
          <a key={s.id} href={`#/platform/homework/${s.homeworkId}`} className="pdr">
            <UAvatar user={st} size={40} />
            <div className="pdr__body"><b>{st?.name || 'O‘quvchi'}</b><span>{h?.title} · {fmtAgo(s.submittedAt)}</span></div>
            <Badge tone="amber">Baholash</Badge>
          </a>
        )
      }) : <Empty icon="checkCircle" title="Hammasi baholangan" text="Yangi javoblar kelganda shu yerda ko‘rinadi." />}
    </Card>
  )
}

// O'quvchi: muddati yaqin vazifa va testlar
function Deadlines({ homework, tests }) {
  const items = [
    ...homework.map((h) => ({ id: h.id, at: h.dueAt, icon: 'fileText', tone: 'amber', title: h.title, kind: 'Uy vazifa', href: `#/platform/homework/${h.id}` })),
    ...tests.map((t) => ({ id: t.id, at: t.dueAt, icon: 'clipboard', tone: 'violet', title: t.title, kind: 'Test', href: `#/platform/tests/${t.id}` })),
  ].sort((a, b) => a.at - b.at)
  return (
    <Card title={<CardTitle icon="clock">Topshiriqlarim</CardTitle>}>
      {items.length ? items.slice(0, 6).map((r) => (
        <a key={r.id} href={r.href} className="pdr">
          <span className="pdr__ico" style={toneStyle(r.tone)}><Icon name={r.icon} size={19} /></span>
          <div className="pdr__body"><b>{r.title}</b><span>{r.kind} · muddat {fmtWhen(r.at)}</span></div>
          <Badge tone={r.at - Date.now() < DAY_MS ? 'red' : 'gray'}>{fmtLeft(r.at)}</Badge>
        </a>
      )) : <Empty icon="checkCircle" title="Barcha topshiriqlar bajarilgan" text="Yangi vazifa yoki test berilganda shu yerda ko‘rinadi." />}
    </Card>
  )
}

// O'quvchi: so'nggi baholar (vazifa va testlar)
function RecentGrades() {
  const { user, db } = useAuth()
  const items = [
    ...db.submissions.filter((s) => s.studentId === user.id && s.status === 'graded').map((s) => {
      const h = db.homework.find((x) => x.id === s.homeworkId)
      const max = h?.maxGrade || 100
      return { id: s.id, at: s.gradedAt || s.submittedAt, title: h?.title || 'Uy vazifa', score: `${s.grade}/${max}`, p: pct(s.grade, max), note: s.feedback, href: `#/platform/homework/${s.homeworkId}` }
    }),
    ...db.testAttempts.filter((a) => a.studentId === user.id).map((a) => {
      const t = db.tests.find((x) => x.id === a.testId)
      return { id: a.id, at: a.finishedAt, title: t?.title || 'Test', score: `${a.score}/${a.total}`, p: pct(a.score, a.total), href: `#/platform/tests/${a.testId}` }
    }),
  ].sort((a, b) => b.at - a.at)
  return (
    <Card title={<CardTitle icon="award">So‘nggi baholarim</CardTitle>}>
      {items.length ? items.slice(0, 4).map((r) => (
        <a key={r.id} href={r.href} className="pdr">
          <span className="pdr__ico pdr__score" style={toneStyle(r.p >= 80 ? 'green' : r.p >= 60 ? 'amber' : 'red')}>{r.p}%</span>
          <div className="pdr__body"><b>{r.title}</b><span>{r.score}{r.note ? ` · ${r.note}` : ''} · {fmtAgo(r.at)}</span></div>
        </a>
      )) : <Empty icon="award" title="Hali baho yo‘q" text="Test topshirganingizda yoki vazifangiz baholanganda shu yerda ko‘rinadi." />}
    </Card>
  )
}

// O'quvchi: yangi materiallar (video, maqola, kutubxona, lug'at)
function NewMaterials() {
  const { scope } = useAuth()
  const items = [
    ...scope.videos.map((x) => ({ ...x, icon: 'play', tone: 'blue', kind: 'Video dars', href: `#/platform/videos/${x.id}` })),
    ...scope.articles.filter((x) => x.published).map((x) => ({ ...x, icon: 'bookmark', tone: 'green', kind: 'Maqola', href: `#/platform/articles/${x.id}` })),
    ...scope.library.map((x) => ({ ...x, icon: 'bookOpen', tone: 'violet', kind: 'Kutubxona', href: '#/platform/library' })),
    ...scope.vocabSets.map((x) => ({ ...x, icon: 'translate', tone: 'teal', kind: 'Lug‘at', href: `#/platform/vocabulary/${x.id}` })),
  ].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
  return (
    <Card title={<CardTitle icon="spark">Yangi materiallar</CardTitle>}>
      {items.length ? items.slice(0, 4).map((r) => (
        <a key={`${r.kind}${r.id}`} href={r.href} className="pdr">
          <span className="pdr__ico" style={toneStyle(r.tone)}><Icon name={r.icon} size={19} /></span>
          <div className="pdr__body"><b>{r.title}</b><span>{r.kind} · {fmtAgo(r.createdAt)}</span></div>
        </a>
      )) : <Empty icon="bookOpen" title="Hali material yo‘q" text="Ustozingiz video, maqola yoki kitob qo‘shganda shu yerda ko‘rinadi." />}
    </Card>
  )
}

const ReminderRow = ({ r }) => (
  <a href={r.href || '#/platform'} className="pdr">
    <span className="pdr__ico" style={toneStyle(r.tone)}><Icon name={r.icon} size={19} /></span>
    <div className="pdr__body"><b>{r.title}</b><span>{r.sub}</span></div>
  </a>
)

/* ---------------- Salomlashuv banneri ---------------- */
function HeroBanner() {
  const { user } = useAuth()
  const w = useWeather()
  const i = dayOfYear()
  const [quote, by] = QUOTES[i % QUOTES.length]
  const now = new Date()
  return (
    <section className="pdh">
      <div className="pdh__text">
        <small>Assalomu alaykum,</small>
        <h2>{greet()}, {user.name.split(' ')[0]}!</h2>
        <p>“{MOTTOS[i % MOTTOS.length]}”</p>
      </div>
      <div className="pdh__quote">
        “{quote}”
        {by && <cite>— {by}</cite>}
      </div>
      <div className="pdh__date">
        <b>{fmtDateFull(now)}</b>
        <span>{DAYS_FULL[now.getDay()]}</span>
        {w && (
          <div className="pdh__weather">
            <Icon name={weatherIcon(w.code)} size={22} />
            <div><b>{w.temp > 0 ? '+' : ''}{w.temp}°C</b><span>Toshkent</span></div>
          </div>
        )}
      </div>
    </section>
  )
}

/* ---------------- Bugungi darslar ---------------- */
function TodayLessons({ day, setDay }) {
  const { db, scope } = useAuth()
  const events = useMemo(() => eventsForDay(scope, db, day), [scope, db, day])
  const today = startOfDay(Date.now())
  const options = useMemo(() => {
    const opts = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(today); d.setDate(d.getDate() + i)
      return { ts: d.getTime(), label: i === 0 ? 'Bugun' : i === 1 ? 'Ertaga' : DAYS_FULL[d.getDay()] }
    })
    if (!opts.some((o) => o.ts === day)) opts.push({ ts: day, label: fmtDateFull(day) })
    return opts
  }, [day, today])
  const title = day === today ? 'Bugungi darslar' : day === today + DAY_MS ? 'Ertangi darslar' : `${DAYS_FULL[new Date(day).getDay()]} darslari`

  return (
    <Card title={<CardTitle icon="calendar">{title}</CardTitle>}
      action={<label className="pdsel"><Icon name="calendar" size={16} />{options.find((o) => o.ts === day)?.label}<Icon name="chevDown" size={15} />
        <select value={day} onChange={(e) => setDay(Number(e.target.value))} aria-label="Kunni tanlash">{options.map((o) => <option key={o.ts} value={o.ts}>{o.label}</option>)}</select>
      </label>}>
      <div className="pdl-head">{fmtDateFull(day)}, {DAYS_FULL[new Date(day).getDay()]} · {events.length ? `${events.length} ta dars` : 'dars yo‘q'}</div>
      {events.length ? events.map((e) => <LessonRow key={e.id} e={e} />) : <Empty icon="calendar" title="Bu kunga dars rejalashtirilmagan" text="Boshqa kunni tanlang yoki jadvalni ko‘ring." action={<Btn size="sm" variant="soft" as="a" href="#/platform/schedule">Dars jadvali</Btn>} />}
    </Card>
  )
}

function LessonRow({ e }) {
  const { db } = useAuth()
  const teacher = db.users.find((u) => u.id === e.hostId)
  const online = e.online
  const cancelled = e.status === 'cancelled'
  const now = Date.now()
  const upcoming = !cancelled && e.status !== 'ended' && e.status !== 'live' && e.startsAt > now
  const past = !cancelled && (e.status === 'ended' || (e.status === 'lesson' && e.startsAt + e.durationMin * 60e3 < now))
  const soon = upcoming && e.startsAt - now < 3 * 3600e3
  const menu = [
    e.status === 'live' ? { label: 'Darsga qo‘shilish', icon: 'video', onClick: () => (window.location.hash = e.href) }
      : e.status === 'ended' ? { label: e.href.includes('/videos/') ? 'Yozuvni ko‘rish' : 'Darsni ochish', icon: 'play', onClick: () => (window.location.hash = e.href) }
        : e.kind === 'lesson' ? { label: 'Dars tafsilotlari', icon: 'calendar', onClick: () => (window.location.hash = e.href) }
          : { label: 'Xonaga kirish', icon: 'logIn', onClick: () => (window.location.hash = e.href) },
    { label: 'Dars jadvali', icon: 'calendar', onClick: () => (window.location.hash = '#/platform/schedule') },
  ]
  return (
    <div className={cx('pdl', (past || cancelled) && 'is-past', cancelled && 'is-cancelled')} style={{ '--lc': e.group?.color || '#4aa3f8' }}>
      <span className="pdl__dot" />
      <div className="pdl__time">{e.time} – {e.end}</div>
      <div className="pdl__body">
        <b>{e.title}</b>
        <span>{e.group?.name} · {teacher?.name || 'Ustoz biriktirilmagan'} · {online ? 'Onlayn' : e.place || 'Xona ko‘rsatilmagan'}</span>
      </div>
      <div className="pdl__side">
        {cancelled ? <Badge tone="red">Bekor qilindi</Badge> : e.status === 'live' ? <Badge tone="live" dot>Jonli</Badge> : online ? <Badge tone="green">Onlayn</Badge> : <Badge tone="blue">Xonada</Badge>}
        {soon && <small className="is-soon"><Icon name="clock" size={13} /> {fmtLeft(e.startsAt)}</small>}
        {e.status === 'live' && <small>hozir davom etmoqda</small>}
        {past && <small>o‘tildi</small>}
      </div>
      <Menu items={menu} />
    </div>
  )
}

/* ---------------- Guruhlar ---------------- */
function MyGroups({ groups, staff = false }) {
  const { db } = useAuth()
  const shown = groups.slice(0, 3)
  return (
    <Card title={<CardTitle icon="users">Mening guruhlarim</CardTitle>}
      action={<Btn size="sm" variant="ghost" icon="arrowRight" as="a" href={staff ? '#/platform/groups' : '#/platform/schedule'} style={{ flexDirection: 'row-reverse' }}>Barchasi</Btn>}>
      {shown.length ? (
        <div className="pdg-grid">
          {shown.map((g) => {
            const ms = db.meetings.filter((m) => m.groupId === g.id)
            const p = pct(ms.filter((m) => m.status === 'ended').length, ms.length)
            return (
              <a key={g.id} href={staff ? `#/platform/groups/${g.id}` : '#/platform/schedule'} className="pdg" style={{ '--gc': g.color }} title={`${g.name} · ${g.course}`}>
                <b>{g.name}</b>
                <span>{g.course}</span>
                <small>{staff
                  ? <><Icon name="users" size={14} /> {g.studentIds.length} o‘quvchi</>
                  : <><Icon name="user" size={14} /> {db.users.find((u) => u.id === g.teacherId)?.name || 'Ustoz biriktirilmagan'}</>}</small>
                <div className="pdg__prog" title="O‘tilgan darslar ulushi"><Progress value={p} size="sm" /><em>{p}%</em></div>
              </a>
            )
          })}
        </div>
      ) : <Empty icon="layers" title="Hali guruh yo‘q" text={staff ? 'Guruh biriktirilganda shu yerda ko‘rinadi.' : 'Administrator sizni guruhga qo‘shgach shu yerda ko‘rinadi.'} />}
    </Card>
  )
}

/* ---------------- Tezkor amallar ---------------- */
function QuickActions({ items }) {
  return (
    <Card title={<CardTitle icon="bolt">Tezkor amallar</CardTitle>}>
      <div className="pdq">
        {items.map((a) => <a key={a.label} href={a.href} className={`pdq__a pdq--${a.tone}`}><Icon name={a.icon} size={18} />{a.label}</a>)}
      </div>
    </Card>
  )
}

/* ---------------- So'nggi faoliyat ---------------- */
const kindOf = (t) => /test/i.test(t) ? ['Test', 'violet'] : /vazifa/i.test(t) ? ['Uy vazifa', 'amber'] : /dars/i.test(t) ? ['Dars', 'blue'] : /guruh|o‘quvchi|foydalanuvchi|ustoz|tashkilot/i.test(t) ? ['Guruh', 'teal'] : ['Material', 'green']

function ActivityFeed({ items, title = 'So‘nggi faoliyat' }) {
  const { db } = useAuth()
  return (
    <Card title={<CardTitle icon="clock">{title}</CardTitle>}>
      {items.length ? items.slice(0, 5).map((a) => {
        const u = db.users.find((x) => x.id === a.userId)
        const [label, tone] = kindOf(a.text)
        return (
          <div key={a.id} className="pda">
            <UAvatar user={u} size={36} />
            <div className="pda__body">
              <div title={a.target}><b>{u?.name || 'Foydalanuvchi'}</b> {a.text}</div>
              <small>{fmtAgo(a.at)}</small>
            </div>
            <Badge tone={tone}>{label}</Badge>
          </div>
        )
      }) : <Empty icon="zap" title="Hali faoliyat yo‘q" />}
    </Card>
  )
}

/* ---------------- Mini kalendar ---------------- */
const DOW = ['Du', 'Se', 'Cho', 'Pa', 'Ju', 'Sha', 'Ya']

function MiniCalendar({ day, setDay }) {
  const { db, scope } = useAuth()
  const monthOf = (ts) => { const d = new Date(ts); return new Date(d.getFullYear(), d.getMonth(), 1).getTime() }
  const [month, setMonth] = useState(() => monthOf(day))
  useEffect(() => { setMonth(monthOf(day)) }, [day])

  const m = new Date(month)
  const lead = (m.getDay() + 6) % 7
  const cells = useMemo(() => Array.from({ length: 42 }, (_, i) => new Date(m.getFullYear(), m.getMonth(), 1 - lead + i).getTime()), [month]) // eslint-disable-line react-hooks/exhaustive-deps
  const counts = useMemo(() => lessonCountsFor(scope, db, cells), [scope, db, cells])
  const today = startOfDay(Date.now())
  const shift = (n) => setMonth(new Date(m.getFullYear(), m.getMonth() + n, 1).getTime())
  const monthName = MONTHS_FULL[m.getMonth()]

  return (
    <Card className="pcal">
      <div className="pcal__head">
        <b>{monthName[0].toUpperCase() + monthName.slice(1)} {m.getFullYear()}</b>
        <div className="pcal__nav">
          {month !== monthOf(today) && <button onClick={() => setDay(today)} className="pcal__today">Bugun</button>}
          <button onClick={() => shift(-1)} aria-label="Oldingi oy"><Icon name="chevLeft" size={17} /></button>
          <button onClick={() => shift(1)} aria-label="Keyingi oy"><Icon name="chevRight" size={17} /></button>
        </div>
      </div>
      <div className="pcal__grid">
        {DOW.map((d) => <span key={d} className="pcal__dow">{d}</span>)}
        {cells.map((ts) => {
          const d = new Date(ts)
          const n = counts.get(ts) || 0
          return (
            <button key={ts} onClick={() => setDay(ts)} title={n ? `${n} ta dars` : undefined}
              className={cx('pcal__day', d.getMonth() !== m.getMonth() && 'is-out', ts === today && 'is-today', ts === day && 'is-sel', n > 0 && 'has-dot')}>
              {d.getDate()}
            </button>
          )
        })}
      </div>
    </Card>
  )
}

/* ---------------- Eslatmalar ---------------- */
function Reminders({ items }) {
  return (
    <Card title={<CardTitle icon="bell">Eslatmalar</CardTitle>} action={<Btn size="sm" variant="ghost" icon="arrowRight" as="a" href="#/platform/schedule" style={{ flexDirection: 'row-reverse' }}>Barchasi</Btn>}>
      {items.length ? items.map((r) => <ReminderRow key={r.id} r={r} />) : <Empty icon="checkCircle" title="Eslatmalar yo‘q" text="Hozircha kutilayotgan ish yo‘q." />}
    </Card>
  )
}

/* ---------------- Kutubxona reklamasi ---------------- */
function LibraryPromo() {
  const { scope } = useAuth()
  const n = scope.library.length
  return (
    <section className="pdp">
      <h4>Ilmiy manbalarga ega bo‘ling</h4>
      <p>{n ? `Kutubxonadagi ${n} ta manba sizni kutmoqda.` : 'Kutubxona kitoblar, PDF va audio darslarni jamlaydi.'}</p>
      <Btn size="sm" as="a" href="#/platform/library" icon="bookOpen">Kutubxonaga kirish</Btn>
      <span className="pdp__books" aria-hidden="true"><i /><i /><i /><i /></span>
    </section>
  )
}

// Karta sarlavhasi: ikonka + matn
function CardTitle({ icon, children }) {
  return <span className="pdt"><i className="pdt__ico"><Icon name={icon} size={17} /></i>{children}</span>
}
