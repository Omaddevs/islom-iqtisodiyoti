// Kutubxona → Darslar: ustoz «Dars 1», «Dars 2»… kartalarini yaratadi, har bir dars ichiga fayllar yuklaydi.
// Dars — kutubxonadagi `type: 'unit'` yozuvi; uning fayllari oddiy materiallar bo'lib, `unitId` orqali bog'lanadi
// va darsning «Kimlar ko'radi» sozlamasini meros oladi (himoyalangan ko'rish huquqi shu ro'yxatga qaraydi).
import { useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '../store/auth.jsx'
import { add, patch, remove, notify, logActivity, NO_ORG } from '../store/db.js'
import { Btn, Modal, FField, Input, Textarea, ChipSelect, Empty, Icon, Menu, Confirm, Card, useToast, cx, useFormInit } from '../ui/kit.jsx'
import { fmtDate } from '../ui/format.js'
import { fmtSize } from '../ui/SecureViewer.jsx'
import { materialsApi } from '../api/client.js'
import '../../styles/library-lessons.css'

export const UNIT = 'unit'
export const isUnit = (l) => l?.type === UNIT

// Fayl turi bo'yicha belgi rangi va qisqa nomi
const KINDS = [
  { re: /^pdf$/, label: 'PDF', tone: 'pdf' },
  { re: /^(docx?|docm|dotx?|odt|rtf|txt|md)$/, label: 'Word', tone: 'doc' },
  { re: /^(pptx?|pptm|ppsx?|potx?|odp)$/, label: 'PPTX', tone: 'ppt' },
  { re: /^(xlsx?|xlsm|xlsb|xltx?|ods|csv)$/, label: 'Excel', tone: 'xls' },
  { re: /^(mp3|wav|ogg|oga|opus|m4a|aac|flac)$/, label: 'Audio', tone: 'aud' },
  { re: /^(mp4|m4v|webm|ogv|mov|mkv|avi)$/, label: 'Video', tone: 'vid' },
  { re: /^(png|jpe?g|gif|webp|bmp|svg|heic)$/, label: 'Rasm', tone: 'img' },
]
export const kindOfItem = (l) => {
  if (!l.fileId && l.url) return { label: 'Havola', tone: 'lnk', ext: 'URL' }
  const ext = (l.fileExt || l.format || '').toLowerCase()
  const k = KINDS.find((x) => x.re.test(ext))
  return { label: k?.label || (ext ? ext.toUpperCase() : 'Fayl'), tone: k?.tone || 'oth', ext: (ext || 'fayl').slice(0, 4).toUpperCase() }
}
const byOrder = (a, b) => (a.order ?? a.createdAt) - (b.order ?? b.createdAt) || a.createdAt - b.createdAt
export const sortUnits = (a, b) => (a.num || 0) - (b.num || 0) || a.createdAt - b.createdAt
const pad = (n) => String(n || 0).padStart(2, '0')
const plural = (n, w) => `${n} ta ${w}`
const UNIT_COLORS = ['#2563eb', '#0f766e', '#7c3aed', '#c2410c', '#0369a1', '#15803d', '#be185d', '#4f46e5']

// Dars ichidagi materiallar
export const childrenOf = (all, unitId) => all.filter((l) => l.unitId === unitId).sort(byOrder)

/* ---------- Darslar ro'yxati ---------- */

export function LessonGrid({ units, items, canEdit, onOpen, onCreate, onEdit, onDelete, mineOf }) {
  if (!units.length) {
    return (
      <Card>
        <Empty icon="book" title="Hali dars yaratilmagan"
          text={canEdit ? '«Dars 1» kabi dars yarating va uning ichiga PDF, Word, PPTX, audio yoki video fayllarni yuklang.' : 'Ustoz darslarni joylagach, ular shu yerda paydo bo‘ladi.'}
          action={canEdit && <Btn variant="primary" icon="plus" onClick={onCreate}>Birinchi darsni yaratish</Btn>} />
      </Card>
    )
  }
  return (
    <div className="plessons">
      {units.map((u) => {
        const kids = items.filter((l) => l.unitId === u.id)
        const kinds = Object.entries(kids.reduce((m, l) => { const k = kindOfItem(l); m[k.label] = { n: (m[k.label]?.n || 0) + 1, tone: k.tone }; return m }, {}))
        const last = Math.max(u.createdAt, ...kids.map((l) => l.createdAt))
        const size = kids.reduce((s, l) => s + (l.fileSize || 0), 0)
        const mine = mineOf(u)
        const onKey = (e) => { if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onOpen(u) } }
        return (
          <article key={u.id} className="plesson" style={{ '--uc': u.cover || UNIT_COLORS[0] }} tabIndex={0} onClick={() => onOpen(u)} onKeyDown={onKey} aria-label={u.title}>
            <div className="plesson__top">
              <span className="plesson__num"><small>DARS</small><b>{pad(u.num)}</b></span>
              <span className="plesson__glyph" aria-hidden><Icon name="bookOpen" size={30} stroke={1.5} /></span>
              {canEdit && mine && (
                <span className="plesson__menu" onClick={(e) => e.stopPropagation()}>
                  <Menu align="right" trigger={<button type="button" className="plesson__more" aria-label="Dars amallari"><Icon name="moreV" size={17} /></button>}
                    items={[
                      { label: 'Ochish', icon: 'eye', onClick: () => onOpen(u) },
                      { label: 'Fayl yuklash', icon: 'upload', onClick: () => onOpen(u, { upload: true }) },
                      { label: 'Tahrirlash', icon: 'edit', onClick: () => onEdit(u) },
                      'sep',
                      { label: 'O‘chirish', icon: 'trash', danger: true, onClick: () => onDelete(u) },
                    ]} />
                </span>
              )}
            </div>
            <div className="plesson__body">
              <h4 title={u.title}>{u.title}</h4>
              <p className={cx('plesson__desc', !u.description && 'is-empty')}>{u.description || (kids.length ? 'Dars materiallari' : 'Materiallar hali yuklanmagan')}</p>
              <div className="plesson__kinds">
                {kinds.length ? kinds.slice(0, 4).map(([label, k]) => <span key={label} className={`pkind pkind--${k.tone}`}>{label}{k.n > 1 && <b>{k.n}</b>}</span>)
                  : <span className="pkind pkind--empty"><Icon name="upload" size={12} />Bo‘sh</span>}
              </div>
              <div className="plesson__foot">
                <span><Icon name="layers" size={14} />{plural(kids.length, 'material')}{size > 0 && <em> · {fmtSize(size)}</em>}</span>
                <span className="plesson__date">{fmtDate(last)}</span>
                <span className="plesson__go" aria-hidden><Icon name="arrowRight" size={16} /></span>
              </div>
            </div>
          </article>
        )
      })}
      {canEdit && (
        <button type="button" className="plesson plesson--new" onClick={onCreate}>
          <span className="plesson__plus"><Icon name="plus" size={24} /></span>
          <b>Yangi dars</b>
          <span>Dars {units.length + 1} ni yaratish</span>
        </button>
      )}
    </div>
  )
}

/* ---------- Bitta dars ichi ---------- */

const MAX = 500 * 1024 * 1024
const PARALLEL = 2

export function LessonView({ unit, units, items, canEdit, mine, mineOf, onBack, onOpenUnit, onRun, onEditUnit, onDeleteUnit, onAddLink, menuFor, autoUpload, groups }) {
  const { user, scope } = useAuth()
  const toast = useToast()
  const input = useRef(null)
  const [drag, setDrag] = useState(false)
  const [jobs, setJobs] = useState([]) // { key, name, size, progress, status: queued|uploading|done|error, error }
  const running = useRef(new Map()) // key -> { abort }
  const queue = useRef([]) // { key, file }
  const nextOrder = useRef(0)
  const added = useRef([])
  const kids = items
  const orgId = unit.orgId || scope.orgId
  const idx = units.findIndex((u) => u.id === unit.id)
  const prev = units[idx - 1], next = units[idx + 1]
  const gs = groups.filter((g) => (unit.groupIds || []).includes(g.id))
  const size = kids.reduce((s, l) => s + (l.fileSize || 0), 0)
  const busy = jobs.some((j) => j.status === 'queued' || j.status === 'uploading')
  const canUpload = canEdit && mine

  useEffect(() => { nextOrder.current = Math.max(nextOrder.current, Math.max(0, ...kids.map((l) => l.order || 0)) + 1) }, [kids])
  useEffect(() => { if (autoUpload && canUpload) setTimeout(() => input.current?.click(), 50) }, [autoUpload]) // eslint-disable-line react-hooks/exhaustive-deps
  // Darsdan chiqilsa yoki boshqa darsga o'tilsa — davom etayotgan yuklashlar to'xtatiladi
  useEffect(() => () => { running.current.forEach((r) => r.abort()); running.current.clear(); queue.current = [] }, [unit.id])
  // Yuklash davom etayotganda sahifani yopishdan oldin ogohlantirish
  useEffect(() => {
    if (!busy) return undefined
    const h = (e) => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', h)
    return () => window.removeEventListener('beforeunload', h)
  }, [busy])

  const setJob = (key, ch) => setJobs((js) => js.map((j) => (j.key === key ? { ...j, ...ch } : j)))
  const finishBatch = () => {
    if (running.current.size || queue.current.length || !added.current.length) return
    const n = added.current.length
    const first = added.current[0]
    added.current = []
    notify([...new Set(scope.groups.filter((g) => !(unit.groupIds || []).length || unit.groupIds.includes(g.id)).flatMap((g) => g.studentIds))],
      n === 1 ? `«${unit.title}» darsiga yangi material: «${first}»` : `«${unit.title}» darsiga ${n} ta yangi material qo‘shildi`, '#/platform/library')
    logActivity(orgId, user.id, `«${unit.title}» darsiga material yukladi`, n === 1 ? first : `${n} ta fayl`)
    toast(n === 1 ? 'Fayl darsga qo‘shildi' : `${n} ta fayl darsga qo‘shildi`)
  }
  const pump = () => {
    while (running.current.size < PARALLEL && queue.current.length) {
      const { key, file, order } = queue.current.shift()
      const job = materialsApi.upload(file, { orgId, onProgress: (p) => setJob(key, { progress: p }) })
      running.current.set(key, job)
      setJob(key, { status: 'uploading', progress: 0 })
      job.promise.then((meta) => {
        if (!running.current.has(key)) return
        const title = meta.name.replace(/\.[^.]+$/, '')
        add('library', {
          title, type: 'textbook', unitId: unit.id, order, groupIds: unit.groupIds || [],
          fileId: meta.id, fileName: meta.name, fileExt: meta.ext, fileSize: meta.size, format: (meta.ext || '').toUpperCase(),
          author: '', year: new Date().getFullYear(), lang: 'uz', url: '', description: '', tags: [], category: unit.title,
          orgId, authorId: user.id, downloads: 0,
        })
        added.current.push(title)
        setJob(key, { status: 'done', progress: 1 })
        setTimeout(() => setJobs((js) => js.filter((j) => j.key !== key)), 2200)
      }).catch((e) => {
        if (e.name === 'AbortError') { setJobs((js) => js.filter((j) => j.key !== key)); return }
        setJob(key, { status: 'error', error: e.message || 'Yuklab bo‘lmadi' })
      }).finally(() => { running.current.delete(key); pump(); finishBatch() })
    }
  }
  const enqueue = (files) => {
    if (!canUpload) return
    if (!orgId) { toast(NO_ORG, 'err'); return }
    const list = [...(files || [])]
    if (!list.length) return
    const fresh = list.map((file, i) => {
      const key = `${Date.now()}-${i}-${file.name}`
      const error = !file.size ? 'Fayl bo‘sh' : file.size > MAX ? '500 MB dan katta' : null
      // Tartib tanlangan ketma-ketlikda band qilinadi: parallel yuklashda qaysi biri oldin tugashidan qat'i nazar
      if (!error) queue.current.push({ key, file, order: nextOrder.current++ })
      return { key, name: file.name, size: file.size, progress: 0, status: error ? 'error' : 'queued', error }
    })
    setJobs((js) => [...js, ...fresh])
    pump()
  }
  const cancel = (key) => {
    const r = running.current.get(key)
    if (r) { running.current.delete(key); r.abort() }
    queue.current = queue.current.filter((q) => q.key !== key)
    setJobs((js) => js.filter((j) => j.key !== key))
    setTimeout(finishBatch, 0)
  }
  // Tartibni o'zgartirish: avval hammasiga ketma-ket tartib beriladi, keyin ikkitasi almashadi
  const move = (l, dir) => {
    const i = kids.findIndex((x) => x.id === l.id), j = i + dir
    if (i < 0 || j < 0 || j >= kids.length) return
    kids.forEach((x, k) => { const o = k === i ? j + 1 : k === j ? i + 1 : k + 1; if (x.order !== o) patch('library', x.id, { order: o }) })
  }
  const dropProps = canUpload ? {
    onDragOver: (e) => { if ([...(e.dataTransfer?.types || [])].includes('Files')) { e.preventDefault(); setDrag(true) } },
    onDragLeave: (e) => { if (!e.currentTarget.contains(e.relatedTarget)) setDrag(false) },
    onDrop: (e) => { e.preventDefault(); setDrag(false); enqueue(e.dataTransfer.files) },
  } : {}

  return (
    <div className={cx('plv', drag && 'is-drag')} {...dropProps} style={{ '--uc': unit.cover || UNIT_COLORS[0] }}>
      <nav className="plv__crumbs" aria-label="Yo‘l">
        <button type="button" onClick={onBack}><Icon name="arrowLeft" size={16} />Darslar</button>
        <Icon name="chevRight" size={14} />
        <span>{unit.title}</span>
      </nav>

      <header className="plv__hero">
        <span className="plv__num"><small>DARS</small><b>{pad(unit.num)}</b></span>
        <div className="plv__info">
          <h2>{unit.title}</h2>
          {unit.description && <p>{unit.description}</p>}
          <div className="plv__chips">
            <span><Icon name="layers" size={14} />{plural(kids.length, 'material')}</span>
            {size > 0 && <span><Icon name="cloud" size={14} />{fmtSize(size)}</span>}
            <span><Icon name="calendar" size={14} />{fmtDate(unit.createdAt)}</span>
            {gs.length ? gs.map((g) => <span key={g.id}><i className="pvdot" style={{ background: g.color }} />{g.name}</span>) : <span><Icon name="users" size={14} />Barcha guruhlar</span>}
          </div>
        </div>
        {canUpload && (
          <div className="plv__actions">
            <Btn variant="primary" icon="upload" onClick={() => input.current?.click()}>Fayl yuklash</Btn>
            <Menu align="right" trigger={<Btn icon="moreV" aria-label="Dars amallari" />} items={[
              { label: 'Havola qo‘shish', icon: 'link', onClick: onAddLink },
              { label: 'Darsni tahrirlash', icon: 'edit', onClick: onEditUnit },
              'sep',
              { label: 'Darsni o‘chirish', icon: 'trash', danger: true, onClick: onDeleteUnit },
            ]} />
          </div>
        )}
      </header>

      <input ref={input} type="file" multiple hidden aria-label="Fayllarni tanlash" onChange={(e) => { enqueue(e.target.files); e.target.value = '' }} />

      {canUpload && (
        <button type="button" className={cx('plv__drop', drag && 'is-over', kids.length > 0 && 'is-compact')} onClick={() => input.current?.click()}>
          <span className="plv__dropicon"><Icon name="upload" size={22} /></span>
          <span className="plv__droptext">
            <b>{drag ? 'Fayllarni qo‘yib yuboring' : 'Fayllarni shu yerga tashlang yoki tanlang'}</b>
            <span>Bir nechta faylni birdaniga yuklash mumkin · PDF, Word, PPTX, Excel, audio, video · har biri 500 MB gacha</span>
          </span>
        </button>
      )}

      {jobs.length > 0 && (
        <div className="plv__queue" aria-live="polite">
          {jobs.map((j) => (
            <div key={j.key} className={cx('plvq', `is-${j.status}`)}>
              <span className={`plvq__ext pkind--${kindOfItem({ fileExt: (/\.([^.]+)$/.exec(j.name)?.[1] || '') }).tone}`}>{(/\.([^.]+)$/.exec(j.name)?.[1] || '?').slice(0, 4).toUpperCase()}</span>
              <div className="plvq__info">
                <b title={j.name}>{j.name}</b>
                <span>{j.status === 'error' ? j.error : j.status === 'done' ? 'Qo‘shildi' : j.status === 'queued' ? `Navbatda · ${fmtSize(j.size)}` : j.progress >= 1 ? 'Saqlanmoqda…' : `${Math.round(j.progress * 100)}% · ${fmtSize(j.size)}`}</span>
                {(j.status === 'uploading' || j.status === 'queued') && <span className="pprog pprog--sm"><span className="pprog__bar" style={{ width: `${Math.round(j.progress * 100)}%` }} /></span>}
              </div>
              {j.status === 'done' ? <span className="plvq__ok"><Icon name="check" size={16} /></span>
                : <button type="button" className="plibicon" onClick={() => cancel(j.key)} aria-label={j.status === 'error' ? 'Olib tashlash' : 'Bekor qilish'} title={j.status === 'error' ? 'Olib tashlash' : 'Bekor qilish'}><Icon name="x" size={16} /></button>}
            </div>
          ))}
        </div>
      )}

      {kids.length === 0 ? (
        !canUpload && <Card><Empty icon="layers" title="Bu darsga hali material qo‘shilmagan" text="Ustoz fayllarni yuklagach, ular shu yerda ko‘rinadi." /></Card>
      ) : (
        <ol className="plv__files">
          {kids.map((l, i) => {
            const k = kindOfItem(l)
            const own = canEdit && mineOf(l)
            const items = [
              ...menuFor(l),
              ...(own && kids.length > 1 ? ['sep', i > 0 && { label: 'Yuqoriga', icon: 'chevUp', onClick: () => move(l, -1) }, i < kids.length - 1 && { label: 'Pastga', icon: 'chevDown', onClick: () => move(l, 1) }] : []),
            ].filter(Boolean)
            const meta = [k.label, l.fileSize ? fmtSize(l.fileSize) : null, l.pages ? `${l.pages} bet` : null, !l.fileId && l.url ? (() => { try { return new URL(l.url).hostname.replace(/^www\./, '') } catch { return null } })() : null].filter(Boolean)
            return (
              <li key={l.id} className="plvf">
                <span className="plvf__n">{i + 1}</span>
                <button type="button" className={`plvf__ext pkind--${k.tone}`} onClick={(e) => onRun(l, e)} tabIndex={-1} aria-hidden>{k.ext}</button>
                <button type="button" className="plvf__main" onClick={(e) => onRun(l, e)}>
                  <b>{l.title}</b>
                  <span>{meta.join(' · ')}{l.description ? <em> — {l.description}</em> : null}</span>
                </button>
                {l.fileId && <span className="plibprot plvf__prot" title="Faqat platforma ichida ko‘riladi, yuklab olib bo‘lmaydi"><Icon name="lock" size={12} />Himoyalangan</span>}
                <span className="plvf__tools">
                  <a className="plibcard__cta" href={l.url || '#'} target={l.url && !l.fileId ? '_blank' : undefined} rel="noreferrer" onClick={(e) => onRun(l, e)}>
                    <Icon name={l.fileId ? 'eye' : 'externalLink'} size={15} stroke={2} /><span>Ochish</span>
                  </a>
                  <Menu align="right" trigger={<button type="button" className="plibicon" aria-label="Amallar"><Icon name="moreV" size={17} /></button>} items={items} />
                </span>
              </li>
            )
          })}
        </ol>
      )}

      {units.length > 1 && (
        <div className="plv__pager">
          {prev ? <button type="button" onClick={() => onOpenUnit(prev)}><Icon name="arrowLeft" size={16} /><span><small>Oldingi dars</small><b>{prev.title}</b></span></button> : <i />}
          {next ? <button type="button" className="is-next" onClick={() => onOpenUnit(next)}><span><small>Keyingi dars</small><b>{next.title}</b></span><Icon name="arrowRight" size={16} /></button> : <i />}
        </div>
      )}

      {drag && <div className="plv__veil" aria-hidden><Icon name="upload" size={34} /><b>«{unit.title}» darsiga yuklash</b></div>}
    </div>
  )
}

/* ---------- Dars yaratish / tahrirlash ---------- */

export function UnitForm({ open, item, units, onClose, onSaved }) {
  const { user, scope } = useAuth()
  const toast = useToast()
  const isNew = !item?.id
  const [f, setF] = useState({})
  const [err, setErr] = useState({})
  const nextNum = useMemo(() => Math.max(0, ...units.map((u) => u.num || 0)) + 1, [units])
  useFormInit(open, item?.id, () => {
    setErr({})
    setF(isNew
      ? { num: nextNum, title: `Dars ${nextNum}`, description: '', groupIds: [], cover: UNIT_COLORS[(nextNum - 1) % UNIT_COLORS.length] }
      : { num: item.num, title: item.title, description: item.description || '', groupIds: item.groupIds || [], cover: item.cover || UNIT_COLORS[0] })
  })
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }))
  const setNum = (v) => setF((x) => ({ ...x, num: v, title: !x.title || /^Dars \d*$/.test(x.title) ? `Dars ${v}` : x.title }))
  const submit = () => {
    const er = {}
    const num = Number(f.num)
    if (!f.title?.trim()) er.title = 'Dars nomini kiriting'
    if (!Number.isInteger(num) || num < 1 || num > 999) er.num = '1 dan 999 gacha'
    setErr(er); if (Object.keys(er).length) return
    const data = { title: f.title.trim().slice(0, 160), description: f.description?.trim().slice(0, 600) || '', num, groupIds: f.groupIds || [], cover: f.cover }
    if (isNew) {
      if (!scope.orgId) { toast(NO_ORG, 'err'); return }
      const u = add('library', { ...data, type: UNIT, orgId: scope.orgId, authorId: user.id, downloads: 0, author: '', format: '', url: '', fileId: null, tags: [], category: '' })
      logActivity(scope.orgId, user.id, 'kutubxonada dars yaratdi', data.title)
      toast(`«${data.title}» yaratildi — endi fayllarni yuklang`)
      onSaved?.(u)
    } else {
      patch('library', item.id, data)
      // Darsning ko'rish ruxsati uning fayllariga ham o'tadi
      const same = (a, b) => a.length === b.length && a.every((x) => b.includes(x))
      if (!same(data.groupIds, item.groupIds || [])) scope.library.filter((l) => l.unitId === item.id).forEach((l) => patch('library', l.id, { groupIds: data.groupIds }))
      toast('Dars saqlandi')
    }
    onClose()
  }
  return (
    <Modal open={open} onClose={onClose} title={isNew ? 'Yangi dars' : 'Darsni tahrirlash'} sub={isNew ? 'Dars yaratilgach, ichiga fayllarni yuklaysiz' : null} width={560}
      footer={<><Btn onClick={onClose}>Bekor</Btn><Btn variant="primary" icon={isNew ? 'plus' : 'check'} onClick={submit}>{isNew ? 'Darsni yaratish' : 'Saqlash'}</Btn></>}>
      <div className="pform">
        <div className="punitpreview" style={{ '--uc': f.cover }}>
          <span className="plesson__num"><small>DARS</small><b>{pad(f.num)}</b></span>
          <div><b>{f.title || 'Dars nomi'}</b><span>{f.description || 'Qisqacha tavsif'}</span></div>
        </div>
        <div className="pform__row punitform__row">
          <FField label="Raqami" error={err.num}><Input type="number" min="1" max="999" value={f.num ?? ''} onChange={(e) => setNum(e.target.value)} /></FField>
          <FField label="Nomi" error={err.title}><Input value={f.title || ''} onChange={(e) => set('title', e.target.value)} placeholder="Masalan: Dars 1. Murobaha asoslari" autoFocus /></FField>
        </div>
        <FField label="Tavsif"><Textarea value={f.description || ''} onChange={(e) => set('description', e.target.value)} placeholder="Darsda nimalar o‘rganiladi…" rows={3} /></FField>
        <FField label="Rang">
          <div className="punitcolors" role="radiogroup" aria-label="Rang">
            {UNIT_COLORS.map((c) => <button key={c} type="button" role="radio" aria-checked={f.cover === c} aria-label={c} className={cx(f.cover === c && 'is-on')} style={{ background: c }} onClick={() => set('cover', c)}>{f.cover === c && <Icon name="check" size={14} stroke={3} />}</button>)}
          </div>
        </FField>
        <FField label="Kimlar ko‘radi" hint="Darsdagi barcha fayllar shu guruhlarga ko‘rinadi">
          <ChipSelect allLabel="Barcha guruhlar" value={f.groupIds || []} onChange={(v) => set('groupIds', v)} options={scope.groups.map((g) => ({ value: g.id, label: g.name, color: g.color }))} />
        </FField>
      </div>
    </Modal>
  )
}

/* ---------- Darsni o'chirish ---------- */

export function UnitDelete({ unit, count, onClose, onDone }) {
  const toast = useToast()
  const { scope } = useAuth()
  return (
    <Confirm open={!!unit} onClose={onClose} danger title="Darsni o‘chirish" confirmLabel="O‘chirish"
      text={unit ? (count ? `«${unit.title}» va uning ichidagi ${count} ta material o‘chiriladi. Bu amalni qaytarib bo‘lmaydi.` : `«${unit.title}» o‘chiriladi.`) : ''}
      onConfirm={() => {
        scope.library.filter((l) => l.unitId === unit.id).forEach((l) => remove('library', l.id))
        remove('library', unit.id)
        toast('Dars o‘chirildi')
        onDone?.()
      }} />
  )
}

