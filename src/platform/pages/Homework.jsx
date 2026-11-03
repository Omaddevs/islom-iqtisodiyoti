import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../store/auth.jsx'
import { add, patch, remove, notify, logActivity } from '../store/db.js'
import { PageHead, Card, Btn, Badge, Tabs, Modal, FField, Input, Textarea, Select, Empty, Icon, UAvatar, Confirm, Menu, useToast, Table, Search, cx, useFormInit } from '../ui/kit.jsx'
import { fmtDateTime, fmtLeft, fmtAgo, toLocalInput, fromLocalInput, pct } from '../ui/format.js'
import { StatSpark, Donut, series, endOfDay } from '../ui/charts.jsx'

export default function Homework({ param }) {
  if (param) return <HomeworkDetail id={param} />
  return <HomeworkList />
}

/* ---------- Yordamchilar ---------- */

const D = 864e5
const SOON = 3 * D // "Muddati yaqin" chegarasi

// Vazifa holatlari (donut va legend uchun)
const STAFF_STATES = [
  { key: 'done', label: 'Bajarilgan', color: '#10b981' },
  { key: 'progress', label: 'Jarayonda', color: '#3b8ef0' },
  { key: 'pending', label: 'Baholash kutilmoqda', color: '#f5a524' },
  { key: 'late', label: 'Muddati o‘tgan', color: '#ef4444' },
]
const STUDENT_STATES = [
  { key: 'done', label: 'Baholangan', color: '#10b981' },
  { key: 'pending', label: 'Tekshirilmoqda', color: '#3b8ef0' },
  { key: 'progress', label: 'Bajarish kerak', color: '#f5a524' },
  { key: 'late', label: 'Muddati o‘tgan', color: '#ef4444' },
]
const stateOf = (r, isStaff) => {
  if (isStaff) {
    if (r.pending > 0) return 'pending'
    if (r.total > 0 && r.subs.length >= r.total) return 'done'
    return r.expired ? 'late' : 'progress'
  }
  if (r.my) return r.my.status === 'graded' ? 'done' : 'pending'
  return r.expired ? 'late' : 'progress'
}

/* ---------- Ro'yxat sahifasi ---------- */

function HomeworkList() {
  const { user, db, scope, can } = useAuth()
  const toast = useToast()
  const isStaff = user.role !== 'student'
  const [tab, setTab] = useState('active')
  const [q, setQ] = useState('')
  const [grp, setGrp] = useState('all')
  const [showAll, setShowAll] = useState(false)
  const [editing, setEditing] = useState(null)
  const [del, setDel] = useState(null)
  const now = Date.now()

  const hwIds = useMemo(() => new Set(scope.homework.map((h) => h.id)), [scope.homework])
  // Talaba faqat o'z javoblarini ko'radi, xodim — o'z doirasidagi barchasini
  const subsAll = useMemo(() => db.submissions.filter((s) => hwIds.has(s.homeworkId) && (isStaff || s.studentId === user.id)), [db.submissions, hwIds, isStaff, user.id])

  const rows = useMemo(() => scope.homework.map((h) => {
    const g = db.groups.find((x) => x.id === h.groupId)
    const subs = subsAll.filter((s) => s.homeworkId === h.id)
    const my = subs.find((s) => s.studentId === user.id)
    return { h, g, subs, my, total: g?.studentIds.length || 0, graded: subs.filter((s) => s.status === 'graded').length, pending: subs.filter((s) => s.status === 'submitted').length, expired: h.dueAt < now }
  }).sort((a, b) => (a.expired - b.expired) || (a.expired ? b.h.dueAt - a.h.dueAt : a.h.dueAt - b.h.dueAt)), [scope.homework, db.groups, subsAll, user.id, now])

  const is = {
    active: (r) => (isStaff ? !r.expired || r.pending > 0 : !r.my && !r.expired),
    soon: (r) => !r.expired && r.h.dueAt - now < SOON && (isStaff || !r.my),
    done: (r) => !!r.my,
    late: (r) => r.expired && !r.my,
    all: () => true,
  }
  const count = (k) => rows.filter(is[k]).length
  const tabs = isStaff
    ? [{ value: 'active', label: 'Faol', icon: 'fileText', count: count('active') }, { value: 'all', label: 'Barchasi', icon: 'layers', count: rows.length }, { value: 'soon', label: 'Muddati yaqin', icon: 'clock', count: count('soon') }]
    : [{ value: 'active', label: 'Bajarish kerak', icon: 'fileText', count: count('active') }, { value: 'done', label: 'Topshirilgan', icon: 'checkCircle', count: count('done') }, { value: 'late', label: 'Muddati o‘tgan', icon: 'clock', count: count('late') }]

  const list = useMemo(() => {
    const s = q.trim().toLowerCase()
    return rows.filter(is[tab]).filter((r) => !s || [r.h.title, r.h.description, r.g?.name, r.g?.course].some((x) => (x || '').toLowerCase().includes(s)))
  }, [rows, tab, q]) // eslint-disable-line react-hooks/exhaustive-deps

  // Statistika + sparkline qatorlari (oxirgi 14 kun)
  const stats = useMemo(() => {
    const upto = (ts) => subsAll.filter((s) => s.submittedAt <= endOfDay(ts))
    const hwBy = (ts) => rows.filter((r) => (r.h.createdAt || 0) <= endOfDay(ts))
    const waiting = (ts) => upto(ts).filter((s) => s.status === 'submitted' || (s.gradedAt || 0) > endOfDay(ts)).length
    const rate = (ts) => {
      const hs = hwBy(ts)
      return isStaff ? pct(upto(ts).length, hs.reduce((n, r) => n + r.total, 0)) : pct(upto(ts).length, hs.length)
    }
    const maxOf = (s) => rows.find((r) => r.h.id === s.homeworkId)?.h.maxGrade || 100
    const avgGrade = (list) => (list.length ? Math.round(list.reduce((n, s) => n + pct(s.grade, maxOf(s)), 0) / list.length) : 0)
    const graded = subsAll.filter((s) => s.status === 'graded')
    return {
      subs: subsAll.length,
      pending: subsAll.filter((s) => s.status === 'submitted').length,
      rate: rate(now),
      avgGrade: avgGrade(graded),
      sActive: series(14, (ts) => hwBy(ts).filter((r) => r.h.dueAt > ts).length),
      sSubs: series(14, (ts) => upto(ts).length),
      sPending: series(14, waiting),
      sRate: series(14, rate),
      sGrade: series(14, (ts) => avgGrade(graded.filter((s) => (s.gradedAt || s.submittedAt) <= endOfDay(ts)))),
    }
  }, [subsAll, rows, now, isStaff])

  const recent = useMemo(() => [...subsAll].sort((a, b) => b.submittedAt - a.submittedAt), [subsAll])
  const STATES = isStaff ? STAFF_STATES : STUDENT_STATES
  const inGrp = grp === 'all' ? rows : rows.filter((r) => r.h.groupId === grp)
  const parts = STATES.map((st) => ({ ...st, value: inGrp.filter((r) => stateOf(r, isStaff) === st.key).length }))
  const grpRate = isStaff ? pct(inGrp.reduce((n, r) => n + r.subs.length, 0), inGrp.reduce((n, r) => n + r.total, 0)) : pct(inGrp.filter((r) => r.my).length, inGrp.length)
  const grpOpts = [{ value: 'all', label: 'Barcha vazifalar' }, ...scope.groups.filter((g) => rows.some((r) => r.h.groupId === g.id)).map((g) => ({ value: g.id, label: g.name }))]

  const scrollTo = (id) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  const canCreate = isStaff && can('content.create')
  const hwOf = (s) => rows.find((r) => r.h.id === s.homeworkId)?.h

  return (
    <>
      {/* Sarlavha banneri */}
      <section className="pthero">
        <span className="pthero__icon"><Icon name="fileText" size={34} /></span>
        <div className="pthero__text">
          <h1>Uy vazifalari</h1>
          <p>{isStaff ? 'Topshiriqlar bering, javoblarni baholang' : 'Topshiriqlarni bajaring, baholaringizni kuzating'}</p>
        </div>
        <blockquote className="pthero__quote">“Ilm bilan amal qilish eng ulug‘ ne’matdir.”</blockquote>
        {canCreate && <Btn variant="primary" size="lg" icon="plus" className="pthero__btn" onClick={() => setEditing({})}>Vazifa berish</Btn>}
      </section>

      {/* Statistika */}
      <div className="pgrid pgrid--4 ptstats phwstats">
        {isStaff ? <>
          <StatSpark icon="fileText" tone="blue" color="#3b8ef0" value={count('active')} label="Faol vazifa" data={stats.sActive} onClick={() => setTab('active')} />
          <StatSpark icon="users" tone="teal" color="#14b8a6" value={stats.subs} label="Topshirishlar" data={stats.sSubs} onClick={() => scrollTo('phw-recent')} />
          <StatSpark icon="clock" tone="amber" color="#f5a524" value={stats.pending} label="Baholash kutilmoqda" data={stats.sPending} onClick={() => scrollTo('phw-recent')} />
          <StatSpark icon="chart" tone="violet" color="#8b5cf6" value={`${stats.rate}%`} label="O‘rtacha bajarilish" data={stats.sRate} onClick={() => scrollTo('phw-state')} />
        </> : <>
          <StatSpark icon="fileText" tone="blue" color="#3b8ef0" value={count('active')} label="Bajarish kerak" data={stats.sActive} onClick={() => setTab('active')} />
          <StatSpark icon="checkCircle" tone="teal" color="#14b8a6" value={count('done')} label="Topshirilgan" data={stats.sSubs} onClick={() => setTab('done')} />
          <StatSpark icon="clock" tone="amber" color="#f5a524" value={stats.pending} label="Tekshirilmoqda" data={stats.sPending} onClick={() => scrollTo('phw-recent')} />
          <StatSpark icon="award" tone="violet" color="#8b5cf6" value={`${stats.avgGrade}%`} label="O‘rtacha baho" data={stats.sGrade} onClick={() => scrollTo('phw-state')} />
        </>}
      </div>

      {/* Filtr paneli */}
      <div className="pvtool">
        <Tabs value={tab} onChange={setTab} items={tabs} className="pttabs" />
        <Search value={q} onChange={setQ} placeholder="Vazifa nomi, fan yoki tavsif bo‘yicha qidirish…" className="ptsearch" />
      </div>

      {/* Vazifa kartalari */}
      {list.length === 0 ? (
        <Card>
          {q
            ? <Empty icon="search" title="Hech narsa topilmadi" text="Qidiruv so‘rovingizga mos vazifa yo‘q." action={<Btn icon="refresh" onClick={() => setQ('')}>Qidiruvni tozalash</Btn>} />
            : <Empty icon="fileText" title="Vazifa yo‘q" text={isStaff ? 'Guruhga yangi vazifa bering.' : 'Bu bo‘limda vazifa yo‘q.'} action={canCreate && <Btn variant="primary" icon="plus" onClick={() => setEditing({})}>Vazifa berish</Btn>} />}
        </Card>
      ) : (
        <div className="pgrid pgrid--2">
          {list.map((r) => <HomeworkCard key={r.h.id} r={r} isStaff={isStaff}
            menu={isStaff && (r.h.authorId === user.id || user.role !== 'teacher') ? [
              { label: 'Javoblar', icon: 'eye', onClick: () => { window.location.hash = `#/platform/homework/${r.h.id}` } },
              { label: 'Tahrirlash', icon: 'edit', onClick: () => setEditing(r.h) }, 'sep',
              { label: 'O‘chirish', icon: 'trash', danger: true, onClick: () => setDel(r.h) },
            ] : null} />)}
          {/* Toq sonli kartada bo'sh joyni iqtibos bilan to'ldiramiz */}
          {list.length % 2 === 1 && <blockquote className="phwquote" aria-hidden="true">“Har bir ilm amaliyot bilan go‘zallashadi.”</blockquote>}
        </div>
      )}

      {/* Pastki qism: so'nggi topshiruvlar + holat */}
      <div className="ptbottom phwbottom">
        <Card id="phw-recent" pad={false} className="ptrecent phwrecent">
          <header className="ptcard-h">
            <h3 className="pdt"><span className="pdt__ico"><Icon name="clock" size={18} /></span>{isStaff ? 'So‘nggi topshiruvlar' : 'Mening topshiruvlarim'}</h3>
            {recent.length > 5 && <button type="button" className="ptlink" onClick={() => setShowAll((v) => !v)}>{showAll ? 'Yig‘ish' : 'Barchasini ko‘rish'} <Icon name={showAll ? 'chevUp' : 'arrowRight'} size={15} /></button>}
          </header>
          {recent.length === 0
            ? <Empty icon="clock" title="Hali topshiruv yo‘q" text="Vazifa topshirilgach javoblar shu yerda ko‘rinadi." />
            : (
              <Table rows={showAll ? recent : recent.slice(0, 5)} onRow={(s) => { window.location.hash = `#/platform/homework/${s.homeworkId}` }} cols={[
                { key: 'n', label: '#', w: 44, render: (s) => recent.indexOf(s) + 1 },
                ...(isStaff ? [{ key: 's', label: 'Talaba', render: (s) => { const u = db.users.find((x) => x.id === s.studentId); return <div className="pcell-user ptuser"><UAvatar user={u} size={30} /><b>{u?.name || '—'}</b></div> } }] : []),
                { key: 't', label: 'Vazifa nomi', render: (s) => <span className="ptname">{hwOf(s)?.title}</span> },
                { key: 'd', label: 'Topshirilgan vaqt', render: (s) => <span className="ptdate">{fmtDateTime(s.submittedAt)}</span> },
                { key: 'st', label: 'Holat', render: (s) => {
                  const late = s.submittedAt > (hwOf(s)?.dueAt ?? Infinity)
                  return s.status === 'graded' ? <span className="phwst phwst--green">Baholangan</span> : <span className={cx('phwst', late ? 'phwst--amber' : 'phwst--blue')}>{late ? 'Kech topshirildi' : 'Baholanmagan'}</span>
                } },
                { key: 'g', label: 'Ball', render: (s) => (s.status === 'graded' ? <span className="phwball">{s.grade}/{hwOf(s)?.maxGrade}</span> : <span className="pmuted">—</span>) },
              ]} />
            )}
        </Card>

        <Card id="phw-state" className="ptanalytics">
          <header className="ptcard-h ptcard-h--in">
            <h3 className="pdt"><span className="pdt__ico"><Icon name="chart" size={18} /></span>Vazifalar holati</h3>
            <label className="pdsel"><span>{grpOpts.find((o) => o.value === grp)?.label}</span><Icon name="chevDown" size={16} />
              <select value={grp} onChange={(e) => setGrp(e.target.value)} aria-label="Guruh">{grpOpts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select>
            </label>
          </header>
          <div className="ptan">
            <Donut parts={parts} center={inGrp.length ? `${grpRate}%` : '—'} sub={isStaff ? 'Bajarilish' : 'Topshirilgan'} />
            <ul className="ptlegend">
              {parts.map((p) => <li key={p.key}><i style={{ background: p.color }} /><span>{p.label}</span><b>{p.value}</b></li>)}
            </ul>
          </div>
          {inGrp.length === 0 && <p className="pmuted ptan__empty">Bu guruhda vazifa yo‘q.</p>}
        </Card>
      </div>

      <HomeworkForm open={!!editing} hw={editing} onClose={() => setEditing(null)} />
      <Confirm open={!!del} onClose={() => setDel(null)} danger title="Vazifani o‘chirish" text={`«${del?.title}» va barcha javoblar o‘chiriladi.`} confirmLabel="O‘chirish" onConfirm={() => { remove('homework', del.id); toast('O‘chirildi') }} />
    </>
  )
}

function HomeworkCard({ r, isStaff, menu }) {
  const { h, g, subs, my, total, graded, pending, expired } = r
  const href = `#/platform/homework/${h.id}`
  return (
    <article className={cx('phw', expired && !pending && 'is-expired')}>
      <span className="phw__icon"><Icon name="fileText" size={24} /></span>
      <div className="phw__body">
        <div className="phw__top">
          <h4><a href={href}>{h.title}</a></h4>
          {my ? (my.status === 'graded' ? <span className="phwdue phwdue--ok">Baho: {my.grade}/{h.maxGrade}</span> : <span className="phwdue phwdue--info">Tekshirilmoqda</span>)
            : expired ? <span className="phwdue phwdue--hot">Muddat tugagan</span>
              : <span className={cx('phwdue', h.dueAt - Date.now() < D && 'phwdue--hot')}>{fmtLeft(h.dueAt)}</span>}
        </div>
        {h.description && <p className="phw__desc">{h.description}</p>}
        <div className="phw__meta">
          <span><Icon name="layers" size={15} />{g?.name}</span>
          <span><Icon name="calendar" size={15} />{fmtDateTime(h.dueAt)}</span>
          <span><Icon name="award" size={15} />maks. {h.maxGrade} ball</span>
        </div>
        {isStaff && (
          <div className="phw__prog">
            <div><b>Topshirdi: {subs.length}/{total}</b>{pending > 0 ? <b className="phw__warn">{pending} ta baholanmagan</b> : <span>{graded} ta baholangan</span>}</div>
            <span className="phw__bar"><i style={{ width: `${pct(subs.length, total)}%` }} /></span>
          </div>
        )}
        <div className="phw__foot">
          {isStaff ? <Btn size="sm" variant={pending ? 'primary' : 'soft'} icon="eye" as="a" href={href}>{pending ? 'Baholash' : 'Ko‘rish'}</Btn>
            : my ? <Btn size="sm" variant="soft" icon="eye" as="a" href={href}>Javobimni ko‘rish</Btn>
              : expired ? <span className="pmuted" style={{ fontSize: 13.5 }}>Topshirish yopilgan</span>
                : <Btn size="sm" variant="primary" icon="send" as="a" href={href}>Topshirish</Btn>}
          {menu && <Menu items={menu} trigger={<button type="button" className="phw__more" aria-label="Amallar"><Icon name="moreV" size={18} /></button>} />}
        </div>
      </div>
    </article>
  )
}

export function HomeworkForm({ open, hw, onClose, defaultGroupId }) {
  const { user, db, scope } = useAuth()
  const toast = useToast()
  const isNew = !hw?.id
  const [f, setF] = useState({})
  const [err, setErr] = useState({})
  useFormInit(open, hw?.id, () => { setErr({}); setF(isNew ? { title: '', description: '', groupId: defaultGroupId || scope.groups[0]?.id || '', dueAt: toLocalInput(Date.now() + 3 * 864e5), maxGrade: 100 } : { ...hw, dueAt: toLocalInput(hw.dueAt) }) })
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }))
  const submit = () => {
    const er = {}
    if (!f.title?.trim()) er.title = 'Nomini kiriting'
    if (!f.groupId) er.groupId = 'Guruhni tanlang'
    if (!fromLocalInput(f.dueAt)) er.dueAt = 'Muddatni kiriting'
    setErr(er); if (Object.keys(er).length) return
    const g = db.groups.find((x) => x.id === f.groupId)
    if (!g) return setErr({ groupId: 'Guruh topilmadi — qayta tanlang' })
    const data = { title: f.title.trim(), description: f.description?.trim(), groupId: f.groupId, dueAt: fromLocalInput(f.dueAt), maxGrade: Number(f.maxGrade) || 100 }
    if (isNew) {
      const h = add('homework', { ...data, orgId: g.orgId, authorId: user.id })
      notify(g.studentIds, `Yangi uy vazifasi: «${h.title}» — muddat ${fmtDateTime(h.dueAt)}`, `#/platform/homework/${h.id}`)
      logActivity(g.orgId, user.id, 'uy vazifasi berdi', h.title)
      toast('Vazifa berildi, o‘quvchilarga xabar yuborildi')
    } else { patch('homework', hw.id, data); toast('Saqlandi') }
    onClose()
  }
  return (
    <Modal open={open} onClose={onClose} title={isNew ? 'Uy vazifasi berish' : 'Vazifani tahrirlash'} footer={<><Btn onClick={onClose}>Bekor</Btn><Btn variant="primary" onClick={submit}>{isNew ? 'Berish' : 'Saqlash'}</Btn></>}>
      <div className="pform">
        <FField label="Vazifa nomi" error={err.title}><Input value={f.title || ''} onChange={(e) => set('title', e.target.value)} autoFocus /></FField>
        <FField label="Topshiriq matni"><Textarea value={f.description || ''} onChange={(e) => set('description', e.target.value)} placeholder="Nima qilish kerakligini batafsil yozing…" /></FField>
        <div className="pform__row">
          <FField label="Guruh" error={err.groupId}><Select value={f.groupId} onChange={(v) => set('groupId', v)} options={scope.groups.map((g) => ({ value: g.id, label: `${g.name} — ${g.course}` }))} placeholder="Tanlang" /></FField>
          <FField label="Maksimal ball"><Input type="number" min="1" value={f.maxGrade || ''} onChange={(e) => set('maxGrade', e.target.value)} /></FField>
        </div>
        <FField label="Topshirish muddati" error={err.dueAt}><Input type="datetime-local" value={f.dueAt || ''} onChange={(e) => set('dueAt', e.target.value)} /></FField>
      </div>
    </Modal>
  )
}

function HomeworkDetail({ id }) {
  const { user, db } = useAuth()
  const toast = useToast()
  const h = db.homework.find((x) => x.id === id)
  const [text, setText] = useState('')
  const [grading, setGrading] = useState({}) // subId -> {grade, feedback}
  if (!h) return <Card><Empty icon="fileText" title="Vazifa topilmadi" action={<Btn as="a" href="#/platform/homework">Orqaga</Btn>} /></Card>
  const g = db.groups.find((x) => x.id === h.groupId)
  const author = db.users.find((u) => u.id === h.authorId)
  const subs = db.submissions.filter((s) => s.homeworkId === id)
  const isStaff = user.role !== 'student'
  const my = subs.find((s) => s.studentId === user.id)
  const expired = h.dueAt < Date.now()

  const submit = () => {
    if (!text.trim()) return toast('Javob matnini yozing', 'err')
    add('submissions', { homeworkId: id, studentId: user.id, text: text.trim(), submittedAt: Date.now(), status: 'submitted' })
    notify([h.authorId], `${user.name} «${h.title}» vazifasini yubordi`, `#/platform/homework/${id}`)
    logActivity(h.orgId, user.id, 'uy vazifasini topshirdi', h.title)
    toast('Javob yuborildi')
  }
  const grade = (s) => {
    const gr = grading[s.id] || {}
    const val = Number(gr.grade)
    if (!(val >= 0 && val <= h.maxGrade)) return toast(`Baho 0–${h.maxGrade} oralig‘ida bo‘lishi kerak`, 'err')
    patch('submissions', s.id, { status: 'graded', grade: val, feedback: gr.feedback?.trim() || '', gradedAt: Date.now() })
    notify([s.studentId], `${user.name} «${h.title}» vazifangizni baholadi: ${val}/${h.maxGrade}`, `#/platform/homework/${id}`)
    toast('Baholandi, o‘quvchiga xabar yuborildi')
  }

  const students = (g?.studentIds || []).map((sid) => db.users.find((u) => u.id === sid)).filter(Boolean)

  return (
    <>
      <PageHead crumbs={[{ label: 'Uy vazifalari', href: '#/platform/homework' }, { label: h.title }]} title={h.title} sub={`${g?.name} · ${author?.name} · muddat ${fmtDateTime(h.dueAt)} · maks. ${h.maxGrade} ball`} />
      <div className="pgrid pgrid--main">
        <div className="pstack-v" style={{ gap: 20 }}>
          <Card title="Topshiriq"><p style={{ lineHeight: 1.7, color: 'var(--pf-text-2)', whiteSpace: 'pre-wrap' }}>{h.description || 'Tavsif berilmagan.'}</p></Card>

          {!isStaff && (
            my ? (
              <Card title="Sizning javobingiz" action={my.status === 'graded' ? <Badge tone="green">Baho: {my.grade}/{h.maxGrade}</Badge> : <Badge tone="blue">Tekshirilmoqda</Badge>}>
                <div className="psub"><span className="pmuted" style={{ fontSize: 12.5 }}>Yuborildi: {fmtDateTime(my.submittedAt)}</span><div className="psub__text">{my.text}</div>
                  {my.feedback && <div className="psub__fb"><b>Ustoz izohi:</b> {my.feedback}</div>}</div>
              </Card>
            ) : expired ? <Card><Empty icon="alertCircle" title="Topshirish muddati tugagan" text="Ustoz bilan bog‘lanib qo‘shimcha vaqt so‘rashingiz mumkin." /></Card> : (
              <Card title="Javob yuborish" sub={fmtLeft(h.dueAt)}>
                <Textarea style={{ minHeight: 180 }} value={text} onChange={(e) => setText(e.target.value)} placeholder="Javobingizni shu yerga yozing…" />
                <div className="prow prow--between" style={{ marginTop: 12 }}><span className="pmuted" style={{ fontSize: 12.5 }}>Fayl bo‘lsa — Google Drive yoki Telegram havolasini matnga qo‘shing</span><Btn variant="primary" icon="send" onClick={submit}>Yuborish</Btn></div>
              </Card>
            )
          )}

          {isStaff && (
            <Card title="Javoblar" sub={`${subs.length} / ${students.length} o‘quvchi topshirdi`}>
              {subs.length === 0 && <Empty icon="fileText" title="Hali javob yo‘q" />}
              {subs.sort((a, b) => (a.status === 'submitted' ? -1 : 1) - (b.status === 'submitted' ? -1 : 1)).map((s) => {
                const st = db.users.find((u) => u.id === s.studentId)
                const gr = grading[s.id] || { grade: s.grade ?? '', feedback: s.feedback ?? '' }
                return (
                  <div key={s.id} className="psub" style={{ marginBottom: 12 }}>
                    <div className="prow prow--between"><div className="pcell-user"><UAvatar user={st} size={34} /><div><b>{st?.name}</b><span>{fmtAgo(s.submittedAt)}{s.submittedAt > h.dueAt && ' · kech topshirdi'}</span></div></div>{s.status === 'graded' ? <Badge tone="green">{s.grade}/{h.maxGrade}</Badge> : <Badge tone="amber">Baholanmagan</Badge>}</div>
                    <div className="psub__text">{s.text}</div>
                    <div className="pform__row" style={{ marginTop: 12, gridTemplateColumns: '120px 1fr auto', alignItems: 'end' }}>
                      <FField label="Baho"><Input type="number" min="0" max={h.maxGrade} value={gr.grade} onChange={(e) => setGrading((x) => ({ ...x, [s.id]: { ...gr, grade: e.target.value } }))} /></FField>
                      <FField label="Izoh"><Input value={gr.feedback} onChange={(e) => setGrading((x) => ({ ...x, [s.id]: { ...gr, feedback: e.target.value } }))} placeholder="O‘quvchiga izoh…" /></FField>
                      <Btn variant={s.status === 'graded' ? 'default' : 'primary'} icon="check" onClick={() => grade(s)}>{s.status === 'graded' ? 'Yangilash' : 'Baholash'}</Btn>
                    </div>
                  </div>
                )
              })}
            </Card>
          )}
        </div>
        <Card title={isStaff ? 'Guruh holati' : 'Guruh'} sub={g?.name}>
          {students.map((s) => {
            const sub = subs.find((x) => x.studentId === s.id)
            return (
              <div key={s.id} className="pitem" style={{ padding: '9px 0' }}>
                <UAvatar user={s} size={32} />
                <div className="pitem__body"><b style={{ fontSize: 14 }}>{s.name}</b></div>
                {isStaff && (sub ? <Badge tone={sub.status === 'graded' ? 'green' : 'blue'}>{sub.status === 'graded' ? `${sub.grade}` : 'Yuborgan'}</Badge> : <Badge tone="gray">—</Badge>)}
              </div>
            )
          })}
        </Card>
      </div>
    </>
  )
}
