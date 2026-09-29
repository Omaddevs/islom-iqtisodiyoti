import { useMemo, useState } from 'react'
import { useAuth } from '../store/auth.jsx'
import { PageHead, Card, Btn, Badge, Icon, Empty, Table, Menu, Search, cx } from '../ui/kit.jsx'
import { DAYS, DAYS_FULL, MONTHS_FULL } from '../ui/format.js'
import { DAY_MS as D, startOfWeek, eventsForDay } from '../ui/agenda.js'

export default function Schedule() {
  const { db, scope } = useAuth()
  const [week, setWeek] = useState(() => startOfWeek(Date.now()))
  const [q, setQ] = useState('')
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const thisWeek = week === startOfWeek(Date.now())

  // Haftaning har kuni: aniq rejalashtirilgan darslar + guruh jadvalidan doimiy darslar
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => {
    const ts = week + i * D
    return { ts, dow: new Date(ts).getDay(), isToday: ts === today.getTime(), events: eventsForDay(scope, db, ts) }
  }), [week, scope, db, today])

  const total = days.reduce((s, d) => s + d.events.length, 0)
  const first = new Date(week), last = new Date(week + 6 * D)
  const range = `${first.getDate()} ${MONTHS_FULL[first.getMonth()].slice(0, 4)} — ${last.getDate()} ${MONTHS_FULL[last.getMonth()].slice(0, 3)} ${last.getFullYear()} · ${total} ta dars`

  const groups = scope.groups.filter((g) => (g.name + ' ' + g.course).toLowerCase().includes(q.toLowerCase()))

  return (
    <>
      <PageHead icon="calendar" title="Dars jadvali" sub={range}
        actions={<div className="pweek-nav">
          <Btn icon="chevLeft" onClick={() => setWeek((w) => w - 7 * D)} aria-label="Oldingi hafta" />
          <Btn variant={thisWeek ? 'primary' : 'soft'} onClick={() => setWeek(startOfWeek(Date.now()))}>Bugun</Btn>
          <Btn icon="chevRight" onClick={() => setWeek((w) => w + 7 * D)} aria-label="Keyingi hafta" />
        </div>} />

      <div className="pweek">
        {days.map((d) => {
          const dt = new Date(d.ts)
          const weekend = d.dow === 0 || d.dow === 6
          return (
            <div key={d.ts} className={cx('pweek__day', d.isToday && 'is-today', d.ts < today.getTime() && 'is-past')}>
              <header className="pweek__head">
                <div>
                  <span className="pweek__dow">{DAYS_FULL[d.dow]}</span>
                  <b className="pweek__num">{dt.getDate()}</b>
                  <span className="pweek__mon">{MONTHS_FULL[dt.getMonth()]}</span>
                </div>
                {d.events.length > 0 && <span className="pweek__count">{d.events.length} ta dars</span>}
              </header>
              <div className="pweek__list">
                {d.events.length === 0 && (
                  <div className="pweek__empty">
                    <Icon name={weekend ? (d.dow === 0 ? 'moon' : 'sun') : 'calendar'} size={30} />
                    <b>Dars yo‘q</b>
                    <span>{d.isToday ? 'Bugun dam olish kuni' : weekend ? 'Dam olish kuni' : 'Bo‘sh kun'}</span>
                  </div>
                )}
                {d.events.map((e) => <EventCard key={e.id} e={e} />)}
              </div>
            </div>
          )
        })}
      </div>

      <Card pad={false} className="pweek-table">
        <header className="pcard__head" style={{ padding: '22px 24px 16px' }}>
          <div className="phead__ttl">
            <span className="phead__icon phead__icon--sm"><Icon name="calendar" size={22} /></span>
            <div><h3 className="pcard__title">Guruhlar jadvali</h3><p className="pcard__sub">Doimiy dars kunlari va vaqtlari</p></div>
          </div>
          <Search value={q} onChange={setQ} placeholder="Guruh yoki fan nomi bo‘yicha qidirish…" className="pweek-table__search" />
        </header>
        <Table rows={groups} onRow={(g) => (window.location.hash = `#/platform/groups/${g.id}`)} empty={<Empty icon="layers" title="Guruh topilmadi" />} cols={[
          { key: 'name', label: 'Fan / guruh', render: (g) => <div className="pcell-user"><span className="pcell-icon" style={{ background: g.color + '1f', color: g.color }}><Icon name="layers" size={20} /></span><div><b>{g.name} · {g.course}</b><span>{g.level}</span></div></div> },
          { key: 'teacher', label: 'O‘qituvchi', render: (g) => { const t = db.users.find((u) => u.id === g.teacherId); return <span className="pcell-muted"><Icon name="user" size={16} />{t?.name || 'Biriktirilmagan'}</span> } },
          { key: 'mode', label: 'Shakli', render: (g) => /onlayn|online/i.test(g.room || '') ? <Badge tone="green"><Icon name="wifi" size={13} /> Onlayn</Badge> : <Badge tone="blue"><Icon name="building" size={13} /> {g.room || 'Ofis'}</Badge> },
          { key: 'room', label: 'Xona', render: (g) => /onlayn|online/i.test(g.room || '') ? <span className="pmuted">—</span> : g.name },
          { key: 'days', label: 'Dars kunlari', render: (g) => <div className="pweek__times">{g.schedule.length ? g.schedule.map((s, i) => <span key={i}>{DAYS[s.day]} {s.time}</span>) : <span className="pmuted">Jadval yo‘q</span>}</div> },
          { key: 'a', label: '', align: 'right', render: (g) => <span onClick={(e) => e.stopPropagation()}><Menu items={[{ label: 'Guruhni ochish', icon: 'layers', onClick: () => (window.location.hash = `#/platform/groups/${g.id}`) }, { label: 'Onlayn darslar', icon: 'video', onClick: () => (window.location.hash = '#/platform/meetings') }]} /></span> },
        ]} />
      </Card>
    </>
  )
}

function EventCard({ e }) {
  return (
    <a href={e.href} className={cx('pev', `pev--${e.status}`)} style={{ '--ec': e.group?.color || '#4aa3f8' }} title={`${e.title} · ${e.group?.name}`}>
      <div className="pev__time">{e.time} – {e.end}</div>
      <div className="pev__title">{e.title}</div>
      <div className="pev__foot">
        <span className="pev__group"><Icon name="layers" size={13} />{e.group?.name}</span>
        {e.status === 'live' ? <span className="pev__live">Jonli</span> : <span className="pev__status">{e.status === 'ended' ? 'o‘tildi' : e.status === 'scheduled' ? 'reja' : 'doimiy'}</span>}
      </div>
    </a>
  )
}
