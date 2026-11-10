// Dars jadvali. Ustoz o'z guruhlari uchun, administrator tashkilotdagi istalgan guruh uchun dars qo'shadi:
// bir martalik yoki haftalik (tanlangan kunlarda). Har bir o'zgarish (yangi dars, vaqt o'zgarishi,
// bir kunni bekor qilish, o'chirish) va dars boshlanishidan 1 soat oldingi eslatma o'quvchilarga
// server tomonidan bildirishnoma sifatida yuboriladi.
import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../store/auth.jsx'
import { commit } from '../store/db.js'
import { uid } from '../store/ids.js'
import { PageHead, Card, Btn, Badge, Icon, Empty, Table, Menu, Search, Modal, Confirm, FField, Input, Textarea, Select, useToast, useFormInit, cx } from '../ui/kit.jsx'
import { DAYS, DAYS_FULL, MONTHS_FULL } from '../ui/format.js'
import {
  DAY_MS as D, startOfWeek, eventsForDay, dayKey, keyToTs, todayKey, toMin, occursOn, isSkipped, hasFuture,
  nextOccurrence, lessonWhen, lessonTime, lessonPlace,
} from '../ui/agenda.js'

const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0]
const DURATIONS = [45, 60, 80, 90, 120, 150, 180, 240]
const durLabel = (m) => (m % 60 === 0 ? `${m / 60} soat` : m > 60 ? `${Math.floor(m / 60)} soat ${m % 60} daq` : `${m} daqiqa`)
const fmtKey = (k) => { const d = new Date(keyToTs(k)); return `${d.getDate()}-${MONTHS_FULL[d.getMonth()]}, ${DAYS_FULL[d.getDay()].toLowerCase()}` }
const isOnline = (room) => /onlayn|online/i.test(room || '')
const parseLink = (p) => {
  const [id, d] = String(p || '').split('.')
  return [id || null, d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null]
}

// Kim qaysi guruh jadvalini boshqaradi (server ham xuddi shunday tekshiradi)
export function useLessonRights() {
  const { user, scope, can } = useAuth()
  const canGroup = (g) => !!g && can('lessons.manage') && (user.role !== 'teacher' || g.teacherId === user.id)
  return { canGroup, groups: scope.groups.filter(canGroup) }
}

export default function Schedule({ param }) {
  const { db, scope, user } = useAuth()
  const { canGroup, groups: manageable } = useLessonRights()
  // Bildirishnomadagi havola: #/platform/schedule/<darsId>.<sana>
  const [linkId, linkDate] = parseLink(param)
  const [week, setWeek] = useState(() => startOfWeek(linkDate ? keyToTs(linkDate) : Date.now()))
  const [detail, setDetail] = useState(() => (linkId ? { id: linkId, date: linkDate } : null))
  // Sahifa ochiq turganda bildirishnoma bosilsa: router manzil o'zgarmagan deb hisoblashi mumkin — o'zimiz ochamiz
  useEffect(() => {
    const on = () => {
      const m = window.location.hash.match(/^#\/platform\/schedule\/([^/?#]+)/)
      if (!m) return
      const [id, d] = parseLink(decodeURIComponent(m[1]))
      setDetail({ id, date: d })
      if (d) setWeek(startOfWeek(keyToTs(d)))
    }
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])
  const [form, setForm] = useState(null) // { lesson } | { date }
  const [q, setQ] = useState('')
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const thisWeek = week === startOfWeek(Date.now())

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => {
    const ts = week + i * D
    return { ts, dow: new Date(ts).getDay(), isToday: ts === today.getTime(), events: eventsForDay(scope, db, ts) }
  }), [week, scope, db, today])

  const total = days.reduce((s, d) => s + d.events.filter((e) => e.status !== 'cancelled').length, 0)
  const first = new Date(week), last = new Date(week + 6 * D)
  const range = `${first.getDate()} ${MONTHS_FULL[first.getMonth()].slice(0, 4)} — ${last.getDate()} ${MONTHS_FULL[last.getMonth()].slice(0, 3)} ${last.getFullYear()} · ${total} ta dars`

  const closeDetail = () => {
    setDetail(null)
    // Havoladan ochilgan bo'lsa — manzilni tozalaymiz (sahifa qayta yuklanmaydi, hafta joyida qoladi)
    if (param) window.history.replaceState(null, '', '#/platform/schedule')
  }
  const openEvent = (e) => setDetail({ id: e.lesson.id, date: e.date })
  const canAdd = manageable.length > 0

  return (
    <>
      <PageHead icon="calendar" title="Dars jadvali" sub={range}
        actions={<>
          <div className="pweek-nav">
            <Btn icon="chevLeft" onClick={() => setWeek((w) => w - 7 * D)} aria-label="Oldingi hafta" />
            <Btn variant={thisWeek ? 'primary' : 'soft'} onClick={() => setWeek(startOfWeek(Date.now()))}>Bugun</Btn>
            <Btn icon="chevRight" onClick={() => setWeek((w) => w + 7 * D)} aria-label="Keyingi hafta" />
          </div>
          {canAdd && <Btn variant="primary" icon="plus" onClick={() => setForm({ date: thisWeek ? todayKey() : dayKey(week) })}>Dars qo‘shish</Btn>}
        </>} />

      <div className="pweek">
        {days.map((d) => {
          const dt = new Date(d.ts)
          const weekend = d.dow === 0 || d.dow === 6
          const past = d.ts < today.getTime()
          const live = d.events.filter((e) => e.status !== 'cancelled').length
          return (
            <div key={d.ts} className={cx('pweek__day', d.isToday && 'is-today', past && 'is-past')}>
              <header className="pweek__head">
                <div>
                  <span className="pweek__dow">{DAYS_FULL[d.dow]}</span>
                  <b className="pweek__num">{dt.getDate()}</b>
                  <span className="pweek__mon">{MONTHS_FULL[dt.getMonth()]}</span>
                </div>
                {live > 0 && <span className="pweek__count">{live} ta dars</span>}
              </header>
              <div className="pweek__list">
                {d.events.length === 0 && (
                  <div className="pweek__empty">
                    <Icon name={weekend ? (d.dow === 0 ? 'moon' : 'sun') : 'calendar'} size={30} />
                    <b>Dars yo‘q</b>
                    <span>{weekend ? 'Dam olish kuni' : 'Bo‘sh kun'}</span>
                  </div>
                )}
                {d.events.map((e) => <EventCard key={e.id} e={e} onOpen={openEvent} />)}
                {canAdd && !past && (
                  <button type="button" className="pweek__add" onClick={() => setForm({ date: dayKey(d.ts) })} aria-label={`${DAYS_FULL[d.dow]} kuniga dars qo‘shish`}>
                    <Icon name="plus" size={15} /> Dars
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <LessonsTable q={q} setQ={setQ} canGroup={canGroup} canAdd={canAdd} onOpen={(l) => setDetail({ id: l.id, date: null })}
        onEdit={(l) => setForm({ lesson: l })} onAdd={() => setForm({ date: todayKey() })} student={user.role === 'student'} />

      <LessonDetail open={!!detail} id={detail?.id} date={detail?.date} onClose={closeDetail}
        onEdit={(l) => { setDetail(null); setForm({ lesson: l }) }} />
      <LessonForm open={!!form} lesson={form?.lesson || null} defaultDate={form?.date}
        onClose={() => setForm(null)} onSaved={(l) => { const k = nextOccurrence(l); if (k) setWeek(startOfWeek(keyToTs(k))) }} />
    </>
  )
}

function EventCard({ e, onOpen }) {
  const inner = (
    <>
      <div className="pev__time">{e.time} – {e.end}</div>
      <div className="pev__title">{e.title}</div>
      <div className="pev__foot">
        <span className="pev__group"><Icon name="layers" size={13} />{e.group?.name}</span>
        {e.status === 'live' ? <span className="pev__live">Jonli</span>
          : e.status === 'cancelled' ? <span className="pev__off">bekor</span>
            : <span className="pev__status">{e.status === 'ended' ? 'o‘tildi' : e.status === 'scheduled' ? 'onlayn' : e.online ? 'onlayn' : e.place || 'dars'}</span>}
      </div>
    </>
  )
  const cls = cx('pev', `pev--${e.status}`)
  const style = { '--ec': e.group?.color || '#4aa3f8' }
  if (e.kind === 'lesson') return <button type="button" className={cls} style={style} onClick={() => onOpen(e)} title={`${e.title} · ${e.group?.name || ''}`}>{inner}</button>
  return <a href={e.href} className={cls} style={style} title={`${e.title} · ${e.group?.name || ''}`}>{inner}</a>
}

// ---- Jadvaldagi barcha darslar ----
function LessonsTable({ q, setQ, canGroup, canAdd, onOpen, onEdit, onAdd, student }) {
  const { db, scope } = useAuth()
  const toast = useToast()
  const [showPast, setShowPast] = useState(false)
  const [del, setDel] = useState(null)
  const groupOf = (l) => db.groups.find((g) => g.id === l.groupId)
  const all = scope.lessons
  const rows = all
    .filter((l) => showPast || hasFuture(l))
    .filter((l) => { const g = groupOf(l); return `${l.title} ${g?.name} ${g?.course}`.toLowerCase().includes(q.toLowerCase()) })
    .map((l) => ({ ...l, next: nextOccurrence(l) }))
    .sort((a, b) => (a.next && b.next ? (a.next + a.time).localeCompare(b.next + b.time) : a.next ? -1 : b.next ? 1 : b.date.localeCompare(a.date)))
  const pastCount = all.filter((l) => !hasFuture(l)).length

  const remove = async (l) => {
    try { await commit([{ col: 'lessons', op: 'delete', id: l.id }]); toast('Dars jadvaldan o‘chirildi') } catch (e) { toast(e.message || 'O‘chirib bo‘lmadi', 'err') }
  }

  return (
    <Card pad={false} className="pweek-table">
      <header className="pcard__head" style={{ padding: '22px 24px 16px' }}>
        <div className="phead__ttl">
          <span className="phead__icon phead__icon--sm"><Icon name="list" size={22} /></span>
          <div><h3 className="pcard__title">Jadvaldagi darslar</h3><p className="pcard__sub">Doimiy va bir martalik darslar · {rows.length} ta</p></div>
        </div>
        <div className="pweek-table__tools">
          {pastCount > 0 && <Btn size="sm" variant={showPast ? 'primary' : 'soft'} onClick={() => setShowPast((v) => !v)}>O‘tganlar ({pastCount})</Btn>}
          <Search value={q} onChange={setQ} placeholder="Dars yoki guruh bo‘yicha qidirish…" className="pweek-table__search" />
        </div>
      </header>
      <Table rows={rows} onRow={onOpen}
        empty={q
          ? <Empty icon="search" title="Hech narsa topilmadi" />
          : <Empty icon="calendar" title="Jadval hali bo‘sh"
            text={student ? 'Ustozingiz dars qo‘shganda shu yerda ko‘rinadi va sizga bildirishnoma keladi.' : canAdd ? 'Guruhingiz uchun dars qo‘shing — o‘quvchilarga bildirishnoma boradi.' : 'Darslarni guruh ustozi qo‘shadi.'}
            action={canAdd && <Btn variant="primary" icon="plus" onClick={onAdd}>Dars qo‘shish</Btn>} />}
        cols={[
          { key: 'title', label: 'Dars', render: (l) => { const g = groupOf(l); return <div className="pcell-user"><span className="pcell-icon" style={{ background: (g?.color || '#4aa3f8') + '1f', color: g?.color || '#4aa3f8' }}><Icon name={l.online ? 'video' : 'calendar'} size={20} /></span><div><b>{l.title}</b><span>{g ? `${g.name} · ${g.course}` : 'Guruh o‘chirilgan'}</span></div></div> } },
          { key: 'teacher', label: 'O‘qituvchi', render: (l) => { const t = db.users.find((u) => u.id === groupOf(l)?.teacherId); return <span className="pcell-muted"><Icon name="user" size={16} />{t?.name || 'Biriktirilmagan'}</span> } },
          { key: 'when', label: 'Kunlar', render: (l) => <div className="pweek__times">{l.repeat === 'weekly' ? l.days.slice().sort((a, b) => WEEK_ORDER.indexOf(a) - WEEK_ORDER.indexOf(b)).map((d) => <span key={d}>{DAYS[d]}</span>) : <span>{lessonWhen(l)}</span>}</div> },
          { key: 'time', label: 'Vaqt', render: (l) => <span className="mono">{lessonTime(l)}</span> },
          { key: 'place', label: 'Joy', render: (l) => l.online ? <Badge tone="green"><Icon name="wifi" size={13} /> Onlayn</Badge> : <Badge tone="blue"><Icon name="building" size={13} /> {lessonPlace(l, groupOf(l)) || 'Xona'}</Badge> },
          { key: 'next', label: 'Keyingi dars', render: (l) => (l.next ? <span className="pcell-muted">{fmtKey(l.next)}</span> : <span className="pmuted">Tugagan</span>) },
          { key: 'a', label: '', align: 'right', render: (l) => canGroup(groupOf(l)) && <span onClick={(e) => e.stopPropagation()}><Menu items={[
            { label: 'Ko‘rish', icon: 'eye', onClick: () => onOpen(l) },
            { label: 'Tahrirlash', icon: 'edit', onClick: () => onEdit(l) },
            { label: 'O‘chirish', icon: 'trash', danger: true, onClick: () => setDel(l) },
          ]} /></span> },
        ]} />
      <Confirm open={!!del} onClose={() => setDel(null)} danger title="Darsni o‘chirish" confirmLabel="O‘chirish" onConfirm={() => remove(del)}
        text={del?.repeat === 'weekly' ? `«${del?.title}» — barcha haftalik darslar jadvaldan o‘chiriladi. Guruh o‘quvchilariga xabar boradi.` : `«${del?.title}» darsi o‘chiriladi. Guruh o‘quvchilariga xabar boradi.`} />
    </Card>
  )
}

// ---- Dars tafsiloti ----
function LessonDetail({ open, id, date, onClose, onEdit }) {
  const { db } = useAuth()
  const toast = useToast()
  const { canGroup } = useLessonRights()
  const [ask, setAsk] = useState(null) // 'skip' | 'delete'
  const [busy, setBusy] = useState(false)
  const l = db.lessons.find((x) => x.id === id)
  const g = l && db.groups.find((x) => x.id === l.groupId)
  const teacher = g && db.users.find((u) => u.id === g.teacherId)
  const manage = l && canGroup(g)
  // Aniq kun tanlanmagan bo'lsa — eng yaqin dars kuni
  const k = l && (date && occursOn(l, date) ? date : nextOccurrence(l))
  const skipped = l && k && isSkipped(l, k)
  const pastDay = k && k < todayKey()

  const run = async (ops, msg) => {
    setBusy(true)
    try { await commit(ops); toast(msg) } catch (e) { toast(e.message || 'Saqlab bo‘lmadi', 'err') } finally { setBusy(false) }
  }
  const toggleSkip = () => run([{ col: 'lessons', op: 'patch', id: l.id, changes: { skips: skipped ? l.skips.filter((x) => x !== k) : [...(l.skips || []), k] } }],
    skipped ? 'Dars qayta tiklandi — o‘quvchilarga xabar yuborildi' : 'Shu kungi dars bekor qilindi — o‘quvchilarga xabar yuborildi')
  const remove = async () => { await run([{ col: 'lessons', op: 'delete', id: l.id }], 'Dars jadvaldan o‘chirildi'); onClose() }

  if (!open) return null
  if (!l) {
    return (
      <Modal open onClose={onClose} title="Dars topilmadi" width={460} footer={<Btn onClick={onClose}>Yopish</Btn>}>
        <Empty icon="calendar" title="Bu dars jadvalda yo‘q" text="Dars o‘chirilgan yoki siz bu guruhda emassiz." />
      </Modal>
    )
  }
  const place = lessonPlace(l, g)
  const rows = [
    ['calendar', 'Sana', k ? fmtKey(k) : 'Darslar tugagan'],
    ['clock', 'Vaqt', `${lessonTime(l)} · ${durLabel(l.durationMin)}`],
    ['layers', 'Guruh', g ? `${g.name} · ${g.course}` : 'Guruh o‘chirilgan'],
    ['user', 'O‘qituvchi', teacher?.name || 'Biriktirilmagan'],
    [l.online ? 'wifi' : 'building', 'Joy', l.online ? 'Onlayn' : place || 'Ko‘rsatilmagan'],
    ['refresh', 'Takrorlanish', l.repeat === 'weekly'
      ? `Har hafta: ${l.days.slice().sort((a, b) => WEEK_ORDER.indexOf(a) - WEEK_ORDER.indexOf(b)).map((d) => DAYS_FULL[d]).join(', ')}${l.until ? ` · ${fmtKey(l.until)}gacha` : ''}`
      : 'Bir martalik'],
  ]
  return (
    <>
      <Modal open onClose={onClose} title={l.title} sub={g ? `${g.name} guruhi` : undefined} width={520}
        footer={<>
          {manage && <Btn variant="ghost" icon="trash" onClick={() => setAsk('delete')} disabled={busy} style={{ marginRight: 'auto', color: 'var(--pf-red, #d92d20)' }}>O‘chirish</Btn>}
          {manage && k && !pastDay && <Btn icon={skipped ? 'refresh' : 'x'} onClick={() => (skipped ? toggleSkip() : setAsk('skip'))} disabled={busy}>{skipped ? 'Qayta tiklash' : 'Shu kunni bekor qilish'}</Btn>}
          {manage ? <Btn variant="primary" icon="edit" onClick={() => onEdit(l)} disabled={busy}>Tahrirlash</Btn> : <Btn onClick={onClose}>Yopish</Btn>}
        </>}>
        {skipped && <div className="plsn__banner"><Icon name="alertCircle" size={18} /> {fmtKey(k)} kungi dars bekor qilingan</div>}
        <div className="plsn">
          {rows.map(([icon, label, value]) => (
            <div key={label} className="plsn__row"><span className="plsn__ico"><Icon name={icon} size={17} /></span><span className="plsn__label">{label}</span><b>{value}</b></div>
          ))}
        </div>
        {l.online && l.url && !skipped && <Btn as="a" href={l.url} target="_blank" rel="noopener noreferrer" variant="primary" icon="video" style={{ marginTop: 16, width: '100%' }}>Darsga qo‘shilish</Btn>}
        {l.note && <div className="plsn__note"><b>Izoh</b><p>{l.note}</p></div>}
      </Modal>
      <Confirm open={ask === 'skip'} onClose={() => setAsk(null)} title="Shu kungi darsni bekor qilish" confirmLabel="Bekor qilish" danger onConfirm={toggleSkip}
        text={`${k ? fmtKey(k) : ''} kungi «${l.title}» darsi bo‘lmaydi. Boshqa kunlar o‘zgarmaydi. Guruh o‘quvchilariga xabar boradi.`} />
      <Confirm open={ask === 'delete'} onClose={() => setAsk(null)} title="Darsni o‘chirish" confirmLabel="O‘chirish" danger onConfirm={remove}
        text={l.repeat === 'weekly' ? 'Barcha haftalik darslar jadvaldan o‘chiriladi. Faqat bitta kunni olib tashlash uchun «Shu kunni bekor qilish»ni tanlang.' : 'Dars jadvaldan o‘chiriladi. Guruh o‘quvchilariga xabar boradi.'} />
    </>
  )
}

// ---- Ikki dars vaqti ustma-ust tushadimi ----
function clashes(a, b) {
  const sa = toMin(a.time), sb = toMin(b.time)
  if (!(sa < sb + b.durationMin && sb < sa + a.durationMin)) return false
  if (a.repeat !== 'weekly') return occursOn(b, a.date) && !isSkipped(b, a.date)
  if (b.repeat !== 'weekly') return occursOn(a, b.date) && !isSkipped(a, b.date)
  return a.days.some((d) => b.days.includes(d)) && a.date <= (b.until || '9999') && b.date <= (a.until || '9999')
}

// ---- Dars qo'shish / tahrirlash ----
export function LessonForm({ open, lesson, defaultGroupId, defaultDate, onClose, onSaved }) {
  const { db, scope } = useAuth()
  const toast = useToast()
  const { groups } = useLessonRights()
  const isNew = !lesson?.id
  const [f, setF] = useState({})
  const [err, setErr] = useState({})
  const [busy, setBusy] = useState(false)
  const [touchedTitle, setTouchedTitle] = useState(false)

  useFormInit(open, lesson?.id || `new-${defaultGroupId || ''}-${defaultDate || ''}`, () => {
    setErr({}); setBusy(false)
    if (!isNew) { setTouchedTitle(true); setF({ ...lesson, until: lesson.until || '', url: lesson.url || '', room: lesson.room || '', note: lesson.note || '' }); return }
    const g = groups.find((x) => x.id === defaultGroupId) || groups[0]
    const date = defaultDate && defaultDate >= todayKey() ? defaultDate : todayKey()
    setTouchedTitle(false)
    setF({
      groupId: g?.id || '', title: g?.course || '', repeat: 'weekly', date, days: [new Date(keyToTs(date)).getDay()], until: '',
      time: '18:00', durationMin: 90, online: isOnline(g?.room), room: isOnline(g?.room) ? '' : g?.room || '', url: '', note: '',
    })
  })
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }))
  const g = db.groups.find((x) => x.id === f.groupId)
  const pickGroup = (id) => {
    const ng = db.groups.find((x) => x.id === id)
    setF((x) => ({ ...x, groupId: id, ...(touchedTitle ? {} : { title: ng?.course || '' }), ...(isNew && ng ? { online: isOnline(ng.room), room: isOnline(ng.room) ? '' : ng.room || '' } : {}) }))
  }
  const pickDate = (v) => setF((x) => ({ ...x, date: v, ...(x.repeat === 'weekly' && v && x.days?.length <= 1 ? { days: [new Date(keyToTs(v)).getDay()] } : {}) }))
  const toggleDay = (d) => set('days', f.days.includes(d) ? f.days.filter((x) => x !== d) : [...f.days, d])

  // Shu guruh yoki shu ustozning boshqa darsi bilan to'qnashuv (ogohlantirish, taqiq emas)
  const clash = useMemo(() => {
    if (!open || !f.time || !f.date || !g) return null
    const cand = { ...f, durationMin: Number(f.durationMin), until: f.until || null, days: f.repeat === 'weekly' ? f.days : [] }
    return scope.lessons.find((o) => {
      if (o.id === lesson?.id || !hasFuture(o)) return false
      const og = db.groups.find((x) => x.id === o.groupId)
      return (o.groupId === g.id || (g.teacherId && og?.teacherId === g.teacherId)) && clashes(cand, o)
    })
  }, [open, f, g, scope.lessons, db.groups, lesson?.id])

  const validate = () => {
    const e = {}
    if (!f.groupId) e.groupId = 'Guruhni tanlang'
    if (!f.title?.trim()) e.title = 'Dars nomini kiriting'
    if (!f.date) e.date = 'Sanani tanlang'
    else if (isNew && f.repeat !== 'weekly' && f.date < todayKey()) e.date = 'O‘tgan sanaga dars qo‘shib bo‘lmaydi'
    if (!f.time) e.time = 'Vaqtni kiriting'
    else if (isNew && f.repeat !== 'weekly' && f.date === todayKey() && toMin(f.time) <= new Date().getHours() * 60 + new Date().getMinutes()) e.time = 'Bu vaqt o‘tib ketgan'
    if (f.repeat === 'weekly' && !f.days?.length) e.days = 'Kamida bitta kunni tanlang'
    if (f.repeat === 'weekly' && f.until && f.until < f.date) e.until = 'Boshlanish sanasidan keyin bo‘lsin'
    if (f.online && f.url && !/^https?:\/\/\S+$/i.test(f.url.trim())) e.url = 'Havola https:// bilan boshlanishi kerak'
    return e
  }

  const submit = async () => {
    const e = validate(); setErr(e)
    if (Object.keys(e).length) return
    const data = {
      title: f.title.trim(), repeat: f.repeat, date: f.date, days: f.repeat === 'weekly' ? f.days.slice().sort() : [], until: f.repeat === 'weekly' ? f.until || null : null,
      time: f.time, durationMin: Number(f.durationMin), online: !!f.online, room: f.online ? '' : f.room.trim(), url: f.online ? f.url.trim() : '', note: f.note.trim(),
    }
    setBusy(true)
    try {
      const [r] = await commit([isNew
        ? { col: 'lessons', op: 'insert', item: { id: uid('ls'), groupId: f.groupId, ...data } }
        : { col: 'lessons', op: 'patch', id: lesson.id, changes: data }])
      const n = g?.studentIds.length || 0
      toast(isNew ? (n ? `Dars qo‘shildi — ${n} ta o‘quvchiga bildirishnoma yuborildi` : 'Dars qo‘shildi') : 'Saqlandi')
      onSaved?.(r.item)
      onClose()
    } catch (x) {
      toast(x.message || 'Saqlab bo‘lmadi', 'err')
      setBusy(false)
    }
  }

  const students = g?.studentIds.length || 0
  return (
    <Modal open={open} onClose={onClose} title={isNew ? 'Dars qo‘shish' : 'Darsni tahrirlash'} sub={isNew ? 'Dars jadvalga qo‘shiladi va guruh o‘quvchilariga xabar boradi' : g ? `${g.name} guruhi` : undefined} width={620}
      footer={<><Btn onClick={onClose} disabled={busy}>Bekor</Btn><Btn variant="primary" onClick={submit} disabled={busy || !groups.length}>{busy ? 'Saqlanmoqda…' : isNew ? 'Qo‘shish' : 'Saqlash'}</Btn></>}>
      {open && !groups.length ? <Empty icon="layers" title="Guruh yo‘q" text="Dars qo‘shish uchun avval guruh yarating yoki sizga guruh biriktirilsin." action={<Btn as="a" href="#/platform/groups" onClick={onClose}>Guruhlar</Btn>} /> : (
        <div className="pform">
          <div className="pform__row">
            <FField label="Guruh" error={err.groupId}>
              {isNew ? <Select value={f.groupId} onChange={pickGroup} placeholder="Guruhni tanlang" options={groups.map((x) => ({ value: x.id, label: `${x.name} · ${x.course}` }))} />
                : <Input value={g ? `${g.name} · ${g.course}` : ''} disabled />}
            </FField>
            <FField label="Dars nomi / mavzu" error={err.title}><Input value={f.title || ''} maxLength={120} onChange={(e) => { setTouchedTitle(true); set('title', e.target.value) }} placeholder="Islom moliyasi asoslari" /></FField>
          </div>

          <FField label="Takrorlanish">
            <div className="pseg pseg--blue pseg--text" role="group" aria-label="Takrorlanish">
              <button type="button" className={cx(f.repeat === 'weekly' && 'is-on')} onClick={() => setF((x) => ({ ...x, repeat: 'weekly', days: x.days?.length ? x.days : [new Date(keyToTs(x.date || todayKey())).getDay()] }))}><Icon name="refresh" size={15} /> Har hafta</button>
              <button type="button" className={cx(f.repeat === 'once' && 'is-on')} onClick={() => set('repeat', 'once')}><Icon name="calendar" size={15} /> Bir martalik</button>
            </div>
          </FField>

          {f.repeat === 'weekly' && (
            <FField label="Hafta kunlari" error={err.days}>
              <div className="pchips">
                {WEEK_ORDER.map((d) => <button key={d} type="button" className={cx('pchip', f.days?.includes(d) && 'is-on')} onClick={() => toggleDay(d)} aria-pressed={f.days?.includes(d)}>{DAYS_FULL[d]}</button>)}
              </div>
            </FField>
          )}

          <div className="pform__row">
            <FField label={f.repeat === 'weekly' ? 'Boshlanish sanasi' : 'Sana'} error={err.date}><Input type="date" value={f.date || ''} min={isNew ? todayKey() : undefined} onChange={(e) => pickDate(e.target.value)} /></FField>
            {f.repeat === 'weekly'
              ? <FField label="Tugash sanasi" hint="Bo‘sh qolsa — muddatsiz" error={err.until}><Input type="date" value={f.until || ''} min={f.date || undefined} onChange={(e) => set('until', e.target.value)} /></FField>
              : <div />}
          </div>

          <div className="pform__row">
            <FField label="Boshlanish vaqti" error={err.time}><Input type="time" value={f.time || ''} onChange={(e) => set('time', e.target.value)} /></FField>
            <FField label="Davomiyligi" hint={f.time ? `Tugaydi: ${lessonTime({ time: f.time, durationMin: Number(f.durationMin) || 0 }).split(' – ')[1]}` : undefined}>
              <Select value={String(f.durationMin || 90)} onChange={(v) => set('durationMin', Number(v))} options={[...new Set([...DURATIONS, Number(f.durationMin) || 90])].sort((a, b) => a - b).map((m) => ({ value: String(m), label: durLabel(m) }))} />
            </FField>
          </div>

          <FField label="Format">
            <div className="pseg pseg--blue pseg--text" role="group" aria-label="Format">
              <button type="button" className={cx(!f.online && 'is-on')} onClick={() => set('online', false)}><Icon name="building" size={15} /> Xonada</button>
              <button type="button" className={cx(f.online && 'is-on')} onClick={() => set('online', true)}><Icon name="wifi" size={15} /> Onlayn</button>
            </div>
          </FField>
          {f.online
            ? <FField label="Dars havolasi" hint="Ixtiyoriy: Zoom, Google Meet yoki boshqa havola" error={err.url}><Input value={f.url || ''} onChange={(e) => set('url', e.target.value)} placeholder="https://…" inputMode="url" /></FField>
            : <FField label="Xona / manzil" hint="Ixtiyoriy"><Input value={f.room || ''} maxLength={80} onChange={(e) => set('room', e.target.value)} placeholder="204-xona" /></FField>}

          <FField label="Izoh" hint="Ixtiyoriy: o‘quvchilar uchun eslatma (nima olib kelish, tayyorgarlik)"><Textarea rows={2} maxLength={1000} value={f.note || ''} onChange={(e) => set('note', e.target.value)} /></FField>

          {clash && <div className="pform__warn"><Icon name="alertCircle" size={16} /> Bu vaqt «{clash.title}» ({db.groups.find((x) => x.id === clash.groupId)?.name}) darsi bilan ustma-ust tushadi: {lessonWhen(clash)} {lessonTime(clash)}</div>}
          {g && <p className="pform__note"><Icon name="bell" size={15} /> {isNew
            ? (students ? `Saqlangach ${students} ta o‘quvchiga bildirishnoma boradi. Har bir darsdan 1 soat oldin eslatma ham yuboriladi.` : 'Guruhda hali o‘quvchi yo‘q — qo‘shilganlar jadvalni ko‘radi va eslatma oladi.')
            : 'Vaqt, kun yoki joy o‘zgarsa, o‘quvchilarga xabar boradi.'}</p>}
        </div>
      )}
    </Modal>
  )
}
