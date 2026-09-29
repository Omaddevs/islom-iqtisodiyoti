import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../store/auth.jsx'
import { add, patch, remove, notify, logActivity } from '../store/db.js'
import { PageHead, Card, Btn, Badge, Tabs, Modal, FField, Input, Textarea, ChipSelect, Empty, Icon, UAvatar, Confirm, Menu, useToast, Table, Progress, cx } from '../ui/kit.jsx'
import { fmtDate, fmtLeft, fmtDateTime, toLocalInput, fromLocalInput, pct, fmtDuration } from '../ui/format.js'
import { uid } from '../store/ids.js'

export default function Tests({ param }) {
  const { user } = useAuth()
  if (param) return user.role === 'student' ? <TakeTest id={param} /> : <TestResults id={param} />
  return <TestList />
}

function TestList() {
  const { user, db, scope, can } = useAuth()
  const toast = useToast()
  const [tab, setTab] = useState('active')
  const [editing, setEditing] = useState(null)
  const [del, setDel] = useState(null)
  const isStaff = user.role !== 'student'
  const attempts = db.testAttempts

  const rows = useMemo(() => scope.tests.map((t) => {
    const my = attempts.find((a) => a.testId === t.id && a.studentId === user.id)
    const groups = db.groups.filter((g) => t.groupIds.includes(g.id))
    const total = new Set(groups.flatMap((g) => g.studentIds)).size
    const done = attempts.filter((a) => a.testId === t.id).length
    const avg = done ? Math.round(attempts.filter((a) => a.testId === t.id).reduce((s, a) => s + pct(a.score, a.total), 0) / done) : 0
    return { t, my, groups, total, done, avg, expired: t.dueAt < Date.now() }
  }).filter((r) => tab === 'active' ? !r.expired && !r.my : tab === 'done' ? !!r.my : r.expired || (isStaff && true)).sort((a, b) => b.t.createdAt - a.t.createdAt), [scope.tests, attempts, tab, user.id, db.groups, isStaff])

  const tabs = isStaff
    ? [{ value: 'active', label: 'Faol', icon: 'clipboard' }, { value: 'all', label: 'Barchasi' }]
    : [{ value: 'active', label: 'Topshirish kerak', icon: 'clipboard', count: scope.tests.filter((t) => t.dueAt > Date.now() && !attempts.some((a) => a.testId === t.id && a.studentId === user.id)).length }, { value: 'done', label: 'Topshirilgan', icon: 'checkCircle' }, { value: 'all', label: 'Muddati o‘tgan' }]

  return (
    <>
      <PageHead icon="clipboard" title="Testlar" sub={isStaff ? 'Testlar yarating, natijalarni kuzating' : 'Bilimingizni tekshiring'}
        actions={isStaff && can('content.create') && <Btn variant="primary" icon="plus" onClick={() => setEditing({})}>Test yaratish</Btn>} />
      <Tabs value={tab} onChange={setTab} items={tabs} />
      {rows.length === 0 ? <Card><Empty icon="clipboard" title="Test yo‘q" text={isStaff ? 'Birinchi testingizni yarating.' : 'Hozircha topshiriladigan test yo‘q.'} /></Card> : (
        <div className="pgrid pgrid--2">
          {rows.map(({ t, my, groups, total, done, avg, expired }) => {
            const a = db.users.find((u) => u.id === t.authorId)
            const mine = t.authorId === user.id || user.role !== 'teacher'
            return (
              <Card key={t.id}>
                <div className="prow prow--between" style={{ alignItems: 'flex-start', flexWrap: 'nowrap' }}>
                  <div className="prow" style={{ flexWrap: 'nowrap', minWidth: 0 }}>
                    <div className="pitem__icon" style={{ background: 'var(--pf-violet-soft)', color: 'var(--pf-violet)' }}><Icon name="clipboard" size={22} /></div>
                    <div style={{ minWidth: 0 }}>
                      <h4 style={{ fontSize: 16, fontWeight: 700 }}>{t.title}</h4>
                      <span className="pmuted" style={{ fontSize: 13 }}>{t.questions.length} savol · {t.timeLimit} daq · {a?.name}</span>
                    </div>
                  </div>
                  {my ? <Badge tone={pct(my.score, my.total) >= 60 ? 'green' : 'red'}>{pct(my.score, my.total)}%</Badge> : expired ? <Badge tone="gray">Muddat tugagan</Badge> : <Badge tone="amber">{fmtLeft(t.dueAt)}</Badge>}
                </div>
                {t.description && <p className="pmuted" style={{ marginTop: 12 }}>{t.description}</p>}
                <div className="prow" style={{ marginTop: 12, gap: 6 }}>{groups.map((g) => <Badge key={g.id} tone="gray">{g.name}</Badge>)}<span className="pmuted" style={{ fontSize: 12.5 }}>Muddat: {fmtDateTime(t.dueAt)}</span></div>
                {isStaff && (
                  <div style={{ marginTop: 14 }}>
                    <div className="prow prow--between" style={{ fontSize: 13, marginBottom: 6 }}><span>Topshirganlar: <b>{done}/{total}</b></span><span>O‘rtacha: <b>{avg}%</b></span></div>
                    <Progress value={pct(done, total)} tone="violet" size="sm" />
                  </div>
                )}
                <div className="prow prow--between" style={{ marginTop: 16 }}>
                  {isStaff ? <Btn size="sm" variant="soft" icon="chart" as="a" href={`#/platform/tests/${t.id}`}>Natijalar</Btn>
                    : my ? <Btn size="sm" variant="soft" icon="eye" as="a" href={`#/platform/tests/${t.id}`}>Natijani ko‘rish</Btn>
                      : expired ? <span className="pmuted" style={{ fontSize: 13 }}>Test yopilgan</span>
                        : <Btn size="sm" variant="primary" icon="play" as="a" href={`#/platform/tests/${t.id}`}>Testni boshlash</Btn>}
                  {isStaff && mine && <Menu items={[{ label: 'Tahrirlash', icon: 'edit', onClick: () => setEditing(t) }, { label: 'O‘chirish', icon: 'trash', danger: true, onClick: () => setDel(t) }]} />}
                </div>
              </Card>
            )
          })}
        </div>
      )}
      <TestForm open={!!editing} test={editing} onClose={() => setEditing(null)} />
      <Confirm open={!!del} onClose={() => setDel(null)} danger title="Testni o‘chirish" text={`«${del?.title}» va uning barcha natijalari o‘chiriladi.`} confirmLabel="O‘chirish"
        onConfirm={() => { remove('tests', del.id); toast('Test o‘chirildi') }} />
    </>
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
  useEffect(() => { if (open) { setErr(''); setF(isNew ? { title: '', description: '', groupIds: scope.groups[0] ? [scope.groups[0].id] : [], timeLimit: 15, dueAt: toLocalInput(Date.now() + 7 * 864e5), questions: [emptyQ(), emptyQ()] } : { ...test, dueAt: toLocalInput(test.dueAt), questions: test.questions.map((q) => ({ ...q, options: [...q.options] })) }) } }, [open, test, isNew, scope.groups])
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
      const t = add('tests', { ...data, orgId: scope.orgId || scope.groups[0]?.orgId, authorId: user.id })
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

  useEffect(() => {
    if (!started || result) return
    setLeft(t.timeLimit * 60)
    const iv = setInterval(() => setLeft((l) => { if (l <= 1) { clearInterval(iv); return 0 } return l - 1 }), 1000)
    return () => clearInterval(iv)
  }, [started, result, t?.timeLimit])
  useEffect(() => { if (started && !result && left === 0 && t) finish(true) }, [left]) // eslint-disable-line

  if (!t) return <Card><Empty icon="clipboard" title="Test topilmadi" action={<Btn as="a" href="#/platform/tests">Orqaga</Btn>} /></Card>

  const finish = (auto = false) => {
    const score = t.questions.reduce((s, q) => s + (answers[q.id] === q.correct ? 1 : 0), 0)
    const att = add('testAttempts', { testId: t.id, studentId: user.id, answers, score, total: t.questions.length, startedAt: Date.now() - (t.timeLimit * 60 - left) * 1000, finishedAt: Date.now() })
    notify([t.authorId], `${user.name} «${t.title}» testini topshirdi: ${score}/${t.questions.length}`, `#/platform/tests/${t.id}`)
    setResult(att)
    toast(auto ? 'Vaqt tugadi, test avtomatik topshirildi' : 'Test topshirildi')
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
  const avg = done.length ? Math.round(done.reduce((s, r) => s + pct(r.a.score, r.a.total), 0) / done.length) : 0
  // Savollar bo'yicha qiyinlik
  const qStats = t.questions.map((q) => ({ q, ok: done.filter((r) => r.a.answers?.[q.id] === q.correct).length }))
  return (
    <>
      <PageHead crumbs={[{ label: 'Testlar', href: '#/platform/tests' }, { label: t.title }]} title={t.title} sub={`${t.questions.length} savol · ${t.timeLimit} daq · muddat ${fmtDateTime(t.dueAt)}`} />
      <div className="pgrid pgrid--4">
        <div className="pstat pstat--blue"><span className="pstat__icon"><Icon name="users" size={22} /></span><span className="pstat__body"><span className="pstat__value">{done.length}/{students.length}</span><span className="pstat__label">Topshirdi</span></span></div>
        <div className="pstat pstat--green"><span className="pstat__icon"><Icon name="award" size={22} /></span><span className="pstat__body"><span className="pstat__value">{avg}%</span><span className="pstat__label">O‘rtacha ball</span></span></div>
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
