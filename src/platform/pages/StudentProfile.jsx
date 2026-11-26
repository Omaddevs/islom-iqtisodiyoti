// Ustoz uchun o'quvchi kartasi: nima qildi (test, kutubxona, lug'at, video, maqola, vazifa, onlayn dars),
// qancha vaqt o'tkazdi va qanday natija ko'rsatdi — davr bo'yicha grafiklar va batafsil jadvallar bilan.
import { useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '../store/auth.jsx'
import { PageHead, Card, Btn, Badge, Tabs, Empty, Icon, UAvatar, Table, Progress, cx } from '../ui/kit.jsx'
import { fmtAgo, fmtDate, fmtDateShort, fmtDateTime, pct } from '../ui/format.js'
import { Donut } from '../ui/charts.jsx'
import { ChartPanel } from '../ui/chartpanel.jsx'
import { studyApi } from '../api/study.js'
import '../../styles/student-profile.css'

export const KINDS = {
  library: { label: 'Kutubxona', icon: 'bookOpen', color: '#2a78d6' },
  video: { label: 'Video darslar', icon: 'play', color: '#e34948' },
  test: { label: 'Testlar', icon: 'clipboard', color: '#6250d6' },
  vocab: { label: 'Lug‘at', icon: 'translate', color: '#1baf7a' },
  article: { label: 'Maqolalar', icon: 'bookmark', color: '#eda100' },
  homework: { label: 'Uy vazifalari', icon: 'fileText', color: '#eb6834' },
  meeting: { label: 'Onlayn darslar', icon: 'video', color: '#0ea5e9' },
}
const ORDER = Object.keys(KINDS)
const PERIODS = [{ value: 7, label: '7 kun' }, { value: 30, label: '30 kun' }, { value: 90, label: '90 kun' }]

// «1 soat 25 daq», «12 daq», «40 son»
export const fmtSpent = (sec) => {
  const s = Math.round(sec || 0)
  if (s < 60) return s ? `${s} son` : '0 daq'
  const h = Math.floor(s / 3600), m = Math.round((s % 3600) / 60)
  return h ? (m ? `${h} soat ${m} daq` : `${h} soat`) : `${m} daq`
}
const dayKey = (ts) => { const d = new Date(ts); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }
const keyToTs = (k) => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d).getTime() }
const rangeDays = (today, n) => Array.from({ length: n }, (_, i) => { const t = keyToTs(today); return dayKey(t - (n - 1 - i) * 864e5) })
const LEVELS = [
  { min: 30 * 60, label: 'Yuqori faollik', tone: 'green' },
  { min: 10 * 60, label: 'O‘rtacha faollik', tone: 'amber' },
  { min: 1, label: 'Past faollik', tone: 'red' },
  { min: 0, label: 'Faol emas', tone: 'gray' },
]
const levelOf = (avgSec) => LEVELS.find((l) => avgSec >= l.min)

export default function StudentProfile({ id }) {
  const { user, db, scope } = useAuth()
  const [days, setDays] = useState(() => { try { return Number(localStorage.getItem('ii_sp_days')) || 30 } catch { return 30 } })
  const [act, setAct] = useState(null)
  const [err, setErr] = useState(null)
  const [tab, setTab] = useState('timeline')
  const s = db.users.find((u) => u.id === id)
  const allowed = !!s && s.role === 'student' && (user.role === 'teacher' ? scope.myStudents : scope.students).some((x) => x.id === id)
  const pickDays = (d) => { setDays(d); try { localStorage.setItem('ii_sp_days', String(d)) } catch { /* xotira */ } }

  useEffect(() => {
    if (!allowed) return undefined
    let alive = true
    setErr(null)
    const load = () => studyApi.student(id, days).then((d) => { if (alive) setAct(d) }).catch((e) => { if (alive) setErr(e.message) })
    load()
    const t = setInterval(() => { if (document.visibilityState === 'visible') load() }, 60e3)
    return () => { alive = false; clearInterval(t) }
  }, [id, days, allowed])

  const data = useMemo(() => (allowed ? build({ s, db, scope, act, days }) : null), [allowed, s, db, scope, act, days])
  if (!allowed) return <Card><Empty icon="user" title="O‘quvchi topilmadi" text="O‘quvchi o‘chirilgan yoki sizning guruhingizda emas." action={<Btn as="a" href="#/platform/users" icon="arrowLeft">O‘quvchilarga qaytish</Btn>} /></Card>

  const d = data
  const lvl = levelOf(d.avgDaily)
  return (
    <>
      <PageHead crumbs={[{ label: user.role === 'teacher' ? 'O‘quvchilarim' : 'Foydalanuvchilar', href: '#/platform/users' }, { label: s.name }]} title="O‘quvchi statistikasi"
        actions={<Btn as="a" href={`#/platform/tests/student.${s.id}`} icon="clipboard">Testlar tahlili</Btn>} />

      {/* O'quvchi kartasi */}
      <section className="sp-hero">
        <UAvatar user={s} size={72} className="sp-hero__av" />
        <div className="sp-hero__info">
          <div className="sp-hero__name"><h2>{s.name}</h2><Badge tone={lvl.tone} dot>{lvl.label}</Badge></div>
          <p className="sp-hero__meta">
            <span><Icon name="phone" size={14} />{s.phone}</span>
            <span><Icon name="clock" size={14} />{d.lastActive ? `Oxirgi faollik: ${fmtAgo(d.lastActive)}` : 'Hali faollik yo‘q'}</span>
            {s.createdAt && <span><Icon name="calendar" size={14} />Qo‘shilgan: {fmtDate(s.createdAt)}</span>}
          </p>
          <div className="sp-hero__groups">
            {d.groups.length ? d.groups.map((g) => <a key={g.id} href={`#/platform/groups/${g.id}`} className="pgchip" style={{ '--gc': g.color }}>{g.name}</a>) : <span className="pmuted">Guruhga biriktirilmagan</span>}
          </div>
        </div>
        <div className="sp-period" role="group" aria-label="Davr">
          {PERIODS.map((p) => <button key={p.value} type="button" className={cx(days === p.value && 'is-on')} aria-pressed={days === p.value} onClick={() => pickDays(p.value)}>{p.label}</button>)}
        </div>
      </section>

      {err && <p className="sp-err"><Icon name="alertCircle" size={16} />Vaqt statistikasini yuklab bo‘lmadi: {err}</p>}

      {/* Asosiy ko'rsatkichlar */}
      <div className="sp-kpis">
        <Kpi icon="clock" color="#2a78d6" value={act ? fmtSpent(d.total) : '…'} label={`O‘qishga sarflangan vaqt · ${days} kun`} sub={act ? `Kuniga o‘rtacha ${fmtSpent(d.avgDaily)}` : null} />
        <Kpi icon="calendar" color="#0ea5e9" value={act ? `${d.activeDays} / ${days}` : '…'} label="Faol kunlar" sub={act ? (d.streak > 1 ? `Ketma-ket ${d.streak} kun` : d.activeDays ? `${pct(d.activeDays, days)}% kunlarda o‘qigan` : 'Bu davrda kirmagan') : null} bar={pct(d.activeDays, days)} />
        <Kpi icon="clipboard" color="#6250d6" value={`${d.tests.done.length} / ${d.tests.assigned.length}`} label="Ishlangan testlar" sub={d.tests.avg === null ? 'Hali topshirmagan' : `O‘rtacha natija ${d.tests.avg}%`} bar={pct(d.tests.done.length, d.tests.assigned.length)} />
        <Kpi icon="fileText" color="#eb6834" value={`${d.hw.submitted} / ${d.hw.list.length}`} label="Topshirilgan uy vazifalari" sub={d.hw.avg === null ? (d.hw.list.length ? 'Baholanmagan' : 'Vazifa berilmagan') : `O‘rtacha baho ${d.hw.avg}%`} bar={pct(d.hw.submitted, d.hw.list.length)} />
        <Kpi icon="bookOpen" color="#2a78d6" value={d.lib.opened} label="Ochilgan kutubxona materiallari" sub={`${fmtSpent(d.lib.seconds)} o‘qigan · ${d.lib.total} ta mavjud`} bar={pct(d.lib.opened, d.lib.total)} />
        <Kpi icon="play" color="#e34948" value={d.vid.watched} label="Ko‘rilgan video darslar" sub={`${fmtSpent(d.vid.seconds)} · ${d.vid.total} ta mavjud`} bar={pct(d.vid.watched, d.vid.total)} />
        <Kpi icon="translate" color="#1baf7a" value={`${d.voc.learned}`} label="Yodlangan so‘zlar" sub={`${d.voc.total} ta so‘zdan · ${fmtSpent(d.voc.seconds)}`} bar={pct(d.voc.learned, d.voc.total)} />
        <Kpi icon="video" color="#0ea5e9" value={`${d.meet.attended} / ${d.meet.total}`} label="Qatnashgan onlayn darslar" sub={d.meet.seconds ? `${fmtSpent(d.meet.seconds)} darsda` : d.meet.total ? 'Guruh darslari' : 'Dars o‘tilmagan'} bar={pct(d.meet.attended, d.meet.total)} />
      </div>

      {/* Kunlik faollik + vaqt taqsimoti */}
      <div className="sp-row">
        <Card className="sp-daily" title="Kunlik faollik" sub={`Har kuni qaysi bo‘limda qancha vaqt o‘tkazgani · oxirgi ${days} kun`}>
          {!act ? <div className="sp-skel" /> : <StackedDays rows={d.dayRows} />}
          <div className="sp-legend">
            {ORDER.filter((k) => d.byKind[k]).map((k) => <span key={k}><i style={{ background: KINDS[k].color }} />{KINDS[k].label}</span>)}
          </div>
        </Card>
        <Card className="sp-split" title="Vaqt taqsimoti" sub={`Oxirgi ${days} kun`}>
          {d.total ? (
            <>
              <Donut parts={ORDER.map((k) => ({ key: k, value: d.byKind[k] || 0, color: KINDS[k].color }))} center={fmtSpent(d.total)} sub="jami" />
              <ul className="sp-split__list">
                {ORDER.filter((k) => d.byKind[k]).sort((a, b) => d.byKind[b] - d.byKind[a]).map((k) => (
                  <li key={k}><i style={{ background: KINDS[k].color }} /><span>{KINDS[k].label}</span><b>{fmtSpent(d.byKind[k])}</b><em>{pct(d.byKind[k], d.total)}%</em></li>
                ))}
              </ul>
            </>
          ) : <Empty icon="clock" title="Bu davrda faollik yo‘q" text="O‘quvchi platformada material ochganda vaqt avtomatik hisoblanadi." />}
        </Card>
      </div>

      {/* Natijalar grafiklari + e'tibor talab qiladigan joylar */}
      <div className="sp-row sp-row--b">
        <ChartPanel title="Natijalar" storeKey="student_profile" datasets={d.datasets} defaultType="bar" emptyText="Hali ma’lumot yo‘q." />
        <Card className="sp-todo" title="E’tibor bering" sub="Bajarilmagan yoki ochilmagan topshiriqlar">
          {d.todo.length ? (
            <ul className="sp-todo__list">
              {d.todo.slice(0, 8).map((x) => (
                <li key={x.key} className={`is-${x.tone}`}>
                  <span className="sp-todo__ico" style={{ '--kc': KINDS[x.kind].color }}><Icon name={KINDS[x.kind].icon} size={16} /></span>
                  <div><b>{x.title}</b><span>{x.text}</span></div>
                </li>
              ))}
            </ul>
          ) : <Empty icon="award" title="Hammasi bajarilgan" text="Muddati o‘tgan yoki ochilmagan topshiriq yo‘q." />}
        </Card>
      </div>

      {/* Batafsil */}
      <Card pad={false} className="sp-detail">
        <div className="sp-detail__tabs">
          <Tabs value={tab} onChange={setTab} items={[
            { value: 'timeline', label: 'Faollik tarixi', icon: 'clock' },
            { value: 'test', label: 'Testlar', icon: 'clipboard', count: d.tests.assigned.length },
            { value: 'library', label: 'Kutubxona', icon: 'bookOpen', count: d.lib.rows.length },
            { value: 'video', label: 'Video', icon: 'play', count: d.vid.rows.length },
            { value: 'vocab', label: 'Lug‘at', icon: 'translate', count: d.voc.rows.length },
            { value: 'article', label: 'Maqolalar', icon: 'bookmark', count: d.art.rows.length },
            { value: 'homework', label: 'Vazifalar', icon: 'fileText', count: d.hw.list.length },
            { value: 'meeting', label: 'Onlayn darslar', icon: 'video', count: d.meet.rows.length },
          ]} />
        </div>
        {tab === 'timeline' && <Timeline items={d.timeline} loading={!act} />}
        {tab === 'test' && <Table rows={d.tests.rows} onRow={(r) => { window.location.hash = `#/platform/tests/student.${s.id}` }} empty={<Empty icon="clipboard" title="Test berilmagan" />} cols={[
          { key: 't', label: 'Test', render: (r) => <Name title={r.t.title} sub={`${r.t.questions.length} savol`} /> },
          { key: 'r', label: 'Natija', render: (r) => (r.a ? <Score value={pct(r.a.score, r.a.total)} text={`${r.a.score}/${r.a.total}`} /> : <Badge tone="amber">Topshirmagan</Badge>) },
          { key: 'n', label: 'Urinishlar', render: (r) => (r.a ? `${r.a.used || 1} marta` : '—') },
          { key: 'sp', label: 'Sarflangan vaqt', render: (r) => (r.a ? fmtSpent((r.a.finishedAt - r.a.startedAt) / 1000) : '—') },
          { key: 'd', label: 'Sana', render: (r) => <span className="pmuted">{r.a ? fmtDateTime(r.a.finishedAt) : '—'}</span> },
        ]} />}
        {tab === 'library' && <Table rows={d.lib.rows} empty={<Empty icon="bookOpen" title="Kutubxona materiali ochilmagan" />} cols={[
          { key: 't', label: 'Material', render: (r) => <Name title={r.title} sub={r.sub} /> },
          { key: 'o', label: 'Ochgan', render: (r) => (r.opens ? `${r.opens} marta` : '—') },
          { key: 'p', label: 'O‘qilgan qismi', render: (r) => (r.progress !== null && r.progress !== undefined ? <Score value={r.progress} /> : <span className="pmuted">—</span>) },
          { key: 's', label: 'Vaqt', render: (r) => <b>{fmtSpent(r.seconds)}</b> },
          { key: 'l', label: 'Oxirgi marta', render: (r) => <span className="pmuted">{r.lastAt ? fmtAgo(r.lastAt) : '—'}</span> },
        ]} />}
        {tab === 'video' && <Table rows={d.vid.rows} empty={<Empty icon="play" title="Video darslar ko‘rilmagan" />} cols={[
          { key: 't', label: 'Video', render: (r) => <Name title={r.title} sub={r.sub} /> },
          { key: 'p', label: 'Ko‘rilgan qismi', render: (r) => (r.progress !== null && r.progress !== undefined ? <Score value={r.progress} /> : <span className="pmuted">—</span>) },
          { key: 's', label: 'Vaqt', render: (r) => <b>{fmtSpent(r.seconds)}</b> },
          { key: 'l', label: 'Oxirgi marta', render: (r) => <span className="pmuted">{fmtAgo(r.lastAt)}</span> },
        ]} />}
        {tab === 'vocab' && <Table rows={d.voc.rows} empty={<Empty icon="translate" title="Lug‘at to‘plamlari yo‘q" />} cols={[
          { key: 't', label: 'To‘plam', render: (r) => <Name title={r.v.title} sub={`${r.v.terms.length} ta so‘z`} /> },
          { key: 'p', label: 'Yodlangan', render: (r) => <Score value={pct(r.learned, r.v.terms.length)} text={`${r.learned}/${r.v.terms.length}`} /> },
          { key: 's', label: 'Vaqt', render: (r) => (r.seconds ? <b>{fmtSpent(r.seconds)}</b> : <span className="pmuted">Ochmagan</span>) },
          { key: 'l', label: 'Oxirgi marta', render: (r) => <span className="pmuted">{r.lastAt ? fmtAgo(r.lastAt) : '—'}</span> },
        ]} />}
        {tab === 'article' && <Table rows={d.art.rows} empty={<Empty icon="bookmark" title="Maqolalar yo‘q" />} cols={[
          { key: 't', label: 'Maqola', render: (r) => <Name title={r.a.title} sub={r.a.category} /> },
          { key: 'r', label: 'Holat', render: (r) => (r.read ? <Badge tone="green" dot>O‘qigan</Badge> : <Badge tone="gray">O‘qimagan</Badge>) },
          { key: 'p', label: 'O‘qilgan qismi', render: (r) => (r.progress !== null && r.progress !== undefined ? <Score value={r.progress} /> : <span className="pmuted">—</span>) },
          { key: 's', label: 'Vaqt', render: (r) => (r.seconds ? <b>{fmtSpent(r.seconds)}</b> : <span className="pmuted">—</span>) },
        ]} />}
        {tab === 'homework' && <Table rows={d.hw.list} onRow={(r) => { window.location.hash = `#/platform/homework/${r.h.id}` }} empty={<Empty icon="fileText" title="Vazifa berilmagan" />} cols={[
          { key: 't', label: 'Vazifa', render: (r) => <Name title={r.h.title} sub={`Muddat: ${fmtDateTime(r.h.dueAt)}`} /> },
          { key: 's', label: 'Holat', render: (r) => (r.sub ? (r.sub.status === 'graded' ? <Badge tone="green" dot>Baholangan</Badge> : <Badge tone="blue" dot>Topshirilgan</Badge>) : r.h.dueAt < Date.now() ? <Badge tone="red">Topshirmagan</Badge> : <Badge tone="amber">Kutilmoqda</Badge>) },
          { key: 'g', label: 'Baho', render: (r) => (r.sub?.grade !== undefined && r.sub?.grade !== null ? <b>{r.sub.grade}/{r.h.maxGrade || 100}</b> : <span className="pmuted">—</span>) },
          { key: 'v', label: 'Ishlagan vaqt', render: (r) => (r.seconds ? fmtSpent(r.seconds) : <span className="pmuted">—</span>) },
          { key: 'd', label: 'Topshirgan', render: (r) => <span className="pmuted">{r.sub ? fmtDateTime(r.sub.submittedAt) : '—'}</span> },
        ]} />}
        {tab === 'meeting' && <Table rows={d.meet.rows} empty={<Empty icon="video" title="Onlayn darslar yo‘q" />} cols={[
          { key: 't', label: 'Dars', render: (r) => <Name title={r.title} sub={fmtDateTime(r.startsAt)} /> },
          { key: 'a', label: 'Qatnashuv', render: (r) => (r.joinedAt ? <Badge tone="green" dot>{r.external ? 'Havolani ochgan' : 'Qatnashgan'}</Badge> : r.past ? <Badge tone="red">Qatnashmagan</Badge> : <Badge tone="gray">Rejada</Badge>) },
          { key: 's', label: 'Darsda', render: (r) => (r.seconds ? fmtSpent(r.seconds) : <span className="pmuted">—</span>) },
        ]} />}
      </Card>
    </>
  )
}

/* ---------- Hisob-kitob ---------- */

function build({ s, db, scope, act, days }) {
  const now = Date.now()
  const groups = db.groups.filter((g) => g.studentIds.includes(s.id))
  const gIds = new Set(groups.map((g) => g.id))
  const forMe = (x) => !(x.groupIds || []).length || x.groupIds.some((g) => gIds.has(g))
  const items = act?.items || []
  const itemOf = (kind, refId) => items.find((x) => x.kind === kind && x.refId === refId)
  const sumKind = (kind) => items.filter((x) => x.kind === kind).reduce((a, x) => a + x.seconds, 0)

  // Kunlik vaqt (+ onlayn darslar qatnashuvi)
  const today = act?.today || dayKey(now)
  const keys = rangeDays(today, days)
  const map = new Map(keys.map((k) => [k, {}]))
  for (const r of act?.daily || []) { const m = map.get(r.day); if (m) m[r.kind] = (m[r.kind] || 0) + r.seconds }
  for (const m of act?.meetings || []) { const x = m.joinedAt && map.get(dayKey(m.joinedAt)); if (x && m.seconds) x.meeting = (x.meeting || 0) + m.seconds }
  const dayRows = keys.map((k) => ({ key: k, ts: keyToTs(k), parts: map.get(k), total: Object.values(map.get(k)).reduce((a, b) => a + b, 0) }))
  const byKind = {}
  for (const r of dayRows) for (const [k, v] of Object.entries(r.parts)) byKind[k] = (byKind[k] || 0) + v
  const total = dayRows.reduce((a, r) => a + r.total, 0)
  const activeDays = dayRows.filter((r) => r.total > 0).length
  let streak = 0
  for (let i = dayRows.length - 1; i >= 0; i--) { if (dayRows[i].total > 0) streak++; else if (i === dayRows.length - 1) continue; else break }

  // Testlar
  const attempts = db.testAttempts.filter((a) => a.studentId === s.id)
  const assigned = scope.tests.filter((t) => forMe(t) || attempts.some((a) => a.testId === t.id))
  const done = attempts.filter((a) => assigned.some((t) => t.id === a.testId))
  const testRows = assigned.map((t) => ({ id: t.id, t, a: done.find((a) => a.testId === t.id) }))
    .sort((x, y) => (y.a?.finishedAt || y.t.createdAt || 0) - (x.a?.finishedAt || x.t.createdAt || 0))
  const tAvg = done.length ? Math.round(done.reduce((a, x) => a + pct(x.score, x.total), 0) / done.length) : null

  // Kutubxona: vaqt yozilgan yoki fayli ochilgan materiallar
  const libAll = scope.library.filter((l) => l.type !== 'unit' && forMe(l))
  const opens = new Map((act?.opens || []).map((o) => [o.refId, o]))
  const libIds = new Set([...items.filter((x) => x.kind === 'library').map((x) => x.refId), ...opens.keys()])
  const libRows = [...libIds].map((rid) => {
    const l = db.library.find((x) => x.id === rid), it = itemOf('library', rid), o = opens.get(rid)
    const unit = l?.unitId && db.library.find((x) => x.id === l.unitId)
    return { id: rid, title: l?.title || it?.title || 'O‘chirilgan material', sub: [unit?.title, l?.fileExt?.toUpperCase() || l?.format].filter(Boolean).join(' · '), seconds: it?.seconds || 0, progress: it?.progress ?? null, opens: o?.opens || 0, lastAt: Math.max(it?.lastAt || 0, o?.lastAt || 0) }
  }).sort((a, b) => b.lastAt - a.lastAt)

  // Video
  const vidAll = scope.videos.filter(forMe)
  const vidRows = items.filter((x) => x.kind === 'video').map((it) => {
    const v = db.videos.find((x) => x.id === it.refId)
    return { id: it.refId, title: v?.title || it.title, sub: v?.module || '', seconds: it.seconds, progress: it.progress, lastAt: it.lastAt }
  })

  // Lug'at
  const vocAll = scope.vocabSets.filter(forMe)
  const vocRows = vocAll.map((v) => {
    const p = db.vocabProgress.find((x) => x.setId === v.id && x.studentId === s.id), it = itemOf('vocab', v.id)
    return { id: v.id, v, learned: p?.learned?.length || 0, seconds: it?.seconds || 0, lastAt: it?.lastAt || 0 }
  }).sort((a, b) => b.lastAt - a.lastAt || b.learned - a.learned)

  // Maqolalar
  const artRows = scope.articles.filter((a) => a.published && forMe(a)).map((a) => {
    const it = itemOf('article', a.id)
    return { id: a.id, a, read: (a.readBy || []).includes(s.id), seconds: it?.seconds || 0, progress: it?.progress ?? null, lastAt: it?.lastAt || 0 }
  }).sort((x, y) => y.lastAt - x.lastAt || Number(y.read) - Number(x.read))

  // Uy vazifalari
  const hwList = db.homework.filter((h) => gIds.has(h.groupId)).map((h) => ({ id: h.id, h, sub: db.submissions.find((x) => x.homeworkId === h.id && x.studentId === s.id), seconds: itemOf('homework', h.id)?.seconds || 0 }))
    .sort((a, b) => b.h.dueAt - a.h.dueAt)
  const graded = hwList.filter((r) => r.sub?.grade !== undefined && r.sub?.grade !== null)
  const hwAvg = graded.length ? Math.round(graded.reduce((a, r) => a + pct(r.sub.grade, r.h.maxGrade || 100), 0) / graded.length) : null

  // Onlayn darslar: guruh darslari + qatnashuv
  const att = new Map((act?.meetings || []).map((m) => [m.id, m]))
  const meetRows = (db.meetings || []).filter((m) => gIds.has(m.groupId) || att.has(m.id)).map((m) => {
    const a = att.get(m.id)
    return { id: m.id, title: m.title, startsAt: new Date(m.startsAt).getTime(), joinedAt: a?.joinedAt || null, external: a?.external, seconds: a?.seconds || 0, past: new Date(m.startsAt).getTime() + m.durationMin * 60e3 < now }
  })
  for (const a of act?.meetings || []) if (!meetRows.some((r) => r.id === a.id)) meetRows.push({ id: a.id, title: a.title, startsAt: a.startsAt, joinedAt: a.joinedAt, external: a.external, seconds: a.seconds, past: true })
  meetRows.sort((a, b) => b.startsAt - a.startsAt)
  const meetPast = meetRows.filter((r) => r.past || r.joinedAt)

  // Faollik tarixi
  const timeline = [
    ...items.map((x) => ({ key: `${x.kind}-${x.refId}`, kind: x.kind, at: x.lastAt, title: x.title || '—', text: `${fmtSpent(x.seconds)}${x.progress !== null && x.progress !== undefined ? ` · ${x.progress}%` : ''}${x.days > 1 ? ` · ${x.days} kun davomida` : ''}`, verb: VERB[x.kind] })),
    ...done.map((a) => { const t = assigned.find((x) => x.id === a.testId); return { key: `ta-${a.id}`, kind: 'test', at: a.finishedAt, title: t?.title || 'Test', text: `${a.score}/${a.total} · ${pct(a.score, a.total)}%`, verb: 'Testni topshirdi', score: pct(a.score, a.total) } }),
    ...hwList.filter((r) => r.sub).map((r) => ({ key: `hw-${r.sub.id}`, kind: 'homework', at: r.sub.submittedAt, title: r.h.title, text: r.sub.grade !== undefined && r.sub.grade !== null ? `Baho: ${r.sub.grade}/${r.h.maxGrade || 100}` : 'Baholanmagan', verb: 'Vazifani topshirdi' })),
    ...(act?.meetings || []).map((m) => ({ key: `mt-${m.id}`, kind: 'meeting', at: m.joinedAt, title: m.title, text: m.seconds ? fmtSpent(m.seconds) : m.external ? 'Havolani ochdi' : '', verb: 'Onlayn darsga qo‘shildi' })),
  ].filter((x) => x.at).sort((a, b) => b.at - a.at).slice(0, 60)

  // E'tibor talab qiladiganlar
  const todo = [
    ...testRows.filter((r) => !r.a).map((r) => ({ key: `t2-${r.id}`, kind: 'test', tone: 'amber', title: r.t.title, text: 'Test hali topshirilmagan' })),
    ...hwList.filter((r) => !r.sub && r.h.dueAt < now).map((r) => ({ key: `h-${r.id}`, kind: 'homework', tone: 'red', title: r.h.title, text: `Vazifa topshirilmagan · muddat ${fmtDate(r.h.dueAt)}` })),
    ...testRows.filter((r) => r.a && pct(r.a.score, r.a.total) < 50).map((r) => ({ key: `tl-${r.id}`, kind: 'test', tone: 'amber', title: r.t.title, text: `Past natija: ${pct(r.a.score, r.a.total)}%` })),
    ...meetPast.filter((r) => r.past && !r.joinedAt).slice(0, 3).map((r) => ({ key: `m-${r.id}`, kind: 'meeting', tone: 'amber', title: r.title, text: `Onlayn darsda qatnashmagan · ${fmtDateShort(r.startsAt)}` })),
    ...(act ? vidAll.filter((v) => !itemOf('video', v.id)).slice(0, 2).map((v) => ({ key: `v-${v.id}`, kind: 'video', tone: 'gray', title: v.title, text: 'Video dars hali ochilmagan' })) : []),
  ]

  // Natijalar grafigi uchun ko'rsatkichlar
  const datasets = [
    { key: 'tests', label: 'Testlar', sub: 'Har bir test natijasi, foizda', max: 100, unit: '%', head: ['Test', 'Natija'], parts: null, defaultType: 'bar',
      rows: [...done].sort((a, b) => a.finishedAt - b.finishedAt).map((a) => { const t = assigned.find((x) => x.id === a.testId); return { key: a.id, label: t?.title || 'Test', value: pct(a.score, a.total), shown: `${pct(a.score, a.total)}% · ${a.score}/${a.total}` } }) },
    { key: 'time', label: 'Materiallar vaqti', sub: 'Eng ko‘p vaqt sarflangan materiallar, daqiqada', unit: ' daq', head: ['Material', 'Vaqt'], defaultType: 'bar',
      parts: { label: 'Vaqtning materiallar bo‘yicha ulushi', value: (r) => r.value },
      rows: [...items].sort((a, b) => b.seconds - a.seconds).slice(0, 12).map((x) => ({ key: `${x.kind}-${x.refId}`, label: x.title || '—', value: Math.max(1, Math.round(x.seconds / 60)), shown: `${fmtSpent(x.seconds)} · ${KINDS[x.kind].label}`, color: KINDS[x.kind].color })) },
    { key: 'vocab', label: 'Lug‘at', sub: 'To‘plamlar bo‘yicha yodlangan so‘zlar, foizda', max: 100, unit: '%', head: ['To‘plam', 'Yodlangan'], parts: null, defaultType: 'bar',
      rows: vocRows.filter((r) => r.v.terms.length).map((r) => ({ key: r.id, label: r.v.title, value: pct(r.learned, r.v.terms.length), shown: `${r.learned}/${r.v.terms.length} so‘z` })) },
    { key: 'videos', label: 'Video', sub: 'Har bir video darsning ko‘rilgan qismi, foizda', max: 100, unit: '%', head: ['Video', 'Ko‘rilgan'], parts: null, defaultType: 'bar',
      rows: vidRows.filter((r) => r.progress !== null && r.progress !== undefined).map((r) => ({ key: r.id, label: r.title, value: r.progress, shown: `${r.progress}% · ${fmtSpent(r.seconds)}` })) },
  ]

  const lastActive = Math.max(s.lastSeen || 0, ...items.map((x) => x.lastAt || 0), ...done.map((a) => a.finishedAt || 0)) || null
  return {
    groups, dayRows, byKind, total, activeDays, streak, avgDaily: total / days, lastActive, timeline, todo, datasets,
    tests: { assigned, done, rows: testRows, avg: tAvg },
    lib: { rows: libRows, opened: libRows.length, total: libAll.length, seconds: sumKind('library') },
    vid: { rows: vidRows, watched: vidRows.length, total: vidAll.length, seconds: sumKind('video') },
    voc: { rows: vocRows, learned: vocRows.reduce((a, r) => a + r.learned, 0), total: vocRows.reduce((a, r) => a + r.v.terms.length, 0), seconds: sumKind('vocab') },
    art: { rows: artRows },
    hw: { list: hwList, submitted: hwList.filter((r) => r.sub).length, avg: hwAvg },
    meet: { rows: meetRows, total: meetPast.length, attended: meetPast.filter((r) => r.joinedAt).length, seconds: (act?.meetings || []).reduce((a, m) => a + m.seconds, 0) },
  }
}
const VERB = { video: 'Video dars ko‘rdi', library: 'Kutubxona materialini o‘qidi', vocab: 'Lug‘at o‘rgandi', test: 'Test ishladi', article: 'Maqola o‘qidi', homework: 'Vazifa ustida ishladi' }

/* ---------- Kichik komponentlar ---------- */

function Kpi({ icon, color, value, label, sub, bar }) {
  return (
    <div className="sp-kpi" style={{ '--kc': color }}>
      <span className="sp-kpi__ico"><Icon name={icon} size={20} /></span>
      <b className="sp-kpi__val">{value}</b>
      <span className="sp-kpi__label">{label}</span>
      {sub && <span className="sp-kpi__sub">{sub}</span>}
      {bar !== undefined && <span className="sp-kpi__bar"><i style={{ width: `${Math.min(100, bar || 0)}%` }} /></span>}
    </div>
  )
}
const Name = ({ title, sub }) => <div className="sp-name"><b>{title}</b>{sub && <span>{sub}</span>}</div>
const Score = ({ value, text }) => (
  <div className="sp-score"><span><b>{text || `${value}%`}</b>{text && <em>{value}%</em>}</span><Progress size="sm" value={value} tone={value >= 70 ? 'green' : value >= 50 ? 'amber' : 'red'} /></div>
)

function Timeline({ items, loading }) {
  if (loading) return <div className="sp-skel sp-skel--list" />
  if (!items.length) return <Empty icon="clock" title="Hali faollik yo‘q" text="O‘quvchi material ochganda, test ishlaganda yoki vazifa topshirganda shu yerda ko‘rinadi." />
  let last = ''
  return (
    <ol className="sp-tl">
      {items.map((x) => {
        const day = new Date(x.at).toDateString()
        const head = day !== last ? (last = day, fmtDate(x.at)) : null
        return (
          <li key={x.key}>
            {head && <div className="sp-tl__day">{new Date(x.at).toDateString() === new Date().toDateString() ? 'Bugun' : head}</div>}
            <div className="sp-tl__row">
              <span className="sp-tl__ico" style={{ '--kc': KINDS[x.kind].color }}><Icon name={KINDS[x.kind].icon} size={16} /></span>
              <div className="sp-tl__body"><span>{x.verb}</span><b>{x.title}</b></div>
              <span className="sp-tl__meta">{x.text}</span>
              <time>{new Date(x.at).toTimeString().slice(0, 5)}</time>
            </div>
          </li>
        )
      })}
    </ol>
  )
}

// Kunlar bo'yicha ustunlar: har bir ustun bo'limlar kesimida (daqiqada)
export function StackedDays({ rows }) {
  const [hover, setHover] = useState(null)
  const box = useRef(null)
  const maxSec = Math.max(...rows.map((r) => r.total), 0)
  const stepMin = [5, 10, 15, 30, 60, 120, 180, 240, 360].find((s) => s * 4 * 60 >= maxSec) || 600
  const top = stepMin * 4 * 60
  const label = (m) => (m >= 60 ? `${m / 60} soat` : `${m} daq`)
  const every = rows.length <= 10 ? 1 : Math.ceil(rows.length / 6)
  const h = hover !== null && rows[hover]
  return (
    <div className="sp-stack" ref={box} onMouseLeave={() => setHover(null)}>
      <div className="sp-stack__grid" aria-hidden>
        {[4, 3, 2, 1, 0].map((i) => <div key={i}><span>{maxSec ? label(stepMin * i) : i === 0 ? '0' : ''}</span></div>)}
      </div>
      <div className="sp-stack__cols" role="list" aria-label="Kunlik faollik" style={{ gap: rows.length > 40 ? 2 : rows.length > 20 ? 4 : 10 }}>
        {rows.map((r, i) => (
          <div key={r.key} role="listitem" className={cx('sp-stack__col', hover === i && 'is-hover', !r.total && 'is-zero')} onMouseEnter={() => setHover(i)} onFocus={() => setHover(i)} tabIndex={0}
            aria-label={`${fmtDate(r.ts)}: ${fmtSpent(r.total)}`}>
            <div className="sp-stack__bar" style={{ height: `${top ? (r.total / top) * 100 : 0}%` }}>
              {ORDER.filter((k) => r.parts[k]).map((k) => <i key={k} style={{ flexGrow: r.parts[k], background: KINDS[k].color }} />)}
            </div>
            <span className="sp-stack__x">{(i % every === 0 || i === rows.length - 1) && (rows.length <= 7 ? ['Yak', 'Dush', 'Sesh', 'Chor', 'Pay', 'Jum', 'Shan'][new Date(r.ts).getDay()] : fmtDateShort(r.ts))}</span>
          </div>
        ))}
      </div>
      {h && (
        <div className={cx('sp-stack__tip', hover > rows.length / 2 && 'is-left')} style={{ left: `${((hover + 0.5) / rows.length) * 100}%` }}>
          <b>{fmtDate(h.ts)}</b>
          {h.total ? ORDER.filter((k) => h.parts[k]).map((k) => <span key={k}><i style={{ background: KINDS[k].color }} />{KINDS[k].label}<em>{fmtSpent(h.parts[k])}</em></span>) : <span className="pmuted">Faollik yo‘q</span>}
          {h.total > 0 && <strong>Jami: {fmtSpent(h.total)}</strong>}
        </div>
      )}
    </div>
  )
}
