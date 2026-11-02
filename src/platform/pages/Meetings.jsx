import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../store/auth.jsx'
import { notify, logActivity, getDB } from '../store/db.js'
import { PageHead, Card, Btn, Badge, Tabs, Modal, FField, Input, Textarea, Select, Empty, Icon, Confirm, Menu, useToast, Search, cx } from '../ui/kit.jsx'
import { fmtTime, fmtDateTime, fmtDateShort, isToday, isTomorrow, DAYS, MONTHS, toLocalInput, fromLocalInput } from '../ui/format.js'
import { meetingsApi, syncMeetings, useServerStatus, joinLink, recordingUrl } from '../api/meetings.js'
import InviteModal, { copyText } from '../../meet/Invite.jsx'

export const hashQuery = () => new URLSearchParams(window.location.hash.split('?')[1] || '')
const joinHref = (m) => `#/join/${m.code}`

export default function Meetings() {
  const { user, scope, can, logout } = useAuth()
  const toast = useToast()
  const server = useServerStatus()
  const [tab, setTab] = useState('upcoming')
  const [q, setQ] = useState('')
  const [editing, setEditing] = useState(null) // null | {} (yangi) | meeting
  const [del, setDel] = useState(null)
  const [invite, setInvite] = useState(null)
  const [player, setPlayer] = useState(null)
  const [attendance, setAttendance] = useState(null)
  const isStaff = user.role !== 'student'
  const canCreate = isStaff && can('content.create') && server !== 'auth' && server !== 'offline'

  useEffect(() => { if (hashQuery().get('new') && isStaff) setEditing({}) }, [isStaff])
  useEffect(() => { syncMeetings().catch(() => {}) }, [])

  const list = useMemo(() => {
    const now = Date.now()
    let l = scope.meetings.filter((m) => m.code && m.title.toLowerCase().includes(q.toLowerCase()))
    if (tab === 'upcoming') l = l.filter((m) => m.status === 'live' || (m.status === 'scheduled' && m.startsAt > now - 3 * 3600e3)).sort((a, b) => (a.status === 'live' ? -1 : b.status === 'live' ? 1 : a.startsAt - b.startsAt))
    if (tab === 'past') l = l.filter((m) => m.status === 'ended' || (m.status === 'scheduled' && m.startsAt <= now - 3 * 3600e3)).sort((a, b) => b.startsAt - a.startsAt)
    if (tab === 'mine') l = l.filter((m) => m.hostId === user.id).sort((a, b) => b.startsAt - a.startsAt)
    return l
  }, [scope.meetings, tab, q, user.id])

  const live = scope.meetings.filter((m) => m.status === 'live').length

  const start = async (m) => {
    try {
      await meetingsApi.start(m.id)
      notifyGroup(m, `«${m.title}» darsi boshlandi. Qo‘shiling!`)
      window.location.hash = joinHref(m)
    } catch (e) { toast(e.message, 'err') }
  }
  const end = async (m) => {
    try { await meetingsApi.end(m.id); await syncMeetings(); toast('Dars yakunlandi') } catch (e) { toast(e.message, 'err') }
  }
  const removeMeeting = async (m) => {
    try { await meetingsApi.remove(m.id); await syncMeetings(); toast('Dars o‘chirildi') } catch (e) { toast(e.message, 'err') }
  }
  const copyLink = async (m) => { if (await copyText(joinLink(m.code))) toast('Havola nusxalandi') }
  const notifyGroup = (m, text) => {
    const g = getDB().groups.find((x) => x.id === m.groupId)
    if (g) notify(g.studentIds, text, joinHref(m))
  }

  const relogin = () => { logout(); window.location.hash = `#/kirish?next=${encodeURIComponent('/platform/meetings')}` }

  return (
    <>
      <PageHead icon="video" title="Onlayn darslar" sub="Jonli darslar, uchrashuvlar va yozuvlar"
        actions={canCreate && <Btn variant="primary" icon="plus" onClick={() => setEditing({})}>Dars rejalashtirish</Btn>} />

      {server === 'auth' && (
        <div className="msrv msrv--warn">
          <Icon name="key" size={20} />
          <div><b>Server sessiyasi topilmadi</b><span>Jonli darslar serverda ishlaydi. Davom etish uchun tizimga qayta kiring.</span></div>
          <Btn variant="primary" icon="logIn" onClick={relogin}>Qayta kirish</Btn>
        </div>
      )}
      {server === 'offline' && (
        <div className="msrv msrv--err">
          <Icon name="wifi" size={20} />
          <div><b>Server bilan aloqa yo‘q</b><span>Internet yoki backend holatini tekshiring. Ro‘yxat avtomatik yangilanadi.</span></div>
          <Btn icon="refresh" onClick={() => syncMeetings().catch(() => {})}>Qayta urinish</Btn>
        </div>
      )}

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
        <Card><Empty icon="video" title={tab === 'past' ? 'O‘tgan darslar yo‘q' : 'Rejalashtirilgan dars yo‘q'} text={isStaff ? 'Yangi dars rejalashtiring — o‘quvchilarga bildirishnoma boradi, mehmonlarni esa havola orqali taklif qilasiz.' : 'Ustozingiz dars rejalashtirganda shu yerda ko‘rinadi.'}
          action={canCreate && <Btn variant="primary" onClick={() => setEditing({})}>Dars rejalashtirish</Btn>} /></Card>
      ) : (
        <div className="pgrid pgrid--2">
          {list.map((m) => (
            <MeetingCard key={m.id} m={m} onStart={start} onEnd={end} onEdit={() => setEditing(m)} onDelete={() => setDel(m)}
              onInvite={() => setInvite(m)} onCopy={() => copyLink(m)} onPlay={() => setPlayer(m)} onAttendance={() => setAttendance(m)} />
          ))}
        </div>
      )}

      <MeetingForm open={!!editing} meeting={editing} onClose={() => setEditing(null)} onCreated={(m) => setInvite(m)} />
      <InviteModal open={!!invite} onClose={() => setInvite(null)} meeting={invite} />
      <RecordingModal meeting={player} onClose={() => setPlayer(null)} />
      <AttendanceModal meeting={attendance} onClose={() => setAttendance(null)} />
      <Confirm open={!!del} onClose={() => setDel(null)} danger title="Darsni o‘chirish" text={`«${del?.title}» darsi, uning chati va yozuvlari o‘chiriladi. Bu amalni qaytarib bo‘lmaydi.`} confirmLabel="O‘chirish"
        onConfirm={() => removeMeeting(del)} />
    </>
  )
}

function MeetingCard({ m, onStart, onEnd, onEdit, onDelete, onInvite, onCopy, onPlay, onAttendance }) {
  const { user, db } = useAuth()
  const g = db.groups.find((x) => x.id === m.groupId)
  const d = new Date(m.startsAt)
  const canManage = m.canManage
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
          <span><Icon name="layers" size={15} /> {m.groupName || g?.name}</span>
          <span><Icon name="user" size={15} /> {m.hostName}</span>
        </div>
        {m.description && <p className="pmeet__desc">{m.description}</p>}
        <div className="pmeet__flags">
          {m.hasPasscode && <span title="Mehmonlar uchun parol"><Icon name="key" size={13} /> Parol</span>}
          {m.allowGuests ? <span><Icon name="globe" size={13} /> Mehmonlar mumkin</span> : <span><Icon name="lock" size={13} /> Faqat a’zolar</span>}
          {m.waitingRoom && <span><Icon name="shield" size={13} /> Kutish zali</span>}
          {m.status !== 'ended' && <button type="button" className="pmeet__code" onClick={onCopy} title="Havolani nusxalash"><Icon name="link" size={13} /> {m.code}</button>}
        </div>
        <div className="pmeet__foot">
          <div className="prow" style={{ gap: 12 }}>
            {m.topic && <span className="pmeet__topic">{m.topic}</span>}
            <span className="pmeet__n"><Icon name="users" size={15} /> {m.status === 'live' && m.online ? `${m.online} kishi xonada` : `${m.invitedCount ?? g?.studentIds.length ?? 0} ishtirokchi`}</span>
          </div>
          <div className="prow" style={{ gap: 8, flexWrap: 'nowrap' }}>
            {m.status === 'live' && <Btn variant="live" icon="video" as="a" href={joinHref(m)}>Qo‘shilish</Btn>}
            {m.status === 'scheduled' && canManage && <Btn variant="primary" icon="play" onClick={() => onStart(m)}>Boshlash</Btn>}
            {m.status === 'scheduled' && !canManage && <Btn variant="soft" icon="video" as="a" href={joinHref(m)}>Xonaga kirish</Btn>}
            {m.status === 'ended' && m.serverRecordingId && <Btn variant="soft" icon="play" onClick={onPlay}>Yozuvni ko‘rish</Btn>}
            {m.status === 'ended' && !m.serverRecordingId && m.recordingId && <Btn variant="soft" icon="play" as="a" href={`#/platform/videos/${m.recordingId}`}>Yozuvni ko‘rish</Btn>}
            {m.status !== 'ended' && !canManage && <Btn icon="link" onClick={onCopy} aria-label="Havolani nusxalash" title="Havolani nusxalash" />}
            {canManage && (
              <Menu trigger={<Btn icon="moreV" aria-label="Amallar" />} items={[
                m.status !== 'ended' && { label: 'Taklif qilish', icon: 'userPlus', onClick: onInvite },
                m.status !== 'ended' && { label: 'Havolani nusxalash', icon: 'link', onClick: onCopy },
                m.status !== 'scheduled' && { label: 'Davomat', icon: 'clipboard', onClick: onAttendance },
                m.status === 'live' && { label: 'Darsni yakunlash', icon: 'checkCircle', onClick: () => onEnd(m) },
                m.status !== 'ended' && { label: 'Tahrirlash', icon: 'edit', onClick: onEdit },
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

// Tasodifiy, o'qilishi oson parol: 6 belgi, chalkash harflarsiz
const genPasscode = () => Array.from({ length: 6 }, () => 'abcdefghjkmnpqrstuvwxyz23456789'[Math.floor(Math.random() * 30)]).join('')

function Switch({ checked, onChange, label, hint }) {
  return (
    <label className="msw">
      <span className="msw__txt"><b>{label}</b>{hint && <small>{hint}</small>}</span>
      <input type="checkbox" checked={!!checked} onChange={(e) => onChange(e.target.checked)} />
      <i aria-hidden="true" />
    </label>
  )
}

// Dars yaratish / tahrirlash formasi (Guruhlar sahifasida ham ishlatiladi)
export function MeetingForm({ open, meeting, onClose, defaultGroupId, onCreated }) {
  const { user, db, scope } = useAuth()
  const toast = useToast()
  const isNew = !meeting?.id
  const [f, setF] = useState({})
  const [err, setErr] = useState({})
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    if (!open) return
    setErr({})
    setBusy(false)
    setF(isNew
      ? { title: '', topic: '', groupId: defaultGroupId || scope.groups[0]?.id || '', startsAt: toLocalInput(Date.now() + 3600e3), durationMin: 60, description: '', usePass: false, passcode: genPasscode(), allowGuests: true, waitingRoom: true, muteOnEntry: false }
      : { ...meeting, startsAt: toLocalInput(meeting.startsAt), usePass: meeting.hasPasscode, passcode: meeting.passcode || genPasscode() })
  }, [open, meeting, isNew, defaultGroupId, scope.groups])
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }))

  const submit = async (e) => {
    e.preventDefault()
    const er = {}
    if (!f.title?.trim()) er.title = 'Dars nomini kiriting'
    if (!f.groupId) er.groupId = 'Guruhni tanlang'
    const ts = fromLocalInput(f.startsAt)
    if (!ts) er.startsAt = 'Sana va vaqtni kiriting'
    if (!(f.durationMin >= 5)) er.durationMin = 'Kamida 5 daqiqa'
    if (f.usePass && !/^[\p{L}\p{N}_-]{3,20}$/u.test(f.passcode || '')) er.passcode = '3–20 ta harf yoki raqam'
    setErr(er)
    if (Object.keys(er).length) return
    const data = {
      title: f.title.trim(), topic: f.topic?.trim() || null, groupId: f.groupId, startsAt: ts, durationMin: Number(f.durationMin), description: f.description?.trim() || null,
      passcode: f.usePass ? f.passcode.trim() : null, allowGuests: !!f.allowGuests, waitingRoom: !!f.waitingRoom, muteOnEntry: !!f.muteOnEntry,
    }
    setBusy(true)
    try {
      if (isNew) {
        const { meeting: m } = await meetingsApi.create(data)
        const g = db.groups.find((x) => x.id === f.groupId)
        if (g) notify([...g.studentIds, g.teacherId].filter((id) => id && id !== user.id), `Yangi dars: «${m.title}» — ${fmtDateTime(ts)}`, joinHref(m))
        logActivity(m.orgId, user.id, 'dars rejalashtirdi', m.title)
        await syncMeetings().catch(() => {})
        toast('Dars rejalashtirildi — endi havolani ulashing')
        onClose()
        onCreated?.(m)
      } else {
        await meetingsApi.update(meeting.id, data)
        await syncMeetings().catch(() => {})
        toast('Dars yangilandi')
        onClose()
      }
    } catch (ex) {
      setBusy(false)
      if (ex.data?.field) setErr({ [ex.data.field]: ex.message })
      else toast(ex.message, 'err')
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={isNew ? 'Dars rejalashtirish' : 'Darsni tahrirlash'} sub="Guruhdagi barcha o‘quvchilarga bildirishnoma yuboriladi" width={600}
      footer={<><Btn onClick={onClose}>Bekor qilish</Btn><Btn variant="primary" onClick={submit} disabled={busy}>{busy ? 'Saqlanmoqda…' : isNew ? 'Rejalashtirish' : 'Saqlash'}</Btn></>}>
      <form className="pform" onSubmit={submit}>
        <FField label="Dars nomi" error={err.title}><Input value={f.title || ''} onChange={(e) => set('title', e.target.value)} placeholder="Masalan: Riba va uning turlari" autoFocus maxLength={160} /></FField>
        <div className="pform__row">
          <FField label="Guruh" error={err.groupId}><Select value={f.groupId} onChange={(v) => set('groupId', v)} options={scope.groups.map((g) => ({ value: g.id, label: `${g.name} — ${g.course}` }))} placeholder="Guruhni tanlang" /></FField>
          <FField label="Mavzu / dars raqami"><Input value={f.topic || ''} onChange={(e) => set('topic', e.target.value)} placeholder="4-dars" maxLength={80} /></FField>
        </div>
        <div className="pform__row">
          <FField label="Sana va vaqt" error={err.startsAt}><Input type="datetime-local" value={f.startsAt || ''} onChange={(e) => set('startsAt', e.target.value)} /></FField>
          <FField label="Davomiylik (daqiqa)" error={err.durationMin}><Input type="number" min="5" max="600" step="5" value={f.durationMin || ''} onChange={(e) => set('durationMin', e.target.value)} /></FField>
        </div>
        <FField label="Tavsif"><Textarea value={f.description || ''} onChange={(e) => set('description', e.target.value)} placeholder="Darsda nimalar o‘tiladi…" maxLength={2000} /></FField>

        <div className="mform__sec">
          <h4><Icon name="shield" size={16} /> Kirish va xavfsizlik</h4>
          <Switch checked={f.allowGuests} onChange={(v) => set('allowGuests', v)} label="Havola orqali mehmonlar" hint="Akkauntsiz odamlar ismini yozib qo‘shila oladi" />
          <Switch checked={f.waitingRoom} onChange={(v) => set('waitingRoom', v)} label="Kutish zali" hint="Guruhdan tashqaridagilar sizning ruxsatingiz bilan kiradi" />
          <Switch checked={f.usePass} onChange={(v) => set('usePass', v)} label="Parol" hint="Guruh a’zolaridan boshqalar parol kiritadi" />
          {f.usePass && (
            <FField error={err.passcode}>
              <div className="mform__pass">
                <Input value={f.passcode || ''} onChange={(e) => set('passcode', e.target.value)} maxLength={20} className="pinput mono" />
                <Btn type="button" icon="refresh" onClick={() => set('passcode', genPasscode())} aria-label="Yangi parol" title="Yangi parol" />
              </div>
            </FField>
          )}
          <Switch checked={f.muteOnEntry} onChange={(v) => set('muteOnEntry', v)} label="Kirishda mikrofonni o‘chirish" hint="Katta guruhlarda shovqinni kamaytiradi" />
        </div>
      </form>
    </Modal>
  )
}

// Server yozuvini ko'rish
function RecordingModal({ meeting, onClose }) {
  const id = meeting?.serverRecordingId
  return (
    <Modal open={!!meeting} onClose={onClose} title={meeting?.title || ''} sub={meeting && `${fmtDateTime(meeting.startsAt)} · ${meeting.hostName}`} width={860}
      footer={id && <Btn as="a" href={recordingUrl(id, true)} icon="download">Yuklab olish</Btn>}>
      {id && <video className="mrec" src={recordingUrl(id)} controls autoPlay preload="metadata" />}
    </Modal>
  )
}

function AttendanceModal({ meeting, onClose }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  useEffect(() => {
    if (!meeting) return
    setData(null); setError(null)
    meetingsApi.attendance(meeting.id).then(setData).catch((e) => setError(e.message))
  }, [meeting])
  const dur = (s) => (s < 60 ? `${s} son` : `${Math.round(s / 60)} daq`)
  return (
    <Modal open={!!meeting} onClose={onClose} title="Davomat" sub={meeting?.title} width={560}>
      {error && <p className="pmuted">{error}</p>}
      {!data && !error && <p className="pmuted">Yuklanmoqda…</p>}
      {data && (
        <div className="mt-att">
          <h4>Qatnashganlar · {data.present.length}</h4>
          {data.present.length === 0 && <p className="pmuted">Hali hech kim qatnashmagan</p>}
          {data.present.map((p) => (
            <div key={p.key} className="mt-att__row">
              <b>{p.name}{p.guest && <small> · mehmon</small>}</b>
              <span>{fmtTime(p.first_join)} – {fmtTime(p.last_leave)} · {dur(p.seconds)}</span>
            </div>
          ))}
          {data.absent.length > 0 && <>
            <h4>Kelmaganlar · {data.absent.length}</h4>
            {data.absent.map((p) => <div key={p.id} className="mt-att__row is-absent"><b>{p.name}</b><span>—</span></div>)}
          </>}
        </div>
      )}
    </Modal>
  )
}

// Eski havolalar uchun: #/platform/meetings/<id>/room → #/join/<kod>
export function MeetingRedirect({ id }) {
  const { db } = useAuth()
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    const local = db.meetings.find((m) => m.id === id && m.code)
    if (local) { window.location.replace(`#/join/${local.code}`); return }
    meetingsApi.get(id)
      .then(({ meeting }) => window.location.replace(`#/join/${meeting.code}`))
      .catch(() => setFailed(true))
  }, [id, db.meetings])
  if (!failed) return <div className="mj mj--center"><span className="mt-spin mt-spin--lg" /></div>
  return (
    <div className="mj mj--center">
      <div className="mj__end">
        <span className="mj__endic is-red"><Icon name="alertCircle" size={30} /></span>
        <h1>Dars topilmadi</h1>
        <p>Havola eskirgan yoki dars o‘chirilgan.</p>
        <div className="mj__endbtns"><Btn variant="primary" as="a" href="#/platform/meetings">Darslar ro‘yxati</Btn></div>
      </div>
    </div>
  )
}
