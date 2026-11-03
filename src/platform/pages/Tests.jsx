import { useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '../store/auth.jsx'
import { add, patch, remove, notify, logActivity, commit, loadDB, NO_ORG } from '../store/db.js'
import { PageHead, Card, Btn, Badge, Tabs, Modal, FField, Input, Textarea, ChipSelect, Empty, Icon, UAvatar, Confirm, Menu, useToast, Table, Progress, Search, cx, useFormInit } from '../ui/kit.jsx'
import { fmtDate, fmtLeft, fmtDateTime, toLocalInput, fromLocalInput, pct, fmtDuration } from '../ui/format.js'
import { uid } from '../store/ids.js'
import { StatSpark, Donut, series, endOfDay } from '../ui/charts.jsx'

export default function Tests({ param }) {
  const { user } = useAuth()
  if (param) return user.role === 'student' ? <TakeTest id={param} /> : <TestResults id={param} />
  return <TestList />
}

/* ---------- Yordamchilar ---------- */

const D = 864e5
// Natija darajalari (donut va jadval pill'lari uchun)
const GRADES = [
  { key: 'a', label: 'A’lo', range: '90–100%', min: 90, color: '#10b981', tone: 'green' },
  { key: 'b', label: 'Yaxshi', range: '70–89%', min: 70, color: '#3b8ef0', tone: 'blue' },
  { key: 'c', label: 'Qoniqarli', range: '50–69%', min: 50, color: '#f5a524', tone: 'amber' },
  { key: 'd', label: 'Qoniqarsiz', range: '0–49%', min: 0, color: '#ef4444', tone: 'red' },
]
const gradeOf = (p) => GRADES.find((g) => p >= g.min)
const PERIODS = [{ value: '7', label: 'So‘nggi 7 kun' }, { value: '30', label: 'So‘nggi 30 kun' }, { value: 'all', label: 'Butun davr' }]
const avgOf = (list) => (list.length ? Math.round(list.reduce((s, a) => s + pct(a.score, a.total), 0) / list.length) : 0)

/* ---------- Ro'yxat sahifasi ---------- */

function TestList() {
  const { user, db, scope, can } = useAuth()
  const toast = useToast()
  const isStaff = user.role !== 'student'
  const [tab, setTab] = useState('active')
  const [q, setQ] = useState('')
  const [period, setPeriod] = useState('30')
  const [showAll, setShowAll] = useState(false)
  const [editing, setEditing] = useState(null)
  const [del, setDel] = useState(null)
  const now = Date.now()

  const testIds = useMemo(() => new Set(scope.tests.map((t) => t.id)), [scope.tests])
  // Talaba faqat o'z natijalarini ko'radi, xodim — o'z doirasidagi barcha testlarnikini
  const attempts = useMemo(() => db.testAttempts.filter((a) => testIds.has(a.testId) && (isStaff || a.studentId === user.id)), [db.testAttempts, testIds, isStaff, user.id])

  const rows = useMemo(() => scope.tests.map((t) => {
    const ta = attempts.filter((a) => a.testId === t.id)
    const my = ta.find((a) => a.studentId === user.id)
    const groups = db.groups.filter((g) => t.groupIds.includes(g.id))
    const total = new Set(groups.flatMap((g) => g.studentIds)).size
    const author = db.users.find((u) => u.id === t.authorId)
    return { t, my, groups, total, author, done: ta.length, avg: ta.length ? `${avgOf(ta)}%` : '—', expired: t.dueAt < now }
  }).sort((a, b) => (a.expired - b.expired) || (a.expired ? b.t.dueAt - a.t.dueAt : a.t.dueAt - b.t.dueAt)), [scope.tests, attempts, db.groups, db.users, user.id, now])

  const is = {
    active: (r) => !r.expired && (isStaff || !r.my),
    done: (r) => !!r.my,
    expired: (r) => r.expired && !r.my,
    all: () => true,
  }
  const count = (k) => rows.filter(is[k]).length
  const tabs = isStaff
    ? [{ value: 'active', label: 'Faol', icon: 'clipboard', count: count('active') }, { value: 'all', label: 'Barchasi', icon: 'fileText', count: rows.length }]
    : [{ value: 'active', label: 'Topshirish kerak', icon: 'clipboard', count: count('active') }, { value: 'done', label: 'Topshirilgan', icon: 'checkCircle', count: count('done') }, { value: 'expired', label: 'Muddati o‘tgan', icon: 'clock', count: count('expired') }]

  const list = useMemo(() => {
    const s = q.trim().toLowerCase()
    return rows.filter(is[tab]).filter((r) => !s || [r.t.title, r.t.description, r.author?.name, ...r.groups.map((g) => `${g.name} ${g.course}`)].some((x) => (x || '').toLowerCase().includes(s)))
  }, [rows, tab, q]) // eslint-disable-line react-hooks/exhaustive-deps

  // Statistika + sparkline qatorlari (oxirgi 14 kun)
  const stats = useMemo(() => {
    const takers = new Set(attempts.map((a) => a.studentId)).size
    const upto = (ts) => attempts.filter((a) => a.finishedAt <= endOfDay(ts))
    return {
      active: count('active'),
      takers,
      avg: attempts.length ? `${avgOf(attempts)}%` : '—',
      sActive: series(14, (ts) => scope.tests.filter((t) => t.createdAt <= endOfDay(ts) && t.dueAt > ts).length),
      sTakers: series(14, (ts) => new Set(upto(ts).map((a) => a.studentId)).size),
      sAvg: series(14, (ts) => avgOf(upto(ts))),
    }
  }, [attempts, scope.tests, rows]) // eslint-disable-line react-hooks/exhaustive-deps

  const recent = useMemo(() => [...attempts].sort((a, b) => b.finishedAt - a.finishedAt), [attempts])
  const inPeriod = useMemo(() => (period === 'all' ? attempts : attempts.filter((a) => a.finishedAt >= now - Number(period) * D)), [attempts, period, now])
  const parts = GRADES.map((g) => ({ ...g, value: inPeriod.filter((a) => gradeOf(pct(a.score, a.total)).key === g.key).length }))

  const scrollTo = (id) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  const canCreate = isStaff && can('content.create')

  return (
    <>
      {/* Sarlavha banneri */}
      <section className="pthero">
        <span className="pthero__icon"><Icon name="clipboard" size={34} /></span>
        <div className="pthero__text">
          <h1>Testlar</h1>
          <p>{isStaff ? 'Testlar yarating, natijalarni kuzating' : 'Bilimingizni tekshiring, natijalaringizni kuzating'}</p>
        </div>
        <blockquote className="pthero__quote">“Bilim — hayotga nur, jamiyatga farovonlikdir.”</blockquote>
        {canCreate && <Btn variant="primary" size="lg" icon="plus" className="pthero__btn" onClick={() => setEditing({})}>Test yaratish</Btn>}
      </section>

      {/* Statistika */}
      <div className="pgrid pgrid--3 ptstats">
        {isStaff ? <>
          <StatSpark icon="clipboard" tone="blue" color="#3b8ef0" value={stats.active} label="Faol testlar" data={stats.sActive} onClick={() => setTab('active')} />
          <StatSpark icon="users" tone="teal" color="#14b8a6" value={stats.takers} label="Topshiruvchilar" data={stats.sTakers} onClick={() => scrollTo('pt-recent')} />
          <StatSpark icon="chart" tone="violet" color="#8b5cf6" value={stats.avg} label="O‘rtacha natija" data={stats.sAvg} onClick={() => scrollTo('pt-analytics')} />
        </> : <>
          <StatSpark icon="clipboard" tone="blue" color="#3b8ef0" value={count('active')} label="Topshirish kerak" data={stats.sActive} onClick={() => setTab('active')} />
          <StatSpark icon="checkCircle" tone="teal" color="#14b8a6" value={count('done')} label="Topshirilgan testlar" data={series(14, (ts) => attempts.filter((a) => a.finishedAt <= endOfDay(ts)).length)} onClick={() => setTab('done')} />
          <StatSpark icon="chart" tone="violet" color="#8b5cf6" value={stats.avg} label="O‘rtacha natijam" data={stats.sAvg} onClick={() => scrollTo('pt-analytics')} />
        </>}
      </div>

      {/* Filtr paneli */}
      <div className="pvtool">
        <Tabs value={tab} onChange={setTab} items={tabs} className="pttabs" />
        <Search value={q} onChange={setQ} placeholder="Test nomi, fan yoki muallif bo‘yicha qidirish…" className="ptsearch" />
      </div>

      {/* Test kartalari */}
      {list.length === 0 ? (
        <Card>
          {q
            ? <Empty icon="search" title="Hech narsa topilmadi" text="Qidiruv so‘rovingizga mos test yo‘q." action={<Btn icon="refresh" onClick={() => setQ('')}>Qidiruvni tozalash</Btn>} />
            : <Empty icon="clipboard" title="Test yo‘q" text={isStaff ? 'Birinchi testingizni yarating.' : 'Hozircha bu bo‘limda test yo‘q.'} action={canCreate && <Btn variant="primary" icon="plus" onClick={() => setEditing({})}>Test yaratish</Btn>} />}
        </Card>
      ) : (
        <div className="pgrid pgrid--2">
          {list.map((r) => <TestCard key={r.t.id} r={r} isStaff={isStaff}
            menu={isStaff && (r.t.authorId === user.id || user.role !== 'teacher') ? [
              { label: 'Natijalar', icon: 'chart', onClick: () => { window.location.hash = `#/platform/tests/${r.t.id}` } },
              { label: 'Tahrirlash', icon: 'edit', onClick: () => setEditing(r.t) }, 'sep',
              { label: 'O‘chirish', icon: 'trash', danger: true, onClick: () => setDel(r.t) },
            ] : null} />)}
        </div>
      )}

      {/* Pastki qism: so'nggi topshiruvlar + tahlil */}
      <div className="ptbottom">
        <Card id="pt-recent" pad={false} className="ptrecent">
          <header className="ptcard-h">
            <h3 className="pdt"><span className="pdt__ico"><Icon name="clock" size={18} /></span>{isStaff ? 'So‘nggi topshiruvlar' : 'Mening natijalarim'}</h3>
            {recent.length > 5 && <button type="button" className="ptlink" onClick={() => setShowAll((v) => !v)}>{showAll ? 'Yig‘ish' : 'Barchasini ko‘rish'} <Icon name={showAll ? 'chevUp' : 'arrowRight'} size={15} /></button>}
          </header>
          {recent.length === 0
            ? <Empty icon="clock" title="Hali topshiruv yo‘q" text="Test topshirilgach natijalar shu yerda ko‘rinadi." />
            : (
              <Table rows={showAll ? recent : recent.slice(0, 5)} onRow={(a) => { window.location.hash = `#/platform/tests/${a.testId}` }} cols={[
                { key: 'n', label: '#', w: 44, render: (a) => recent.indexOf(a) + 1 },
                ...(isStaff ? [{ key: 's', label: 'Talaba', render: (a) => { const s = db.users.find((u) => u.id === a.studentId); return <div className="pcell-user ptuser"><UAvatar user={s} size={30} /><b>{s?.name || '—'}</b></div> } }] : []),
                { key: 't', label: 'Test nomi', render: (a) => <span className="ptname">{scope.tests.find((t) => t.id === a.testId)?.title}</span> },
                { key: 'p', label: 'Natija', render: (a) => { const p = pct(a.score, a.total); return <span className={cx('ptpill', `ptpill--${gradeOf(p).tone}`)}>{p}%</span> } },
                { key: 'd', label: 'Sana', render: (a) => <span className="ptdate">{fmtDateTime(a.finishedAt)}</span> },
              ]} />
            )}
        </Card>

        <Card id="pt-analytics" className="ptanalytics">
          <header className="ptcard-h ptcard-h--in">
            <h3 className="pdt"><span className="pdt__ico"><Icon name="chart" size={18} /></span>Natijalar tahlili</h3>
            <label className="pdsel"><span>{PERIODS.find((p) => p.value === period).label}</span><Icon name="chevDown" size={16} />
              <select value={period} onChange={(e) => setPeriod(e.target.value)} aria-label="Davr">{PERIODS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}</select>
            </label>
          </header>
          <div className="ptan">
            <Donut parts={parts} center={inPeriod.length ? `${avgOf(inPeriod)}%` : '—'} sub="O‘rtacha natija" />
            <ul className="ptlegend">
              {parts.map((g) => <li key={g.key}><i style={{ background: g.color }} /><span>{g.label} <small>({g.range})</small></span><b>{g.value}</b></li>)}
            </ul>
          </div>
          {inPeriod.length === 0 && <p className="pmuted ptan__empty">Tanlangan davrda topshiruv yo‘q.</p>}
        </Card>
      </div>

      <TestForm open={!!editing} test={editing} onClose={() => setEditing(null)} />
      <Confirm open={!!del} onClose={() => setDel(null)} danger title="Testni o‘chirish" text={`«${del?.title}» va uning barcha natijalari o‘chiriladi.`} confirmLabel="O‘chirish"
        onConfirm={() => { remove('tests', del.id); toast('Test o‘chirildi') }} />
    </>
  )
}

function TestCard({ r, isStaff, menu }) {
  const { t, my, groups, total, author, done, avg, expired } = r
  const left = t.dueAt - Date.now()
  const href = `#/platform/tests/${t.id}`
  const myP = my && pct(my.score, my.total)
  return (
    <article className={cx('pcard', 'ptcardx', expired && 'is-expired')}>
      <div className="ptcardx__top">
        <span className="ptcardx__icon"><Icon name="clipboard" size={22} /></span>
        <div className="ptcardx__ttl">
          <h4><a href={href}>{t.title}</a></h4>
          <span>{t.questions.length} savol · {t.timeLimit} daq · {author?.name}</span>
        </div>
        {my ? <span className={cx('ptpill', `ptpill--${gradeOf(myP).tone}`, 'ptpill--lg')}><Icon name="checkCircle" size={15} />{myP}%</span>
          : expired ? <span className="ptdue ptdue--off"><Icon name="lock" size={15} />Yopilgan</span>
            : <span className={cx('ptdue', left < D && 'ptdue--hot')}><Icon name="clock" size={15} />{fmtLeft(t.dueAt)}</span>}
      </div>
      {t.description && <p className="ptcardx__desc">{t.description}</p>}
      <div className="ptcardx__meta">
        {groups.map((g) => <span key={g.id} className="ptgrp" style={{ '--gc': g.color }}>{g.name}</span>)}
        <span className="ptcardx__due"><Icon name="calendar" size={15} />Muddat: {fmtDateTime(t.dueAt)}</span>
      </div>
      {isStaff ? (
        <div className="ptcardx__prog">
          <div><span>Topshirganlar: <b>{done}/{total}</b></span><span>O‘rtacha: <b>{avg}</b></span></div>
          <span className="pprog ptbar"><span className="pprog__bar" style={{ width: `${pct(done, total)}%` }} /></span>
        </div>
      ) : my && (
        <div className="ptcardx__prog">
          <div><span>To‘g‘ri javoblar: <b>{my.score}/{my.total}</b></span><span>{fmtDateTime(my.finishedAt)}</span></div>
          <span className="pprog ptbar"><span className="pprog__bar" style={{ width: `${myP}%`, background: GRADES.find((g) => g.key === gradeOf(myP).key).color }} /></span>
        </div>
      )}
      <div className="ptcardx__foot">
        {isStaff ? <Btn variant="soft" icon="chart" as="a" href={href}>Natijalar</Btn>
          : my ? <Btn variant="soft" icon="eye" as="a" href={href}>Natijani ko‘rish</Btn>
            : expired ? <span className="pmuted" style={{ fontSize: 13.5 }}>Test yopilgan</span>
              : <Btn variant="primary" icon="play" as="a" href={href}>Testni boshlash</Btn>}
        {menu && <Menu items={menu} trigger={<button type="button" className="ptmore" aria-label="Amallar"><Icon name="moreV" size={18} /></button>} />}
      </div>
    </article>
  )
}

// ---- Test konstruktori ----
const emptyQ = () => ({ id: uid('q'), text: '', options: ['', '', '', ''], correct: 0 })
function TestForm({ open, test, onClose }) {
  const { user, scope } = useAuth()
  const toast = useToast()
  const isNew = !test?.id
  const [f, setF] = useState({})
  const [err, setErr] = useState('')
  useFormInit(open, test?.id, () => { setErr(''); setF(isNew ? { title: '', description: '', groupIds: scope.groups[0] ? [scope.groups[0].id] : [], timeLimit: 15, dueAt: toLocalInput(Date.now() + 7 * 864e5), questions: [emptyQ(), emptyQ()] } : { ...test, dueAt: toLocalInput(test.dueAt), questions: test.questions.map((q) => ({ ...q, options: [...q.options] })) }) })
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }))
  const setQ = (i, k, v) => setF((x) => ({ ...x, questions: x.questions.map((q, j) => (j === i ? { ...q, [k]: v } : q)) }))
  const setOpt = (i, oi, v) => setF((x) => ({ ...x, questions: x.questions.map((q, j) => (j === i ? { ...q, options: q.options.map((o, k) => (k === oi ? v : o)) } : q)) }))

  const submit = () => {
    if (!f.title?.trim()) return setErr('Test nomini kiriting')
    if (!f.groupIds?.length) return setErr('Kamida bitta guruh tanlang')
    if (!fromLocalInput(f.dueAt)) return setErr('Muddatni kiriting')
    const qs = f.questions.filter((q) => q.text.trim())
    if (!qs.length) return setErr('Kamida bitta savol kiriting')
    for (const q of qs) if (q.options.filter((o) => o.trim()).length < 2 || !q.options[q.correct]?.trim()) return setErr('Har bir savolda kamida 2 ta variant va to‘g‘ri javob bo‘lishi kerak')
    const data = { title: f.title.trim(), description: f.description?.trim(), groupIds: f.groupIds, timeLimit: Number(f.timeLimit) || 10, dueAt: fromLocalInput(f.dueAt), questions: qs.map((q) => ({ ...q, options: q.options.filter((o) => o.trim()) })) }
    if (isNew) {
      if (!scope.orgId) return toast(NO_ORG, 'err')
      const t = add('tests', { ...data, orgId: scope.orgId, authorId: user.id })
      notify([...new Set(scope.groups.filter((g) => f.groupIds.includes(g.id)).flatMap((g) => g.studentIds))], `Yangi test: «${t.title}» — muddat ${fmtDate(t.dueAt)}`, '#/platform/tests')
      logActivity(scope.orgId, user.id, 'yangi test yaratdi', t.title)
      toast('Test yaratildi, o‘quvchilarga xabar yuborildi')
    } else { patch('tests', test.id, data); toast('Test saqlandi') }
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} width={760} title={isNew ? 'Test yaratish' : 'Testni tahrirlash'} sub="Savollar, variantlar va to‘g‘ri javobni belgilang"
      footer={<>{err && <span style={{ color: 'var(--pf-red)', fontSize: 13, marginRight: 'auto', alignSelf: 'center' }}>{err}</span>}<Btn onClick={onClose}>Bekor</Btn><Btn variant="primary" onClick={submit}>{isNew ? 'Yaratish' : 'Saqlash'}</Btn></>}>
      <div className="pform">
        <FField label="Test nomi"><Input value={f.title || ''} onChange={(e) => set('title', e.target.value)} autoFocus /></FField>
        <FField label="Tavsif"><Input value={f.description || ''} onChange={(e) => set('description', e.target.value)} /></FField>
        <div className="pform__row">
          <FField label="Vaqt chegarasi (daqiqa)"><Input type="number" min="1" value={f.timeLimit || ''} onChange={(e) => set('timeLimit', e.target.value)} /></FField>
          <FField label="Topshirish muddati"><Input type="datetime-local" value={f.dueAt || ''} onChange={(e) => set('dueAt', e.target.value)} /></FField>
        </div>
        <FField label="Guruhlar"><ChipSelect value={f.groupIds || []} onChange={(v) => set('groupIds', v)} options={scope.groups.map((g) => ({ value: g.id, label: g.name, color: g.color }))} /></FField>
        <div className="pfield__label">Savollar ({f.questions?.length || 0})</div>
        {(f.questions || []).map((q, i) => (
          <div key={q.id} className="pqb">
            <div className="prow" style={{ flexWrap: 'nowrap' }}>
              <Badge tone="violet">{i + 1}</Badge>
              <Input value={q.text} onChange={(e) => setQ(i, 'text', e.target.value)} placeholder="Savol matni" />
              <Btn size="sm" variant="ghost" icon="trash" onClick={() => set('questions', f.questions.filter((_, j) => j !== i))} aria-label="Savolni o‘chirish" />
            </div>
            <div className="pqb__opts">
              {q.options.map((o, oi) => (
                <label key={oi} className="pqb__opt">
                  <input type="radio" name={`c-${q.id}`} checked={q.correct === oi} onChange={() => setQ(i, 'correct', oi)} title="To‘g‘ri javob" />
                  <Input value={o} onChange={(e) => setOpt(i, oi, e.target.value)} placeholder={`${String.fromCharCode(65 + oi)} varianti`} style={{ height: 40 }} />
                </label>
              ))}
            </div>
            <span className="pfield__hint" style={{ display: 'block', marginTop: 6 }}>Radio tugma bilan to‘g‘ri javobni belgilang</span>
          </div>
        ))}
        <Btn icon="plus" onClick={() => set('questions', [...f.questions, emptyQ()])}>Savol qo‘shish</Btn>
      </div>
    </Modal>
  )
}

// ---- Talaba: testni topshirish ----
function TakeTest({ id }) {
  const { user, db } = useAuth()
  const toast = useToast()
  const t = db.tests.find((x) => x.id === id)
  const existing = db.testAttempts.find((a) => a.testId === id && a.studentId === user.id)
  const [started, setStarted] = useState(false)
  const [cur, setCur] = useState(0)
  const [answers, setAnswers] = useState({})
  const [left, setLeft] = useState(0)
  const [result, setResult] = useState(existing || null)
  const sending = useRef(false)

  useEffect(() => {
    if (!started || result) return
    setLeft(t.timeLimit * 60)
    const iv = setInterval(() => setLeft((l) => { if (l <= 1) { clearInterval(iv); return 0 } return l - 1 }), 1000)
    return () => clearInterval(iv)
  }, [started, result, t?.timeLimit])
  useEffect(() => { if (started && !result && left === 0 && t) finish(true) }, [left]) // eslint-disable-line

  if (!t) return <Card><Empty icon="clipboard" title="Test topilmadi" action={<Btn as="a" href="#/platform/tests">Orqaga</Btn>} /></Card>

  // Ball serverda hisoblanadi; to'g'ri javoblar topshirilgandan keyingina yuklanadi
  const finish = async (auto = false) => {
    if (sending.current) return
    sending.current = true
    try {
      const [r] = await commit([{ col: 'testAttempts', op: 'insert', item: { id: uid('ta'), testId: t.id, studentId: user.id, answers, startedAt: Date.now() - (t.timeLimit * 60 - left) * 1000 } }])
      await loadDB().catch(() => {})
      notify([t.authorId], `${user.name} «${t.title}» testini topshirdi: ${r.item.score}/${r.item.total}`, `#/platform/tests/${t.id}`)
      setResult(r.item)
      toast(auto ? 'Vaqt tugadi, test avtomatik topshirildi' : 'Test topshirildi')
    } catch (e) {
      sending.current = false
      toast(e.message, 'err')
    }
  }

  if (result) {
    const p = pct(result.score, result.total)
    return (
      <>
        <PageHead crumbs={[{ label: 'Testlar', href: '#/platform/tests' }, { label: t.title }]} title="Natija" />
        <div className="pgrid pgrid--main">
          <Card>
            {t.questions.map((q, i) => {
              const my = result.answers?.[q.id]
              return (
                <div key={q.id} style={{ padding: '14px 0', borderBottom: '1px solid var(--pf-line)' }}>
                  <b style={{ display: 'block', marginBottom: 8 }}>{i + 1}. {q.text}</b>
                  {q.options.map((o, oi) => (
                    <div key={oi} className={cx('pquiz__opt', oi === q.correct && 'is-right', my === oi && my !== q.correct && 'is-wrong')} style={{ cursor: 'default', padding: '9px 12px', fontSize: 14 }}>
                      <i>{String.fromCharCode(65 + oi)}</i>{o}{oi === q.correct && <Icon name="check" size={16} />}
                    </div>
                  ))}
                  {my === undefined && <span className="pmuted" style={{ fontSize: 12.5 }}>Javob berilmagan</span>}
                </div>
              )
            })}
          </Card>
          <div className="pstack-v" style={{ gap: 20 }}>
            <Card>
              <div className="pscore" style={{ '--v': p }}><span>{p}%</span></div>
              <h3 style={{ textAlign: 'center', marginTop: 16, fontFamily: 'var(--f-head)', fontSize: 20 }}>{p >= 80 ? 'A’lo natija!' : p >= 60 ? 'Yaxshi!' : 'Yana mashq qiling'}</h3>
              <p className="pmuted" style={{ textAlign: 'center', marginTop: 6 }}>{result.score} / {result.total} to‘g‘ri javob · {fmtDuration(Math.round((result.finishedAt - result.startedAt) / 1000))}</p>
              <div style={{ textAlign: 'center', marginTop: 18 }}><Btn as="a" href="#/platform/tests" variant="primary">Testlarga qaytish</Btn></div>
            </Card>
          </div>
        </div>
      </>
    )
  }

  if (!started) {
    return (
      <>
        <PageHead crumbs={[{ label: 'Testlar', href: '#/platform/tests' }, { label: t.title }]} title={t.title} sub={t.description} />
        <Card style={{ maxWidth: 640 }}>
          <div className="pgrid pgrid--3" style={{ gap: 12 }}>
            {[['Savollar', t.questions.length, 'clipboard'], ['Vaqt', `${t.timeLimit} daq`, 'timer'], ['Muddat', fmtDate(t.dueAt), 'calendar']].map(([l, v, ic]) => (
              <div key={l} style={{ padding: 14, borderRadius: 14, background: 'var(--c-surface)', display: 'flex', gap: 10, alignItems: 'center' }}><Icon name={ic} size={20} /><div><b style={{ display: 'block' }}>{v}</b><span className="pmuted" style={{ fontSize: 12.5 }}>{l}</span></div></div>
            ))}
          </div>
          <p className="pmuted" style={{ marginTop: 18 }}>Testni faqat bir marta topshirish mumkin. Boshlaganingizdan so‘ng vaqt hisoblanadi; vaqt tugasa test avtomatik topshiriladi.</p>
          <div className="prow" style={{ marginTop: 18 }}><Btn variant="primary" size="lg" icon="play" onClick={() => setStarted(true)}>Boshlash</Btn><Btn as="a" href="#/platform/tests" size="lg">Orqaga</Btn></div>
        </Card>
      </>
    )
  }

  const q = t.questions[cur]
  const answered = Object.keys(answers).length
  return (
    <>
      <div className="prow prow--between">
        <div><h1 style={{ fontFamily: 'var(--f-head)', fontSize: 22 }}>{t.title}</h1><span className="pmuted" style={{ fontSize: 13.5 }}>{cur + 1} / {t.questions.length} savol · {answered} ta javob berildi</span></div>
        <span className={cx('ptimer', left < 60 && 'is-low')}><Icon name="timer" size={18} /> {fmtDuration(left)}</span>
      </div>
      <Progress value={pct(answered, t.questions.length)} />
      <div className="pgrid pgrid--main">
        <div className="pquiz__q">
          <h3>{cur + 1}. {q.text}</h3>
          {q.options.map((o, oi) => (
            <div key={oi} className={cx('pquiz__opt', answers[q.id] === oi && 'is-on')} onClick={() => setAnswers((a) => ({ ...a, [q.id]: oi }))}>
              <i>{String.fromCharCode(65 + oi)}</i>{o}
            </div>
          ))}
          <div className="prow prow--between" style={{ marginTop: 18 }}>
            <Btn icon="chevLeft" disabled={cur === 0} onClick={() => setCur((c) => c - 1)}>Oldingi</Btn>
            {cur < t.questions.length - 1 ? <Btn variant="primary" onClick={() => setCur((c) => c + 1)}>Keyingi <Icon name="chevRight" size={16} /></Btn> : <Btn variant="success" icon="check" onClick={() => finish(false)}>Testni topshirish</Btn>}
          </div>
        </div>
        <Card title="Savollar">
          <div className="pquiz__dots">
            {t.questions.map((qq, i) => <button key={qq.id} className={cx(answers[qq.id] !== undefined && 'is-done', i === cur && 'is-cur')} onClick={() => setCur(i)}>{i + 1}</button>)}
          </div>
          <p className="pmuted" style={{ marginTop: 14, fontSize: 13 }}>Barcha savollarga javob bergach «Testni topshirish» tugmasini bosing.</p>
          <Btn variant="primary" style={{ marginTop: 12, width: '100%' }} onClick={() => finish(false)} disabled={answered === 0}>Topshirish ({answered}/{t.questions.length})</Btn>
        </Card>
      </div>
    </>
  )
}

// ---- Ustoz: natijalar ----
function TestResults({ id }) {
  const { db } = useAuth()
  const t = db.tests.find((x) => x.id === id)
  if (!t) return <Card><Empty icon="clipboard" title="Test topilmadi" action={<Btn as="a" href="#/platform/tests">Orqaga</Btn>} /></Card>
  const groups = db.groups.filter((g) => t.groupIds.includes(g.id))
  const students = [...new Set(groups.flatMap((g) => g.studentIds))].map((sid) => db.users.find((u) => u.id === sid)).filter(Boolean)
  const rows = students.map((s) => ({ id: s.id, s, a: db.testAttempts.find((x) => x.testId === id && x.studentId === s.id) })).sort((x, y) => (y.a ? pct(y.a.score, y.a.total) : -1) - (x.a ? pct(x.a.score, x.a.total) : -1))
  const done = rows.filter((r) => r.a)
  const avg = done.length ? `${Math.round(done.reduce((s, r) => s + pct(r.a.score, r.a.total), 0) / done.length)}%` : '—'
  // Savollar bo'yicha qiyinlik
  const qStats = t.questions.map((q) => ({ q, ok: done.filter((r) => r.a.answers?.[q.id] === q.correct).length }))
  return (
    <>
      <PageHead crumbs={[{ label: 'Testlar', href: '#/platform/tests' }, { label: t.title }]} title={t.title} sub={`${t.questions.length} savol · ${t.timeLimit} daq · muddat ${fmtDateTime(t.dueAt)}`} />
      <div className="pgrid pgrid--4">
        <div className="pstat pstat--blue"><span className="pstat__icon"><Icon name="users" size={22} /></span><span className="pstat__body"><span className="pstat__value">{done.length}/{students.length}</span><span className="pstat__label">Topshirdi</span></span></div>
        <div className="pstat pstat--green"><span className="pstat__icon"><Icon name="award" size={22} /></span><span className="pstat__body"><span className="pstat__value">{avg}</span><span className="pstat__label">O‘rtacha ball</span></span></div>
        <div className="pstat pstat--violet"><span className="pstat__icon"><Icon name="star" size={22} /></span><span className="pstat__body"><span className="pstat__value">{done.filter((r) => pct(r.a.score, r.a.total) >= 80).length}</span><span className="pstat__label">A’lo (80%+)</span></span></div>
        <div className="pstat pstat--red"><span className="pstat__icon"><Icon name="alertCircle" size={22} /></span><span className="pstat__body"><span className="pstat__value">{done.filter((r) => pct(r.a.score, r.a.total) < 60).length}</span><span className="pstat__label">Qoniqarsiz</span></span></div>
      </div>
      <div className="pgrid pgrid--main">
        <Card title="O‘quvchilar natijalari" pad={false}>
          <Table rows={rows} cols={[
            { key: 's', label: 'O‘quvchi', render: (r) => <div className="pcell-user"><UAvatar user={r.s} size={34} /><div><b>{r.s.name}</b><span>{r.s.phone}</span></div></div> },
            { key: 'g', label: 'Guruh', render: (r) => groups.filter((g) => g.studentIds.includes(r.s.id)).map((g) => g.name).join(', ') },
            { key: 'res', label: 'Natija', render: (r) => r.a ? <div style={{ minWidth: 140 }}><div className="prow prow--between" style={{ fontSize: 13, marginBottom: 4 }}><b>{r.a.score}/{r.a.total}</b><span>{pct(r.a.score, r.a.total)}%</span></div><Progress size="sm" value={pct(r.a.score, r.a.total)} tone={pct(r.a.score, r.a.total) >= 60 ? 'green' : 'red'} /></div> : <Badge tone="gray">Topshirmagan</Badge> },
            { key: 'time', label: 'Vaqt', render: (r) => r.a ? fmtDateTime(r.a.finishedAt) : '—' },
          ]} />
        </Card>
        <Card title="Savollar tahlili" sub="Necha o‘quvchi to‘g‘ri javob berdi">
          {qStats.map(({ q, ok }, i) => (
            <div key={q.id} style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 13.5, marginBottom: 6 }}><b>{i + 1}.</b> {q.text}</div>
              <div className="prow" style={{ flexWrap: 'nowrap' }}><Progress size="sm" value={pct(ok, done.length)} tone={pct(ok, done.length) < 50 ? 'red' : 'green'} /><span className="pmuted" style={{ fontSize: 12.5, whiteSpace: 'nowrap' }}>{ok}/{done.length}</span></div>
            </div>
          ))}
        </Card>
      </div>
    </>
  )
}
