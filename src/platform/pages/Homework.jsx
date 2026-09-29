import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../store/auth.jsx'
import { add, patch, remove, notify, logActivity } from '../store/db.js'
import { PageHead, Card, Btn, Badge, Tabs, Modal, FField, Input, Textarea, Select, Empty, Icon, UAvatar, Confirm, Menu, useToast, Progress, cx } from '../ui/kit.jsx'
import { fmtDateTime, fmtLeft, fmtAgo, toLocalInput, fromLocalInput, pct } from '../ui/format.js'

export default function Homework({ param }) {
  if (param) return <HomeworkDetail id={param} />
  return <HomeworkList />
}

function HomeworkList() {
  const { user, db, scope, can } = useAuth()
  const toast = useToast()
  const [tab, setTab] = useState('active')
  const [editing, setEditing] = useState(null)
  const [del, setDel] = useState(null)
  const isStaff = user.role !== 'student'

  const rows = useMemo(() => scope.homework.map((h) => {
    const g = db.groups.find((x) => x.id === h.groupId)
    const subs = db.submissions.filter((s) => s.homeworkId === h.id)
    const my = subs.find((s) => s.studentId === user.id)
    return { h, g, subs, my, total: g?.studentIds.length || 0, graded: subs.filter((s) => s.status === 'graded').length, pending: subs.filter((s) => s.status === 'submitted').length, expired: h.dueAt < Date.now() }
  }).filter((r) => {
    if (isStaff) return tab === 'active' ? !r.expired || r.pending > 0 : true
    return tab === 'active' ? !r.my && !r.expired : tab === 'done' ? !!r.my : r.expired && !r.my
  }).sort((a, b) => a.h.dueAt - b.h.dueAt), [scope.homework, db.groups, db.submissions, tab, user.id, isStaff])

  const tabs = isStaff
    ? [{ value: 'active', label: 'Faol', icon: 'fileText', count: scope.homework.filter((h) => h.dueAt > Date.now()).length }, { value: 'all', label: 'Barchasi' }]
    : [{ value: 'active', label: 'Bajarish kerak', icon: 'fileText' }, { value: 'done', label: 'Topshirilgan', icon: 'checkCircle' }, { value: 'late', label: 'Muddati o‘tgan' }]

  return (
    <>
      <PageHead icon="fileText" title="Uy vazifalari" sub={isStaff ? 'Topshiriqlar bering, javoblarni baholang' : 'Topshiriqlar va baholar'} actions={isStaff && can('content.create') && <Btn variant="primary" icon="plus" onClick={() => setEditing({})}>Vazifa berish</Btn>} />
      <Tabs value={tab} onChange={setTab} items={tabs} />
      {rows.length === 0 ? <Card><Empty icon="fileText" title="Vazifa yo‘q" text={isStaff ? 'Guruhga yangi vazifa bering.' : 'Barcha vazifalar bajarilgan.'} /></Card> : (
        <div className="pgrid pgrid--2">
          {rows.map(({ h, g, my, total, graded, pending, expired, subs }) => (
            <article key={h.id} className="phw">
              <div className="phw__icon"><Icon name="fileText" size={22} /></div>
              <div className="phw__body">
                <div className="prow prow--between" style={{ alignItems: 'flex-start', flexWrap: 'nowrap' }}>
                  <h4>{h.title}</h4>
                  {my ? (my.status === 'graded' ? <Badge tone="green">Baho: {my.grade}/{h.maxGrade}</Badge> : <Badge tone="blue">Tekshirilmoqda</Badge>) : expired ? <Badge tone="gray">Muddat tugagan</Badge> : <Badge tone={h.dueAt - Date.now() < 864e5 ? 'red' : 'amber'}>{fmtLeft(h.dueAt)}</Badge>}
                </div>
                <p>{h.description}</p>
                <div className="phw__meta"><span><Icon name="layers" size={14} /> {g?.name}</span><span><Icon name="calendar" size={14} /> {fmtDateTime(h.dueAt)}</span><span><Icon name="award" size={14} /> maks. {h.maxGrade} ball</span></div>
                {isStaff && (
                  <div style={{ marginTop: 12 }}>
                    <div className="prow prow--between" style={{ fontSize: 13, marginBottom: 6 }}><span>Topshirdi: <b>{subs.length}/{total}</b></span><span>{pending > 0 ? <b style={{ color: '#d97706' }}>{pending} ta baholanmagan</b> : `${graded} ta baholangan`}</span></div>
                    <Progress value={pct(subs.length, total)} tone="amber" size="sm" />
                  </div>
                )}
                <div className="prow prow--between" style={{ marginTop: 14 }}>
                  <Btn size="sm" variant={isStaff && pending ? 'primary' : 'soft'} icon={isStaff ? 'eye' : my ? 'eye' : 'send'} as="a" href={`#/platform/homework/${h.id}`}>{isStaff ? (pending ? 'Baholash' : 'Ko‘rish') : my ? 'Javobimni ko‘rish' : 'Topshirish'}</Btn>
                  {isStaff && (h.authorId === user.id || user.role !== 'teacher') && <Menu items={[{ label: 'Tahrirlash', icon: 'edit', onClick: () => setEditing(h) }, { label: 'O‘chirish', icon: 'trash', danger: true, onClick: () => setDel(h) }]} />}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
      <HomeworkForm open={!!editing} hw={editing} onClose={() => setEditing(null)} />
      <Confirm open={!!del} onClose={() => setDel(null)} danger title="Vazifani o‘chirish" text={`«${del?.title}» va barcha javoblar o‘chiriladi.`} confirmLabel="O‘chirish" onConfirm={() => { remove('homework', del.id); toast('O‘chirildi') }} />
    </>
  )
}

export function HomeworkForm({ open, hw, onClose, defaultGroupId }) {
  const { user, db, scope } = useAuth()
  const toast = useToast()
  const isNew = !hw?.id
  const [f, setF] = useState({})
  const [err, setErr] = useState({})
  useEffect(() => { if (open) { setErr({}); setF(isNew ? { title: '', description: '', groupId: defaultGroupId || scope.groups[0]?.id || '', dueAt: toLocalInput(Date.now() + 3 * 864e5), maxGrade: 100 } : { ...hw, dueAt: toLocalInput(hw.dueAt) }) } }, [open, hw, isNew, defaultGroupId, scope.groups])
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }))
  const submit = () => {
    const er = {}
    if (!f.title?.trim()) er.title = 'Nomini kiriting'
    if (!f.groupId) er.groupId = 'Guruhni tanlang'
    if (!fromLocalInput(f.dueAt)) er.dueAt = 'Muddatni kiriting'
    setErr(er); if (Object.keys(er).length) return
    const g = db.groups.find((x) => x.id === f.groupId)
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
                <div className="prow prow--between" style={{ marginTop: 12 }}><span className="pmuted" style={{ fontSize: 12.5 }}>Fayl biriktirish backend ulanganda qo‘shiladi</span><Btn variant="primary" icon="send" onClick={submit}>Yuborish</Btn></div>
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
