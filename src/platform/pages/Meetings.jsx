import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../store/auth.jsx'
import { add, patch, remove, notify, logActivity } from '../store/db.js'
import { PageHead, Card, Btn, Badge, Tabs, Modal, FField, Input, Textarea, Select, Empty, Icon, Confirm, Menu, useToast, Search, cx } from '../ui/kit.jsx'
import { fmtTime, fmtDateTime, fmtDateShort, isToday, isTomorrow, DAYS, MONTHS, toLocalInput, fromLocalInput } from '../ui/format.js'

export const hashQuery = () => new URLSearchParams(window.location.hash.split('?')[1] || '')

export default function Meetings() {
  const { user, db, scope, can } = useAuth()
  const toast = useToast()
  const [tab, setTab] = useState('upcoming')
  const [q, setQ] = useState('')
  const [editing, setEditing] = useState(null) // null | {} (yangi) | meeting
  const [del, setDel] = useState(null)
  const isStaff = user.role !== 'student'

  useEffect(() => { if (hashQuery().get('new') && isStaff) setEditing({}) }, [isStaff])

  const list = useMemo(() => {
    const now = Date.now()
    let l = scope.meetings.filter((m) => m.title.toLowerCase().includes(q.toLowerCase()))
    if (tab === 'upcoming') l = l.filter((m) => m.status === 'live' || (m.status === 'scheduled' && m.startsAt > now - 3 * 3600e3)).sort((a, b) => (a.status === 'live' ? -1 : b.status === 'live' ? 1 : a.startsAt - b.startsAt))
    if (tab === 'past') l = l.filter((m) => m.status === 'ended' || (m.status === 'scheduled' && m.startsAt <= now - 3 * 3600e3)).sort((a, b) => b.startsAt - a.startsAt)
    if (tab === 'mine') l = l.filter((m) => m.hostId === user.id).sort((a, b) => b.startsAt - a.startsAt)
    return l
  }, [scope.meetings, tab, q, user.id])

  const live = scope.meetings.filter((m) => m.status === 'live').length

  const start = (m) => { patch('meetings', m.id, { status: 'live', startedAt: Date.now() }); notifyGroup(m, `«${m.title}» darsi boshlandi. Qo‘shiling!`); toast('Dars boshlandi'); window.location.hash = `#/platform/meetings/${m.id}/room` }
  const end = (m) => {
    // Tugagan dars avtomatik "yozuv" sifatida video darslarga qo'shiladi
    const rec = add('videos', { orgId: m.orgId, groupIds: [m.groupId], authorId: m.hostId, title: m.title, module: m.topic || 'Dars yozuvi', duration: m.durationMin * 60, thumb: db.groups.find((g) => g.id === m.groupId)?.color || '#4aa3f8', description: m.description || '', views: 0, kind: 'recording' })
    patch('meetings', m.id, { status: 'ended', endedAt: Date.now(), recordingId: rec.id })
    toast('Dars yakunlandi, yozuv video darslarga qo‘shildi')
  }
  const notifyGroup = (m, text) => {
    const g = db.groups.find((x) => x.id === m.groupId)
    if (g) notify(g.studentIds, text, `#/platform/meetings/${m.id}/room`)
  }

  return (
    <>
      <PageHead icon="video" title="Onlayn darslar" sub="Jonli darslar, uchrashuvlar va yozuvlar"
        actions={isStaff && can('content.create') && <Btn variant="primary" icon="plus" onClick={() => setEditing({})}>Dars rejalashtirish</Btn>} />
      <div className={cx('pstatus', live && 'is-live')}><i />{live ? `Hozir ${live} ta jonli dars ketmoqda` : 'Hozir jonli dars yo‘q'}</div>
      <div className="prow prow--between">
        <Tabs value={tab} onChange={setTab} items={[
          { value: 'upcoming', label: 'Yaqin darslar', icon: 'video', count: scope.meetings.filter((m) => m.status !== 'ended' && m.startsAt > Date.now() - 3 * 3600e3).length },
          { value: 'past', label: 'O‘tgan darslar', icon: 'clock' },
          ...(isStaff ? [{ value: 'mine', label: 'Men o‘tkazadigan', icon: 'user' }] : []),
        ]} />
        <Search value={q} onChange={setQ} placeholder="Dars nomi…" />
      </div>

      {list.length === 0 ? (
        <Card><Empty icon="video" title={tab === 'past' ? 'O‘tgan darslar yo‘q' : 'Rejalashtirilgan dars yo‘q'} text={isStaff ? 'Yangi dars rejalashtiring — o‘quvchilarga bildirishnoma boradi.' : 'Ustozingiz dars rejalashtirganda shu yerda ko‘rinadi.'}
          action={isStaff && <Btn variant="primary" onClick={() => setEditing({})}>Dars rejalashtirish</Btn>} /></Card>
      ) : (
        <div className="pgrid pgrid--2">
          {list.map((m) => <MeetingCard key={m.id} m={m} onStart={start} onEnd={end} onEdit={() => setEditing(m)} onDelete={() => setDel(m)} />)}
        </div>
      )}

      <MeetingForm open={!!editing} meeting={editing} onClose={() => setEditing(null)} />
      <Confirm open={!!del} onClose={() => setDel(null)} danger title="Darsni o‘chirish" text={`«${del?.title}» darsi o‘chiriladi. Bu amalni qaytarib bo‘lmaydi.`} confirmLabel="O‘chirish"
        onConfirm={() => { remove('meetings', del.id); toast('Dars o‘chirildi') }} />
    </>
  )
}

function MeetingCard({ m, onStart, onEnd, onEdit, onDelete }) {
  const { user, db } = useAuth()
  const g = db.groups.find((x) => x.id === m.groupId)
  const host = db.users.find((u) => u.id === m.hostId)
  const d = new Date(m.startsAt)
  const isHost = m.hostId === user.id
  const canManage = isHost || user.role === 'org_admin' || user.role === 'superadmin'
  const badge = m.status === 'live' ? <Badge tone="live"><Icon name="radio" size={14} /> Jonli</Badge>
    : m.status === 'ended' ? <Badge tone="gray">Yakunlangan</Badge>
      : isToday(m.startsAt) ? <Badge tone="amber">Bugun</Badge>
        : isTomorrow(m.startsAt) ? <Badge tone="blue">Ertaga</Badge>
          : <Badge tone="blue">{fmtDateShort(m.startsAt)}</Badge>
  return (
    <article className={cx('pmeet', m.status === 'live' && 'is-live', m.status === 'ended' && 'is-ended')}>
      <div className="pmeet__date"><b>{d.getDate()}</b><span>{MONTHS[d.getMonth()]} ·</span><span>{DAYS[d.getDay()]}</span></div>
      <div className="pmeet__body">
        <div className="pmeet__top">
          <h4>{m.title}</h4>
          {badge}
        </div>
        <div className="pmeet__meta">
          <span><Icon name="clock" size={15} /> {fmtTime(m.startsAt)}</span>
          <i className="pmeet__sep" />
          <span><Icon name="timer" size={15} /> {m.durationMin} daq</span>
          <span><Icon name="layers" size={15} /> {g?.name}</span>
          <span><Icon name="user" size={15} /> {host?.name}</span>
        </div>
        {m.description && <p className="pmeet__desc">{m.description}</p>}
        <div className="pmeet__foot">
          <div className="prow" style={{ gap: 12 }}>
            {m.topic && <span className="pmeet__topic">{m.topic}</span>}
            <span className="pmeet__n"><Icon name="users" size={15} /> {g?.studentIds.length ?? 0} ishtirokchi</span>
          </div>
          <div className="prow" style={{ gap: 8, flexWrap: 'nowrap' }}>
            {m.status === 'live' && <Btn variant="live" icon="video" as="a" href={`#/platform/meetings/${m.id}/room`}>Qo‘shilish</Btn>}
            {m.status === 'scheduled' && isHost && <Btn variant="primary" icon="play" onClick={() => onStart(m)}>Boshlash</Btn>}
            {m.status === 'scheduled' && !isHost && <Btn variant="soft" icon="video" as="a" href={`#/platform/meetings/${m.id}/room`}>Xonaga kirish</Btn>}
            {m.status === 'ended' && m.recordingId && <Btn variant="soft" icon="play" as="a" href={`#/platform/videos/${m.recordingId}`}>Yozuvni ko‘rish</Btn>}
            {canManage && m.status !== 'ended' && (
              <Menu trigger={<Btn icon="moreV" aria-label="Amallar" />} items={[
                m.status === 'live' && { label: 'Darsni yakunlash', icon: 'checkCircle', onClick: () => onEnd(m) },
                { label: 'Tahrirlash', icon: 'edit', onClick: onEdit },
                'sep',
                { label: 'O‘chirish', icon: 'trash', danger: true, onClick: onDelete },
              ]} />
            )}
          </div>
        </div>
      </div>
    </article>
  )
}

// Dars yaratish / tahrirlash formasi
export function MeetingForm({ open, meeting, onClose, defaultGroupId }) {
  const { user, db, scope } = useAuth()
  const toast = useToast()
  const isNew = !meeting?.id
  const [f, setF] = useState({})
  const [err, setErr] = useState({})
  useEffect(() => {
    if (!open) return
    setErr({})
    setF(isNew
      ? { title: '', topic: '', groupId: defaultGroupId || scope.groups[0]?.id || '', startsAt: toLocalInput(Date.now() + 3600e3), durationMin: 60, description: '' }
      : { ...meeting, startsAt: toLocalInput(meeting.startsAt) })
  }, [open, meeting, isNew, defaultGroupId, scope.groups])
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }))

  const submit = (e) => {
    e.preventDefault()
    const er = {}
    if (!f.title?.trim()) er.title = 'Dars nomini kiriting'
    if (!f.groupId) er.groupId = 'Guruhni tanlang'
    const ts = fromLocalInput(f.startsAt)
    if (!ts) er.startsAt = 'Sana va vaqtni kiriting'
    if (!(f.durationMin > 0)) er.durationMin = 'Davomiylik noto‘g‘ri'
    setErr(er)
    if (Object.keys(er).length) return
    const g = db.groups.find((x) => x.id === f.groupId)
    const data = { title: f.title.trim(), topic: f.topic?.trim(), groupId: f.groupId, startsAt: ts, durationMin: Number(f.durationMin), description: f.description?.trim() }
    if (isNew) {
      const m = add('meetings', { ...data, orgId: g.orgId, hostId: user.role === 'teacher' ? user.id : g.teacherId || user.id, status: 'scheduled' })
      notify([...g.studentIds, g.teacherId].filter((id) => id && id !== user.id), `Yangi dars: «${m.title}» — ${fmtDateTime(ts)}`, '#/platform/meetings')
      logActivity(g.orgId, user.id, 'dars rejalashtirdi', m.title)
      toast('Dars rejalashtirildi, o‘quvchilarga xabar yuborildi')
    } else {
      patch('meetings', meeting.id, data)
      toast('Dars yangilandi')
    }
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title={isNew ? 'Dars rejalashtirish' : 'Darsni tahrirlash'} sub="Guruhdagi barcha o‘quvchilarga bildirishnoma yuboriladi"
      footer={<><Btn onClick={onClose}>Bekor qilish</Btn><Btn variant="primary" onClick={submit}>{isNew ? 'Rejalashtirish' : 'Saqlash'}</Btn></>}>
      <form className="pform" onSubmit={submit}>
        <FField label="Dars nomi" error={err.title}><Input value={f.title || ''} onChange={(e) => set('title', e.target.value)} placeholder="Masalan: Riba va uning turlari" autoFocus /></FField>
        <div className="pform__row">
          <FField label="Guruh" error={err.groupId}><Select value={f.groupId} onChange={(v) => set('groupId', v)} options={scope.groups.map((g) => ({ value: g.id, label: `${g.name} — ${g.course}` }))} placeholder="Guruhni tanlang" /></FField>
          <FField label="Mavzu / dars raqami"><Input value={f.topic || ''} onChange={(e) => set('topic', e.target.value)} placeholder="4-dars" /></FField>
        </div>
        <div className="pform__row">
          <FField label="Sana va vaqt" error={err.startsAt}><Input type="datetime-local" value={f.startsAt || ''} onChange={(e) => set('startsAt', e.target.value)} /></FField>
          <FField label="Davomiylik (daqiqa)" error={err.durationMin}><Input type="number" min="10" step="5" value={f.durationMin || ''} onChange={(e) => set('durationMin', e.target.value)} /></FField>
        </div>
        <FField label="Tavsif"><Textarea value={f.description || ''} onChange={(e) => set('description', e.target.value)} placeholder="Darsda nimalar o‘tiladi…" /></FField>
      </form>
    </Modal>
  )
}
