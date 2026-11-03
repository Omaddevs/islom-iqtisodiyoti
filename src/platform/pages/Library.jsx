import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '../store/auth.jsx'
import { add, patch, remove, notify, logActivity, NO_ORG } from '../store/db.js'
import { PageHead, Card, Btn, Badge, Modal, FField, Input, Textarea, Select, ChipSelect, Empty, Icon, Confirm, Menu, useToast, cx } from '../ui/kit.jsx'
import { fmtDate, fmtDuration, fmtNum } from '../ui/format.js'

/* ---------- Ma'lumotnomalar ---------- */

// Material turlari: badge rangi, ikonka va asosiy amal
const TYPES = {
  book: { label: 'Kitob', tab: 'Kitoblar', icon: 'bookOpen', tone: 'green' },
  article: { label: 'Maqola', tab: 'Maqolalar', icon: 'fileText', tone: 'violet' },
  audio: { label: 'Audio', tab: 'Audio', icon: 'headphones', tone: 'amber' },
  video: { label: 'Video', tab: 'Video', icon: 'play', tone: 'red' },
  research: { label: 'Tadqiqot', tab: 'Tadqiqot hisobotlari', icon: 'clipboard', tone: 'blue' },
  standard: { label: 'Standart', tab: 'Standartlar', icon: 'scale', tone: 'teal' },
  textbook: { label: 'Darslik', tab: 'Darsliklar', icon: 'book', tone: 'blue' },
  pdf: { label: 'PDF', icon: 'fileText', tone: 'violet' },
  link: { label: 'Havola', icon: 'globe', tone: 'teal' },
}
// "Boshqa" tabi — alohida tabga ega bo'lmagan turlar
const OTHER = ['pdf', 'link']
const TABS = [
  { value: 'all', label: 'Barchasi', icon: 'bookOpen' },
  ...['book', 'article', 'audio', 'video', 'research', 'standard', 'textbook'].map((k) => ({ value: k, label: TYPES[k].tab, icon: TYPES[k].icon })),
  { value: 'other', label: 'Boshqa', icon: 'layers' },
]
const ACTION = {
  audio: { label: 'Tinglash', icon: 'play' },
  video: { label: 'Tomosha qilish', icon: 'play' },
  article: { label: 'O‘qish', icon: 'fileText' },
  pdf: { label: 'O‘qish', icon: 'fileText' },
  link: { label: 'Ochish', icon: 'externalLink' },
}
const actionOf = (l) => ACTION[l.type] || { label: 'Yuklab olish', icon: 'download' }
const LANGS = { uz: 'O‘zbek', ar: 'Arab', en: 'Ingliz', ru: 'Rus' }
const FORMATS = ['PDF', 'EPUB', 'MP3', 'MP4', 'Havola']
const SORTS = [
  { value: 'new', label: 'Yangidan eski' },
  { value: 'old', label: 'Eskidan yangi' },
  { value: 'year', label: 'Nashr yili' },
  { value: 'popular', label: 'Ko‘p yuklangan' },
  { value: 'title', label: 'Nomi (A–Z)' },
]
const sortFn = {
  new: (a, b) => b.createdAt - a.createdAt,
  old: (a, b) => a.createdAt - b.createdAt,
  year: (a, b) => (b.year || 0) - (a.year || 0),
  popular: (a, b) => (b.downloads || 0) - (a.downloads || 0),
  title: (a, b) => a.title.localeCompare(b.title),
}
const inTab = (l, tab) => tab === 'all' || (tab === 'other' ? OTHER.includes(l.type) || !TYPES[l.type] : l.type === tab)
const MONTH = 30 * 864e5

// "320 bet", "45 daqiqa", "1:25:30"
const sizeOf = (l) => {
  if (l.type === 'video' && l.duration) return 'Video dars'
  if (l.type === 'audio' && l.duration) return l.duration >= 3600 ? `${Math.round(l.duration / 360) / 10} soat` : `${Math.round(l.duration / 60)} daqiqa`
  if (l.pages) return `${l.pages} bet`
  if (l.type === 'link' && l.url) { try { return new URL(l.url).hostname.replace(/^www\./, '') } catch { return 'Havola' } }
  return null
}

// Saqlanganlar — foydalanuvchi bo'yicha localStorage'da (backend ulanganda API'ga ko'chadi)
const savedKey = (uid) => `ii_lib_saved_${uid}`
function useSaved(uid) {
  const [saved, setSaved] = useState(() => { try { return JSON.parse(localStorage.getItem(savedKey(uid))) || [] } catch { return [] } })
  const toggle = useCallback((id) => setSaved((s) => {
    const next = s.includes(id) ? s.filter((x) => x !== id) : [id, ...s]
    try { localStorage.setItem(savedKey(uid), JSON.stringify(next)) } catch { /* xotira */ }
    return next
  }), [uid])
  return [saved, toggle]
}

/* ---------- Sahifa ---------- */

export default function Library() {
  const { user, db, scope, can } = useAuth()
  const toast = useToast()
  const [tab, setTab] = useState('all')
  const [q, setQ] = useState('')
  const [cat, setCat] = useState('')
  const [fmt, setFmt] = useState('')
  const [lang, setLang] = useState('')
  const [year, setYear] = useState('')
  const [sort, setSort] = useState('new')
  const [onlySaved, setOnlySaved] = useState(false)
  const [showFilters, setShowFilters] = useState(() => typeof window === 'undefined' || window.innerWidth > 1024)
  const [view, setView] = useState(() => { try { return localStorage.getItem('ii_lib_view') || 'grid' } catch { return 'grid' } })
  const [open, setOpen] = useState(null)
  const [editing, setEditing] = useState(null)
  const [del, setDel] = useState(null)
  const [saved, toggleSaved] = useSaved(user.id)
  const canEdit = user.role !== 'student' && can('content.create')
  const changeView = (v) => { setView(v); try { localStorage.setItem('ii_lib_view', v) } catch { /* xotira */ } }

  const all = scope.library
  const count = (fn) => all.filter(fn).length
  const fresh = count((l) => Date.now() - l.createdAt < MONTH)
  const savedCount = count((l) => saved.includes(l.id))
  const categories = useMemo(() => [...new Set(all.map((l) => l.category).filter(Boolean))].sort(), [all])
  const years = useMemo(() => [...new Set(all.map((l) => l.year).filter(Boolean))].sort((a, b) => b - a), [all])
  const langs = useMemo(() => Object.keys(LANGS).filter((k) => all.some((l) => (l.lang || 'uz') === k)), [all])

  const list = useMemo(() => {
    const s = q.trim().toLowerCase()
    return all
      .filter((l) => inTab(l, tab))
      .filter((l) => !s || [l.title, l.author, l.description, l.category, ...(l.tags || [])].some((x) => (x || '').toLowerCase().includes(s)))
      .filter((l) => !cat || l.category === cat)
      .filter((l) => !fmt || l.format === fmt)
      .filter((l) => !lang || (l.lang || 'uz') === lang)
      .filter((l) => !year || String(l.year) === year)
      .filter((l) => !onlySaved || saved.includes(l.id))
      .sort(sortFn[sort])
  }, [all, tab, q, cat, fmt, lang, year, onlySaved, saved, sort])

  const activeFilters = [cat, fmt, lang, year].filter(Boolean).length
  const filtered = q || tab !== 'all' || activeFilters || onlySaved
  const clear = () => { setQ(''); setTab('all'); setCat(''); setFmt(''); setLang(''); setYear(''); setOnlySaved(false) }

  // Asosiy amal: fayl/havolani ochish, yuklashlar sonini oshirish
  const run = (l, e) => {
    if (!l.url) { e?.preventDefault(); toast('Bu material uchun havola hali qo‘shilmagan', 'err'); return }
    patch('library', l.id, { downloads: (l.downloads || 0) + 1 })
  }
  const save = (l) => { toast(saved.includes(l.id) ? 'Saqlanganlardan olib tashlandi' : 'Saqlanganlarga qo‘shildi'); toggleSaved(l.id) }
  const menuFor = (l) => {
    const mine = l.authorId === user.id || user.role === 'org_admin' || user.role === 'superadmin'
    return [
      { label: 'Batafsil', icon: 'info', onClick: () => setOpen(l) },
      { label: saved.includes(l.id) ? 'Saqlanganlardan olish' : 'Saqlab qo‘yish', icon: 'bookmark', onClick: () => save(l) },
      l.url && { label: 'Havolani nusxalash', icon: 'link', onClick: async () => { try { await navigator.clipboard.writeText(l.url) } catch { /* bloklangan */ } toast('Havola nusxalandi') } },
      ...(canEdit && mine ? ['sep', { label: 'Tahrirlash', icon: 'edit', onClick: () => setEditing(l) }, { label: 'O‘chirish', icon: 'trash', danger: true, onClick: () => setDel(l) }] : []),
    ]
  }
  const pickTag = (t) => { setQ(t); setTab('all'); setOpen(null) }

  return (
    <>
      <PageHead icon="bookOpen" title="Kutubxona" sub="Bilim manbalari bir joyda"
        actions={canEdit && <Btn variant="primary" icon="plus" onClick={() => setEditing({})}>Material qo‘shish</Btn>} />

      {/* Statistika */}
      <div className="plibstats">
        <LibStat icon="bookOpen" tone="violet" value={all.length} label="Jami materiallar" trend={fresh ? `+${fresh} bu oy` : null} />
        <LibStat icon="fileText" tone="blue" value={count((l) => ['book', 'textbook'].includes(l.type))} label="Kitoblar" onClick={() => setTab('book')} />
        <LibStat icon="fileText" tone="violet" value={count((l) => ['article', 'research'].includes(l.type))} label="Ilmiy maqolalar" onClick={() => setTab('article')} />
        <LibStat icon="headphones" tone="green" value={count((l) => l.type === 'audio')} label="Audio materiallar" onClick={() => setTab('audio')} />
        <LibStat icon="play" tone="red" value={count((l) => l.type === 'video')} label="Video materiallar" onClick={() => setTab('video')} />
      </div>

      {/* Qidiruv va filtrlar */}
      <div className="plibbar">
        <div className="plibbar__search">
          <label className="plibsearch">
            <Icon name="search" size={18} />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Kitob, muallif yoki kalit so‘z qidiring…" aria-label="Qidirish" />
            {q && <button type="button" onClick={() => setQ('')} aria-label="Tozalash"><Icon name="x" size={14} /></button>}
          </label>
          <button type="button" className={cx('plibbar__ftoggle', showFilters && 'is-on')} onClick={() => setShowFilters((v) => !v)} aria-expanded={showFilters} aria-label="Filtrlar" title="Filtrlar">
            <Icon name="filter" size={18} />
            {activeFilters > 0 && <b>{activeFilters}</b>}
          </button>
        </div>
        {showFilters && (
          <div className="plibbar__filters">
            <Select value={cat} onChange={setCat} placeholder="Barcha toifalar" options={categories.map((c) => ({ value: c, label: c }))} aria-label="Toifa" />
            <Select value={fmt} onChange={setFmt} placeholder="Barcha formatlar" options={FORMATS.filter((f) => all.some((l) => l.format === f)).map((f) => ({ value: f, label: f }))} aria-label="Format" />
            <Select value={lang} onChange={setLang} placeholder="Barcha tillar" options={langs.map((k) => ({ value: k, label: LANGS[k] }))} aria-label="Til" />
            <Select value={year} onChange={setYear} placeholder="Nashr yili" options={years.map((y) => ({ value: String(y), label: String(y) }))} aria-label="Nashr yili" />
            <span className="plibsort"><Icon name="sort" size={16} /><Select value={sort} onChange={setSort} options={SORTS} aria-label="Saralash" /></span>
          </div>
        )}
      </div>

      {/* Turlar va ko'rinish */}
      <div className="plibnav">
        <div className="plibtabs" role="tablist">
          {TABS.map((t) => {
            const n = count((l) => inTab(l, t.value))
            return (
              <button key={t.value} role="tab" aria-selected={tab === t.value} className={cx('plibtabs__tab', tab === t.value && 'is-on')} onClick={() => setTab(t.value)} title={`${n} ta material`}>
                <Icon name={t.icon} size={16} />{t.label}
              </button>
            )
          })}
        </div>
        <div className="plibnav__right">
          <button type="button" className={cx('plibsaved', onlySaved && 'is-on')} onClick={() => setOnlySaved((v) => !v)} aria-pressed={onlySaved} aria-label="Saqlanganlar" title="Saqlanganlar">
            <Icon name="bookmark" size={17} />{savedCount > 0 && <b>{savedCount}</b>}
          </button>
          <div className="plibview" role="group" aria-label="Ko‘rinish">
            <button className={cx(view === 'grid' && 'is-on')} onClick={() => changeView('grid')} aria-pressed={view === 'grid'}><Icon name="grid" size={16} /> Karta</button>
            <button className={cx(view === 'list' && 'is-on')} onClick={() => changeView('list')} aria-pressed={view === 'list'}><Icon name="list" size={16} /> Ro‘yxat</button>
          </div>
        </div>
      </div>

      {filtered && list.length > 0 && (
        <div className="plibresult">
          <span><b>{list.length}</b> ta material topildi</span>
          <button type="button" onClick={clear}><Icon name="x" size={14} /> Filtrni tozalash</button>
        </div>
      )}

      {/* Kontent */}
      {list.length === 0 ? (
        <Card>
          {filtered
            ? <Empty icon="search" title="Hech narsa topilmadi" text={onlySaved && !saved.length ? 'Hali hech narsa saqlanmagan. Kartadagi xatcho‘p belgisini bosing.' : 'Qidiruv yoki filtr shartlariga mos material yo‘q.'} action={<Btn icon="refresh" onClick={clear}>Filtrni tozalash</Btn>} />
            : <Empty icon="bookOpen" title="Kutubxona hali bo‘sh" text="Kitoblar, maqolalar, audio va video materiallarni shu yerga joylang." action={canEdit && <Btn variant="primary" icon="plus" onClick={() => setEditing({})}>Birinchi materialni qo‘shish</Btn>} />}
        </Card>
      ) : (
        <div className={view === 'grid' ? 'plibgrid' : 'pliblist'}>
          {list.map((l) => (
            <LibCard key={l.id} l={l} row={view === 'list'} saved={saved.includes(l.id)} onOpen={() => setOpen(l)} onRun={run} onSave={() => save(l)} onTag={pickTag} menu={menuFor(l)} />
          ))}
        </div>
      )}

      <LibDetail item={open && all.find((x) => x.id === open.id)} onClose={() => setOpen(null)} groups={db.groups} uploader={open && db.users.find((u) => u.id === open.authorId)}
        saved={open && saved.includes(open.id)} onSave={() => save(open)} onRun={run} onTag={pickTag} />
      <LibForm open={!!editing} item={editing} onClose={() => setEditing(null)} categories={categories} />
      <Confirm open={!!del} onClose={() => setDel(null)} danger title="Materialni o‘chirish" text={`«${del?.title}» o‘chiriladi. Bu amalni qaytarib bo‘lmaydi.`} confirmLabel="O‘chirish" onConfirm={() => { remove('library', del.id); toast('Material o‘chirildi') }} />
    </>
  )
}

function LibStat({ icon, tone, value, label, trend, onClick }) {
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag className={cx('plibstat', `plibstat--${tone}`)} onClick={onClick} type={onClick ? 'button' : undefined}>
      <span className="plibstat__icon"><Icon name={icon} size={24} /></span>
      <span className="plibstat__body">
        <b>{fmtNum(value)}</b>
        <span>{label}</span>
        {trend && <em><Icon name="arrowUpRight" size={13} stroke={2.4} /> {trend}</em>}
      </span>
    </Tag>
  )
}

/* ---------- Muqova ---------- */

// Har bir tur uchun o'ziga xos muqova: kitob, qog'oz varaq, audio to'lqin, video kadr, hisobot grafigi
function Cover({ l, size = 'md' }) {
  const t = l.type
  const style = { '--bc': l.cover || '#3b82f6' }
  if (t === 'audio') {
    return (
      <div className={cx('plibcov', 'plibcov--audio', `plibcov--${size}`)} style={style}>
        <span className="plibcov__wave">{[5, 9, 14, 8, 12, 6, 10].map((h, i) => <i key={i} style={{ height: h * 2 }} />)}</span>
        <Icon name="headphones" size={size === 'sm' ? 22 : 40} stroke={1.6} />
      </div>
    )
  }
  if (t === 'video') {
    return (
      <div className={cx('plibcov', 'plibcov--video', `plibcov--${size}`)} style={style}>
        <span className="plibcov__play"><Icon name="play" size={size === 'sm' ? 18 : 30} /></span>
        {l.duration > 0 && size !== 'sm' && <span className="plibcov__dur"><Icon name="play" size={11} /> {fmtDuration(l.duration)}</span>}
      </div>
    )
  }
  if (t === 'article' || t === 'pdf') {
    return (
      <div className={cx('plibcov', 'plibcov--paper', `plibcov--${size}`)}>
        <span className="plibcov__ptitle">{l.title}</span>
        <span className="plibcov__lines">{Array.from({ length: 11 }, (_, i) => <i key={i} style={{ width: `${[100, 92, 96, 70, 100, 88, 94, 60, 100, 84, 76][i]}%` }} />)}</span>
        {t === 'pdf' && <span className="plibcov__pdf">PDF</span>}
      </div>
    )
  }
  if (t === 'research') {
    return (
      <div className={cx('plibcov', 'plibcov--report', `plibcov--${size}`)} style={style}>
        <span className="plibcov__rtitle">{l.title}</span>
        <span className="plibcov__bars">{[30, 45, 38, 60, 52, 78, 92].map((h, i) => <i key={i} style={{ height: `${h}%` }} />)}</span>
      </div>
    )
  }
  if (t === 'link') {
    return (
      <div className={cx('plibcov', 'plibcov--link', `plibcov--${size}`)} style={style}>
        <Icon name="globe" size={size === 'sm' ? 22 : 38} stroke={1.6} />
        {size !== 'sm' && <span className="plibcov__host">{sizeOf(l)}</span>}
      </div>
    )
  }
  // Kitob, darslik, standart — bosma muqova
  return (
    <div className={cx('plibcov', 'plibcov--book', t === 'standard' && 'plibcov--std', `plibcov--${size}`)} style={style}>
      <span className="plibcov__frame">
        {t === 'standard'
          ? <><b className="plibcov__org">{l.author}</b><Icon name="scale" size={size === 'sm' ? 14 : 26} stroke={1.6} /></>
          : <><span className="plibcov__btitle">{l.title}</span><Icon name={t === 'textbook' ? 'award' : 'bank'} size={size === 'sm' ? 12 : 24} stroke={1.5} /></>}
      </span>
    </div>
  )
}

/* ---------- Karta ---------- */

function LibCard({ l, row, saved, onOpen, onRun, onSave, onTag, menu }) {
  const t = TYPES[l.type] || TYPES.pdf
  const a = actionOf(l)
  const size = sizeOf(l)
  const stop = (e) => e.stopPropagation()
  const onKey = (e) => { if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onOpen() } }
  return (
    <article className={cx('plibcard', row && 'plibcard--row')} onClick={onOpen} onKeyDown={onKey} tabIndex={0} aria-label={l.title}>
      <Cover l={l} size={row ? 'sm' : 'md'} />
      <div className="plibcard__body">
        <div className="plibcard__head">
          <Badge tone={t.tone}>{t.label}</Badge>
          {row && l.category && <span className="plibcard__cat">{l.category}</span>}
        </div>
        <h4 title={l.title}>{l.title}</h4>
        <div className="plibcard__meta">
          <span className="plibcard__author">{l.author || '—'}</span>
          <span>{[l.year, size].filter(Boolean).join(' · ')}</span>
        </div>
        {l.description && <p className="plibcard__desc">{l.description}</p>}
        {(l.tags || []).length > 0 && (
          <div className="plibcard__tags" onClick={stop}>
            {l.tags.slice(0, row ? 4 : 2).map((tag) => <button key={tag} type="button" onClick={() => onTag(tag)}>{tag}</button>)}
          </div>
        )}
        <div className="plibcard__foot" onClick={stop}>
          <a className="plibcard__cta" href={l.url || '#'} target={l.url ? '_blank' : undefined} rel="noreferrer" onClick={(e) => onRun(l, e)}>
            <Icon name={a.icon} size={15} stroke={2} /> {a.label}
          </a>
          <span className="plibcard__tools">
            <button type="button" className={cx('plibicon', saved && 'is-on')} onClick={onSave} aria-pressed={saved} aria-label={saved ? 'Saqlanganlardan olish' : 'Saqlab qo‘yish'} title={saved ? 'Saqlangan' : 'Saqlab qo‘yish'}>
              <Icon name="bookmark" size={17} />
            </button>
            <Menu align="right" trigger={<button type="button" className="plibicon" aria-label="Amallar"><Icon name="moreV" size={17} /></button>} items={menu} />
          </span>
        </div>
      </div>
    </article>
  )
}

/* ---------- Batafsil ---------- */

function LibDetail({ item: l, onClose, groups, uploader, saved, onSave, onRun, onTag }) {
  if (!l) return null
  const t = TYPES[l.type] || TYPES.pdf
  const a = actionOf(l)
  const gs = groups.filter((g) => l.groupIds.includes(g.id))
  const rows = [
    ['Muallif', l.author],
    ['Nashr yili', l.year],
    [l.duration ? 'Davomiyligi' : 'Hajmi', l.duration ? fmtDuration(l.duration) : l.pages ? `${l.pages} bet` : null],
    ['Toifa', l.category],
    ['Til', LANGS[l.lang || 'uz']],
    ['Format', l.format],
    ['Yuklashlar', fmtNum(l.downloads || 0)],
    ['Qo‘shilgan', `${fmtDate(l.createdAt)}${uploader ? ` · ${uploader.name}` : ''}`],
  ].filter(([, v]) => v)
  return (
    <Modal open onClose={onClose} title="Material haqida" width={720}
      footer={<>
        <Btn icon="bookmark" variant={saved ? 'soft' : 'default'} onClick={onSave}>{saved ? 'Saqlangan' : 'Saqlab qo‘yish'}</Btn>
        <Btn as="a" variant="primary" icon={a.icon} href={l.url || '#'} target={l.url ? '_blank' : undefined} rel="noreferrer" onClick={(e) => onRun(l, e)}>{a.label}</Btn>
      </>}>
      <div className="plibdetail">
        <Cover l={l} size="lg" />
        <div className="plibdetail__info">
          <Badge tone={t.tone}>{t.label}</Badge>
          <h2>{l.title}</h2>
          {l.description && <p>{l.description}</p>}
          <dl>{rows.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
          <div className="plibdetail__chips">
            {gs.length ? gs.map((g) => <Badge key={g.id} tone="gray"><i className="pvdot" style={{ background: g.color }} /> {g.name}</Badge>) : <Badge tone="gray"><Icon name="users" size={12} /> Barcha guruhlar</Badge>}
          </div>
          {(l.tags || []).length > 0 && <div className="plibcard__tags">{l.tags.map((tag) => <button key={tag} type="button" onClick={() => onTag(tag)}>{tag}</button>)}</div>}
        </div>
      </div>
    </Modal>
  )
}

/* ---------- Qo'shish / tahrirlash ---------- */

const DEFAULT_FORMAT = { audio: 'MP3', video: 'MP4', link: 'Havola' }
const COVERS = ['#12402f', '#0d4a3c', '#3a2414', '#1d4ed8', '#5b21b6', '#7c2d12', '#1e3a5f', '#831843']

function LibForm({ open, item, onClose, categories }) {
  const { user, scope } = useAuth()
  const toast = useToast()
  const isNew = !item?.id
  const [f, setF] = useState({})
  const [err, setErr] = useState({})
  useEffect(() => {
    if (!open) return
    setErr({})
    setF(isNew
      ? { title: '', author: '', type: 'book', pages: '', minutes: '', year: new Date().getFullYear(), category: '', lang: 'uz', format: 'PDF', url: '', description: '', tags: '', groupIds: [] }
      : { ...item, minutes: item.duration ? Math.round(item.duration / 60) : '', tags: (item.tags || []).join(', ') })
  }, [open, item, isNew])
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }))
  const setType = (v) => setF((x) => ({ ...x, type: v, format: DEFAULT_FORMAT[v] || (DEFAULT_FORMAT[x.type] ? 'PDF' : x.format) }))
  const timed = f.type === 'audio' || f.type === 'video'
  const submit = () => {
    const er = {}
    if (!f.title?.trim()) er.title = 'Nomini kiriting'
    if (f.type === 'link' && !f.url?.trim()) er.url = 'Havolani kiriting'
    if (f.url?.trim() && !/^https?:\/\//i.test(f.url.trim())) er.url = 'Havola http(s):// bilan boshlanishi kerak'
    setErr(er); if (Object.keys(er).length) return
    const data = {
      title: f.title.trim(), author: f.author?.trim(), type: f.type, year: Number(f.year) || null,
      pages: timed ? 0 : Number(f.pages) || 0, duration: timed ? (Number(f.minutes) || 0) * 60 : 0,
      category: f.category?.trim(), lang: f.lang, format: f.format, url: f.url?.trim(), description: f.description?.trim(),
      tags: (f.tags || '').split(',').map((s) => s.trim()).filter(Boolean).slice(0, 6), groupIds: f.groupIds || [],
    }
    if (isNew) {
      if (!scope.orgId) return toast(NO_ORG, 'err')
      add('library', { ...data, orgId: scope.orgId, authorId: user.id, downloads: 0, cover: COVERS[Math.floor(Math.random() * COVERS.length)] })
      notify([...new Set(scope.groups.filter((g) => !data.groupIds.length || data.groupIds.includes(g.id)).flatMap((g) => g.studentIds))], `Kutubxonaga yangi material: «${data.title}»`, '#/platform/library')
      logActivity(scope.orgId, user.id, 'kutubxonaga material qo‘shdi', data.title)
      toast('Material qo‘shildi')
    } else { patch('library', item.id, data); toast('Saqlandi') }
    onClose()
  }
  return (
    <Modal open={open} onClose={onClose} title={isNew ? 'Material qo‘shish' : 'Materialni tahrirlash'} sub="Kitob, maqola, audio, video yoki boshqa manba" width={620}
      footer={<><Btn onClick={onClose}>Bekor</Btn><Btn variant="primary" icon={isNew ? 'plus' : 'check'} onClick={submit}>{isNew ? 'Qo‘shish' : 'Saqlash'}</Btn></>}>
      <div className="pform">
        <FField label="Turi">
          <div className="plibtypes">
            {Object.entries(TYPES).map(([k, t]) => (
              <button key={k} type="button" className={cx('plibtypes__opt', f.type === k && 'is-on')} onClick={() => setType(k)}><Icon name={t.icon} size={15} /> {t.label}</button>
            ))}
          </div>
        </FField>
        <FField label="Nomi" error={err.title}><Input value={f.title || ''} onChange={(e) => set('title', e.target.value)} placeholder="Masalan: Islom moliyasi asoslari" autoFocus /></FField>
        <div className="pform__row">
          <FField label="Muallif"><Input value={f.author || ''} onChange={(e) => set('author', e.target.value)} /></FField>
          <FField label="Toifa"><Input value={f.category || ''} onChange={(e) => set('category', e.target.value)} placeholder="Islom moliyasi" list="plib-cats" /><datalist id="plib-cats">{categories.map((c) => <option key={c} value={c} />)}</datalist></FField>
        </div>
        <div className="pform__row">
          {timed
            ? <FField label="Davomiylik (daqiqa)"><Input type="number" min="1" value={f.minutes || ''} onChange={(e) => set('minutes', e.target.value)} /></FField>
            : <FField label="Betlar soni"><Input type="number" min="1" value={f.pages || ''} onChange={(e) => set('pages', e.target.value)} /></FField>}
          <FField label="Nashr yili"><Input type="number" value={f.year || ''} onChange={(e) => set('year', e.target.value)} /></FField>
        </div>
        <div className="pform__row">
          <FField label="Til"><Select value={f.lang} onChange={(v) => set('lang', v)} options={Object.entries(LANGS).map(([k, v]) => ({ value: k, label: v }))} /></FField>
          <FField label="Format"><Select value={f.format} onChange={(v) => set('format', v)} options={FORMATS.map((x) => ({ value: x, label: x }))} /></FField>
        </div>
        <FField label={f.type === 'link' ? 'Havola' : 'Fayl havolasi'} error={err.url} hint="Google Drive, Telegram yoki boshqa ochiq havola"><Input value={f.url || ''} onChange={(e) => set('url', e.target.value)} placeholder="https://…" /></FField>
        <FField label="Teglar" hint="Vergul bilan ajrating, masalan: Murobaha, Amaliy"><Input value={f.tags || ''} onChange={(e) => set('tags', e.target.value)} /></FField>
        <FField label="Kimlar ko‘radi"><ChipSelect allLabel="Barcha guruhlar" value={f.groupIds || []} onChange={(v) => set('groupIds', v)} options={scope.groups.map((g) => ({ value: g.id, label: g.name, color: g.color }))} /></FField>
        <FField label="Tavsif"><Textarea value={f.description || ''} onChange={(e) => set('description', e.target.value)} placeholder="Qisqacha mazmuni…" /></FField>
      </div>
    </Modal>
  )
}
