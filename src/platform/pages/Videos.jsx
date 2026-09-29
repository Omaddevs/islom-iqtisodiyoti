import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '../store/auth.jsx'
import { add, patch, remove, notify, logActivity } from '../store/db.js'
import { PageHead, Card, Btn, Badge, Tabs, Modal, FField, Input, Textarea, ChipSelect, Empty, Icon, UAvatar, Confirm, Menu, useToast, Search, Select, CopyBtn, cx } from '../ui/kit.jsx'
import { fmtDate, fmtDuration, fmtAgo, fmtNum } from '../ui/format.js'

export default function Videos({ param }) {
  if (param) return <VideoPlayer id={param} />
  return <VideoList />
}

/* ---------- Yordamchilar ---------- */

// Ko'rish progressi — foydalanuvchi bo'yicha localStorage'da (backend ulanganda API'ga ko'chadi)
const progKey = (uid) => `ii_video_progress_${uid}`
const loadProg = (uid) => { try { return JSON.parse(localStorage.getItem(progKey(uid))) || {} } catch { return {} } }
function useProgress(uid) {
  const [prog, setProg] = useState(() => loadProg(uid))
  const update = useCallback((vid, data) => setProg((p) => {
    const next = { ...p, [vid]: { ...(p[vid] || {}), ...data, at: Date.now() } }
    try { localStorage.setItem(progKey(uid), JSON.stringify(next)) } catch { /* xotira */ }
    return next
  }), [uid])
  return [prog, update]
}
const pctOf = (p, v) => (!p ? 0 : p.done ? 100 : Math.min(100, Math.round(((p.pos || 0) / v.duration) * 100)))

// "2 soat 15 daq" ko'rinishi
const fmtLong = (sec) => { const h = Math.floor(sec / 3600), m = Math.round((sec % 3600) / 60); return h ? `${h} soat ${m} daq` : `${m} daq` }
// Modullarni tabiiy tartibda: 1-modul, 2-modul … , keyin matnli (Qo'shimcha) oxirida
const modNum = (m) => { const n = parseInt(m, 10); return Number.isNaN(n) ? Infinity : n }
const byModule = (a, b) => modNum(a) - modNum(b) || a.localeCompare(b)
const isNew = (v) => Date.now() - v.createdAt < 3 * 864e5
const KIND = { recording: { label: 'Yozuv', tone: 'red', icon: 'record' }, lesson: { label: 'Dars', tone: 'blue', icon: 'play' } }
const SORTS = [{ value: 'order', label: 'Dars tartibi' }, { value: 'new', label: 'Avval yangilari' }, { value: 'views', label: 'Ko‘p ko‘rilgan' }, { value: 'long', label: 'Uzun darslar' }, { value: 'short', label: 'Qisqa darslar' }]
const sortFn = { order: (a, b) => a.createdAt - b.createdAt, new: (a, b) => b.createdAt - a.createdAt, views: (a, b) => b.views - a.views, long: (a, b) => b.duration - a.duration, short: (a, b) => a.duration - b.duration }
const goTo = (id) => { window.location.hash = `#/platform/videos/${id}` }

/* ---------- Ro'yxat sahifasi ---------- */

function VideoList() {
  const { user, db, scope, can } = useAuth()
  const toast = useToast()
  const [tab, setTab] = useState('all')
  const [q, setQ] = useState('')
  const [mod, setMod] = useState('')
  const [sort, setSort] = useState('order')
  const [view, setView] = useState(() => { try { return localStorage.getItem('ii_video_view') || 'grid' } catch { return 'grid' } })
  const [editing, setEditing] = useState(null)
  const [del, setDel] = useState(null)
  const [prog] = useProgress(user.id)
  const canEdit = user.role !== 'student' && can('content.create')
  const changeView = (v) => { setView(v); try { localStorage.setItem('ii_video_view', v) } catch { /* xotira */ } }

  const all = scope.videos
  const totals = useMemo(() => ({
    sec: all.reduce((s, v) => s + v.duration, 0),
    views: all.reduce((s, v) => s + (v.views || 0), 0),
    rec: all.filter((v) => v.kind === 'recording').length,
    done: all.filter((v) => prog[v.id]?.done).length,
  }), [all, prog])
  const modules = useMemo(() => [...new Set(all.map((v) => v.module))].sort(byModule), [all])

  const list = useMemo(() => {
    const s = q.trim().toLowerCase()
    return all
      .filter((v) => !s || v.title.toLowerCase().includes(s) || (v.description || '').toLowerCase().includes(s) || (db.users.find((u) => u.id === v.authorId)?.name || '').toLowerCase().includes(s))
      .filter((v) => tab === 'all' || v.kind === tab)
      .filter((v) => !mod || v.module === mod)
      .sort(sortFn[sort])
  }, [all, db.users, q, tab, mod, sort])
  const shownModules = modules.filter((m) => list.some((v) => v.module === m))
  const filtered = q || tab !== 'all' || mod
  const clear = () => { setQ(''); setTab('all'); setMod('') }

  // Davom ettirish: oxirgi ko'rilgan, hali tugallanmagan video
  const resume = useMemo(() => {
    const ids = Object.entries(prog).filter(([, p]) => !p.done && (p.pos || 0) > 20).sort((a, b) => b[1].at - a[1].at)
    for (const [id] of ids) { const v = all.find((x) => x.id === id); if (v) return v }
    return null
  }, [prog, all])

  const menuFor = (v) => {
    const mine = v.authorId === user.id || user.role === 'org_admin' || user.role === 'superadmin'
    if (!canEdit || !mine) return null
    return [
      { label: 'Ochish', icon: 'play', onClick: () => goTo(v.id) },
      { label: 'Havolani nusxalash', icon: 'link', onClick: async () => { try { await navigator.clipboard.writeText(`${location.origin}${location.pathname}#/platform/videos/${v.id}`) } catch { /* bloklangan */ } toast('Havola nusxalandi') } },
      'sep',
      { label: 'Tahrirlash', icon: 'edit', onClick: () => setEditing(v) },
      { label: 'O‘chirish', icon: 'trash', danger: true, onClick: () => setDel(v) },
    ]
  }

  return (
    <>
      <PageHead icon="play" title="Video darslar" sub={`${all.length} ta video · ${fmtLong(totals.sec)} umumiy`}
        actions={canEdit && <Btn variant="primary" icon="upload" onClick={() => setEditing({})}>Video qo‘shish</Btn>} />

      {/* Statistika */}
      <div className="pgrid pgrid--4 pvstats">
        <MiniStat icon="play" tone="blue" value={all.length} label="Jami video" hint={`${modules.length} ta modul`} />
        <MiniStat icon="clock" tone="violet" value={fmtLong(totals.sec)} label="Umumiy davomiylik" />
        <MiniStat icon="eye" tone="teal" value={fmtNum(totals.views)} label="Ko‘rishlar" />
        {user.role === 'student'
          ? <MiniStat icon="checkCircle" tone="green" value={`${totals.done}/${all.length}`} label="Ko‘rib bo‘lingan" progress={all.length ? (totals.done / all.length) * 100 : 0} />
          : <MiniStat icon="record" tone="red" value={totals.rec} label="Dars yozuvlari" hint={`${all.length - totals.rec} ta video kurs`} />}
      </div>

      {/* Davom ettirish */}
      {resume && <ResumeCard v={resume} p={prog[resume.id]} author={db.users.find((u) => u.id === resume.authorId)} />}

      {/* Filtr paneli */}
      <div className="pvtool">
        <Tabs value={tab} onChange={setTab} items={[
          { value: 'all', label: 'Barchasi', count: all.length },
          { value: 'lesson', label: 'Video kurs', icon: 'play', count: all.length - totals.rec },
          { value: 'recording', label: 'Dars yozuvlari', icon: 'record', count: totals.rec },
        ]} />
        <div className="pvtool__right">
          <Select value={mod} onChange={setMod} placeholder="Barcha modullar" options={modules.map((m) => ({ value: m, label: m }))} aria-label="Modul" />
          <Select value={sort} onChange={setSort} options={SORTS} aria-label="Saralash" />
          <Search value={q} onChange={setQ} placeholder="Video, ustoz yoki mavzu…" className="pvtool__search" />
          <div className="pseg" role="group" aria-label="Ko‘rinish">
            <button className={cx(view === 'grid' && 'is-on')} onClick={() => changeView('grid')} aria-label="Kartalar" title="Kartalar"><Icon name="grid" size={17} /></button>
            <button className={cx(view === 'list' && 'is-on')} onClick={() => changeView('list')} aria-label="Ro‘yxat" title="Ro‘yxat"><Icon name="list" size={17} /></button>
          </div>
        </div>
      </div>

      {/* Kontent */}
      {list.length === 0 ? (
        <Card>
          {filtered
            ? <Empty icon="search" title="Hech narsa topilmadi" text="Qidiruv yoki filtr shartlariga mos video yo‘q." action={<Btn icon="refresh" onClick={clear}>Filtrni tozalash</Btn>} />
            : <Empty icon="play" title="Hali video yo‘q" text="Yakunlangan jonli darslar avtomatik shu yerga yozuv sifatida tushadi." action={canEdit && <Btn variant="primary" icon="upload" onClick={() => setEditing({})}>Birinchi videoni qo‘shish</Btn>} />}
        </Card>
      ) : shownModules.map((m) => {
        const vids = list.filter((v) => v.module === m)
        const done = vids.filter((v) => prog[v.id]?.done).length
        const n = modNum(m)
        return (
          <section key={m} className="pvmod">
            <header className="pvmod__head">
              <div className="pvmod__ttl">
                <span className={cx('pvmod__n', n === Infinity && 'pvmod__n--x')}>{n === Infinity ? <Icon name="layers" size={18} /> : n}</span>
                <div>
                  <h3>{m}</h3>
                  <span>{vids.length} ta video · {fmtLong(vids.reduce((s, v) => s + v.duration, 0))}</span>
                </div>
              </div>
              {user.role === 'student' && (
                <div className="pvmod__prog" title={`${done} ta ko‘rildi`}>
                  <span className="pprog pprog--sm pprog--green"><span className="pprog__bar" style={{ width: `${vids.length ? (done / vids.length) * 100 : 0}%` }} /></span>
                  <b>{done}/{vids.length}</b>
                </div>
              )}
            </header>
            <div className={view === 'grid' ? 'pgrid pgrid--cards' : 'pvrows'}>
              {vids.map((v, i) => (
                <VideoCard key={v.id} v={v} idx={i + 1} row={view === 'list'} pct={pctOf(prog[v.id], v)} done={!!prog[v.id]?.done}
                  author={db.users.find((u) => u.id === v.authorId)} groups={db.groups.filter((g) => v.groupIds.includes(g.id))} menu={menuFor(v)} />
              ))}
            </div>
          </section>
        )
      })}

      <VideoForm open={!!editing} video={editing} onClose={() => setEditing(null)} />
      <Confirm open={!!del} onClose={() => setDel(null)} danger title="Videoni o‘chirish" text={`«${del?.title}» o‘chiriladi. Bu amalni qaytarib bo‘lmaydi.`} confirmLabel="O‘chirish"
        onConfirm={() => { remove('videos', del.id); toast('Video o‘chirildi') }} />
    </>
  )
}

function MiniStat({ icon, tone, value, label, hint, progress }) {
  return (
    <div className={cx('pstat', `pstat--${tone}`, 'pvstat')}>
      <span className="pstat__icon"><Icon name={icon} size={22} /></span>
      <span className="pstat__body">
        <span className="pstat__value">{value}</span>
        <span className="pstat__label">{label}</span>
        {hint && <span className="pstat__hint">{hint}</span>}
        {progress != null && <span className="pprog pprog--sm pprog--green" style={{ marginTop: 8 }}><span className="pprog__bar" style={{ width: `${progress}%` }} /></span>}
      </span>
    </div>
  )
}

function ResumeCard({ v, p, author }) {
  const pct = pctOf(p, v)
  return (
    <a href={`#/platform/videos/${v.id}`} className="pvresume" style={{ '--vc': v.thumb }}>
      <div className="pvresume__thumb">
        <span className="pvideo__play"><Icon name="play" size={24} /></span>
        <span className="pvideo__dur">{fmtDuration(v.duration - (p.pos || 0))} qoldi</span>
        <i className="pvideo__prog"><b style={{ width: `${pct}%` }} /></i>
      </div>
      <div className="pvresume__body">
        <span className="pvresume__eyebrow"><Icon name="clock" size={14} /> Davom ettirish · {fmtAgo(p.at)}</span>
        <h3>{v.title}</h3>
        <div className="pvresume__meta">
          <span>{v.module}</span>
          <span>{author?.name}</span>
          <span>{pct}% ko‘rilgan</span>
        </div>
      </div>
      <span className="pvresume__cta"><Icon name="play" size={16} /> {fmtDuration(p.pos || 0)} dan davom etish</span>
    </a>
  )
}

function VideoCard({ v, idx, row, pct, done, author, groups, menu }) {
  const k = KIND[v.kind] || KIND.lesson
  const open = (e) => { if (e.target.closest('.pvideo__more')) return; goTo(v.id) }
  const onKey = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); goTo(v.id) } }
  return (
    <article className={cx('pvideo', row && 'pvideo--row', done && 'is-done')} style={{ '--vc': v.thumb }} onClick={open} onKeyDown={onKey} tabIndex={0} role="link" aria-label={v.title}>
      <div className="pvideo__thumb">
        <span className="pvideo__idx">{String(idx).padStart(2, '0')}</span>
        <span className="pvideo__play"><Icon name="play" size={row ? 18 : 26} /></span>
        <span className="pvideo__dur">{fmtDuration(v.duration)}</span>
        <span className="pvideo__kind"><Badge tone={k.tone}><Icon name={k.icon} size={12} /> {k.label}</Badge>{isNew(v) && !row && <Badge tone="green">Yangi</Badge>}</span>
        {done && <span className="pvideo__done" title="Ko‘rib bo‘lingan"><Icon name="check" size={14} stroke={3} /></span>}
        {pct > 0 && !done && <i className="pvideo__prog"><b style={{ width: `${pct}%` }} /></i>}
      </div>
      <div className="pvideo__body">
        <div className="pvideo__top">
          <h4>{v.title}</h4>
          {menu && <span className="pvideo__more"><Menu align="right" trigger={<button className="pvideo__morebtn" aria-label="Amallar"><Icon name="moreV" size={17} /></button>} items={menu} /></span>}
        </div>
        {row && v.description && <p className="pvideo__desc">{v.description}</p>}
        <div className="pvideo__author">
          <UAvatar user={author} size={22} />
          <span>{author?.name || '—'}</span>
          {row && isNew(v) && <Badge tone="green">Yangi</Badge>}
        </div>
        <div className="pvideo__foot">
          <span><Icon name="eye" size={14} /> {fmtNum(v.views || 0)}</span>
          <span><Icon name="calendar" size={14} /> {fmtDate(v.createdAt)}</span>
          {groups.length > 0 && <span className="pvideo__groups" title={groups.map((g) => g.name).join(', ')}>{groups.slice(0, 3).map((g) => <i key={g.id} style={{ background: g.color }} />)}{groups.length > 3 && <small>+{groups.length - 3}</small>}</span>}
          {pct > 0 && <span className="pvideo__pct">{done ? 'Ko‘rildi' : `${pct}%`}</span>}
        </div>
      </div>
    </article>
  )
}

/* ---------- Qo'shish / tahrirlash ---------- */

function VideoForm({ open, video, onClose }) {
  const { user, scope } = useAuth()
  const toast = useToast()
  const isNewV = !video?.id
  const [f, setF] = useState({})
  const [err, setErr] = useState({})
  const modules = [...new Set(scope.videos.map((v) => v.module))].sort(byModule)
  useEffect(() => { if (open) { setErr({}); setF(isNewV ? { title: '', module: modules[0] || '1-modul', groupIds: [], duration: 30, description: '', url: '', kind: 'lesson' } : { ...video, duration: Math.round(video.duration / 60) }) } }, [open, video, isNewV]) // eslint-disable-line
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }))
  const submit = () => {
    const er = {}
    if (!f.title?.trim()) er.title = 'Nomini kiriting'
    if (!(f.duration > 0)) er.duration = 'Davomiylikni kiriting'
    if (f.url && !/^https?:\/\//i.test(f.url.trim())) er.url = 'Havola http(s):// bilan boshlanishi kerak'
    setErr(er); if (Object.keys(er).length) return
    const data = { title: f.title.trim(), module: f.module?.trim() || 'Qo‘shimcha', groupIds: f.groupIds, duration: Number(f.duration) * 60, description: f.description?.trim(), url: f.url?.trim(), kind: f.kind || 'lesson' }
    if (isNewV) {
      const colors = ['#4aa3f8', '#6366f1', '#14b8a6', '#f59e0b', '#8b5cf6']
      add('videos', { ...data, orgId: scope.orgId || scope.groups[0]?.orgId, authorId: user.id, thumb: colors[Math.floor(Math.random() * colors.length)], views: 0 })
      const targets = scope.groups.filter((g) => f.groupIds.length === 0 || f.groupIds.includes(g.id)).flatMap((g) => g.studentIds)
      notify([...new Set(targets)], `Yangi video dars: «${data.title}»`, '#/platform/videos')
      logActivity(scope.orgId, user.id, 'video dars qo‘shdi', data.title)
      toast('Video qo‘shildi')
    } else { patch('videos', video.id, data); toast('Saqlandi') }
    onClose()
  }
  return (
    <Modal open={open} onClose={onClose} title={isNewV ? 'Video dars qo‘shish' : 'Videoni tahrirlash'} sub="Video fayl yoki YouTube/Vimeo havolasi"
      footer={<><Btn onClick={onClose}>Bekor</Btn><Btn variant="primary" icon={isNewV ? 'plus' : 'check'} onClick={submit}>{isNewV ? 'Qo‘shish' : 'Saqlash'}</Btn></>}>
      <div className="pform">
        <FField label="Nomi" error={err.title}><Input value={f.title || ''} onChange={(e) => set('title', e.target.value)} placeholder="Masalan: Zakot hisob-kitobi" autoFocus /></FField>
        <div className="pform__row">
          <FField label="Modul" hint={modules.length ? `Mavjud: ${modules.join(', ')}` : undefined}><Input value={f.module || ''} onChange={(e) => set('module', e.target.value)} placeholder="1-modul" list="pv-modules" /><datalist id="pv-modules">{modules.map((m) => <option key={m} value={m} />)}</datalist></FField>
          <FField label="Davomiylik (daqiqa)" error={err.duration}><Input type="number" min="1" value={f.duration || ''} onChange={(e) => set('duration', e.target.value)} /></FField>
        </div>
        <FField label="Turi">
          <div className="pvkind">
            {Object.entries(KIND).map(([k, d]) => (
              <button key={k} type="button" className={cx('pvkind__opt', (f.kind || 'lesson') === k && 'is-on')} onClick={() => set('kind', k)}>
                <Icon name={d.icon} size={16} /> {k === 'lesson' ? 'Video kurs' : 'Dars yozuvi'}
              </button>
            ))}
          </div>
        </FField>
        <FField label="Video havolasi" hint="Backend ulanganda fayl yuklash ham qo‘shiladi" error={err.url}><Input value={f.url || ''} onChange={(e) => set('url', e.target.value)} placeholder="https://youtube.com/watch?v=…" /></FField>
        <FField label="Kimlar ko‘radi"><ChipSelect allLabel="Barcha guruhlar" value={f.groupIds || []} onChange={(v) => set('groupIds', v)} options={scope.groups.map((g) => ({ value: g.id, label: g.name, color: g.color }))} /></FField>
        <FField label="Tavsif"><Textarea value={f.description || ''} onChange={(e) => set('description', e.target.value)} placeholder="Darsda nimalar o‘rganiladi…" /></FField>
      </div>
    </Modal>
  )
}

/* ---------- Pleyer sahifasi ---------- */

const RATES = [0.75, 1, 1.25, 1.5, 2]

function VideoPlayer({ id }) {
  const { user, db, scope } = useAuth()
  const toast = useToast()
  const v = db.videos.find((x) => x.id === id)
  const [prog, setProgress] = useProgress(user.id)
  const [playing, setPlaying] = useState(false)
  const [pos, setPos] = useState(() => prog[id]?.done ? 0 : prog[id]?.pos || 0)
  const [rate, setRate] = useState(1)
  const [auto, setAuto] = useState(() => { try { return localStorage.getItem('ii_video_auto') !== '0' } catch { return true } })
  const [full, setFull] = useState(false)
  const stageRef = useRef(null)
  const posRef = useRef(pos)
  posRef.current = pos

  // Ko'rishlar sonini bir marta oshiramiz
  useEffect(() => { if (v) patch('videos', v.id, { views: (v.views || 0) + 1 }) }, [id]) // eslint-disable-line

  // Modul playlisti va qo'shni videolar
  const playlist = useMemo(() => (v ? scope.videos.filter((x) => x.module === v.module).sort((a, b) => a.createdAt - b.createdAt) : []), [scope.videos, v])
  const at = playlist.findIndex((x) => x.id === id)
  const prev = playlist[at - 1], next = playlist[at + 1]

  const finish = useCallback(() => {
    setPlaying(false)
    setProgress(id, { pos: v.duration, done: true })
    if (auto && next) setTimeout(() => goTo(next.id), 600)
  }, [id, v, auto, next, setProgress])

  // Demo pleyer: taymer. Har 5 soniyada progress saqlanadi
  useEffect(() => {
    if (!playing || !v) return
    const t = setInterval(() => {
      const n = posRef.current + rate
      if (n >= v.duration) { setPos(v.duration); finish(); return }
      setPos(n)
      if (Math.floor(n) % 5 < rate) setProgress(id, { pos: Math.floor(n) })
    }, 1000)
    return () => clearInterval(t)
  }, [playing, v, rate, id, finish, setProgress])

  // Sahifadan chiqishda joriy pozitsiyani saqlab qo'yamiz
  useEffect(() => () => { if (v && posRef.current > 5 && posRef.current < v.duration) setProgress(id, { pos: Math.floor(posRef.current) }) }, [id]) // eslint-disable-line

  // Klaviatura: Space — play/pauza, ←/→ — 10 soniya, F — to'liq ekran
  useEffect(() => {
    const onKey = (e) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return
      if (!v) return
      if (e.code === 'Space') { e.preventDefault(); setPlaying((p) => !p) }
      if (e.key === 'ArrowRight') setPos((p) => Math.min(v.duration, p + 10))
      if (e.key === 'ArrowLeft') setPos((p) => Math.max(0, p - 10))
      if (e.key === 'f' || e.key === 'F') toggleFull()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [v]) // eslint-disable-line
  useEffect(() => { const h = () => setFull(!!document.fullscreenElement); document.addEventListener('fullscreenchange', h); return () => document.removeEventListener('fullscreenchange', h) }, [])
  const toggleFull = () => { const el = stageRef.current; if (!el) return; if (document.fullscreenElement) document.exitFullscreen?.(); else el.requestFullscreen?.() }

  if (!v) return <Card><Empty icon="play" title="Video topilmadi" text="Havola eskirgan yoki video o‘chirilgan bo‘lishi mumkin." action={<Btn as="a" href="#/platform/videos" icon="arrowLeft">Video darslarga qaytish</Btn>} /></Card>

  const a = db.users.find((u) => u.id === v.authorId)
  const groups = db.groups.filter((g) => v.groupIds.includes(g.id))
  const k = KIND[v.kind] || KIND.lesson
  const p = prog[id]
  const yt = v.url && /youtu\.?be/.test(v.url) ? v.url.replace('watch?v=', 'embed/').replace('youtu.be/', 'www.youtube.com/embed/') : null
  const seek = (e) => { const r = e.currentTarget.getBoundingClientRect(); setPos(Math.max(0, Math.min(v.duration, ((e.clientX - r.left) / r.width) * v.duration))) }
  const markDone = () => { setProgress(id, { pos: v.duration, done: true }); setPlaying(false); toast('Ko‘rib bo‘lingan deb belgilandi') }
  const unmark = () => { setProgress(id, { pos: 0, done: false }); setPos(0); toast('Belgi olib tashlandi') }
  const setAutoplay = (val) => { setAuto(val); try { localStorage.setItem('ii_video_auto', val ? '1' : '0') } catch { /* xotira */ } }
  const doneCount = playlist.filter((x) => prog[x.id]?.done).length

  return (
    <>
      <PageHead crumbs={[{ label: 'Video darslar', href: '#/platform/videos' }, { label: v.module }]} title={v.title}
        actions={<>
          <Btn as="a" href={prev ? `#/platform/videos/${prev.id}` : undefined} icon="chevLeft" aria-disabled={!prev} className={cx(!prev && 'is-disabled')}>Oldingi</Btn>
          <Btn as="a" href={next ? `#/platform/videos/${next.id}` : undefined} variant="primary" aria-disabled={!next} className={cx(!next && 'is-disabled')}>Keyingi dars <Icon name="chevRight" size={17} stroke={2} /></Btn>
        </>} />

      <div className="pgrid pgrid--main pvplay">
        <div className="pstack-v" style={{ gap: 20 }}>
          <div ref={stageRef} className={cx('pplayer', playing && 'is-playing', full && 'is-full')} style={{ '--vc': v.thumb }}>
            {yt ? <iframe src={yt} title={v.title} className="pplayer__frame" allow="autoplay; fullscreen; picture-in-picture" allowFullScreen />
              : v.url ? <video src={v.url} controls className="pplayer__frame" />
                : (
                  <>
                    <div className="pplayer__stage" onClick={() => setPlaying((x) => !x)}>
                      <span className="pplayer__idx">{at + 1} / {playlist.length}</span>
                      <button className="pplayer__big" aria-label={playing ? 'Pauza' : 'Ijro'} onClick={(e) => { e.stopPropagation(); setPlaying((x) => !x) }}>
                        <Icon name={playing ? 'pause' : 'play'} size={38} />
                      </button>
                      {!playing && pos > 0 && pos < v.duration && <span className="pplayer__hint">{fmtDuration(pos)} dan davom etish</span>}
                      {pos >= v.duration && next && <span className="pplayer__hint">{auto ? 'Keyingi dars ochilmoqda…' : 'Dars yakunlandi'}</span>}
                    </div>
                    <div className="pplayer__ctrl" onClick={(e) => e.stopPropagation()}>
                      <div className="pplayer__bar" onClick={seek} role="slider" aria-valuenow={Math.round(pos)} aria-valuemin={0} aria-valuemax={v.duration} aria-label="Vaqt">
                        <i style={{ width: `${(pos / v.duration) * 100}%` }} /><b style={{ left: `${(pos / v.duration) * 100}%` }} />
                      </div>
                      <div className="pplayer__row">
                        <button onClick={() => setPlaying((x) => !x)} aria-label={playing ? 'Pauza' : 'Ijro'}><Icon name={playing ? 'pause' : 'play'} size={18} /></button>
                        <button onClick={() => setPos((x) => Math.max(0, x - 10))} aria-label="10 soniya orqaga" title="−10s"><Icon name="chevLeft" size={18} /></button>
                        <button onClick={() => setPos((x) => Math.min(v.duration, x + 10))} aria-label="10 soniya oldinga" title="+10s"><Icon name="chevRight" size={18} /></button>
                        <span className="pplayer__t">{fmtDuration(pos)} <em>/ {fmtDuration(v.duration)}</em></span>
                        <span className="pplayer__sp" />
                        <button className="pplayer__rate" onClick={() => setRate(RATES[(RATES.indexOf(rate) + 1) % RATES.length])} title="Tezlik">{rate}×</button>
                        <button aria-label="Ovoz"><Icon name="volume" size={18} /></button>
                        <button onClick={toggleFull} aria-label="To‘liq ekran"><Icon name="maximize" size={18} /></button>
                      </div>
                    </div>
                    <span className="pplayer__demo">Demo pleyer · video fayl backend orqali ulanadi</span>
                  </>
                )}
          </div>

          <Card className="pvinfo">
            <div className="pvinfo__head">
              <div className="prow" style={{ gap: 14 }}>
                <UAvatar user={a} size={46} />
                <div><b style={{ display: 'block', fontSize: 15 }}>{a?.name}</b><span className="pmuted" style={{ fontSize: 13 }}>{a?.title || 'Ustoz'}</span></div>
              </div>
              <div className="pvinfo__meta">
                <Badge tone={k.tone}><Icon name={k.icon} size={12} /> {v.kind === 'recording' ? 'Dars yozuvi' : 'Video dars'}</Badge>
                <span><Icon name="eye" size={14} /> {fmtNum(v.views || 0)} ko‘rish</span>
                <span><Icon name="calendar" size={14} /> {fmtDate(v.createdAt)}</span>
                <span><Icon name="clock" size={14} /> {fmtLong(v.duration)}</span>
              </div>
            </div>
            {v.description ? <p className="pvinfo__desc">{v.description}</p> : <p className="pvinfo__desc pmuted">Tavsif kiritilmagan.</p>}
            <div className="pvinfo__foot">
              <div className="prow">{groups.length ? groups.map((g) => <Badge key={g.id} tone="gray"><i className="pvdot" style={{ background: g.color }} /> {g.name}</Badge>) : <Badge tone="gray"><Icon name="users" size={12} /> Barcha guruhlar</Badge>}</div>
              <div className="prow">
                <CopyBtn text={`${location.origin}${location.pathname}#/platform/videos/${v.id}`} label="Havola" />
                {p?.done
                  ? <Btn size="sm" variant="success" icon="checkCircle" onClick={unmark}>Ko‘rib bo‘lingan</Btn>
                  : <Btn size="sm" icon="check" onClick={markDone}>Ko‘rildi deb belgilash</Btn>}
              </div>
            </div>
          </Card>
        </div>

        <Card pad={false} className="pvlist">
          <header className="pvlist__head">
            <div>
              <h3 className="pcard__title">{v.module}</h3>
              <p className="pcard__sub">{playlist.length} ta dars · {doneCount} ta ko‘rildi</p>
            </div>
            <label className="pvswitch" title="Dars tugagach keyingisini avtomatik ochish">
              <span>Avto</span>
              <input type="checkbox" checked={auto} onChange={(e) => setAutoplay(e.target.checked)} /><i />
            </label>
          </header>
          <div className="pvlist__prog"><span className="pprog pprog--sm pprog--green"><span className="pprog__bar" style={{ width: `${playlist.length ? (doneCount / playlist.length) * 100 : 0}%` }} /></span></div>
          <div className="pvlist__items">
            {playlist.map((r, i) => {
              const rp = prog[r.id]
              const cur = r.id === id
              return (
                <a key={r.id} href={`#/platform/videos/${r.id}`} className={cx('pvitem', cur && 'is-cur', rp?.done && 'is-done')} style={{ '--vc': r.thumb }} aria-current={cur ? 'page' : undefined}>
                  <span className="pvitem__n">{rp?.done ? <Icon name="check" size={14} stroke={3} /> : cur ? <Icon name="play" size={13} /> : i + 1}</span>
                  <span className="pvitem__thumb"><Icon name={KIND[r.kind]?.icon || 'play'} size={14} />{!rp?.done && pctOf(rp, r) > 0 && <i style={{ width: `${pctOf(rp, r)}%` }} />}</span>
                  <span className="pvitem__body">
                    <b>{r.title}</b>
                    <span>{fmtDuration(r.duration)} · {fmtNum(r.views || 0)} ko‘rish{cur && ' · hozir'}</span>
                  </span>
                </a>
              )
            })}
          </div>
          {next && (
            <a href={`#/platform/videos/${next.id}`} className="pvlist__next">
              <span>Keyingi dars</span>
              <b>{next.title}</b>
              <Icon name="arrowRight" size={16} />
            </a>
          )}
        </Card>
      </div>
    </>
  )
}
