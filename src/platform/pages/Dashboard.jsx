// Bosh sahifa (dashboard): bitta umumiy dizayn, ma'lumotlar esa rolga qarab hisoblanadi
import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../store/auth.jsx'
import { Card, Stat, Btn, Badge, UAvatar, Icon, Progress, Empty, Menu, cx } from '../ui/kit.jsx'
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
  // Bosh admin tashkilot ichiga kirganda — tashkilot admini ko'rinishi
  const role = user.role === 'superadmin' && viewOrgId ? 'org_admin' : user.role
  const [day, setDay] = useState(() => startOfDay(Date.now()))
  const data = useDashData(role)

  return (
    <div className="pdash">
      <div className="pdash__main">
        <HeroBanner />
        <div className="pgrid pgrid--4 pdash__stats">
          {data.stats.map((s) => <Stat key={s.label} {...s} />)}
        </div>
        <div className="pdash__cols">
          <div className="pdash__col">
            <TodayLessons day={day} setDay={setDay} />
            <MyGroups groups={data.groups} role={role} />
          </div>
          <div className="pdash__col">
            <QuickActions items={data.actions} />
            <ActivityFeed items={data.activity} />
          </div>
        </div>
      </div>
      <aside className="pdash__side">
        <MiniCalendar day={day} setDay={setDay} />
        <Reminders items={data.reminders} />
        <LibraryPromo />
      </aside>
    </div>
  )
}

/* ---------------- Rolga qarab ma'lumotlar ---------------- */
function useDashData(role) {
  const { user, db, scope } = useAuth()
  return useMemo(() => {
    const now = Date.now()
    const weekAgo = now - 7 * DAY_MS
    const live = scope.meetings.filter((m) => m.status === 'live').length
    const ended = scope.meetings.filter((m) => m.status === 'ended').length
    const liveHint = live ? `${live} ta jonli dars` : undefined
    let stats, actions, groups = scope.groups, activity = scope.activity

    if (role === 'superadmin') {
      const users = db.users.filter((u) => u.role !== 'superadmin')
      const fresh = users.filter((u) => u.createdAt > weekAgo).length
      stats = [
        { icon: 'bank', label: 'Tashkilotlar', value: db.organizations.length, tone: 'violet', href: '#/platform/organizations' },
        { icon: 'users', label: 'Foydalanuvchilar', value: users.length, trend: fresh ? `+${fresh} bu hafta` : undefined, tone: 'blue', href: '#/platform/users' },
        { icon: 'layers', label: 'Guruhlar', value: db.groups.length, tone: 'green', href: '#/platform/groups' },
        { icon: 'video', label: 'Jami darslar', value: db.meetings.length, hint: liveHint, tone: 'red', href: '#/platform/meetings' },
      ]
      actions = [
        { label: 'Tashkilot qo‘shish', icon: 'bank', tone: 'violet', href: '#/platform/organizations?new=1' },
        { label: 'Foydalanuvchi qo‘shish', icon: 'userPlus', tone: 'green', href: '#/platform/users?new=1' },
        { label: 'Guruh yaratish', icon: 'layers', tone: 'amber', href: '#/platform/groups?new=1' },
        { label: 'Yangi dars yaratish', icon: 'plus', tone: 'blue', href: '#/platform/meetings?new=1' },
      ]
      groups = db.groups; activity = db.activity
    } else if (role === 'org_admin') {
      const fresh = scope.users.filter((u) => u.createdAt > weekAgo).length
      stats = [
        { icon: 'users', label: 'O‘quvchilar', value: scope.students.length, trend: fresh ? `+${fresh} bu hafta` : undefined, tone: 'blue', href: '#/platform/users' },
        { icon: 'user', label: 'Ustozlar', value: scope.teachers.length, tone: 'teal', href: '#/platform/users?role=teacher' },
        { icon: 'layers', label: 'Guruhlar', value: scope.groups.length, tone: 'green', href: '#/platform/groups' },
        { icon: 'video', label: 'Jami darslar', value: scope.meetings.length, hint: liveHint, tone: 'red', href: '#/platform/meetings' },
      ]
      actions = [
        { label: 'Yangi dars yaratish', icon: 'plus', tone: 'blue', href: '#/platform/meetings?new=1' },
        { label: 'Foydalanuvchi qo‘shish', icon: 'userPlus', tone: 'green', href: '#/platform/users?new=1' },
        { label: 'Material yuklash', icon: 'upload', tone: 'violet', href: '#/platform/library' },
        { label: 'Guruh yaratish', icon: 'layers', tone: 'amber', href: '#/platform/groups?new=1' },
      ]
    } else if (role === 'teacher') {
      const toGrade = db.submissions.filter((s) => s.status === 'submitted' && scope.homework.some((h) => h.id === s.homeworkId)).length
      stats = [
        { icon: 'layers', label: 'Guruhlarim', value: scope.groups.length, tone: 'blue', href: '#/platform/groups' },
        { icon: 'users', label: 'O‘quvchilarim', value: scope.myStudents.length, tone: 'teal', href: '#/platform/users' },
        { icon: 'fileText', label: 'Baholash kutmoqda', value: toGrade, tone: 'amber', href: '#/platform/homework' },
        { icon: 'video', label: 'O‘tkazilgan darslar', value: ended, hint: liveHint, tone: 'violet', href: '#/platform/meetings' },
      ]
      actions = [
        { label: 'Dars rejalashtirish', icon: 'plus', tone: 'blue', href: '#/platform/meetings?new=1' },
        { label: 'Test yaratish', icon: 'clipboard', tone: 'violet', href: '#/platform/tests' },
        { label: 'Vazifa berish', icon: 'fileText', tone: 'amber', href: '#/platform/homework' },
        { label: 'Material yuklash', icon: 'upload', tone: 'green', href: '#/platform/library' },
      ]
    } else {
      const attempts = db.testAttempts.filter((a) => a.studentId === user.id)
      const avg = attempts.length ? Math.round(attempts.reduce((s, a) => s + pct(a.score, a.total), 0) / attempts.length) : 0
      const pendingHw = scope.homework.filter((h) => !db.submissions.some((s) => s.homeworkId === h.id && s.studentId === user.id) && h.dueAt > now).length
      const learned = db.vocabProgress.filter((p) => p.studentId === user.id).reduce((s, p) => s + p.learned.length, 0)
      const totalTerms = scope.vocabSets.reduce((s, v) => s + v.terms.length, 0)
      stats = [
        { icon: 'layers', label: 'Guruhlarim', value: scope.groups.length, tone: 'blue', href: '#/platform/schedule' },
        { icon: 'award', label: 'Testlar o‘rtachasi', value: `${avg}%`, hint: attempts.length ? `${attempts.length} ta topshirilgan` : undefined, tone: 'green', href: '#/platform/tests' },
        { icon: 'fileText', label: 'Kutilayotgan vazifa', value: pendingHw, tone: 'amber', href: '#/platform/homework' },
        { icon: 'translate', label: 'O‘rganilgan so‘zlar', value: `${learned}/${totalTerms}`, tone: 'violet', href: '#/platform/vocabulary' },
      ]
      actions = [
        { label: 'Testlarga o‘tish', icon: 'clipboard', tone: 'blue', href: '#/platform/tests' },
        { label: 'Uy vazifalari', icon: 'fileText', tone: 'amber', href: '#/platform/homework' },
        { label: 'Lug‘atni mashq qilish', icon: 'translate', tone: 'violet', href: '#/platform/vocabulary' },
        { label: 'Kutubxona', icon: 'bookOpen', tone: 'green', href: '#/platform/library' },
      ]
    }

    return { stats, actions, groups, activity, reminders: buildReminders(role, user, db, scope) }
  }, [role, user, db, scope])
}

// Eslatmalar: yaqin darslar + rolga xos muddatlar + o'qilmagan bildirishnomalar
function buildReminders(role, user, db, scope) {
  const now = Date.now()
  const items = []
  scope.meetings
    .filter((m) => m.status !== 'ended' && m.startsAt > now - 30 * 60e3 && m.startsAt < now + 2 * DAY_MS)
    .forEach((m) => {
      const g = db.groups.find((x) => x.id === m.groupId)
      items.push({ id: m.id, at: m.startsAt, icon: 'video', tone: m.status === 'live' ? 'red' : 'blue', title: m.title, sub: `${m.status === 'live' ? 'Hozir jonli' : fmtWhen(m.startsAt)} · ${g?.name || ''}`, href: `#/platform/meetings/${m.id}/room` })
    })
  if (role === 'student') {
    scope.homework.filter((h) => h.dueAt > now && !db.submissions.some((s) => s.homeworkId === h.id && s.studentId === user.id))
      .forEach((h) => items.push({ id: h.id, at: h.dueAt, icon: 'fileText', tone: 'amber', title: h.title, sub: `Muddat: ${fmtWhen(h.dueAt)}`, href: `#/platform/homework/${h.id}` }))
    scope.tests.filter((t) => t.dueAt > now && !db.testAttempts.some((a) => a.testId === t.id && a.studentId === user.id))
      .forEach((t) => items.push({ id: t.id, at: t.dueAt, icon: 'clipboard', tone: 'violet', title: t.title, sub: `Test muddati: ${fmtWhen(t.dueAt)}`, href: `#/platform/tests/${t.id}` }))
  }
  if (role === 'teacher' || role === 'org_admin') {
    const toGrade = db.submissions.filter((s) => s.status === 'submitted' && scope.homework.some((h) => h.id === s.homeworkId))
    if (toGrade.length) items.push({ id: 'grade', at: now, icon: 'edit', tone: 'amber', title: `${toGrade.length} ta vazifa baholashni kutmoqda`, sub: 'Uy vazifalari bo‘limi', href: '#/platform/homework' })
    scope.homework.filter((h) => h.dueAt > now && h.dueAt < now + 2 * DAY_MS)
      .forEach((h) => items.push({ id: h.id, at: h.dueAt, icon: 'fileText', tone: 'teal', title: h.title, sub: `Topshirish muddati: ${fmtWhen(h.dueAt)}`, href: `#/platform/homework/${h.id}` }))
  }
  if (role === 'org_admin' || role === 'superadmin') {
    scope.groups.filter((g) => !g.teacherId)
      .forEach((g) => items.push({ id: g.id, at: now, icon: 'alertCircle', tone: 'red', title: `${g.name} guruhiga ustoz biriktirilmagan`, sub: g.course, href: `#/platform/groups/${g.id}` }))
  }
  db.notifications.filter((n) => n.userId === user.id && !n.read).slice(0, 2)
    .forEach((n) => items.push({ id: n.id, at: n.at, icon: 'bell', tone: 'gray', title: n.text, sub: fmtAgo(n.at), href: n.href }))
  return items.sort((a, b) => a.at - b.at).slice(0, 4)
}

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
  const online = /onlayn|online/i.test(e.group?.room || '')
  const now = Date.now()
  const upcoming = e.status !== 'ended' && e.status !== 'live' && e.startsAt > now
  const past = e.status === 'ended' || (e.status === 'regular' && e.startsAt + e.durationMin * 60e3 < now)
  const soon = upcoming && e.startsAt - now < 3 * 3600e3
  const menu = [
    e.status === 'live' ? { label: 'Darsga qo‘shilish', icon: 'video', onClick: () => (window.location.hash = e.href) }
      : e.status === 'ended' ? { label: e.href.includes('/videos/') ? 'Yozuvni ko‘rish' : 'Darsni ochish', icon: 'play', onClick: () => (window.location.hash = e.href) }
        : e.status === 'regular' ? { label: 'Guruhni ochish', icon: 'layers', onClick: () => (window.location.hash = e.href) }
          : { label: 'Xonaga kirish', icon: 'logIn', onClick: () => (window.location.hash = e.href) },
    { label: 'Dars jadvali', icon: 'calendar', onClick: () => (window.location.hash = '#/platform/schedule') },
  ]
  return (
    <div className={cx('pdl', past && 'is-past')} style={{ '--lc': e.group?.color || '#4aa3f8' }}>
      <span className="pdl__dot" />
      <div className="pdl__time">{e.time} – {e.end}</div>
      <div className="pdl__body">
        <b>{e.title}</b>
        <span>{e.group?.name} · {teacher?.name || 'Ustoz biriktirilmagan'} · {online ? 'Onlayn' : e.group?.room || 'Xona ko‘rsatilmagan'}</span>
      </div>
      <div className="pdl__side">
        {e.status === 'live' ? <Badge tone="live" dot>Jonli</Badge> : online ? <Badge tone="green">Onlayn</Badge> : <Badge tone="blue">Xonada</Badge>}
        {soon && <small className="is-soon"><Icon name="clock" size={13} /> {fmtLeft(e.startsAt)}</small>}
        {e.status === 'live' && <small>hozir davom etmoqda</small>}
        {past && <small>o‘tildi</small>}
      </div>
      <Menu items={menu} />
    </div>
  )
}

/* ---------------- Guruhlar ---------------- */
function MyGroups({ groups, role }) {
  const { db } = useAuth()
  const staff = role !== 'student'
  const shown = groups.slice(0, 3)
  return (
    <Card title={<CardTitle icon="users">{role === 'superadmin' || role === 'org_admin' ? 'Guruhlar' : 'Mening guruhlarim'}</CardTitle>}
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
                <small><Icon name="users" size={14} /> {g.studentIds.length} talaba</small>
                <div className="pdg__prog" title="O‘tilgan darslar ulushi"><Progress value={p} size="sm" /><em>{p}%</em></div>
              </a>
            )
          })}
        </div>
      ) : <Empty icon="layers" title="Hali guruh yo‘q" />}
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

function ActivityFeed({ items }) {
  const { db } = useAuth()
  return (
    <Card title={<CardTitle icon="clock">So‘nggi faoliyat</CardTitle>}>
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
      {items.length ? items.map((r) => (
        <a key={r.id} href={r.href || '#/platform'} className="pdr">
          <span className="pdr__ico" style={toneStyle(r.tone)}><Icon name={r.icon} size={19} /></span>
          <div className="pdr__body"><b>{r.title}</b><span>{r.sub}</span></div>
        </a>
      )) : <Empty icon="checkCircle" title="Eslatmalar yo‘q" text="Hozircha kutilayotgan ish yo‘q." />}
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
