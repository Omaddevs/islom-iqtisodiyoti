import { useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '../store/auth.jsx'
import { add, patch, remove, notify, logActivity, commit, loadDB, NO_ORG } from '../store/db.js'
import { PageHead, Card, Btn, Badge, Tabs, Modal, FField, Input, ChipSelect, Empty, Icon, UAvatar, Confirm, Menu, useToast, Table, Progress, Search, cx, useFormInit } from '../ui/kit.jsx'
import { fmtDate, fmtDateShort, fmtLeft, fmtDateTime, toLocalInput, fromLocalInput, pct, fmtDuration } from '../ui/format.js'
import { uid } from '../store/ids.js'
import { StatSpark, series, endOfDay } from '../ui/charts.jsx'
import { ChartPanel } from '../ui/chartpanel.jsx'

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
const LETTER = (i) => String.fromCharCode(65 + i)
const STATUS = {
  right: { label: 'To‘g‘ri', color: '#10b981', icon: 'checkCircle', tone: 'green' },
  wrong: { label: 'Xato', color: '#ef4444', icon: 'alertCircle', tone: 'red' },
  skip: { label: 'Javob berilmagan', color: '#aab4c2', icon: 'minus', tone: 'gray' },
}
// Har bir savol bo'yicha o'quvchi javobining holati
const reviewOf = (t, a) => t.questions.map((q, i) => {
  const my = a.answers?.[q.id]
  return { q, i, my, status: my === undefined || my === null ? 'skip' : my === q.correct ? 'right' : 'wrong' }
})

/* ---------- Grafik ma'lumotlari ---------- */

function gradesDataset(list) {
  return {
    key: 'grades', label: 'Baholar', sub: 'Har bir bahoga nechta topshiruv to‘g‘ri kelgani', defaultType: 'donut', head: ['Baho', 'Topshiruvlar'],
    parts: { label: 'Topshiruvlarning baholar bo‘yicha ulushi', value: (r) => r.value }, center: { value: `${avgOf(list)}%`, label: 'O‘rtacha' },
    rows: list.length ? GRADES.map((g) => {
      const n = list.filter((a) => gradeOf(pct(a.score, a.total)).key === g.key).length
      return { key: g.key, label: `${g.label} (${g.range})`, short: g.label, value: n, shown: `${n} ta`, color: g.color }
    }) : [],
  }
}
function testsDataset(list, tests, label = 'Testlar', sub = 'Har bir test bo‘yicha o‘rtacha natija, vaqt tartibida') {
  const rows = tests.map((t) => ({ t, ta: list.filter((a) => a.testId === t.id) })).filter((x) => x.ta.length)
    .map((x) => ({ ...x, at: Math.max(...x.ta.map((a) => a.finishedAt)) })).sort((a, b) => a.at - b.at).slice(-24)
  return {
    key: 'tests', label, sub, max: 100, unit: '%', defaultType: 'line', head: ['Test', 'Natija'], parts: null,
    rows: rows.map((x) => ({ key: x.t.id, label: x.t.title, value: avgOf(x.ta), shown: x.ta.length > 1 ? `${avgOf(x.ta)}% · ${x.ta.length} ta topshiruv` : `${avgOf(x.ta)}% · ${fmtDate(x.at)}` })),
  }
}
function daysDataset(list) {
  const days = new Map()
  for (const a of [...list].sort((x, y) => x.finishedAt - y.finishedAt)) {
    const k = new Date(a.finishedAt).toDateString()
    if (!days.has(k)) days.set(k, [])
    days.get(k).push(a)
  }
  return {
    key: 'days', label: 'Kunlar', sub: 'Har kuni nechta test topshirilgani', head: ['Sana', 'Topshiruvlar'], parts: { label: 'Topshiruvlarning kunlar bo‘yicha ulushi', value: (r) => r.value },
    rows: [...days.values()].map((ta) => ({ key: String(ta[0].finishedAt), label: fmtDate(ta[0].finishedAt), short: fmtDateShort(ta[0].finishedAt), value: ta.length, shown: `${ta.length} ta · o‘rtacha ${avgOf(ta)}%` })),
  }
}

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
    // Guruhdan chiqqan bo'lsa ham topshirgan o'quvchi hisobda qoladi
    const total = new Set([...groups.flatMap((g) => g.studentIds), ...ta.map((a) => a.studentId)]).size
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
  const datasets = useMemo(() => [gradesDataset(inPeriod), testsDataset(inPeriod, scope.tests), daysDataset(inPeriod)], [inPeriod, scope.tests])

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

        <ChartPanel id="pt-analytics" title="Natijalar tahlili" storeKey="tests_overview" defaultType="donut" datasets={datasets} emptyText="Tanlangan davrda topshiruv yo‘q."
          actions={<label className="pdsel"><span>{PERIODS.find((p) => p.value === period).label}</span><Icon name="chevDown" size={16} />
            <select value={period} onChange={(e) => setPeriod(e.target.value)} aria-label="Davr">{PERIODS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}</select>
          </label>} />
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
const MAX_OPTS = 8
const emptyQ = () => ({ id: uid('q'), text: '', options: ['', '', '', ''], correct: 0 })
function TestForm({ open, test, onClose }) {
  const { user, db, scope } = useAuth()
  const toast = useToast()
  const isNew = !test?.id
  const [f, setF] = useState({})
  const [err, setErr] = useState('')
  useEffect(() => { setErr('') }, [f]) // forma tuzatilganda eski xato ko'rinib turmasin
  // Topshirilgan testning savollari qulflanadi: aks holda eski natijalar buziladi
  const locked = !isNew && db.testAttempts.some((a) => a.testId === test.id)
  useFormInit(open, test?.id, () => { setErr(''); setF(isNew ? { title: '', description: '', groupIds: scope.groups[0] ? [scope.groups[0].id] : [], timeLimit: 15, dueAt: toLocalInput(Date.now() + 7 * 864e5), questions: [emptyQ(), emptyQ()] } : { ...test, dueAt: toLocalInput(test.dueAt), questions: test.questions.map((q) => ({ ...q, options: [...q.options] })) }) })
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }))
  const setQ = (i, k, v) => setF((x) => ({ ...x, questions: x.questions.map((q, j) => (j === i ? { ...q, [k]: v } : q)) }))
  const setOpt = (i, oi, v) => setF((x) => ({ ...x, questions: x.questions.map((q, j) => (j === i ? { ...q, options: q.options.map((o, k) => (k === oi ? v : o)) } : q)) }))
  const addOpt = (i) => setF((x) => ({ ...x, questions: x.questions.map((q, j) => (j === i ? { ...q, options: [...q.options, ''] } : q)) }))
  const delOpt = (i, oi) => setF((x) => ({ ...x, questions: x.questions.map((q, j) => {
    if (j !== i) return q
    const correct = oi === q.correct ? 0 : oi < q.correct ? q.correct - 1 : q.correct
    return { ...q, options: q.options.filter((_, k) => k !== oi), correct }
  }) }))

  const submit = () => {
    if (!f.title?.trim()) return setErr('Test nomini kiriting')
    if (!f.groupIds?.length) return setErr('Kamida bitta guruh tanlang')
    const limit = Number(f.timeLimit)
    if (!Number.isFinite(limit) || limit < 1 || limit > 600) return setErr('Vaqt chegarasi 1 daqiqadan 600 daqiqagacha bo‘lishi kerak')
    const dueAt = fromLocalInput(f.dueAt)
    if (!dueAt) return setErr('Muddatni kiriting')
    if (isNew && dueAt <= Date.now()) return setErr('Muddat kelajakdagi vaqt bo‘lishi kerak')
    const data = { title: f.title.trim(), description: f.description?.trim(), groupIds: f.groupIds, timeLimit: limit, dueAt }
    if (!locked) {
      const qs = []
      for (let n = 0; n < f.questions.length; n++) {
        const q = f.questions[n], label = `${n + 1}-savol`
        // Bo'sh variantlar olib tashlanganda to'g'ri javob ko'rsatkichi ham surilishi kerak
        const kept = q.options.map((o, i) => ({ o: o.trim(), i })).filter((x) => x.o)
        if (!q.text.trim()) { if (kept.length) return setErr(`${label}: savol matnini kiriting`); continue }
        if (kept.length < 2) return setErr(`${label}: kamida 2 ta variant kiriting`)
        if (new Set(kept.map((x) => x.o.toLowerCase())).size !== kept.length) return setErr(`${label}: variantlar takrorlanmasin`)
        const correct = kept.findIndex((x) => x.i === q.correct)
        if (correct < 0) return setErr(`${label}: to‘g‘ri javob to‘ldirilgan variantlardan biri bo‘lishi kerak`)
        qs.push({ id: q.id, text: q.text.trim(), options: kept.map((x) => x.o), correct })
      }
      if (!qs.length) return setErr('Kamida bitta savol kiriting')
      data.questions = qs
    }
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
    <Modal open={open} onClose={onClose} width={760} title={isNew ? 'Test yaratish' : 'Testni tahrirlash'} sub={locked ? 'Nomi, guruhlari va muddatini o‘zgartirish mumkin' : 'Savollar, variantlar va to‘g‘ri javobni belgilang'}
      footer={<>{err && <span className="ptform__err" role="alert">{err}</span>}<Btn onClick={onClose}>Bekor</Btn><Btn variant="primary" onClick={submit}>{isNew ? 'Yaratish' : 'Saqlash'}</Btn></>}>
      <div className="pform">
        <FField label="Test nomi"><Input value={f.title || ''} onChange={(e) => set('title', e.target.value)} autoFocus /></FField>
        <FField label="Tavsif"><Input value={f.description || ''} onChange={(e) => set('description', e.target.value)} /></FField>
        <div className="pform__row">
          <FField label="Vaqt chegarasi (daqiqa)"><Input type="number" min="1" max="600" value={f.timeLimit || ''} onChange={(e) => set('timeLimit', e.target.value)} /></FField>
          <FField label="Topshirish muddati"><Input type="datetime-local" value={f.dueAt || ''} onChange={(e) => set('dueAt', e.target.value)} /></FField>
        </div>
        <div className="pfield">
          <span className="pfield__label">Guruhlar</span>
          {scope.groups.length
            ? <ChipSelect value={f.groupIds || []} onChange={(v) => set('groupIds', v)} options={scope.groups.map((g) => ({ value: g.id, label: g.name, color: g.color }))} />
            : <span className="pfield__hint">Avval guruh yarating: test guruh o‘quvchilariga beriladi.</span>}
        </div>
        <div className="pfield__label">Savollar ({f.questions?.length || 0})</div>
        {locked && <p className="ptform__lock"><Icon name="lock" size={16} />O‘quvchilar bu testni topshirgan, shuning uchun savollar qulflangan: o‘zgarish eski natijalarni buzadi.</p>}
        {(f.questions || []).map((q, i) => (locked ? (
          <div key={q.id} className="pqb pqb--ro">
            <b>{i + 1}. {q.text}</b>
            <ul>{q.options.map((o, oi) => <li key={oi} className={cx(oi === q.correct && 'is-right')}><i>{LETTER(oi)}</i>{o}{oi === q.correct && <Icon name="check" size={15} />}</li>)}</ul>
          </div>
        ) : (
          <div key={q.id} className="pqb">
            <div className="prow" style={{ flexWrap: 'nowrap' }}>
              <Badge tone="violet">{i + 1}</Badge>
              <Input value={q.text} onChange={(e) => setQ(i, 'text', e.target.value)} placeholder="Savol matni" aria-label={`${i + 1}-savol matni`} />
              <Btn size="sm" variant="ghost" icon="trash" onClick={() => set('questions', f.questions.filter((_, j) => j !== i))} aria-label="Savolni o‘chirish" />
            </div>
            <div className="pqb__opts">
              {q.options.map((o, oi) => (
                <div key={oi} className={cx('pqb__opt', q.correct === oi && 'is-right')}>
                  <input type="radio" name={`c-${q.id}`} checked={q.correct === oi} onChange={() => setQ(i, 'correct', oi)} title="To‘g‘ri javob" aria-label={`${LETTER(oi)} — to‘g‘ri javob`} />
                  <Input value={o} onChange={(e) => setOpt(i, oi, e.target.value)} placeholder={`${LETTER(oi)} varianti`} style={{ height: 40 }} />
                  {q.options.length > 2 && <button type="button" className="pqb__del" onClick={() => delOpt(i, oi)} aria-label={`${LETTER(oi)} variantini o‘chirish`}><Icon name="x" size={14} /></button>}
                </div>
              ))}
            </div>
            <div className="pqb__foot">
              <span className="pfield__hint">Doira bilan to‘g‘ri javobni belgilang</span>
              {q.options.length < MAX_OPTS && <button type="button" className="ptlink" onClick={() => addOpt(i)}><Icon name="plus" size={15} />Variant qo‘shish</button>}
            </div>
          </div>
        )))}
        {!locked && <Btn icon="plus" onClick={() => set('questions', [...f.questions, emptyQ()])}>Savol qo‘shish</Btn>}
      </div>
    </Modal>
  )
}

// ---- Savollar bo'yicha javoblarni ko'rish (o'quvchi va ustoz uchun) ----
function QuestionReview({ test, attempt, who = 'Sizning javobingiz' }) {
  const items = useMemo(() => reviewOf(test, attempt), [test, attempt])
  const [filter, setFilter] = useState('all')
  const n = (s) => items.filter((x) => x.status === s).length
  const tabs = [
    { value: 'all', label: 'Barchasi', count: items.length },
    { value: 'wrong', label: 'Xatolar', icon: 'alertCircle', count: n('wrong') },
    { value: 'right', label: 'To‘g‘ri', icon: 'checkCircle', count: n('right') },
    ...(n('skip') ? [{ value: 'skip', label: 'Javobsiz', icon: 'minus', count: n('skip') }] : []),
  ]
  const shown = filter === 'all' ? items : items.filter((x) => x.status === filter)
  const idOf = (x) => `ptrv-${attempt.id}-${x.q.id}`
  const jump = (x) => {
    setFilter('all')
    setTimeout(() => document.getElementById(idOf(x))?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 30)
  }
  return (
    <div className="ptrv">
      <div className="ptrv__map" role="group" aria-label="Savollar xaritasi">
        {items.map((x) => (
          <button key={x.q.id} type="button" className={`is-${x.status}`} onClick={() => jump(x)} title={`${x.i + 1}-savol: ${STATUS[x.status].label}`} aria-label={`${x.i + 1}-savol: ${STATUS[x.status].label}`}>
            {x.i + 1}<Icon name={x.status === 'right' ? 'check' : x.status === 'wrong' ? 'x' : 'minus'} size={11} stroke={3} />
          </button>
        ))}
      </div>
      <Tabs value={filter} onChange={setFilter} items={tabs} className="ptrv__tabs" />
      {shown.length === 0 && <Empty icon={filter === 'wrong' ? 'award' : 'clipboard'} title={filter === 'wrong' ? 'Xato javob yo‘q' : 'Bu bo‘limda savol yo‘q'} text={filter === 'wrong' ? 'Barcha javoblar to‘g‘ri yoki javobsiz qoldirilgan.' : undefined} />}
      <ol className="ptrv__list">
        {shown.map((x) => (
          <li key={x.q.id} id={idOf(x)} className={cx('ptrv__q', `is-${x.status}`)}>
            <header>
              <span className="ptrv__num">{x.i + 1}</span>
              <h4>{x.q.text}</h4>
              <Badge tone={STATUS[x.status].tone}>{STATUS[x.status].label}</Badge>
            </header>
            <div className="ptrv__opts">
              {x.q.options.map((o, oi) => {
                const right = oi === x.q.correct, mine = oi === x.my
                return (
                  <div key={oi} className={cx('ptrv__opt', right && 'is-right', mine && !right && 'is-wrong')}>
                    <i>{right ? <Icon name="check" size={14} stroke={3} /> : mine ? <Icon name="x" size={14} stroke={3} /> : LETTER(oi)}</i>
                    <span>{o}</span>
                    {(right || mine) && (
                      <em>
                        {mine && <small className={right ? 'is-ok' : 'is-bad'}>{who}</small>}
                        {right && <small className="is-ok">To‘g‘ri javob</small>}
                      </em>
                    )}
                  </div>
                )
              })}
            </div>
          </li>
        ))}
      </ol>
    </div>
  )
}

// O'quvchi javoblaridan bir qator statistikasi
function ScoreHero({ test, attempt, staff }) {
  const items = reviewOf(test, attempt)
  const p = pct(attempt.score, attempt.total)
  const g = gradeOf(p)
  const count = (s) => items.filter((x) => x.status === s).length
  const spent = attempt.finishedAt && attempt.startedAt ? Math.max(0, Math.round((attempt.finishedAt - attempt.startedAt) / 1000)) : null
  return (
    <section className="ptrh">
      <div className="ptrh__ring" style={{ '--v': p, '--c': g.color }} role="img" aria-label={`Natija ${p}%`}><span><b>{p}%</b><small>{attempt.score}/{attempt.total}</small></span></div>
      <div className="ptrh__main">
        <span className={cx('ptpill', `ptpill--${g.tone}`)}>{g.label}</span>
        <h2>{staff ? `${attempt.score} ta to‘g‘ri javob, jami ${attempt.total} ta savol` : p >= 90 ? 'Ajoyib natija!' : p >= 70 ? 'Yaxshi natija!' : p >= 50 ? 'Yomon emas, yanada yaxshilash mumkin' : 'Mavzuni qayta takrorlang'}</h2>
        <p>{fmtDateTime(attempt.finishedAt)}</p>
      </div>
      <dl className="ptrh__tiles">
        <div className="is-right"><dt><Icon name="checkCircle" size={16} />To‘g‘ri</dt><dd>{count('right')}</dd></div>
        <div className="is-wrong"><dt><Icon name="alertCircle" size={16} />Xato</dt><dd>{count('wrong')}</dd></div>
        <div><dt><Icon name="minus" size={16} />Javobsiz</dt><dd>{count('skip')}</dd></div>
        <div><dt><Icon name="timer" size={16} />Vaqt</dt><dd>{spent === null ? '—' : fmtDuration(spent)}</dd></div>
      </dl>
    </section>
  )
}

// ---- Talaba: testni topshirish ----
const readRun = (k) => {
  try {
    const r = JSON.parse(localStorage.getItem(k))
    return r && Number.isFinite(r.startedAt) && r.answers && typeof r.answers === 'object' ? r : null
  } catch { return null }
}
const writeRun = (k, v) => { try { if (v) localStorage.setItem(k, JSON.stringify(v)); else localStorage.removeItem(k) } catch { /* xotira */ } }

function TakeTest({ id }) {
  const { user, db } = useAuth()
  const toast = useToast()
  const t = db.tests.find((x) => x.id === id)
  const existing = db.testAttempts.find((a) => a.testId === id && a.studentId === user.id)
  const storeKey = `ii_test_run_${user.id}_${id}`
  // Javoblar va boshlangan vaqt saqlanadi: sahifa yangilansa ham test davom etadi, taymer qaytadan boshlanmaydi
  const [run, setRun] = useState(() => (existing ? null : readRun(storeKey)))
  const [fresh, setFresh] = useState(null)
  const [now, setNow] = useState(Date.now())
  const [busy, setBusy] = useState(false)
  const [ask, setAsk] = useState(false)
  const sending = useRef(false)
  const result = existing || fresh
  const active = !!run && !result && !!t
  const left = active ? Math.max(0, Math.ceil((run.startedAt + t.timeLimit * 60e3 - now) / 1000)) : 0

  useEffect(() => { writeRun(storeKey, result ? null : run) }, [storeKey, run, result])
  useEffect(() => {
    if (!active) return undefined
    setNow(Date.now())
    const iv = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(iv)
  }, [active])

  // Ball serverda hisoblanadi; to'g'ri javoblar topshirilgandan keyingina yuklanadi
  const finish = async (auto = false) => {
    if (sending.current || !run) return
    sending.current = true
    setBusy(true)
    try {
      const [r] = await commit([{ col: 'testAttempts', op: 'insert', item: { id: uid('ta'), testId: t.id, studentId: user.id, answers: run.answers, startedAt: run.startedAt } }])
      await loadDB().catch(() => {})
      notify([t.authorId], `${user.name} «${t.title}» testini topshirdi: ${r.item.score}/${r.item.total}`, `#/platform/tests/${t.id}`)
      setFresh(r.item)
      setRun(null)
      toast(auto ? 'Vaqt tugadi, test avtomatik topshirildi' : 'Test topshirildi')
    } catch (e) {
      sending.current = false
      if (e.status === 409) { await loadDB().catch(() => {}); setRun(null) } // boshqa oynada allaqachon topshirilgan
      else if (e.status === 422 || e.status === 404) { setRun(null); toast(e.message, 'err') }
      else toast(`${e.message}. Javoblaringiz saqlangan — qayta urinib ko‘ring.`, 'err')
    } finally { setBusy(false) }
  }
  useEffect(() => { if (active && left === 0) finish(true) }, [active, left]) // eslint-disable-line react-hooks/exhaustive-deps

  // Klaviatura: 1-9 — variant, ← → — savollar orasida
  const total = t?.questions.length || 0
  const cur = active ? Math.min(run.cur || 0, total - 1) : 0
  useEffect(() => {
    if (!active) return undefined
    const onKey = (e) => {
      if (ask || e.ctrlKey || e.metaKey || e.altKey || /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return
      if (e.key === 'ArrowLeft') setRun((r) => ({ ...r, cur: Math.max(0, (r.cur || 0) - 1) }))
      else if (e.key === 'ArrowRight') setRun((r) => ({ ...r, cur: Math.min(total - 1, (r.cur || 0) + 1) }))
      else if (/^[1-9]$/.test(e.key)) {
        const q = t.questions[cur], oi = Number(e.key) - 1
        if (q && oi < q.options.length) setRun((r) => ({ ...r, answers: { ...r.answers, [q.id]: oi } }))
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [active, ask, total, cur, t])

  // To'g'ri javoblar hali yuklanmagan bo'lsa (tarmoq uzilishi) — qayta so'raladi
  const reviewReady = !!t && t.questions.every((q) => q.correct !== undefined)
  useEffect(() => { if (result && t && !reviewReady) loadDB().catch(() => {}) }, [result?.id, reviewReady]) // eslint-disable-line react-hooks/exhaustive-deps

  const myAttempts = useMemo(() => db.testAttempts.filter((a) => a.studentId === user.id), [db.testAttempts, user.id])
  const datasets = useMemo(() => {
    if (!result || !t || !reviewReady) return []
    const items = reviewOf(t, result)
    const row = (s) => { const v = items.filter((x) => x.status === s).length; return { key: s, label: STATUS[s].label, short: s === 'skip' ? 'Javobsiz' : STATUS[s].label, value: v, shown: `${v} ta savol`, color: STATUS[s].color } }
    return [
      { key: 'answers', label: 'Javoblar', sub: 'To‘g‘ri, xato va javobsiz qolgan savollar soni', defaultType: 'donut', head: ['Javob', 'Savollar'], rows: ['right', 'wrong', 'skip'].map(row),
        parts: { label: 'Savollarning javob holati bo‘yicha ulushi', value: (r) => r.value }, center: { value: `${pct(result.score, result.total)}%`, label: 'Natija' } },
      { key: 'questions', label: 'Savollar', sub: 'Har bir savol: to‘g‘ri javob — 100%, xato yoki javobsiz — 0%', max: 100, unit: '%', head: ['Savol', 'Holat'], parts: null,
        rows: items.map((x) => ({ key: x.q.id, label: `${x.i + 1}. ${x.q.text}`, short: String(x.i + 1), value: x.status === 'right' ? 100 : 0, shown: STATUS[x.status].label, color: STATUS[x.status].color })) },
      testsDataset(myAttempts, db.tests, 'Mening dinamikam', 'Topshirgan testlaringiz bo‘yicha natija, vaqt tartibida'),
    ]
  }, [result, t, reviewReady, myAttempts, db.tests])

  if (!t) return <Card><Empty icon="clipboard" title="Test topilmadi" text="Test o‘chirilgan yoki sizga berilmagan bo‘lishi mumkin." action={<Btn as="a" href="#/platform/tests">Orqaga</Btn>} /></Card>
  const crumbs = [{ label: 'Testlar', href: '#/platform/tests' }, { label: t.title }]

  if (result) {
    return (
      <>
        <PageHead crumbs={crumbs} title="Test natijasi" sub={t.title} actions={<Btn as="a" href="#/platform/tests" icon="chevLeft">Testlarga qaytish</Btn>} />
        {!reviewReady ? (
          <Card><Empty icon="refresh" title="Javoblar yuklanmoqda" text={`Natijangiz saqlandi: ${result.score}/${result.total}. To‘g‘ri javoblarni ko‘rish uchun yangilang.`} action={<Btn variant="primary" icon="refresh" onClick={() => loadDB().catch((e) => toast(e.message, 'err'))}>Yangilash</Btn>} /></Card>
        ) : (
          <>
            <ScoreHero test={t} attempt={result} />
            <ChartPanel title="Natija grafigi" storeKey="test_result" datasets={datasets} defaultType="donut" />
            <section className="pcard">
              <h3 className="pdt ptrv__ttl"><span className="pdt__ico"><Icon name="clipboard" size={18} /></span>Savollar va to‘g‘ri javoblar</h3>
              <QuestionReview test={t} attempt={result} />
            </section>
          </>
        )}
      </>
    )
  }

  if (!run) {
    const closed = t.dueAt < Date.now()
    return (
      <>
        <PageHead crumbs={crumbs} title={t.title} sub={t.description} />
        <section className="pcard ptintro">
          <span className="ptintro__icon"><Icon name={closed ? 'lock' : 'clipboard'} size={30} /></span>
          <h2>{closed ? 'Test muddati tugagan' : 'Testni boshlashga tayyormisiz?'}</h2>
          <dl className="ptintro__facts">
            <div><dt><Icon name="clipboard" size={17} />Savollar</dt><dd>{t.questions.length} ta</dd></div>
            <div><dt><Icon name="timer" size={17} />Vaqt</dt><dd>{t.timeLimit} daqiqa</dd></div>
            <div><dt><Icon name="calendar" size={17} />Muddat</dt><dd>{fmtDateTime(t.dueAt)}</dd></div>
          </dl>
          {closed ? <p className="pmuted">Bu testni endi topshirib bo‘lmaydi. Savollaringiz bo‘lsa, ustozingizga murojaat qiling.</p> : (
            <ul className="ptintro__rules">
              <li><Icon name="check" size={16} />Testni faqat bir marta topshirish mumkin.</li>
              <li><Icon name="check" size={16} />Boshlaganingizdan so‘ng vaqt to‘xtamaydi, vaqt tugasa test avtomatik topshiriladi.</li>
              <li><Icon name="check" size={16} />Sahifa yangilansa, javoblaringiz saqlanib qoladi.</li>
              <li><Icon name="check" size={16} />Topshirgach, xatolaringiz va to‘g‘ri javoblarni ko‘rasiz.</li>
            </ul>
          )}
          <div className="prow ptintro__cta">
            {!closed && <Btn variant="primary" size="lg" icon="play" onClick={() => setRun({ startedAt: Date.now(), answers: {}, cur: 0, flags: [] })}>Testni boshlash</Btn>}
            <Btn as="a" href="#/platform/tests" size="lg">Orqaga</Btn>
          </div>
        </section>
      </>
    )
  }

  const q = t.questions[cur]
  const answers = run.answers
  const flags = run.flags || []
  const answered = t.questions.filter((x) => answers[x.id] !== undefined).length
  const missing = total - answered
  const go = (i) => setRun((r) => ({ ...r, cur: i }))
  const pick = (oi) => setRun((r) => ({ ...r, answers: { ...r.answers, [q.id]: oi } }))
  const toggleFlag = () => setRun((r) => ({ ...r, flags: flags.includes(q.id) ? flags.filter((x) => x !== q.id) : [...flags, q.id] }))
  return (
    <>
      <div className="ptq__bar">
        <div className="ptq__ttl"><h1>{t.title}</h1><span>{answered} / {total} ta savolga javob berildi</span></div>
        <span className={cx('ptimer', left < 60 && 'is-low')} role="timer" aria-label="Qolgan vaqt"><Icon name="timer" size={18} /> {fmtDuration(left)}</span>
        <Progress value={pct(answered, total)} size="sm" />
      </div>
      <div className="pgrid pgrid--main ptq">
        <section className="pquiz__q">
          <div className="ptq__head">
            <span className="ptq__count">{cur + 1}-savol, jami {total} ta</span>
            <button type="button" className={cx('ptq__flag', flags.includes(q.id) && 'is-on')} aria-pressed={flags.includes(q.id)} onClick={toggleFlag}><Icon name="bookmark" size={16} />Keyinroq qaytish</button>
          </div>
          <h3>{q.text}</h3>
          <div role="radiogroup" aria-label="Javob variantlari">
            {q.options.map((o, oi) => (
              <button key={oi} type="button" role="radio" aria-checked={answers[q.id] === oi} className={cx('pquiz__opt', answers[q.id] === oi && 'is-on')} onClick={() => pick(oi)}>
                <i>{LETTER(oi)}</i><span>{o}</span>
              </button>
            ))}
          </div>
          <div className="ptq__nav">
            <Btn icon="chevLeft" disabled={cur === 0} onClick={() => go(cur - 1)}>Oldingi</Btn>
            {cur < total - 1
              ? <Btn variant="primary" onClick={() => go(cur + 1)}>Keyingi <Icon name="chevRight" size={16} /></Btn>
              : <Btn variant="success" icon="check" disabled={busy} onClick={() => setAsk(true)}>Testni topshirish</Btn>}
          </div>
        </section>
        <Card title="Savollar" className="ptq__side">
          <div className="pquiz__dots">
            {t.questions.map((qq, i) => (
              <button key={qq.id} type="button" className={cx(answers[qq.id] !== undefined && 'is-done', i === cur && 'is-cur', flags.includes(qq.id) && 'is-flag')} onClick={() => go(i)}
                aria-label={`${i + 1}-savol${answers[qq.id] !== undefined ? ', javob berilgan' : ''}${flags.includes(qq.id) ? ', belgilangan' : ''}`} aria-current={i === cur ? 'true' : undefined}>{i + 1}</button>
            ))}
          </div>
          <ul className="ptq__keys">
            <li><i className="is-done" />Javob berilgan</li>
            <li><i />Javob berilmagan</li>
            <li><i className="is-flag" />Belgilangan</li>
          </ul>
          <Btn variant="primary" className="ptq__submit" disabled={busy} onClick={() => setAsk(true)}>{busy ? 'Yuborilmoqda…' : `Topshirish (${answered}/${total})`}</Btn>
          <p className="pmuted ptq__hint">Klaviatura: 1–{Math.min(q.options.length, 9)} — variant, ← → — savollar.</p>
        </Card>
      </div>
      <Confirm open={ask} onClose={() => setAsk(false)} title="Testni topshirasizmi?" confirmLabel="Topshirish"
        text={missing ? `${missing} ta savolga javob berilmagan. Topshirgach, javoblarni o‘zgartirib bo‘lmaydi.` : 'Barcha savollarga javob berdingiz. Topshirgach, javoblarni o‘zgartirib bo‘lmaydi.'}
        onConfirm={() => finish(false)} />
    </>
  )
}

// ---- Ustoz: natijalar ----
function TestResults({ id }) {
  const { db } = useAuth()
  const t = db.tests.find((x) => x.id === id)
  const [groupId, setGroupId] = useState('all')
  const [sort, setSort] = useState('order')
  const [open, setOpen] = useState(null)
  const data = useMemo(() => {
    if (!t) return null
    const groups = db.groups.filter((g) => t.groupIds.includes(g.id))
    const inScope = groupId === 'all' ? groups : groups.filter((g) => g.id === groupId)
    const attempts = db.testAttempts.filter((a) => a.testId === id)
    // Guruhdan chiqqan o'quvchining natijasi ham «Barcha guruhlar» ko'rinishida qoladi
    const ids = new Set([...inScope.flatMap((g) => g.studentIds), ...(groupId === 'all' ? attempts.map((a) => a.studentId) : [])])
    const rows = [...ids].map((sid) => ({ id: sid, s: db.users.find((u) => u.id === sid), a: attempts.find((x) => x.studentId === sid) })).filter((r) => r.s)
      .sort((x, y) => (y.a ? pct(y.a.score, y.a.total) : -1) - (x.a ? pct(x.a.score, x.a.total) : -1) || x.s.name.localeCompare(y.s.name))
    const done = rows.filter((r) => r.a)
    const list = done.map((r) => r.a)
    const qStats = t.questions.map((q, i) => {
      const counts = q.options.map((_, oi) => list.filter((a) => a.answers?.[q.id] === oi).length)
      const ok = counts[q.correct] || 0
      const skip = list.length - counts.reduce((s, n) => s + n, 0)
      return { q, i, counts, ok, skip, wrong: list.length - ok - skip, rate: pct(ok, list.length) }
    })
    return { groups, rows, done, list, qStats }
  }, [t, db.groups, db.users, db.testAttempts, id, groupId])
  const datasets = useMemo(() => (!data ? [] : [
    gradesDataset(data.list),
    { key: 'questions', label: 'Savollar', sub: 'Har bir savolga to‘g‘ri javob berganlar ulushi', max: 100, unit: '%', head: ['Savol', 'To‘g‘ri javoblar'],
      parts: { label: 'Xato javoblarning savollar bo‘yicha ulushi', value: (r) => r.wrong, unit: ' ta', empty: 'Xato javoblar yo‘q — hamma savollarga to‘g‘ri javob berilgan.' },
      rows: data.list.length ? data.qStats.map((x) => ({ key: x.q.id, label: `${x.i + 1}. ${x.q.text}`, short: String(x.i + 1), value: x.rate, wrong: x.wrong + x.skip, shown: `${x.rate}% · ${x.ok}/${data.list.length} to‘g‘ri` })) : [] },
    { key: 'students', label: 'O‘quvchilar', sub: 'Har bir o‘quvchining natijasi', max: 100, unit: '%', head: ['O‘quvchi', 'Natija'], defaultType: 'bar',
      parts: { label: 'To‘g‘ri javoblarning o‘quvchilar bo‘yicha ulushi', value: (r) => r.score, unit: ' ta' },
      rows: data.done.map((r) => ({ key: r.id, label: r.s.name, short: r.s.name.split(' ')[0], value: pct(r.a.score, r.a.total), score: r.a.score, shown: `${pct(r.a.score, r.a.total)}% · ${r.a.score}/${r.a.total}` })) },
  ]), [data])

  if (!t) return <Card><Empty icon="clipboard" title="Test topilmadi" action={<Btn as="a" href="#/platform/tests">Orqaga</Btn>} /></Card>
  const { groups, rows, done, list, qStats } = data
  const scores = list.map((a) => pct(a.score, a.total))
  const avg = list.length ? `${avgOf(list)}%` : '—'
  const sorted = sort === 'hard' ? [...qStats].sort((a, b) => a.rate - b.rate) : qStats
  const groupName = (sid) => groups.filter((g) => g.studentIds.includes(sid)).map((g) => g.name).join(', ')
  return (
    <>
      <PageHead crumbs={[{ label: 'Testlar', href: '#/platform/tests' }, { label: t.title }]} title={t.title} sub={`${t.questions.length} savol · ${t.timeLimit} daq · muddat ${fmtDateTime(t.dueAt)}`}
        actions={groups.length > 1 && (
          <label className="pdsel"><span>{groupId === 'all' ? 'Barcha guruhlar' : groups.find((g) => g.id === groupId)?.name}</span><Icon name="chevDown" size={16} />
            <select value={groupId} onChange={(e) => setGroupId(e.target.value)} aria-label="Guruh"><option value="all">Barcha guruhlar</option>{groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}</select>
          </label>
        )} />
      <div className="pgrid pgrid--4">
        <div className="pstat pstat--blue"><span className="pstat__icon"><Icon name="users" size={22} /></span><span className="pstat__body"><span className="pstat__value">{done.length}/{rows.length}</span><span className="pstat__label">Topshirdi</span></span></div>
        <div className="pstat pstat--green"><span className="pstat__icon"><Icon name="chart" size={22} /></span><span className="pstat__body"><span className="pstat__value">{avg}</span><span className="pstat__label">O‘rtacha natija</span></span></div>
        <div className="pstat pstat--violet"><span className="pstat__icon"><Icon name="trophy" size={22} /></span><span className="pstat__body"><span className="pstat__value">{scores.length ? `${Math.max(...scores)}%` : '—'}</span><span className="pstat__label">Eng yuqori natija</span></span></div>
        <div className="pstat pstat--red"><span className="pstat__icon"><Icon name="alertCircle" size={22} /></span><span className="pstat__body"><span className="pstat__value">{scores.filter((p) => p < 50).length}</span><span className="pstat__label">Qoniqarsiz (50% dan past)</span></span></div>
      </div>

      <ChartPanel title="Natijalar grafigi" storeKey="test_results" datasets={datasets} defaultType="column" emptyText="Hali hech kim topshirmagan. Natijalar shu yerda paydo bo‘ladi." />

      <Card title="O‘quvchilar natijalari" sub={done.length ? 'Javoblarini ko‘rish uchun o‘quvchini tanlang' : undefined} pad={false}>
        <Table rows={rows} onRow={(r) => r.a && setOpen(r)} empty={<Empty icon="users" title="Bu guruhda o‘quvchi yo‘q" />} cols={[
          { key: 's', label: 'O‘quvchi', render: (r) => <div className="pcell-user"><UAvatar user={r.s} size={34} /><div><b>{r.s.name}</b><span>{r.s.phone}</span></div></div> },
          { key: 'g', label: 'Guruh', render: (r) => groupName(r.id) || <span className="pmuted">Guruhda emas</span> },
          { key: 'res', label: 'Natija', render: (r) => r.a ? <div className="ptres__cell"><div><b>{r.a.score}/{r.a.total}</b><span className={cx('ptpill', `ptpill--${gradeOf(pct(r.a.score, r.a.total)).tone}`)}>{pct(r.a.score, r.a.total)}%</span></div><Progress size="sm" value={pct(r.a.score, r.a.total)} tone={pct(r.a.score, r.a.total) >= 50 ? 'green' : 'red'} /></div> : <Badge tone="gray">Topshirmagan</Badge> },
          { key: 'time', label: 'Topshirilgan vaqt', render: (r) => r.a ? <span className="ptdate">{fmtDateTime(r.a.finishedAt)}</span> : '—' },
          { key: 'go', label: '', align: 'right', render: (r) => r.a && <Icon name="chevRight" size={18} /> },
        ]} />
      </Card>

      <Card title="Savollar tahlili" sub={list.length ? 'Har bir variantni nechta o‘quvchi tanlagani' : 'Test topshirilgach, ko‘p xato qilingan savollar shu yerda ko‘rinadi'}
        action={list.length > 0 && (
          <label className="pdsel"><span>{sort === 'hard' ? 'Eng qiyinlari avval' : 'Test tartibida'}</span><Icon name="chevDown" size={16} />
            <select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Saralash"><option value="order">Test tartibida</option><option value="hard">Eng qiyinlari avval</option></select>
          </label>
        )}>
        <div className="ptqa">
          {sorted.map((x) => (
            <details key={x.q.id} className="ptqa__item" open={t.questions.length <= 6}>
              <summary>
                <span className="ptrv__num">{x.i + 1}</span>
                <span className="ptqa__text">{x.q.text}</span>
                {list.length > 0 && <span className={cx('ptpill', `ptpill--${gradeOf(x.rate).tone}`)}>{x.rate}%</span>}
                <Icon name="chevDown" size={16} />
              </summary>
              <div className="ptqa__opts">
                {x.q.options.map((o, oi) => (
                  <div key={oi} className={cx('ptqa__opt', oi === x.q.correct && 'is-right')}>
                    <i>{oi === x.q.correct ? <Icon name="check" size={13} stroke={3} /> : LETTER(oi)}</i>
                    <span className="ptqa__olabel">{o}{oi === x.q.correct && <small>To‘g‘ri javob</small>}</span>
                    <span className="ptqa__track"><b style={{ width: `${pct(x.counts[oi], list.length)}%` }} /></span>
                    <span className="ptqa__n">{x.counts[oi]} ta · {pct(x.counts[oi], list.length)}%</span>
                  </div>
                ))}
                {x.skip > 0 && <p className="pmuted ptqa__skip">{x.skip} ta o‘quvchi javob bermagan</p>}
              </div>
            </details>
          ))}
        </div>
      </Card>

      <Modal open={!!open} onClose={() => setOpen(null)} width={860} title={open?.s.name} sub={t.title}>
        {open && <><ScoreHero test={t} attempt={open.a} staff /><QuestionReview test={t} attempt={open.a} who="O‘quvchi javobi" /></>}
      </Modal>
    </>
  )
}
