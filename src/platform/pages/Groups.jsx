import { useEffect, useState } from 'react'
import { useAuth } from '../store/auth.jsx'
import { add, patch, remove, setDB, notify, logActivity } from '../store/db.js'
import { PageHead, Card, Btn, Badge, Tabs, Modal, FField, Input, Select, Empty, Icon, UAvatar, AvatarStack, Confirm, Menu, useToast, Table, Credentials, Stat, Search, cx } from '../ui/kit.jsx'
import { DAYS_FULL, fmtWhen, fmtDate, pct } from '../ui/format.js'
import { UserForm } from './Users.jsx'
import { MeetingForm, hashQuery } from './Meetings.jsx'
import { HomeworkForm } from './Homework.jsx'

const COLORS = ['#4aa3f8', '#8b5cf6', '#14b8a6', '#f59e0b', '#10b981', '#f43f5e', '#0ea5e9', '#6366f1']

export default function Groups({ param }) {
  if (param) return <GroupDetail id={param} />
  return <GroupList />
}

function GroupList() {
  const { user, db, scope, can } = useAuth()
  const toast = useToast()
  const [q, setQ] = useState('')
  const [editing, setEditing] = useState(null)
  const [del, setDel] = useState(null)
  useEffect(() => { if (hashQuery().get('new') && can('groups.manage')) setEditing({}) }, [can])
  const list = scope.groups.filter((g) => (g.name + g.course).toLowerCase().includes(q.toLowerCase()))
  return (
    <>
      <PageHead icon="layers" title="Guruhlar" sub={`${scope.groups.length} ta guruh`} actions={can('groups.manage') && <Btn variant="primary" icon="plus" onClick={() => setEditing({})}>Guruh yaratish</Btn>} />
      <Search value={q} onChange={setQ} placeholder="Guruh yoki kurs…" className="ptop__search" />
      {list.length === 0 ? <Card><Empty icon="layers" title="Guruh yo‘q" text="Guruh yarating, ustoz biriktiring va o‘quvchilarni qo‘shing." action={can('groups.manage') && <Btn variant="primary" onClick={() => setEditing({})}>Guruh yaratish</Btn>} /></Card> : (
        <div className="pgrid pgrid--cards">
          {list.map((g) => {
            const t = db.users.find((u) => u.id === g.teacherId)
            const students = g.studentIds.map((id) => db.users.find((u) => u.id === id)).filter(Boolean)
            const next = db.meetings.filter((m) => m.groupId === g.id && m.status !== 'ended').sort((a, b) => a.startsAt - b.startsAt)[0]
            return (
              <article key={g.id} className="pgroup" style={{ '--gc': g.color }} onClick={() => (window.location.hash = `#/platform/groups/${g.id}`)}>
                <div className="pgroup__head">
                  <div><h4>{g.name}</h4><span>{g.course} · {g.level}</span></div>
                  {can('groups.manage') && <span onClick={(e) => e.stopPropagation()}><Menu items={[{ label: 'Tahrirlash', icon: 'edit', onClick: () => setEditing(g) }, { label: 'O‘chirish', icon: 'trash', danger: true, onClick: () => setDel(g) }]} /></span>}
                </div>
                <div className="pgroup__stats">
                  <div><b>{students.length}</b><span>o‘quvchi</span></div>
                  <div><b>{db.meetings.filter((m) => m.groupId === g.id && m.status === 'ended').length}</b><span>dars o‘tildi</span></div>
                  <div><b>{db.homework.filter((h) => h.groupId === g.id).length}</b><span>vazifa</span></div>
                </div>
                <p className="pmuted" style={{ fontSize: 13 }}>{g.schedule.map((s) => `${DAYS_FULL[s.day].slice(0, 3)} ${s.time}`).join(' · ') || 'Jadval belgilanmagan'}{next && <><br /><Icon name="video" size={13} /> {next.status === 'live' ? 'Hozir jonli' : fmtWhen(next.startsAt)}</>}</p>
                <div className="pgroup__foot">
                  <div className="pgroup__teacher">{t ? <><UAvatar user={t} size={28} />{t.name}</> : <Badge tone="amber">Ustoz yo‘q</Badge>}</div>
                  <AvatarStack users={students} max={3} size={26} />
                </div>
              </article>
            )
          })}
        </div>
      )}
      <GroupForm open={!!editing} group={editing} onClose={() => setEditing(null)} />
      <Confirm open={!!del} onClose={() => setDel(null)} danger title="Guruhni o‘chirish" text={`${del?.name} guruhi o‘chiriladi. O‘quvchilar hisoblari saqlanib qoladi.`} confirmLabel="O‘chirish" onConfirm={() => { remove('groups', del.id); toast('Guruh o‘chirildi') }} />
    </>
  )
}

export function GroupForm({ open, group, onClose }) {
  const { user, db, scope } = useAuth()
  const toast = useToast()
  const isNew = !group?.id
  const [f, setF] = useState({})
  const [err, setErr] = useState({})
  useEffect(() => { if (open) { setErr({}); setF(isNew ? { name: '', course: '', level: 'Boshlang‘ich', teacherId: user.role === 'teacher' ? user.id : '', room: 'Onlayn', color: COLORS[db.groups.length % COLORS.length], schedule: [{ day: 1, time: '19:00' }, { day: 3, time: '19:00' }] } : { ...group, schedule: group.schedule.map((s) => ({ ...s })) }) } }, [open, group, isNew, user, db.groups.length])
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }))
  const setS = (i, k, v) => setF((x) => ({ ...x, schedule: x.schedule.map((s, j) => (j === i ? { ...s, [k]: v } : s)) }))
  const teachers = db.users.filter((u) => u.role === 'teacher' && u.orgId === (scope.orgId || user.orgId))
  const submit = () => {
    const er = {}
    if (!f.name?.trim()) er.name = 'Guruh nomini kiriting'
    if (!f.course?.trim()) er.course = 'Kurs nomini kiriting'
    setErr(er); if (Object.keys(er).length) return
    const data = { name: f.name.trim(), course: f.course.trim(), level: f.level, teacherId: f.teacherId || null, room: f.room?.trim(), color: f.color, schedule: f.schedule.filter((s) => s.time) }
    if (isNew) {
      const orgId = scope.orgId || user.orgId
      const g = add('groups', { ...data, orgId, studentIds: [] })
      if (g.teacherId && g.teacherId !== user.id) notify([g.teacherId], `Siz ${g.name} guruhiga ustoz etib biriktirildingiz`, `#/platform/groups/${g.id}`)
      logActivity(orgId, user.id, 'guruh yaratdi', g.name)
      toast('Guruh yaratildi'); onClose(); window.location.hash = `#/platform/groups/${g.id}`
    } else { patch('groups', group.id, data); toast('Saqlandi'); onClose() }
  }
  return (
    <Modal open={open} onClose={onClose} title={isNew ? 'Guruh yaratish' : 'Guruhni tahrirlash'} footer={<><Btn onClick={onClose}>Bekor</Btn><Btn variant="primary" onClick={submit}>{isNew ? 'Yaratish' : 'Saqlash'}</Btn></>}>
      <div className="pform">
        <div className="pform__row">
          <FField label="Guruh nomi" error={err.name}><Input value={f.name || ''} onChange={(e) => set('name', e.target.value)} placeholder="IM-102" autoFocus /></FField>
          <FField label="Daraja"><Select value={f.level} onChange={(v) => set('level', v)} options={['Boshlang‘ich', 'O‘rta', 'Yuqori'].map((l) => ({ value: l, label: l }))} /></FField>
        </div>
        <FField label="Kurs" error={err.course}><Input value={f.course || ''} onChange={(e) => set('course', e.target.value)} placeholder="Islom moliyasi asoslari" /></FField>
        <div className="pform__row">
          <FField label="Ustoz">{user.role === 'teacher' ? <Input value={user.name} disabled /> : <Select value={f.teacherId} onChange={(v) => set('teacherId', v)} placeholder="Keyinroq biriktirish" options={teachers.map((t) => ({ value: t.id, label: t.name }))} />}</FField>
          <FField label="Xona / format"><Input value={f.room || ''} onChange={(e) => set('room', e.target.value)} placeholder="Onlayn" /></FField>
        </div>
        <FField label="Rang"><div className="pswatches">{COLORS.map((c) => <button key={c} type="button" className={cx(f.color === c && 'is-on')} style={{ background: c }} onClick={() => set('color', c)} aria-label={c} />)}</div></FField>
        <FField label="Dars jadvali">
          {(f.schedule || []).map((s, i) => (
            <div key={i} className="prow" style={{ flexWrap: 'nowrap', marginBottom: 8 }}>
              <Select value={String(s.day)} onChange={(v) => setS(i, 'day', Number(v))} options={DAYS_FULL.map((d, di) => ({ value: String(di), label: d }))} />
              <Input type="time" value={s.time} onChange={(e) => setS(i, 'time', e.target.value)} style={{ width: 130 }} />
              <Btn icon="trash" variant="ghost" onClick={() => set('schedule', f.schedule.filter((_, j) => j !== i))} aria-label="O‘chirish" />
            </div>
          ))}
          <Btn size="sm" icon="plus" onClick={() => set('schedule', [...(f.schedule || []), { day: 1, time: '18:00' }])}>Kun qo‘shish</Btn>
        </FField>
      </div>
    </Modal>
  )
}

function GroupDetail({ id }) {
  const { user, db, scope, can } = useAuth()
  const toast = useToast()
  const g = db.groups.find((x) => x.id === id)
  const [tab, setTab] = useState('students')
  const [addOpen, setAddOpen] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [meetOpen, setMeetOpen] = useState(false)
  const [hwOpen, setHwOpen] = useState(false)
  const [creds, setCreds] = useState(null)
  const [rm, setRm] = useState(null)
  const [pick, setPick] = useState([])
  if (!g) return <Card><Empty icon="layers" title="Guruh topilmadi" action={<Btn as="a" href="#/platform/groups">Orqaga</Btn>} /></Card>
  const t = db.users.find((u) => u.id === g.teacherId)
  const students = g.studentIds.map((sid) => db.users.find((u) => u.id === sid)).filter(Boolean)
  const canEdit = can('groups.manage') || (user.role === 'teacher' && g.teacherId === user.id)
  const meetings = db.meetings.filter((m) => m.groupId === g.id).sort((a, b) => b.startsAt - a.startsAt)
  const homework = db.homework.filter((h) => h.groupId === g.id)
  const tests = db.tests.filter((x) => x.groupIds.includes(g.id))
  const videos = db.videos.filter((v) => v.groupIds.includes(g.id))
  const available = db.users.filter((u) => u.role === 'student' && u.orgId === g.orgId && !g.studentIds.includes(u.id))

  const addPicked = () => { setDB((s) => ({ ...s, groups: s.groups.map((x) => (x.id === g.id ? { ...x, studentIds: [...x.studentIds, ...pick] } : x)) })); notify(pick, `Siz ${g.name} (${g.course}) guruhiga qo‘shildingiz`, '#/platform'); toast(`${pick.length} o‘quvchi qo‘shildi`); setPick([]); setAddOpen(false) }
  const removeStudent = (s) => { patch('groups', g.id, (x) => ({ studentIds: x.studentIds.filter((i) => i !== s.id) })); toast('O‘quvchi guruhdan chiqarildi') }

  // O'quvchi statistikasi
  const stat = (s) => {
    const hw = homework.length ? pct(db.submissions.filter((x) => x.studentId === s.id && homework.some((h) => h.id === x.homeworkId)).length, homework.length) : null
    const at = db.testAttempts.filter((a) => a.studentId === s.id && tests.some((x) => x.id === a.testId))
    const avg = at.length ? Math.round(at.reduce((sum, a) => sum + pct(a.score, a.total), 0) / at.length) : null
    return { hw, avg }
  }

  return (
    <>
      <PageHead crumbs={[{ label: 'Guruhlar', href: '#/platform/groups' }, { label: g.name }]} title={`${g.name} — ${g.course}`} sub={`${g.level} · ${g.room} · ${g.schedule.map((s) => `${DAYS_FULL[s.day].slice(0, 3)} ${s.time}`).join(', ')}`}
        actions={canEdit && <>
          <Btn variant="primary" icon="video" onClick={() => setMeetOpen(true)}>Dars rejalashtirish</Btn>
          <Btn icon="fileText" onClick={() => setHwOpen(true)}>Vazifa berish</Btn>
          {can('groups.manage') && <Btn icon="edit" onClick={() => setEditOpen(true)}>Tahrirlash</Btn>}
        </>} />
      <div className="pgrid pgrid--4">
        <Stat icon="users" label="O‘quvchilar" value={students.length} tone="blue" />
        <Stat icon="video" label="Darslar" value={meetings.length} hint={`${meetings.filter((m) => m.status === 'ended').length} ta o‘tildi`} tone="violet" />
        <Stat icon="fileText" label="Vazifalar" value={homework.length} tone="amber" />
        <Stat icon="clipboard" label="Testlar" value={tests.length} tone="teal" />
      </div>
      <div className="pgrid pgrid--main">
        <div className="pstack-v" style={{ gap: 20 }}>
          <Tabs value={tab} onChange={setTab} items={[{ value: 'students', label: 'O‘quvchilar', icon: 'users', count: students.length }, { value: 'meetings', label: 'Darslar', icon: 'video', count: meetings.length }, { value: 'content', label: 'Materiallar', icon: 'layers' }]} />
          {tab === 'students' && (
            <Card pad={false} title="O‘quvchilar" action={canEdit && <><Btn size="sm" icon="userPlus" onClick={() => setAddOpen(true)}>Mavjudini qo‘shish</Btn><Btn size="sm" variant="primary" icon="plus" onClick={() => setCreateOpen(true)}>Yangi o‘quvchi</Btn></>}>
              <Table rows={students} empty={<Empty icon="users" title="Guruhda o‘quvchi yo‘q" action={canEdit && <Btn variant="primary" onClick={() => setCreateOpen(true)}>O‘quvchi qo‘shish</Btn>} />} cols={[
                { key: 'name', label: 'O‘quvchi', render: (s) => <div className="pcell-user"><UAvatar user={s} size={36} /><div><b>{s.name}</b><span className="mono">{s.phone}</span></div></div> },
                { key: 'hw', label: 'Vazifalar', render: (s) => { const { hw } = stat(s); return hw == null ? '—' : <div style={{ minWidth: 100 }}><span style={{ fontSize: 12.5 }}>{hw}%</span><Progress2 v={hw} /></div> } },
                { key: 'avg', label: 'Test o‘rtachasi', render: (s) => { const { avg } = stat(s); return avg == null ? <span className="pmuted">—</span> : <Badge tone={avg >= 60 ? 'green' : 'red'}>{avg}%</Badge> } },
                { key: 'st', label: 'Holat', render: (s) => s.status === 'blocked' ? <Badge tone="red">Bloklangan</Badge> : <Badge tone="green" dot>Faol</Badge> },
                { key: 'a', label: '', align: 'right', render: (s) => canEdit && <Menu items={[{ label: 'Kirish ma’lumotlari', icon: 'key', onClick: () => setCreds(s) }, { label: 'Guruhdan chiqarish', icon: 'minus', danger: true, onClick: () => setRm(s) }]} /> },
              ]} />
            </Card>
          )}
          {tab === 'meetings' && (
            <Card title="Darslar">
              {meetings.length === 0 && <Empty icon="video" title="Dars yo‘q" />}
              {meetings.map((m) => (
                <div key={m.id} className="pitem">
                  <div className="pitem__icon" style={m.status === 'live' ? { background: '#fff1f0', color: '#d92d20' } : undefined}><Icon name="video" size={20} /></div>
                  <div className="pitem__body"><b>{m.title}</b><span>{fmtWhen(m.startsAt)} · {m.durationMin} daq{m.topic ? ` · ${m.topic}` : ''}</span></div>
                  <div className="pitem__side">
                    {m.status === 'live' ? <Badge tone="live" dot>Jonli</Badge> : m.status === 'ended' ? <Badge tone="gray">O‘tildi</Badge> : <Badge tone="blue">Reja</Badge>}
                    {m.status !== 'ended' ? <Btn size="sm" variant="soft" as="a" href={`#/platform/meetings/${m.id}/room`}>Xona</Btn> : m.recordingId && <Btn size="sm" variant="soft" icon="play" as="a" href={`#/platform/videos/${m.recordingId}`}>Yozuv</Btn>}
                  </div>
                </div>
              ))}
            </Card>
          )}
          {tab === 'content' && (
            <div className="pgrid pgrid--2">
              <Card title="Uy vazifalari" action={<Btn size="sm" variant="ghost" as="a" href="#/platform/homework">Barchasi</Btn>}>
                {homework.length === 0 && <Empty icon="fileText" title="Vazifa yo‘q" />}
                {homework.map((h) => <a key={h.id} href={`#/platform/homework/${h.id}`} className="pitem"><div className="pitem__icon" style={{ background: 'var(--pf-amber-soft)', color: '#d97706' }}><Icon name="fileText" size={18} /></div><div className="pitem__body"><b>{h.title}</b><span>Muddat: {fmtDate(h.dueAt)} · {db.submissions.filter((s) => s.homeworkId === h.id).length}/{students.length} topshirdi</span></div></a>)}
              </Card>
              <Card title="Testlar" action={<Btn size="sm" variant="ghost" as="a" href="#/platform/tests">Barchasi</Btn>}>
                {tests.length === 0 && <Empty icon="clipboard" title="Test yo‘q" />}
                {tests.map((x) => <a key={x.id} href={`#/platform/tests/${x.id}`} className="pitem"><div className="pitem__icon" style={{ background: 'var(--pf-violet-soft)', color: 'var(--pf-violet)' }}><Icon name="clipboard" size={18} /></div><div className="pitem__body"><b>{x.title}</b><span>{x.questions.length} savol · {db.testAttempts.filter((a) => a.testId === x.id).length} topshirdi</span></div></a>)}
              </Card>
              <Card title="Video darslar" action={<Btn size="sm" variant="ghost" as="a" href="#/platform/videos">Barchasi</Btn>}>
                {videos.length === 0 && <Empty icon="play" title="Video yo‘q" />}
                {videos.map((v) => <a key={v.id} href={`#/platform/videos/${v.id}`} className="pitem"><div className="pitem__icon" style={{ background: v.thumb, color: '#fff' }}><Icon name="play" size={18} /></div><div className="pitem__body"><b>{v.title}</b><span>{v.module} · {Math.round(v.duration / 60)} daq</span></div></a>)}
              </Card>
              <Card title="Lug‘at" action={<Btn size="sm" variant="ghost" as="a" href="#/platform/vocabulary">Barchasi</Btn>}>
                {db.vocabSets.filter((v) => v.groupIds.includes(g.id)).map((v) => <a key={v.id} href={`#/platform/vocabulary/${v.id}`} className="pitem"><div className="pitem__icon" style={{ background: 'var(--pf-teal-soft)', color: '#0d9488' }}><Icon name="translate" size={18} /></div><div className="pitem__body"><b>{v.title}</b><span>{v.terms.length} so‘z</span></div></a>)}
                {db.vocabSets.filter((v) => v.groupIds.includes(g.id)).length === 0 && <Empty icon="translate" title="To‘plam yo‘q" />}
              </Card>
            </div>
          )}
        </div>
        <div className="pstack-v" style={{ gap: 20 }}>
          <Card title="Ustoz">
            {t ? <div className="pcell-user"><UAvatar user={t} size={48} /><div><b style={{ fontSize: 15 }}>{t.name}</b><span>{t.title}</span><span className="mono">{t.phone}</span></div></div> : <Empty icon="user" title="Ustoz biriktirilmagan" action={can('groups.manage') && <Btn size="sm" onClick={() => setEditOpen(true)}>Biriktirish</Btn>} />}
          </Card>
          <Card title="Dars jadvali">
            {g.schedule.length === 0 && <p className="pmuted">Belgilanmagan</p>}
            {g.schedule.map((s, i) => <div key={i} className="pitem" style={{ padding: '10px 0' }}><div className="pitem__icon" style={{ width: 38, height: 38, borderRadius: 11 }}><Icon name="calendar" size={17} /></div><div className="pitem__body"><b style={{ fontSize: 14 }}>{DAYS_FULL[s.day]}</b><span>{s.time} · {g.room}</span></div></div>)}
          </Card>
        </div>
      </div>

      <Modal open={addOpen} onClose={() => { setAddOpen(false); setPick([]) }} title="Mavjud o‘quvchilarni qo‘shish" sub={`${available.length} ta o‘quvchi guruhda emas`} footer={<><Btn onClick={() => setAddOpen(false)}>Bekor</Btn><Btn variant="primary" disabled={!pick.length} onClick={addPicked}>Qo‘shish ({pick.length})</Btn></>}>
        {available.length === 0 ? <Empty icon="users" title="Qo‘shish uchun o‘quvchi yo‘q" action={<Btn variant="primary" onClick={() => { setAddOpen(false); setCreateOpen(true) }}>Yangi o‘quvchi yaratish</Btn>} /> : available.map((s) => (
          <label key={s.id} className="pitem" style={{ cursor: 'pointer', padding: '10px 0' }}>
            <input type="checkbox" checked={pick.includes(s.id)} onChange={(e) => setPick((p) => (e.target.checked ? [...p, s.id] : p.filter((x) => x !== s.id)))} />
            <UAvatar user={s} size={32} /><div className="pitem__body"><b style={{ fontSize: 14 }}>{s.name}</b><span>{db.groups.filter((x) => x.studentIds.includes(s.id)).map((x) => x.name).join(', ') || 'Guruhsiz'}</span></div>
          </label>
        ))}
      </Modal>
      <UserForm open={createOpen} role="student" defaultGroupId={g.id} onClose={() => setCreateOpen(false)} onCreated={(u) => setCreds(u)} />
      <Modal open={!!creds} onClose={() => setCreds(null)} title="Kirish ma’lumotlari" width={480} footer={<Btn variant="primary" onClick={() => setCreds(null)}>Tayyor</Btn>}><Credentials user={creds} /></Modal>
      <GroupForm open={editOpen} group={g} onClose={() => setEditOpen(false)} />
      <MeetingForm open={meetOpen} meeting={{}} defaultGroupId={g.id} onClose={() => setMeetOpen(false)} />
      <HomeworkForm open={hwOpen} hw={{}} defaultGroupId={g.id} onClose={() => setHwOpen(false)} />
      <Confirm open={!!rm} onClose={() => setRm(null)} danger title="Guruhdan chiqarish" text={`${rm?.name} guruhdan chiqariladi. Hisobi saqlanib qoladi.`} confirmLabel="Chiqarish" onConfirm={() => removeStudent(rm)} />
    </>
  )
}

const Progress2 = ({ v }) => <span className="pprog pprog--sm pprog--amber" style={{ marginTop: 3 }}><span className="pprog__bar" style={{ width: `${v}%` }} /></span>
