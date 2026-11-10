import { useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '../store/auth.jsx'
import { add, patch, remove, notify, logActivity, commit, loadDB, NO_ORG } from '../store/db.js'
import { PageHead, Card, Btn, Badge, Tabs, Modal, FField, Input, Textarea, ChipSelect, Empty, Icon, UAvatar, Confirm, Menu, useToast, Table, Progress, Search, cx, useFormInit } from '../ui/kit.jsx'
import { fmtDate, fmtDateShort, fmtLeft, fmtDateTime, toLocalInput, fromLocalInput, pct, fmtDuration } from '../ui/format.js'
import { uid } from '../store/ids.js'
import { StatSpark, series, endOfDay } from '../ui/charts.jsx'
import { ChartPanel } from '../ui/chartpanel.jsx'

export default function Tests({ param }) {
  const { user } = useAuth()
  // #/platform/tests/group.<guruhId> — guruh statistikasi, #/platform/tests/student.<o'quvchiId> — o'quvchi statistikasi
  if (param?.startsWith('group.')) return user.role === 'student' ? <StudentTestStats sid={user.id} /> : <GroupTestStats gid={param.slice(6)} />
  if (param?.startsWith('student.')) return <StudentTestStats sid={user.role === 'student' ? user.id : param.slice(8)} />
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
// Savol tasnifi (ixtiyoriy): turi test vaqtida ko'rinadi, Bloom darajasi va bo'lim — faqat natijada
const QKIND = { scenario: 'Vaziyatli', calc: 'Hisob-kitob', theory: 'Nazariy-tahliliy' }
const BLOOM = { apply: 'Qo‘llash', analyze: 'Tahlil', evaluate: 'Baholash' }
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
        {!isStaff && <Btn variant="primary" size="lg" icon="chart" className="pthero__btn" as="a" href={`#/platform/tests/student.${user.id}`}>Mening statistikam</Btn>}
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
          <StatSpark icon="chart" tone="violet" color="#8b5cf6" value={stats.avg} label="O‘rtacha natijam" data={stats.sAvg} onClick={() => { window.location.hash = `#/platform/tests/student.${user.id}` }} />
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

      {isStaff && <GroupsOverview tests={scope.tests} attempts={attempts} />}

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
const emptyQ = () => ({ id: uid('q'), text: '', options: ['', '', '', ''], correct: 0, explain: '' })
const META_KEYS = ['explain', 'quote', 'ref', 'section', 'kind', 'bloom']
// Savolning izoh va tasnif maydonlari (bo'sh qiymatlar saqlanmaydi)
const metaOf = (q, keep = null) => {
  const out = {}
  for (const k of META_KEYS) { const v = (q[k] || '').trim(); if (v) out[k] = v }
  const notes = (keep || q.options.map((_, i) => i)).map((i) => (q.notes?.[i] || '').trim())
  if (notes.some(Boolean)) out.notes = notes
  return out
}
// Savol izohi va tasnifi: o'quvchi testni topshirgach ko'radi (xato qilganda — o'z variantining izohi bilan)
function QuestionMeta({ q, onChange, n }) {
  const has = META_KEYS.some((k) => q[k]) || q.notes?.some(Boolean)
  const [open, setOpen] = useState(has)
  if (!open) return <button type="button" className="ptlink pqb__explain-add" onClick={() => setOpen(true)}><Icon name="message" size={15} />Izoh va manba qo‘shish</button>
  const setNote = (oi, v) => onChange('notes', q.options.map((_, k) => (k === oi ? v : q.notes?.[k] || '')))
  return (
    <div className="pqb__meta">
      <div className="pqb__meta-row">
        <label><span>Savol turi</span>
          <select className="pinput" value={q.kind || ''} onChange={(e) => onChange('kind', e.target.value)}><option value="">—</option>{Object.entries(QKIND).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
        <label><span>Bloom darajasi</span>
          <select className="pinput" value={q.bloom || ''} onChange={(e) => onChange('bloom', e.target.value)}><option value="">—</option>{Object.entries(BLOOM).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
        <label><span>Bo‘lim</span><Input value={q.section || ''} maxLength={120} onChange={(e) => onChange('section', e.target.value)} placeholder="Qabz masalasi" /></label>
      </div>
      <label className="pqb__explain">
        <span><Icon name="message" size={14} />Izoh — nega to‘g‘ri javob to‘g‘ri (o‘quvchi topshirgach ko‘radi)</span>
        <Textarea rows={3} maxLength={4000} value={q.explain || ''} onChange={(e) => onChange('explain', e.target.value)} placeholder="Qoida, uning shar’iy asosi va vaziyatga tatbiqi. Hisob-kitob bo‘lsa — bosqichma-bosqich." aria-label={`${n}-savol izohi`} />
      </label>
      <div className="pqb__notes">
        <span>Variantlar haqida (o‘quvchi aynan shu variantni tanlasa ko‘radi)</span>
        {q.options.map((o, oi) => (
          <label key={oi} className={cx(oi === q.correct && 'is-right')}><i>{LETTER(oi)}</i>
            <Input value={q.notes?.[oi] || ''} maxLength={1000} onChange={(e) => setNote(oi, e.target.value)} placeholder={oi === q.correct ? 'To‘g‘ri javob — izoh shart emas' : 'Nega bu variant noto‘g‘ri?'} />
          </label>
        ))}
      </div>
      <div className="pqb__meta-row pqb__meta-row--src">
        <label><span>Manba (band)</span><Input value={q.ref || ''} maxLength={200} onChange={(e) => onChange('ref', e.target.value)} placeholder="AAOIFI SS 1, 2/6/2" /></label>
        <label><span>Iqtibos</span><Input value={q.quote || ''} maxLength={800} onChange={(e) => onChange('quote', e.target.value)} placeholder="Bandning qisqa matni (1–2 gap)" /></label>
      </div>
    </div>
  )
}

// JSON fayldan savollar: { title, description, timeLimit, questions: [{ text, options, correct: 1 | "B", explain, notes, ref, quote, section, kind, bloom }] }
function parseTestFile(raw) {
  let d
  try { d = JSON.parse(raw.replace(/^﻿/, '')) } catch { throw new Error('Fayl JSON formatida emas') }
  const list = Array.isArray(d) ? d : d?.questions
  if (!Array.isArray(list) || !list.length) throw new Error('Faylda «questions» ro‘yxati topilmadi')
  if (list.length > 200) throw new Error('Testda 200 tadan ortiq savol bo‘lishi mumkin emas')
  const questions = list.map((q, n) => {
    const label = `${n + 1}-savol`
    const options = Array.isArray(q?.options) ? q.options.map((o) => String(o ?? '').trim()) : []
    if (!String(q?.text || '').trim()) throw new Error(`${label}: matn yo‘q`)
    if (options.length < 2 || options.length > MAX_OPTS || options.some((o) => !o)) throw new Error(`${label}: 2 tadan ${MAX_OPTS} tagacha to‘ldirilgan variant bo‘lishi kerak`)
    const correct = typeof q.correct === 'string' && /^[A-H]$/i.test(q.correct.trim()) ? q.correct.trim().toUpperCase().charCodeAt(0) - 65 : Number(q.correct)
    if (!Number.isInteger(correct) || correct < 0 || correct >= options.length) throw new Error(`${label}: to‘g‘ri javob noto‘g‘ri ko‘rsatilgan`)
    const pick = (k) => (typeof q[k] === 'string' ? q[k].trim() : '')
    return {
      id: uid('q'), text: String(q.text).trim(), options, correct,
      explain: pick('explain'), quote: pick('quote'), ref: pick('ref'), section: pick('section'),
      kind: QKIND[q.kind] ? q.kind : '', bloom: BLOOM[q.bloom] ? q.bloom : '',
      notes: Array.isArray(q.notes) ? options.map((_, k) => String(q.notes[k] ?? '').trim()) : [],
    }
  })
  return {
    questions,
    title: typeof d.title === 'string' ? d.title.trim() : '',
    description: typeof d.description === 'string' ? d.description.trim() : '',
    timeLimit: Number.isFinite(Number(d.timeLimit)) && Number(d.timeLimit) >= 1 ? Math.min(600, Math.round(Number(d.timeLimit))) : null,
  }
}
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
    return { ...q, options: q.options.filter((_, k) => k !== oi), correct, ...(q.notes ? { notes: q.notes.filter((_, k) => k !== oi) } : {}) }
  }) }))
  // JSON fayldan import: mavjud savollar o'rniga (forma bo'sh bo'lmasa — tasdiq so'raladi)
  const fileRef = useRef(null)
  const [pending, setPending] = useState(null)
  const applyImport = (r) => {
    setF((x) => ({ ...x, questions: r.questions, title: x.title?.trim() ? x.title : r.title, description: x.description?.trim() ? x.description : r.description, timeLimit: r.timeLimit || x.timeLimit }))
    toast(`${r.questions.length} ta savol yuklandi — tekshirib, «Yaratish»ni bosing`)
  }
  const onFile = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (file.size > 2 * 1024 * 1024) return setErr('Fayl juda katta (2 MB dan oshmasin)')
    try {
      const r = parseTestFile(await file.text())
      const filled = f.questions?.some((q) => q.text.trim() || q.options.some((o) => o.trim()))
      if (filled) setPending(r); else applyImport(r)
    } catch (x) { setErr(x.message) }
  }

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
        qs.push({ id: q.id, text: q.text.trim(), options: kept.map((x) => x.o), correct, ...metaOf(q, kept.map((x) => x.i)) })
      }
      if (!qs.length) return setErr('Kamida bitta savol kiriting')
      data.questions = qs
    } else {
      // Qulflangan testda faqat izoh va tasnif o'zgaradi — savol, variant va to'g'ri javob o'sha-o'sha
      const old = test.questions
      const qs = old.map((q) => {
        const edited = f.questions.find((x) => x.id === q.id) || q
        return { id: q.id, text: q.text, options: q.options, correct: q.correct, ...metaOf({ ...edited, options: q.options }) }
      })
      if (JSON.stringify(qs) !== JSON.stringify(old.map((q) => ({ id: q.id, text: q.text, options: q.options, correct: q.correct, ...metaOf(q) })))) data.questions = qs
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
        <div className="ptform__qhead">
          <span className="pfield__label">Savollar ({f.questions?.length || 0})</span>
          {!locked && <>
            <input ref={fileRef} type="file" accept=".json,application/json" hidden onChange={onFile} />
            <Btn size="sm" icon="upload" onClick={() => fileRef.current?.click()}>Fayldan yuklash</Btn>
          </>}
        </div>
        {!locked && <p className="pfield__hint ptform__importhint">Tayyor test bankini JSON fayl ko‘rinishida yuklash mumkin: savollar, variantlar, to‘g‘ri javob, izohlar, manba va Bloom darajasi bilan.</p>}
        {locked && <p className="ptform__lock"><Icon name="lock" size={16} />O‘quvchilar bu testni topshirgan, shuning uchun savollar qulflangan: o‘zgarish eski natijalarni buzadi. Izoh, manba va tasnifni esa qo‘shish va tahrirlash mumkin — o‘quvchilar darhol ko‘radi.</p>}
        {(f.questions || []).map((q, i) => (locked ? (
          <div key={q.id} className="pqb pqb--ro">
            <b>{i + 1}. {q.text}</b>
            <ul>{q.options.map((o, oi) => <li key={oi} className={cx(oi === q.correct && 'is-right')}><i>{LETTER(oi)}</i>{o}{oi === q.correct && <Icon name="check" size={15} />}</li>)}</ul>
            <QuestionMeta q={q} onChange={(k, v) => setQ(i, k, v)} n={i + 1} />
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
            <QuestionMeta q={q} onChange={(k, v) => setQ(i, k, v)} n={i + 1} />
          </div>
        )))}
        {!locked && <Btn icon="plus" onClick={() => set('questions', [...f.questions, emptyQ()])}>Savol qo‘shish</Btn>}
      </div>
      <Confirm open={!!pending} onClose={() => setPending(null)} title="Savollarni almashtirish" confirmLabel="Almashtirish"
        text={`Formadagi savollar o‘rniga fayldagi ${pending?.questions.length || 0} ta savol qo‘yiladi.`} onConfirm={() => applyImport(pending)} />
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
            <ReviewNotes x={x} who={who} />
          </li>
        ))}
      </ol>
    </div>
  )
}

// Savol ostidagi izohlar: nega to'g'ri, tanlangan variant nega noto'g'ri, boshqa variantlar, manba
function ReviewNotes({ x, who }) {
  const { q, my, status } = x
  const notes = q.notes || []
  const mine = status === 'wrong' && notes[my]
  const others = q.options.map((o, oi) => ({ oi, note: notes[oi] })).filter((n) => n.note && n.oi !== q.correct && !(status === 'wrong' && n.oi === my))
  const tags = [q.kind && QKIND[q.kind], q.bloom && BLOOM[q.bloom] && `Bloom: ${BLOOM[q.bloom]}`, q.section].filter(Boolean)
  if (!q.explain && !mine && !others.length && !q.ref && !tags.length) return null
  return (
    <div className="ptrv__more">
      {q.explain && (
        <div className={cx('ptrv__exp', status !== 'right' && 'is-hot')}>
          <span><Icon name="message" size={15} />Nima uchun {LETTER(q.correct)} to‘g‘ri</span>
          <p>{q.explain}</p>
        </div>
      )}
      {mine && (
        <div className="ptrv__exp is-bad">
          <span><Icon name="alertCircle" size={15} />{who === 'Sizning javobingiz' ? 'Siz tanlagan' : 'Tanlangan'} {LETTER(my)} variant nima uchun noto‘g‘ri</span>
          <p>{mine}</p>
        </div>
      )}
      {others.length > 0 && (
        <details className="ptrv__others" open={status !== 'right'}>
          <summary>Boshqa variantlar</summary>
          <ul>{others.map((n) => <li key={n.oi}><b>{LETTER(n.oi)})</b> {n.note}</li>)}</ul>
        </details>
      )}
      {(q.ref || q.quote) && (
        <div className="ptrv__src">
          <Icon name="bookOpen" size={15} />
          <div>{q.ref && <b>Manba: {q.ref}</b>}{q.quote && <q>{q.quote}</q>}</div>
        </div>
      )}
      {tags.length > 0 && <div className="ptrv__tags">{tags.map((t) => <span key={t}>{t}</span>)}</div>}
    </div>
  )
}

// ---- Standart bo'yicha yakuniy tahlil (savollarda Bloom darajasi yoki bo'lim ko'rsatilgan testlar uchun) ----
const LEVELS = [
  { min: 85, label: 'A’lo: imtihonga tayyor', tone: 'green' },
  { min: 70, label: 'Yaxshi: ayrim bo‘limlarni takrorlash kerak', tone: 'blue' },
  { min: 50, label: 'Qoniqarli: tizimli takrorlash zarur', tone: 'amber' },
  { min: 0, label: 'Standartni qayta o‘rganish tavsiya etiladi', tone: 'red' },
]
const hasTaxonomy = (t) => t.questions.some((q) => q.bloom || q.section)
const byKey = (items, key) => {
  const m = new Map()
  for (const x of items) { const k = key(x); if (!k) continue; if (!m.has(k)) m.set(k, []); m.get(k).push(x) }
  return [...m.entries()].map(([k, list]) => ({ k, n: list.length, ok: list.filter((x) => x.status === 'right').length, list }))
}
const mark = (p) => (p >= 80 ? { s: '✅', t: 'Yaxshi', tone: 'green' } : p >= 50 ? { s: '⚠️', t: 'Takrorlang', tone: 'amber' } : { s: '❌', t: 'Qayta o‘rganing', tone: 'red' })

function StandardAnalysis({ test, attempt, staff }) {
  const items = useMemo(() => reviewOf(test, attempt), [test, attempt])
  if (!hasTaxonomy(test)) return null
  const p = pct(attempt.score, attempt.total)
  const level = LEVELS.find((l) => p >= l.min)
  const blooms = byKey(items, (x) => x.q.bloom).sort((a, b) => Object.keys(BLOOM).indexOf(a.k) - Object.keys(BLOOM).indexOf(b.k))
  const sections = byKey(items, (x) => x.q.section)
  const wrong = items.filter((x) => x.status !== 'right')
  const weak = sections.filter((s) => pct(s.ok, s.n) < 80).sort((a, b) => pct(a.ok, a.n) - pct(b.ok, b.n))
  const refs = [...new Set(wrong.map((x) => x.q.ref).filter(Boolean))]
  return (
    <section className="pcard ptsa">
      <header className="ptsa__head">
        <h3 className="pdt"><span className="pdt__ico"><Icon name="award" size={18} /></span>Standart bo‘yicha tahlil</h3>
        <span className={cx('ptpill', `ptpill--${level.tone}`, 'ptpill--lg')}>{attempt.score}/{attempt.total} · {p}%</span>
      </header>
      <p className={cx('ptsa__level', `is-${level.tone}`)}><b>{level.label}</b></p>
      <div className="ptsa__grid">
        {blooms.length > 0 && (
          <div className="ptsa__tbl">
            <h4>Bloom darajalari bo‘yicha</h4>
            <table><thead><tr><th>Daraja</th><th>Savollar</th><th>To‘g‘ri</th><th>Foiz</th></tr></thead>
              <tbody>{blooms.map((b) => <tr key={b.k}><td>{BLOOM[b.k]}</td><td>{b.n}</td><td>{b.ok}</td><td>{pill(pct(b.ok, b.n))}</td></tr>)}</tbody></table>
          </div>
        )}
        {sections.length > 0 && (
          <div className="ptsa__tbl">
            <h4>Standart bo‘limlari bo‘yicha</h4>
            <table><thead><tr><th>Bo‘lim</th><th>Savollar</th><th>To‘g‘ri</th><th>Holat</th></tr></thead>
              <tbody>{sections.map((s) => { const m = mark(pct(s.ok, s.n)); return <tr key={s.k}><td>{s.k}</td><td>{s.n}</td><td>{s.ok}</td><td><span className={cx('ptsa__mark', `is-${m.tone}`)} title={m.t}>{m.s} {m.t}</span></td></tr> })}</tbody></table>
          </div>
        )}
      </div>
      {wrong.length > 0 && (
        <div className="ptsa__wrong">
          <h4>Xato qilingan savollar</h4>
          <table><thead><tr><th>№</th><th>Mavzu</th><th>Qayta o‘qish kerak bo‘lgan band</th></tr></thead>
            <tbody>{wrong.map((x) => <tr key={x.q.id}><td>{x.i + 1}</td><td>{x.q.section || '—'}{x.status === 'skip' && <small> · javob berilmagan</small>}</td><td>{x.q.ref || '—'}</td></tr>)}</tbody></table>
        </div>
      )}
      <div className="ptsa__tip">
        <Icon name="zap" size={18} />
        <p>{wrong.length === 0
          ? `${staff ? 'O‘quvchi barcha' : 'Barcha'} savollarga to‘g‘ri javob ${staff ? 'bergan' : 'berdingiz'}. Bilimni mustahkamlash uchun baholash darajasidagi murakkab vaziyatlarni mustaqil tahlil qilib ko‘ring.`
          : `${weak.length ? `Avval quyidagi bo‘limlarni qayta o‘qing: ${weak.map((s) => `${s.k} (${s.ok}/${s.n})`).join(', ')}. ` : ''}${refs.length ? `Bandlar: ${refs.join('; ')}. ` : ''}Har bir xato savol ostidagi izohda to‘g‘ri javobning sababi va ${staff ? 'tanlangan' : 'siz tanlagan'} variantning xatosi ko‘rsatilgan.`}</p>
      </div>
    </section>
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
            <FeedbackBox test={t} attempt={result} />
            <StandardAnalysis test={t} attempt={result} />
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
            <span className="ptq__count">{cur + 1}-savol, jami {total} ta{q.kind && QKIND[q.kind] && <em className="ptq__kind">{QKIND[q.kind]}</em>}</span>
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
    // Savollarda tasnif bo'lsa: bo'limlar va Bloom darajalari bo'yicha to'g'ri javoblar ulushi
    ...[['section', 'Bo‘limlar', 'Standart bo‘limlari bo‘yicha to‘g‘ri javoblar ulushi', (q) => q.section, (k) => k],
      ['bloom', 'Bloom', 'Bloom darajalari bo‘yicha to‘g‘ri javoblar ulushi', (q) => q.bloom, (k) => BLOOM[k] || k]]
      .filter(([, , , key]) => t.questions.some(key))
      .map(([k, label, sub, key, name]) => {
        const groups = new Map()
        for (const x of data.qStats) { const g = key(x.q); if (!g) continue; const v = groups.get(g) || { ok: 0, all: 0 }; v.ok += x.ok; v.all += data.list.length; groups.set(g, v) }
        return { key: k, label, sub, max: 100, unit: '%', head: [label, 'To‘g‘ri javoblar'], parts: null,
          rows: data.list.length ? [...groups.entries()].map(([g, v]) => ({ key: g, label: name(g), value: pct(v.ok, v.all), shown: `${pct(v.ok, v.all)}% · ${v.ok}/${v.all}` })) : [] }
      }),
  ]), [data, t])

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
          { key: 'fb', label: 'Izoh', render: (r) => r.a?.feedback ? <Badge tone="blue"><Icon name="message" size={13} /> Yozilgan</Badge> : <span className="pmuted">—</span> },
          { key: 'go', label: '', align: 'right', render: (r) => <span onClick={(e) => e.stopPropagation()}><Menu items={[
            r.a && { label: 'Javoblar va izoh', icon: 'eye', onClick: () => setOpen(r) },
            { label: 'O‘quvchi statistikasi', icon: 'chart', onClick: () => { window.location.hash = `#/platform/tests/student.${r.id}` } },
          ].filter(Boolean)} /></span> },
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

      <AttemptModal test={t} attempt={open && db.testAttempts.find((a) => a.id === open.a.id)} student={open?.s} onClose={() => setOpen(null)} />
    </>
  )
}

/* ================= Statistika: guruh va o'quvchi kesimida ================= */

const pctOf = (a) => pct(a.score, a.total)
const pill = (p, extra) => <span className={cx('ptpill', `ptpill--${gradeOf(p).tone}`, extra)}>{p}%</span>

// Guruh bo'yicha: qaysi testlar berilgan, kim qaysi testni qanday topshirgan
function groupStats(g, tests, attempts, users) {
  const gt = tests.filter((t) => t.groupIds.includes(g.id)).sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0))
  const tIds = new Set(gt.map((t) => t.id))
  const students = g.studentIds.map((id) => users.find((u) => u.id === id)).filter(Boolean)
  const sIds = new Set(students.map((s) => s.id))
  const list = attempts.filter((a) => tIds.has(a.testId) && sIds.has(a.studentId))
  const now = Date.now()
  const rows = students.map((s) => {
    const mine = list.filter((a) => a.studentId === s.id)
    const cells = new Map(mine.map((a) => [a.testId, a]))
    const missed = gt.filter((t) => t.dueAt < now && !cells.has(t.id)).length
    return { s, cells, done: mine.length, avg: mine.length ? avgOf(mine) : null, missed }
  })
  // Muddati o'tgan yoki topshirilgan testlar — o'quvchidan kutilgan ishlar
  const due = gt.reduce((n, t) => n + students.filter((s) => t.dueAt < now || list.some((a) => a.testId === t.id && a.studentId === s.id)).length, 0)
  return {
    g, tests: gt, students, rows, list,
    avg: list.length ? avgOf(list) : null,
    rate: pct(list.length, due),
    weak: rows.filter((r) => r.avg !== null && r.avg < 50).length,
  }
}

function GroupsOverview({ tests, attempts }) {
  const { db, scope } = useAuth()
  const rows = useMemo(() => scope.groups.map((g) => groupStats(g, tests, attempts, db.users)), [scope.groups, tests, attempts, db.users])
  if (!rows.length) return null
  return (
    <section className="pcard ptgo">
      <header className="ptcard-h">
        <h3 className="pdt"><span className="pdt__ico"><Icon name="layers" size={18} /></span>Guruhlar kesimida</h3>
        <span className="ptgo__hint">Guruhni tanlang — har bir o‘quvchining barcha testlar bo‘yicha natijasi</span>
      </header>
      <div className="ptgo__grid">
        {rows.map((r) => (
          <a key={r.g.id} href={`#/platform/tests/group.${r.g.id}`} className="ptgo__card" style={{ '--gc': r.g.color || '#4aa3f8' }}>
            <div className="ptgo__top">
              <div><b>{r.g.name}</b><span>{r.g.course}</span></div>
              {r.avg === null ? <span className="ptpill ptpill--gray">—</span> : pill(r.avg, 'ptpill--lg')}
            </div>
            <div className="ptgo__nums">
              <div><b>{r.students.length}</b><span>o‘quvchi</span></div>
              <div><b>{r.tests.length}</b><span>test</span></div>
              <div><b>{r.list.length}</b><span>topshiruv</span></div>
            </div>
            <div className="ptgo__bar">
              <span>Topshirish ko‘rsatkichi <b>{r.rate}%</b></span>
              <span className="pprog ptbar"><span className="pprog__bar" style={{ width: `${r.rate}%` }} /></span>
            </div>
            <div className="ptgo__foot">
              {r.weak > 0 ? <small className="is-warn"><Icon name="alertCircle" size={14} />{r.weak} o‘quvchi 50% dan past</small>
                : r.tests.length ? <small><Icon name="checkCircle" size={14} />Qoniqarsiz o‘quvchi yo‘q</small> : <small>Hali test berilmagan</small>}
              <span className="ptgo__go">Batafsil <Icon name="arrowRight" size={15} /></span>
            </div>
          </a>
        ))}
      </div>
    </section>
  )
}

// CSV (Excel ochadi): o'quvchi × test jadvali
function downloadCsv(name, head, rows) {
  const esc = (v) => { const s = String(v ?? ''); return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s }
  const csv = '﻿' + [head, ...rows].map((r) => r.map(esc).join(';')).join('\r\n')
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  a.download = name.replace(/[\\/:*?"<>|]+/g, '_') + '.csv'
  document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}

function GroupTestStats({ gid }) {
  const { db, scope } = useAuth()
  const [sort, setSort] = useState('avg')
  const [open, setOpen] = useState(null) // { t, aId, s }
  const g = scope.groups.find((x) => x.id === gid)
  const st = useMemo(() => g && groupStats(g, scope.tests, db.testAttempts, db.users), [g, scope.tests, db.testAttempts, db.users])
  const datasets = useMemo(() => (!st ? [] : [
    { key: 'students', label: 'O‘quvchilar', sub: 'Har bir o‘quvchining barcha testlar bo‘yicha o‘rtacha natijasi', max: 100, unit: '%', head: ['O‘quvchi', 'O‘rtacha'], defaultType: 'bar',
      parts: { label: 'Topshiruvlarning o‘quvchilar bo‘yicha ulushi', value: (r) => r.done, unit: ' ta' },
      rows: st.rows.filter((r) => r.avg !== null).map((r) => ({ key: r.s.id, label: r.s.name, short: r.s.name.split(' ')[0], value: r.avg, done: r.done, shown: `${r.avg}% · ${r.done} ta test` })) },
    testsDataset(st.list, st.tests, 'Testlar', 'Har bir test bo‘yicha guruh o‘rtachasi, vaqt tartibida'),
    { key: 'completion', label: 'Topshirish', sub: 'Har bir testni guruhning necha foizi topshirgani', max: 100, unit: '%', head: ['Test', 'Topshirganlar'], parts: null,
      rows: st.students.length ? st.tests.map((t) => { const n = st.list.filter((a) => a.testId === t.id).length; return { key: t.id, label: t.title, value: pct(n, st.students.length), shown: `${n}/${st.students.length} · ${pct(n, st.students.length)}%` } }) : [] },
    gradesDataset(st.list),
  ]), [st])

  if (!g) return <Card><Empty icon="layers" title="Guruh topilmadi" text="Guruh o‘chirilgan yoki sizga biriktirilmagan." action={<Btn as="a" href="#/platform/tests">Testlarga qaytish</Btn>} /></Card>
  const rows = [...st.rows].sort((a, b) => (sort === 'name' ? a.s.name.localeCompare(b.s.name) : (b.avg ?? -1) - (a.avg ?? -1) || a.s.name.localeCompare(b.s.name)))
  const teacher = db.users.find((u) => u.id === g.teacherId)
  const now = Date.now()
  const exportCsv = () => downloadCsv(`${g.name} — test natijalari`,
    ['O‘quvchi', ...st.tests.map((t) => t.title), 'O‘rtacha, %', 'Topshirgan', 'Qoldirgan'],
    rows.map((r) => [r.s.name, ...st.tests.map((t) => { const a = r.cells.get(t.id); return a ? `${pctOf(a)}% (${a.score}/${a.total})` : t.dueAt < now ? 'topshirmagan' : 'kutilmoqda' }), r.avg ?? '', r.done, r.missed]))
  const openCell = (t, a, s) => setOpen({ t, aId: a.id, s })
  const cur = open && db.testAttempts.find((a) => a.id === open.aId)

  return (
    <>
      <PageHead crumbs={[{ label: 'Testlar', href: '#/platform/tests' }, { label: `${g.name} statistikasi` }]} title={`${g.name} — testlar statistikasi`}
        sub={`${g.course}${teacher ? ` · ${teacher.name}` : ''}`}
        actions={<>
          <Btn icon="layers" as="a" href={`#/platform/groups/${g.id}`}>Guruh sahifasi</Btn>
          {st.tests.length > 0 && st.students.length > 0 && <Btn variant="primary" icon="download" onClick={exportCsv}>Excel’ga yuklash</Btn>}
        </>} />
      <div className="pgrid pgrid--4">
        <div className="pstat pstat--blue"><span className="pstat__icon"><Icon name="users" size={22} /></span><span className="pstat__body"><span className="pstat__value">{st.students.length}</span><span className="pstat__label">O‘quvchilar</span></span></div>
        <div className="pstat pstat--violet"><span className="pstat__icon"><Icon name="clipboard" size={22} /></span><span className="pstat__body"><span className="pstat__value">{st.tests.length}</span><span className="pstat__label">Berilgan testlar</span></span></div>
        <div className="pstat pstat--green"><span className="pstat__icon"><Icon name="chart" size={22} /></span><span className="pstat__body"><span className="pstat__value">{st.avg === null ? '—' : `${st.avg}%`}</span><span className="pstat__label">Guruh o‘rtachasi</span></span></div>
        <div className="pstat pstat--red"><span className="pstat__icon"><Icon name="alertCircle" size={22} /></span><span className="pstat__body"><span className="pstat__value">{st.weak}</span><span className="pstat__label">50% dan past o‘quvchilar</span></span></div>
      </div>

      <ChartPanel title="Guruh natijalari" storeKey="group_tests" datasets={datasets} defaultType="bar" emptyText="Guruhda hali test topshirilmagan." />

      <Card pad={false} className="ptmx-card">
        <header className="ptcard-h">
          <h3 className="pdt"><span className="pdt__ico"><Icon name="grid" size={18} /></span>O‘quvchilar va testlar</h3>
          <label className="pdsel"><span>{sort === 'name' ? 'Ism bo‘yicha' : 'Natija bo‘yicha'}</span><Icon name="chevDown" size={16} />
            <select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Saralash"><option value="avg">Natija bo‘yicha</option><option value="name">Ism bo‘yicha</option></select>
          </label>
        </header>
        {!st.students.length ? <Empty icon="users" title="Guruhda o‘quvchi yo‘q" />
          : !st.tests.length ? <Empty icon="clipboard" title="Guruhga hali test berilmagan" action={<Btn variant="primary" as="a" href="#/platform/tests">Test yaratish</Btn>} />
            : (
              <div className="ptmx">
                <table>
                  <thead>
                    <tr>
                      <th className="ptmx__name">O‘quvchi</th>
                      {st.tests.map((t) => <th key={t.id} title={t.title}><a href={`#/platform/tests/${t.id}`}>{t.title}</a><small>{fmtDateShort(t.dueAt)}</small></th>)}
                      <th className="ptmx__avg">O‘rtacha</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.s.id}>
                        <th className="ptmx__name"><a href={`#/platform/tests/student.${r.s.id}`} className="pcell-user ptuser"><UAvatar user={r.s} size={30} /><span><b>{r.s.name}</b><small>{r.done}/{st.tests.length} test{r.missed ? ` · ${r.missed} qoldirgan` : ''}</small></span></a></th>
                        {st.tests.map((t) => {
                          const a = r.cells.get(t.id)
                          if (a) return <td key={t.id}><button type="button" className={cx('ptmx__cell', `is-${gradeOf(pctOf(a)).tone}`)} onClick={() => openCell(t, a, r.s)} title={`${t.title}: ${a.score}/${a.total}${a.feedback ? ' · izoh yozilgan' : ''}`}>{pctOf(a)}%{a.feedback && <Icon name="message" size={11} />}</button></td>
                          return <td key={t.id}><span className={cx('ptmx__cell', t.dueAt < now ? 'is-miss' : 'is-wait')} title={t.dueAt < now ? 'Topshirmagan, muddat tugagan' : 'Hali topshirmagan'}>{t.dueAt < now ? '✕' : '…'}</span></td>
                        })}
                        <td className="ptmx__avg">{r.avg === null ? <span className="pmuted">—</span> : pill(r.avg)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <th className="ptmx__name">Test o‘rtachasi</th>
                      {st.tests.map((t) => { const ta = st.list.filter((a) => a.testId === t.id); return <td key={t.id}>{ta.length ? pill(avgOf(ta)) : <span className="pmuted">—</span>}</td> })}
                      <td className="ptmx__avg">{st.avg === null ? '—' : pill(st.avg)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
        <p className="ptmx__legend"><span><i className="is-green" />90%+ a’lo</span><span><i className="is-blue" />70–89%</span><span><i className="is-amber" />50–69%</span><span><i className="is-red" />50% dan past</span><span>✕ topshirmagan</span><span>… kutilmoqda</span><span><Icon name="message" size={12} /> izoh yozilgan</span></p>
      </Card>

      <AttemptModal test={open?.t} attempt={cur} student={open?.s} onClose={() => setOpen(null)} />
    </>
  )
}

function StudentTestStats({ sid }) {
  const { user, db, scope } = useAuth()
  const staff = user.role !== 'student'
  const [open, setOpen] = useState(null) // attempt id
  const [onlyTest, setOnlyTest] = useState('all')
  const s = db.users.find((u) => u.id === sid)
  const allowed = !!s && (!staff ? sid === user.id : (user.role === 'teacher' ? scope.myStudents : scope.students).some((x) => x.id === sid))
  const data = useMemo(() => {
    if (!allowed) return null
    const groups = db.groups.filter((g) => g.studentIds.includes(sid) && (!staff || scope.groupIds.has(g.id)))
    const mine = db.testAttempts.filter((a) => a.studentId === sid)
    const tests = scope.tests.filter((t) => t.groupIds.some((id) => groups.some((g) => g.id === id)) || mine.some((a) => a.testId === t.id))
    const tIds = new Set(tests.map((t) => t.id))
    const done = mine.filter((a) => tIds.has(a.testId))
    const now = Date.now()
    const rows = tests.map((t) => ({ id: t.id, t, a: done.find((a) => a.testId === t.id), expired: t.dueAt < now, groups: groups.filter((g) => t.groupIds.includes(g.id)) }))
      .sort((x, y) => (y.a?.finishedAt || y.t.dueAt) - (x.a?.finishedAt || x.t.dueAt))
    // Xatolar: topshirilgan testlardagi noto'g'ri va javobsiz savollar (to'g'ri javob ma'lum bo'lsa)
    const mistakes = rows.filter((r) => r.a && r.t.questions.every((q) => q.correct !== undefined))
      .flatMap((r) => reviewOf(r.t, r.a).filter((x) => x.status !== 'right').map((x) => ({ ...x, t: r.t, a: r.a })))
    const totals = { right: 0, wrong: 0, skip: 0 }
    for (const r of rows) if (r.a && r.t.questions.every((q) => q.correct !== undefined)) for (const x of reviewOf(r.t, r.a)) totals[x.status]++
    return { groups, tests, rows, done, mistakes, totals }
  }, [allowed, db.groups, db.testAttempts, scope.tests, scope.groupIds, sid, staff])
  const datasets = useMemo(() => (!data ? [] : [
    testsDataset(data.done, data.tests, 'Dinamika', 'Har bir test natijasi, vaqt tartibida'),
    gradesDataset(data.done),
    { key: 'answers', label: 'Javoblar', sub: 'Barcha topshirilgan testlardagi savollar', defaultType: 'donut', head: ['Javob', 'Savollar'],
      parts: { label: 'Savollarning javob holati bo‘yicha ulushi', value: (r) => r.value },
      center: { value: String(data.totals.right + data.totals.wrong + data.totals.skip), label: 'Savol' },
      rows: data.done.length ? ['right', 'wrong', 'skip'].map((k) => ({ key: k, label: STATUS[k].label, short: k === 'skip' ? 'Javobsiz' : STATUS[k].label, value: data.totals[k], shown: `${data.totals[k]} ta`, color: STATUS[k].color })) : [] },
  ]), [data])

  if (!allowed) return <Card><Empty icon="user" title="O‘quvchi topilmadi" text="O‘quvchi o‘chirilgan yoki sizning guruhingizda emas." action={<Btn as="a" href="#/platform/tests">Testlarga qaytish</Btn>} /></Card>
  const { rows, done, mistakes } = data
  const scores = done.map(pctOf)
  const avg = done.length ? avgOf(done) : null
  const shownMistakes = onlyTest === 'all' ? mistakes : mistakes.filter((m) => m.t.id === onlyTest)
  const mistakeTests = [...new Map(mistakes.map((m) => [m.t.id, m.t])).values()]
  const cur = open && db.testAttempts.find((a) => a.id === open)
  const curTest = cur && db.tests.find((t) => t.id === cur.testId)
  const crumbs = staff
    ? [{ label: 'Testlar', href: '#/platform/tests' }, ...(data.groups[0] ? [{ label: `${data.groups[0].name} statistikasi`, href: `#/platform/tests/group.${data.groups[0].id}` }] : []), { label: s.name }]
    : [{ label: 'Testlar', href: '#/platform/tests' }, { label: 'Mening statistikam' }]

  return (
    <>
      <PageHead crumbs={crumbs} title={staff ? s.name : 'Mening statistikam'} sub={data.groups.map((g) => `${g.name} · ${g.course}`).join(', ') || 'Guruhga biriktirilmagan'}
        actions={!staff && <Btn as="a" href="#/platform/tests" icon="chevLeft">Testlarga qaytish</Btn>} />
      <div className="pgrid pgrid--4">
        <div className="pstat pstat--blue"><span className="pstat__icon"><Icon name="clipboard" size={22} /></span><span className="pstat__body"><span className="pstat__value">{done.length}/{rows.length}</span><span className="pstat__label">Topshirilgan testlar</span></span></div>
        <div className="pstat pstat--green"><span className="pstat__icon"><Icon name="chart" size={22} /></span><span className="pstat__body"><span className="pstat__value">{avg === null ? '—' : `${avg}%`}</span><span className="pstat__label">O‘rtacha natija</span></span></div>
        <div className="pstat pstat--violet"><span className="pstat__icon"><Icon name="trophy" size={22} /></span><span className="pstat__body"><span className="pstat__value">{scores.length ? `${Math.max(...scores)}%` : '—'}</span><span className="pstat__label">Eng yuqori natija</span></span></div>
        <div className="pstat pstat--red"><span className="pstat__icon"><Icon name="alertCircle" size={22} /></span><span className="pstat__body"><span className="pstat__value">{data.totals.wrong + data.totals.skip}</span><span className="pstat__label">Xato va javobsiz savollar</span></span></div>
      </div>

      <ChartPanel title={staff ? 'O‘quvchi natijalari' : 'Natijalarim'} storeKey="student_tests" datasets={datasets} defaultType="line" emptyText="Hali test topshirilmagan." />

      <Card title="Testlar" sub={done.length ? 'Javoblar, izohlar va to‘g‘ri javoblarni ko‘rish uchun testni tanlang' : undefined} pad={false}>
        <Table rows={rows} onRow={(r) => (r.a ? setOpen(r.a.id) : !staff && !r.expired && (window.location.hash = `#/platform/tests/${r.t.id}`))}
          empty={<Empty icon="clipboard" title="Hali test berilmagan" />} cols={[
            { key: 't', label: 'Test', render: (r) => <div className="ptname-cell"><b>{r.t.title}</b><span>{r.t.questions.length} savol · {r.groups.map((g) => g.name).join(', ')}</span></div> },
            { key: 'res', label: 'Natija', render: (r) => (r.a ? <div className="ptres__cell"><div><b>{r.a.score}/{r.a.total}</b>{pill(pctOf(r.a))}</div><Progress size="sm" value={pctOf(r.a)} tone={pctOf(r.a) >= 50 ? 'green' : 'red'} /></div>
              : r.expired ? <Badge tone="red">Topshirilmagan</Badge> : <Badge tone="amber">Kutilmoqda · {fmtLeft(r.t.dueAt)}</Badge>) },
            { key: 'd', label: 'Sana', render: (r) => <span className="ptdate">{r.a ? fmtDateTime(r.a.finishedAt) : `Muddat: ${fmtDateTime(r.t.dueAt)}`}</span> },
            { key: 'fb', label: 'Ustoz izohi', render: (r) => (r.a?.feedback ? <Badge tone="blue"><Icon name="message" size={13} /> Bor</Badge> : <span className="pmuted">—</span>) },
            { key: 'go', label: '', align: 'right', render: (r) => (r.a || (!staff && !r.expired)) && <Icon name="chevRight" size={18} /> },
          ]} />
      </Card>

      <Card title="Xatolar ustida ishlash" sub={mistakes.length ? `${mistakes.length} ta savolda xato yoki javobsiz — to‘g‘ri javob va ustoz izohi bilan` : undefined}
        action={mistakeTests.length > 1 && (
          <label className="pdsel"><span>{onlyTest === 'all' ? 'Barcha testlar' : mistakeTests.find((t) => t.id === onlyTest)?.title}</span><Icon name="chevDown" size={16} />
            <select value={onlyTest} onChange={(e) => setOnlyTest(e.target.value)} aria-label="Test"><option value="all">Barcha testlar</option>{mistakeTests.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}</select>
          </label>
        )}>
        {shownMistakes.length === 0
          ? <Empty icon="award" title={done.length ? 'Xato yo‘q' : 'Hali test topshirilmagan'} text={done.length ? 'Barcha savollarga to‘g‘ri javob berilgan. Ofarin!' : undefined} />
          : (
            <ol className="ptmk">
              {shownMistakes.map((m) => (
                <li key={`${m.a.id}-${m.q.id}`} className={cx('ptmk__item', `is-${m.status}`)}>
                  <header><span className="ptmk__test">{m.t.title} · {m.i + 1}-savol</span><Badge tone={STATUS[m.status].tone}>{STATUS[m.status].label}</Badge></header>
                  <h4>{m.q.text}</h4>
                  <div className="ptmk__ans">
                    {m.status === 'wrong' && <p className="is-bad"><Icon name="x" size={14} stroke={3} /><span>{staff ? 'O‘quvchi javobi' : 'Sizning javobingiz'}: <b>{m.q.options[m.my]}</b></span></p>}
                    <p className="is-ok"><Icon name="check" size={14} stroke={3} /><span>To‘g‘ri javob: <b>{m.q.options[m.q.correct]}</b></span></p>
                  </div>
                  {m.q.explain
                    ? <div className="ptrv__exp is-hot"><span><Icon name="message" size={15} />Izoh</span><p>{m.q.explain}</p></div>
                    : staff && <p className="ptmk__noexp">Bu savolga izoh yozilmagan — test tahririda qo‘shish mumkin.</p>}
                </li>
              ))}
            </ol>
          )}
      </Card>

      <AttemptModal test={curTest} attempt={cur} student={s} onClose={() => setOpen(null)} />
    </>
  )
}

// Bitta topshiruv: natija, ustoz izohi va savollar
function AttemptModal({ test, attempt, student, onClose }) {
  const { user } = useAuth()
  const staff = user.role !== 'student'
  const ready = !!test && !!attempt && test.questions.every((q) => q.correct !== undefined)
  return (
    <Modal open={!!attempt} onClose={onClose} width={860} title={staff ? student?.name : test?.title} sub={staff ? test?.title : 'Test natijasi'}>
      {attempt && test && (ready ? (
        <>
          <ScoreHero test={test} attempt={attempt} staff={staff} />
          <FeedbackBox test={test} attempt={attempt} />
          <StandardAnalysis test={test} attempt={attempt} staff={staff} />
          <QuestionReview test={test} attempt={attempt} who={staff ? 'O‘quvchi javobi' : 'Sizning javobingiz'} />
        </>
      ) : <Empty icon="refresh" title="Javoblar yuklanmoqda" action={<Btn icon="refresh" onClick={() => loadDB().catch(() => {})}>Yangilash</Btn>} />)}
    </Modal>
  )
}

// Ustozning o'quvchiga shaxsiy izohi: ustoz yozadi/tahrirlaydi, o'quvchi o'qiydi
function FeedbackBox({ test, attempt }) {
  const { user, db } = useAuth()
  const toast = useToast()
  const staff = user.role !== 'student'
  const canWrite = staff && (user.role !== 'teacher' || test.authorId === user.id || db.groups.some((g) => g.teacherId === user.id && test.groupIds.includes(g.id)))
  const [edit, setEdit] = useState(false)
  const [v, setV] = useState(attempt.feedback || '')
  const [busy, setBusy] = useState(false)
  useEffect(() => { if (!edit) setV(attempt.feedback || '') }, [attempt.feedback, edit])
  const author = db.users.find((u) => u.id === attempt.feedbackBy)

  const save = async (text) => {
    setBusy(true)
    try {
      await commit([{ col: 'testAttempts', op: 'patch', id: attempt.id, changes: { feedback: text } }])
      if (text && text !== (attempt.feedback || '')) notify([attempt.studentId], `${user.name} «${test.title}» testi bo‘yicha sizga izoh yozdi`, `#/platform/tests/${test.id}`)
      toast(text ? 'Izoh saqlandi — o‘quvchiga bildirishnoma yuborildi' : 'Izoh o‘chirildi')
      setEdit(false)
    } catch (e) { toast(e.message || 'Saqlab bo‘lmadi', 'err') } finally { setBusy(false) }
  }

  if (!staff && !attempt.feedback) return null
  if (edit) {
    return (
      <section className="ptfb is-edit">
        <label className="ptfb__head" htmlFor={`fb-${attempt.id}`}><Icon name="message" size={17} />O‘quvchiga izoh</label>
        <Textarea id={`fb-${attempt.id}`} rows={3} maxLength={2000} value={v} onChange={(e) => setV(e.target.value)} autoFocus
          placeholder="Masalan: 3- va 5-savollardagi mavzuni darslikning 2-bobidan qayta o‘qing…" />
        <div className="ptfb__actions">
          <span className="pmuted">{v.length}/2000</span>
          <Btn onClick={() => { setEdit(false); setV(attempt.feedback || '') }} disabled={busy}>Bekor</Btn>
          <Btn variant="primary" icon="check" onClick={() => save(v.trim())} disabled={busy || !v.trim()}>{busy ? 'Saqlanmoqda…' : 'Saqlash'}</Btn>
        </div>
      </section>
    )
  }
  if (!attempt.feedback) {
    return canWrite ? (
      <button type="button" className="ptfb ptfb--empty" onClick={() => setEdit(true)}>
        <Icon name="message" size={18} /><span><b>O‘quvchiga izoh yozing</b><small>Xatolar ustida maslahat bering — o‘quvchi bildirishnoma oladi</small></span><Icon name="plus" size={18} />
      </button>
    ) : null
  }
  return (
    <section className="ptfb">
      <div className="ptfb__head"><Icon name="message" size={17} />Ustoz izohi{author && <span>· {author.name}{attempt.feedbackAt ? `, ${fmtDateTime(attempt.feedbackAt)}` : ''}</span>}</div>
      <p>{attempt.feedback}</p>
      {canWrite && (
        <div className="ptfb__actions">
          <Btn size="sm" variant="ghost" icon="trash" onClick={() => save('')} disabled={busy}>O‘chirish</Btn>
          <Btn size="sm" icon="edit" onClick={() => setEdit(true)} disabled={busy}>Tahrirlash</Btn>
        </div>
      )}
    </section>
  )
}
