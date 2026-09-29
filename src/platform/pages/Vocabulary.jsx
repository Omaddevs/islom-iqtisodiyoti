import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../store/auth.jsx'
import { add, patch, remove, setDB, notify, logActivity } from '../store/db.js'
import { PageHead, Card, Btn, Badge, Tabs, Modal, FField, Input, Textarea, ChipSelect, Empty, Icon, Confirm, Menu, useToast, Progress, cx, Search } from '../ui/kit.jsx'
import { pct } from '../ui/format.js'
import { uid } from '../store/ids.js'

export default function Vocabulary({ param }) {
  if (param) return <VocabSet id={param} />
  return <VocabList />
}

function VocabList() {
  const { user, db, scope, can } = useAuth()
  const toast = useToast()
  const [editing, setEditing] = useState(null)
  const [del, setDel] = useState(null)
  const [q, setQ] = useState('')
  const isStaff = user.role !== 'student'
  const list = scope.vocabSets.filter((v) => v.title.toLowerCase().includes(q.toLowerCase()))
  return (
    <>
      <PageHead icon="translate" title="Lug‘at" sub="Atamalar to‘plamlari, kartochkalar va mashqlar" actions={isStaff && can('content.create') && <Btn variant="primary" icon="plus" onClick={() => setEditing({})}>To‘plam yaratish</Btn>} />
      <Search value={q} onChange={setQ} placeholder="To‘plam nomi…" className="ptop__search" />
      {list.length === 0 ? <Card><Empty icon="translate" title="Lug‘at to‘plami yo‘q" /></Card> : (
        <div className="pgrid pgrid--cards">
          {list.map((v) => {
            const p = db.vocabProgress.find((x) => x.setId === v.id && x.studentId === user.id)
            const n = p?.learned.length || 0
            const groups = db.groups.filter((g) => v.groupIds.includes(g.id))
            const learners = db.vocabProgress.filter((x) => x.setId === v.id).length
            return (
              <Card key={v.id} style={{ cursor: 'pointer' }} onClick={() => (window.location.hash = `#/platform/vocabulary/${v.id}`)}>
                <div className="prow prow--between" style={{ alignItems: 'flex-start' }}>
                  <div className="pitem__icon" style={{ background: 'var(--pf-teal-soft)', color: '#0d9488' }}><Icon name="translate" size={22} /></div>
                  <Badge tone="teal">{v.lang}</Badge>
                </div>
                <h4 style={{ marginTop: 14, fontSize: 17, fontWeight: 700, fontFamily: 'var(--f-head)' }}>{v.title}</h4>
                <p className="pmuted" style={{ marginTop: 4, fontSize: 13.5 }}>{v.terms.length} ta so‘z · {groups.map((g) => g.name).join(', ') || 'Barcha guruhlar'}</p>
                {user.role === 'student' ? (
                  <div style={{ marginTop: 14 }}><div className="prow prow--between" style={{ fontSize: 13, marginBottom: 6 }}><span>O‘rganildi</span><b>{n}/{v.terms.length}</b></div><Progress value={pct(n, v.terms.length)} tone="teal" size="sm" /></div>
                ) : <p className="pmuted" style={{ marginTop: 12, fontSize: 13 }}>{learners} o‘quvchi mashq qilmoqda</p>}
                <div className="prow prow--between" style={{ marginTop: 14 }} onClick={(e) => e.stopPropagation()}>
                  <Btn size="sm" variant="soft" icon="cards" as="a" href={`#/platform/vocabulary/${v.id}`}>{user.role === 'student' ? 'Mashq qilish' : 'Ochish'}</Btn>
                  {isStaff && (v.authorId === user.id || user.role !== 'teacher') && <Menu items={[{ label: 'Tahrirlash', icon: 'edit', onClick: () => setEditing(v) }, { label: 'O‘chirish', icon: 'trash', danger: true, onClick: () => setDel(v) }]} />}
                </div>
              </Card>
            )
          })}
        </div>
      )}
      <VocabForm open={!!editing} set={editing} onClose={() => setEditing(null)} />
      <Confirm open={!!del} onClose={() => setDel(null)} danger title="To‘plamni o‘chirish" text={`«${del?.title}» o‘chiriladi.`} confirmLabel="O‘chirish" onConfirm={() => { remove('vocabSets', del.id); toast('O‘chirildi') }} />
    </>
  )
}

const emptyTerm = () => ({ id: uid('w'), term: '', translation: '', definition: '', example: '' })
export function VocabForm({ open, set: vs, onClose }) {
  const { user, scope } = useAuth()
  const toast = useToast()
  const isNew = !vs?.id
  const [f, setF] = useState({})
  const [err, setErr] = useState('')
  useEffect(() => { if (open) { setErr(''); setF(isNew ? { title: '', lang: 'ar → uz', groupIds: [], terms: [emptyTerm(), emptyTerm(), emptyTerm()] } : { ...vs, terms: vs.terms.map((t) => ({ ...t })) }) } }, [open, vs, isNew])
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }))
  const setT = (i, k, v) => setF((x) => ({ ...x, terms: x.terms.map((t, j) => (j === i ? { ...t, [k]: v } : t)) }))
  const submit = () => {
    if (!f.title?.trim()) return setErr('Nomini kiriting')
    const terms = f.terms.filter((t) => t.term.trim() && t.translation.trim())
    if (!terms.length) return setErr('Kamida bitta so‘z va tarjimasini kiriting')
    const data = { title: f.title.trim(), lang: f.lang?.trim() || '—', groupIds: f.groupIds || [], terms }
    if (isNew) {
      add('vocabSets', { ...data, orgId: scope.orgId || scope.groups[0]?.orgId, authorId: user.id })
      notify([...new Set(scope.groups.filter((g) => !f.groupIds.length || f.groupIds.includes(g.id)).flatMap((g) => g.studentIds))], `Yangi lug‘at to‘plami: «${data.title}»`, '#/platform/vocabulary')
      logActivity(scope.orgId, user.id, 'lug‘at to‘plami qo‘shdi', data.title)
      toast('To‘plam yaratildi')
    } else { patch('vocabSets', vs.id, data); toast('Saqlandi') }
    onClose()
  }
  return (
    <Modal open={open} onClose={onClose} width={760} title={isNew ? 'Lug‘at to‘plami' : 'To‘plamni tahrirlash'}
      footer={<>{err && <span style={{ color: 'var(--pf-red)', fontSize: 13, marginRight: 'auto', alignSelf: 'center' }}>{err}</span>}<Btn onClick={onClose}>Bekor</Btn><Btn variant="primary" onClick={submit}>{isNew ? 'Yaratish' : 'Saqlash'}</Btn></>}>
      <div className="pform">
        <div className="pform__row">
          <FField label="Nomi"><Input value={f.title || ''} onChange={(e) => set('title', e.target.value)} autoFocus /></FField>
          <FField label="Til juftligi"><Input value={f.lang || ''} onChange={(e) => set('lang', e.target.value)} placeholder="ar → uz" /></FField>
        </div>
        <FField label="Guruhlar"><ChipSelect allLabel="Barcha guruhlar" value={f.groupIds || []} onChange={(v) => set('groupIds', v)} options={scope.groups.map((g) => ({ value: g.id, label: g.name, color: g.color }))} /></FField>
        <div className="pfield__label">So‘zlar ({f.terms?.length || 0})</div>
        {(f.terms || []).map((t, i) => (
          <div key={t.id} className="pqb">
            <div className="pform__row">
              <Input value={t.term} onChange={(e) => setT(i, 'term', e.target.value)} placeholder="So‘z / atama" />
              <div className="prow" style={{ flexWrap: 'nowrap' }}><Input value={t.translation} onChange={(e) => setT(i, 'translation', e.target.value)} placeholder="Tarjima" /><Btn size="sm" variant="ghost" icon="trash" onClick={() => set('terms', f.terms.filter((_, j) => j !== i))} aria-label="O‘chirish" /></div>
            </div>
            <div className="pform__row" style={{ marginTop: 8 }}>
              <Input value={t.definition} onChange={(e) => setT(i, 'definition', e.target.value)} placeholder="Ta’rif (ixtiyoriy)" style={{ height: 40 }} />
              <Input value={t.example} onChange={(e) => setT(i, 'example', e.target.value)} placeholder="Misol jumla (ixtiyoriy)" style={{ height: 40 }} />
            </div>
          </div>
        ))}
        <Btn icon="plus" onClick={() => set('terms', [...f.terms, emptyTerm()])}>So‘z qo‘shish</Btn>
      </div>
    </Modal>
  )
}

// ---- To'plam: ro'yxat, kartochkalar, viktorina ----
function VocabSet({ id }) {
  const { user, db } = useAuth()
  const toast = useToast()
  const v = db.vocabSets.find((x) => x.id === id)
  const [mode, setMode] = useState('list')
  const [editing, setEditing] = useState(false)
  const prog = db.vocabProgress.find((x) => x.setId === id && x.studentId === user.id)
  const learned = useMemo(() => new Set(prog?.learned || []), [prog])
  if (!v) return <Card><Empty icon="translate" title="To‘plam topilmadi" action={<Btn as="a" href="#/platform/vocabulary">Orqaga</Btn>} /></Card>

  const toggleLearned = (tid) => {
    if (user.role !== 'student') return
    setDB((s) => {
      const p = s.vocabProgress.find((x) => x.setId === id && x.studentId === user.id)
      if (!p) return { ...s, vocabProgress: [...s.vocabProgress, { id: uid('vp'), setId: id, studentId: user.id, learned: [tid] }] }
      const l = p.learned.includes(tid) ? p.learned.filter((x) => x !== tid) : [...p.learned, tid]
      return { ...s, vocabProgress: s.vocabProgress.map((x) => (x.id === p.id ? { ...x, learned: l } : x)) }
    })
  }
  const isStaff = user.role !== 'student'
  return (
    <>
      <PageHead crumbs={[{ label: 'Lug‘at', href: '#/platform/vocabulary' }, { label: v.title }]} title={v.title} sub={`${v.terms.length} ta so‘z · ${v.lang}${user.role === 'student' ? ` · ${learned.size} ta o‘rganildi` : ''}`}
        actions={isStaff && (v.authorId === user.id || user.role !== 'teacher') && <Btn icon="edit" onClick={() => setEditing(true)}>Tahrirlash</Btn>} />
      <Tabs value={mode} onChange={setMode} items={[{ value: 'list', label: 'Ro‘yxat', icon: 'list' }, { value: 'cards', label: 'Kartochkalar', icon: 'cards' }, { value: 'quiz', label: 'Viktorina', icon: 'zap' }]} />
      {user.role === 'student' && <Progress value={pct(learned.size, v.terms.length)} tone="teal" />}
      {mode === 'list' && (
        <Card>
          {v.terms.map((t) => (
            <div key={t.id} className="pterm">
              <div><b dir="auto">{t.term}</b>{t.example && <small dir="auto">{t.example}</small>}</div>
              <div><span>{t.translation}</span>{t.definition && <small>{t.definition}</small>}</div>
              {user.role === 'student' ? <Btn size="sm" variant={learned.has(t.id) ? 'success' : 'default'} icon={learned.has(t.id) ? 'check' : 'plus'} onClick={() => toggleLearned(t.id)}>{learned.has(t.id) ? 'O‘rganildi' : 'Belgilash'}</Btn> : <span />}
            </div>
          ))}
        </Card>
      )}
      {mode === 'cards' && <Flashcards terms={v.terms} learned={learned} onLearn={toggleLearned} isStudent={user.role === 'student'} />}
      {mode === 'quiz' && <Quiz terms={v.terms} onDone={(ok, total) => toast(`Natija: ${ok}/${total}`)} />}
      <VocabForm open={editing} set={v} onClose={() => setEditing(false)} />
    </>
  )
}

function Flashcards({ terms, learned, onLearn, isStudent }) {
  const [i, setI] = useState(0)
  const [flip, setFlip] = useState(false)
  const [onlyNew, setOnlyNew] = useState(false)
  const list = onlyNew ? terms.filter((t) => !learned.has(t.id)) : terms
  const t = list[i % Math.max(1, list.length)]
  const go = (d) => { setFlip(false); setTimeout(() => setI((x) => (x + d + list.length) % list.length), 120) }
  useEffect(() => {
    const k = (e) => { if (e.key === ' ') { e.preventDefault(); setFlip((f) => !f) } if (e.key === 'ArrowRight') go(1); if (e.key === 'ArrowLeft') go(-1) }
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k)
  }) // eslint-disable-line
  if (!list.length) return <Card><Empty icon="checkCircle" title="Barcha so‘zlar o‘rganilgan" action={<Btn onClick={() => setOnlyNew(false)}>Hammasini ko‘rsatish</Btn>} /></Card>
  return (
    <div style={{ maxWidth: 640, margin: '0 auto', width: '100%' }}>
      <div className="prow prow--between" style={{ marginBottom: 14 }}>
        <span className="pmuted">{(i % list.length) + 1} / {list.length}</span>
        {isStudent && <label className="prow" style={{ fontSize: 13.5, cursor: 'pointer' }}><input type="checkbox" checked={onlyNew} onChange={(e) => { setOnlyNew(e.target.checked); setI(0) }} /> Faqat o‘rganilmaganlar</label>}
      </div>
      <div className={cx('pflash', flip && 'is-flipped')} onClick={() => setFlip((f) => !f)}>
        <div className="pflash__in">
          <div className="pflash__face"><span className="pflash__hint">So‘z</span><div className="pflash__term" dir="auto">{t.term}</div><span className="pflash__hint">Ag‘darish uchun bosing</span></div>
          <div className="pflash__face pflash__face--back"><span className="pflash__hint" style={{ color: 'rgba(255,255,255,.5)' }}>Tarjima</span><div className="pflash__term">{t.translation}</div>{t.definition && <div className="pflash__def">{t.definition}</div>}{t.example && <div className="pflash__ex" dir="auto">“{t.example}”</div>}</div>
        </div>
      </div>
      <div className="prow" style={{ justifyContent: 'center', marginTop: 18, gap: 10 }}>
        <Btn icon="chevLeft" onClick={() => go(-1)}>Oldingi</Btn>
        {isStudent && <Btn variant={learned.has(t.id) ? 'success' : 'primary'} icon="check" onClick={() => onLearn(t.id)}>{learned.has(t.id) ? 'O‘rganilgan' : 'Bildim'}</Btn>}
        <Btn onClick={() => go(1)}>Keyingi <Icon name="chevRight" size={16} /></Btn>
      </div>
      <p className="pmuted" style={{ textAlign: 'center', marginTop: 12, fontSize: 12.5 }}>Klaviatura: Probel — ag‘darish, ← → — o‘tish</p>
    </div>
  )
}

function Quiz({ terms, onDone }) {
  const [qs] = useState(() => {
    const shuffled = [...terms].sort(() => Math.random() - .5).slice(0, Math.min(10, terms.length))
    return shuffled.map((t) => {
      const others = terms.filter((x) => x.id !== t.id).sort(() => Math.random() - .5).slice(0, 3).map((x) => x.translation)
      const options = [...others, t.translation].sort(() => Math.random() - .5)
      return { t, options, correct: options.indexOf(t.translation) }
    })
  })
  const [i, setI] = useState(0)
  const [picked, setPicked] = useState(null)
  const [ok, setOk] = useState(0)
  const [done, setDone] = useState(false)
  if (terms.length < 2) return <Card><Empty icon="zap" title="Viktorina uchun kamida 2 ta so‘z kerak" /></Card>
  if (done) return (
    <Card style={{ maxWidth: 520, margin: '0 auto', textAlign: 'center' }}>
      <div className="pscore" style={{ '--v': pct(ok, qs.length) }}><span>{pct(ok, qs.length)}%</span></div>
      <h3 style={{ marginTop: 16, fontFamily: 'var(--f-head)', fontSize: 20 }}>{ok} / {qs.length} to‘g‘ri</h3>
      <div style={{ marginTop: 16 }}><Btn variant="primary" icon="refresh" onClick={() => window.location.reload()}>Qayta boshlash</Btn></div>
    </Card>
  )
  const q = qs[i]
  const pick = (oi) => {
    if (picked !== null) return
    setPicked(oi); if (oi === q.correct) setOk((o) => o + 1)
    setTimeout(() => { if (i + 1 >= qs.length) { setDone(true); onDone(ok + (oi === q.correct ? 1 : 0), qs.length) } else { setI(i + 1); setPicked(null) } }, 900)
  }
  return (
    <div style={{ maxWidth: 640, margin: '0 auto', width: '100%' }}>
      <div className="prow prow--between" style={{ marginBottom: 12 }}><span className="pmuted">{i + 1} / {qs.length}</span><Badge tone="green">{ok} to‘g‘ri</Badge></div>
      <Progress value={pct(i, qs.length)} tone="teal" size="sm" />
      <div className="pquiz__q" style={{ marginTop: 16 }}>
        <span className="pflash__hint">Tarjimasini tanlang</span>
        <h3 style={{ fontSize: 30, fontFamily: 'var(--f-head)', marginTop: 6 }} dir="auto">{q.t.term}</h3>
        {q.options.map((o, oi) => (
          <div key={oi} className={cx('pquiz__opt', picked !== null && oi === q.correct && 'is-right', picked === oi && oi !== q.correct && 'is-wrong')} onClick={() => pick(oi)}><i>{String.fromCharCode(65 + oi)}</i>{o}</div>
        ))}
      </div>
    </div>
  )
}
