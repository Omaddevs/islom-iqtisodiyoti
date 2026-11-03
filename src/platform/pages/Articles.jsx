import { useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '../store/auth.jsx'
import { add, patch, remove, notify, logActivity, NO_ORG } from '../store/db.js'
import { Card, Btn, Badge, Modal, FField, Input, Textarea, ChipSelect, Empty, Icon, UAvatar, Confirm, Menu, useToast, Search, cx, useFormInit } from '../ui/kit.jsx'
import { fmtDate } from '../ui/format.js'
import { StatBars, endOfDay } from '../ui/charts.jsx'
import { Cover, CoverPicker, IMAGE_TYPES, checkImage, readImage } from '../ui/media.jsx'

export default function Articles({ param }) {
  if (param) return <Reader id={param} />
  return <ArticleList />
}

/* ---------- Yordamchilar ---------- */

const D = 864e5
const GUIDE = 'Qo‘llanma'

// Teg bo'yicha muqova rangi va ikonkasi (birinchi mos teg olinadi)
const TAG_LOOK = {
  Riba: { tone: 'red', icon: 'scale' },
  Murobaha: { tone: 'blue', icon: 'coins' },
  [GUIDE]: { tone: 'green', icon: 'fileText' },
  Amaliyot: { tone: 'violet', icon: 'briefcase' },
  Asoslar: { tone: 'blue', icon: 'bookOpen' },
}
const TAG_TONE = { Riba: 'red', [GUIDE]: 'green', Amaliyot: 'violet' }
const FALLBACK = [{ tone: 'blue', icon: 'bookOpen' }, { tone: 'violet', icon: 'bookmark' }, { tone: 'amber', icon: 'fileText' }, { tone: 'teal', icon: 'layers' }]
const lookOf = (a) => TAG_LOOK[a.tags.find((t) => TAG_LOOK[t])] || FALLBACK[a.title.length % FALLBACK.length]

const SORTS = [
  { value: 'new', label: 'Yangi avval', fn: (a, b) => b.createdAt - a.createdAt },
  { value: 'old', label: 'Eski avval', fn: (a, b) => a.createdAt - b.createdAt },
  { value: 'views', label: 'Ko‘p o‘qilgan', fn: (a, b) => (b.views || 0) - (a.views || 0) },
  { value: 'short', label: 'Qisqa avval', fn: (a, b) => a.readTime - b.readTime },
]

// Matn ichidagi rasm: alohida abzatsda ![izoh](img:kalit) yoki ![izoh](https://…)
const IMG_RE = /^!\[([^\]]*)\]\(([^)\s]+)\)$/
const IMG_ANY = /!\[[^\]]*\]\([^)\s]+\)/g
const plain = (body) => body.replace(IMG_ANY, ' ').replace(/\s+/g, ' ').trim()
const imgSrc = (a, ref) => (ref.startsWith('img:') ? a.images?.[ref.slice(4)] : /^https?:\/\//i.test(ref) ? ref : null)
const usedKeys = (body) => [...body.matchAll(/\(img:([\w-]+)\)/g)].map((m) => m[1])
const newKey = () => Math.random().toString(36).slice(2, 8)

const fmtNum = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')

// Saqlangan (bookmark) maqolalar — har bir foydalanuvchi uchun brauzerda
const savedKey = (uid) => `ii_article_saved_${uid}`
function useSaved(uid) {
  const [saved, setSaved] = useState(() => { try { return JSON.parse(localStorage.getItem(savedKey(uid))) || [] } catch { return [] } })
  const toggle = (id) => setSaved((l) => {
    const next = l.includes(id) ? l.filter((x) => x !== id) : [...l, id]
    try { localStorage.setItem(savedKey(uid), JSON.stringify(next)) } catch { /* xotira yopiq */ }
    return next
  })
  return [saved, toggle]
}

/* ---------- Ro'yxat sahifasi ---------- */

function ArticleList() {
  const { user, db, scope, can } = useAuth()
  const toast = useToast()
  const [q, setQ] = useState('')
  const [tag, setTag] = useState('')
  const [sort, setSort] = useState('new')
  const [editing, setEditing] = useState(null)
  const [del, setDel] = useState(null)
  const [saved, toggleSaved] = useSaved(user.id)
  const isStaff = user.role !== 'student'
  const isAdmin = user.role === 'org_admin' || user.role === 'superadmin'
  const canCreate = isStaff && can('content.create')

  const visible = useMemo(() => scope.articles.filter((a) => a.published || a.authorId === user.id || isAdmin), [scope.articles, user.id, isAdmin])
  const published = useMemo(() => visible.filter((a) => a.published), [visible])
  const tags = useMemo(() => {
    const n = {}
    visible.forEach((a) => a.tags.forEach((t) => { n[t] = (n[t] || 0) + 1 }))
    return Object.keys(n).sort((a, b) => n[b] - n[a])
  }, [visible])
  const authorOf = (a) => db.users.find((u) => u.id === a.authorId)

  const list = useMemo(() => {
    const s = q.trim().toLowerCase()
    const by = SORTS.find((x) => x.value === sort).fn
    return visible
      .filter((a) => (tag === 'saved' ? saved.includes(a.id) : !tag || a.tags.includes(tag)))
      .filter((a) => !s || [a.title, a.excerpt, ...a.tags, db.users.find((u) => u.id === a.authorId)?.name].some((x) => (x || '').toLowerCase().includes(s)))
      .sort(by)
  }, [visible, tag, saved, q, sort, db.users])

  // Statistika: oxirgi 6 hafta ustunlari (har hafta oxiridagi holat)
  const stats = useMemo(() => {
    const weeks = Array.from({ length: 6 }, (_, i) => endOfDay(Date.now() - (5 - i) * 7 * D))
    const upto = (ts) => published.filter((a) => a.createdAt <= ts)
    const authors = (l) => new Set(l.map((a) => a.authorId)).size
    const month = published.filter((a) => a.createdAt > Date.now() - 30 * D).length
    const read = published.filter((a) => (a.readBy || []).includes(user.id))
    return {
      total: published.length,
      trend: month ? `+${month} shu oyda` : null,
      authors: authors(published),
      views: published.reduce((n, a) => n + (a.views || 0), 0),
      guides: published.filter((a) => a.tags.includes(GUIDE)).length,
      read: read.length,
      bTotal: weeks.map((ts) => upto(ts).length),
      bAuthors: weeks.map((ts) => authors(upto(ts))),
      bViews: weeks.map((ts) => upto(ts).reduce((n, a) => n + (a.views || 0), 0)),
      bGuides: weeks.map((ts) => upto(ts).filter((a) => a.tags.includes(GUIDE)).length),
      bSaved: weeks.map((ts) => upto(ts).filter((a) => saved.includes(a.id)).length),
      bRead: weeks.map((ts) => upto(ts).filter((a) => read.includes(a)).length),
    }
  }, [published, user.id, saved])

  const recent = useMemo(() => [...published].sort((a, b) => b.createdAt - a.createdAt).slice(0, 3), [published])
  const top = useMemo(() => [...published].sort((a, b) => (b.views || 0) - (a.views || 0)).slice(0, 3), [published])
  const pick = (t, s) => {
    setTag(t)
    if (s) setSort(s)
    document.getElementById('part-grid')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const menuFor = (a) => {
    const mine = isStaff && (a.authorId === user.id || isAdmin)
    return [
      { label: saved.includes(a.id) ? 'Saqlanganlardan olish' : 'Saqlash', icon: 'bookmark', onClick: () => toggleSaved(a.id) },
      { label: 'Havolani nusxalash', icon: 'link', onClick: async () => {
        try { await navigator.clipboard.writeText(`${location.origin}${location.pathname}#/platform/articles/${a.id}`); toast('Havola nusxalandi') } catch { toast('Nusxalab bo‘lmadi', 'err') }
      } },
      ...(mine ? ['sep',
        { label: 'Tahrirlash', icon: 'edit', onClick: () => setEditing(a) },
        { label: a.published ? 'Qoralamaga o‘tkazish' : 'Chop etish', icon: a.published ? 'eyeOff' : 'eye', onClick: () => patch('articles', a.id, { published: !a.published }) },
        { label: 'O‘chirish', icon: 'trash', danger: true, onClick: () => setDel(a) }] : []),
    ]
  }

  const filtered = q || tag
  return (
    <>
      {/* Sarlavha banneri */}
      <section className="pthero pahero">
        <span className="pthero__icon"><Icon name="bookmark" size={34} /></span>
        <div className="pthero__text">
          <span className="pahero__eyebrow">Maqolalar</span>
          <h1>Maqolalar</h1>
          <p>O‘quv materiallari, qo‘llanmalar va tahlillar</p>
        </div>
        <blockquote className="pthero__quote">“Bilim ulashilganda qadri oshadi.”</blockquote>
        <HeroArt />
        {canCreate && <Btn variant="primary" size="lg" icon="plus" className="pthero__btn" onClick={() => setEditing({})}>Maqola yozish</Btn>}
      </section>

      {/* Statistika */}
      <div className="pgrid pgrid--4 ptstats pastats">
        <StatBars icon="bookOpen" tone="violet" color="#6366f1" value={stats.total} label="Jami maqolalar" trend={stats.trend} data={stats.bTotal} onClick={() => pick('')} />
        <StatBars icon="users" tone="blue" color="#8b8ef5" value={stats.authors} label="Faol mualliflar" data={stats.bAuthors} onClick={() => document.getElementById('part-recent')?.scrollIntoView({ behavior: 'smooth', block: 'center' })} />
        {isStaff
          ? <StatBars icon="eye" tone="green" color="#10b981" value={fmtNum(stats.views)} label="O‘qilganlar" data={stats.bViews} onClick={() => pick('', 'views')} />
          : <StatBars icon="eye" tone="green" color="#10b981" value={stats.read} label="Men o‘qiganlar" data={stats.bRead} onClick={() => pick('')} />}
        {isStaff
          ? <StatBars icon="fileText" tone="amber" color="#f59e0b" value={stats.guides} label="Qo‘llanmalar" data={stats.bGuides} onClick={() => pick(GUIDE)} />
          : <StatBars icon="bookmark" tone="amber" color="#f59e0b" value={saved.length} label="Saqlanganlar" data={stats.bSaved} onClick={() => pick('saved')} />}
      </div>

      {/* Filtrlar */}
      <div className="patool" id="part-grid">
        <div className="pchips patool__chips">
          <button className={cx('pchip', !tag && 'is-on')} onClick={() => setTag('')}>Barchasi</button>
          {tags.map((t) => <button key={t} className={cx('pchip', tag === t && 'is-on')} onClick={() => setTag(t)}>{t}</button>)}
          {saved.length > 0 && <button className={cx('pchip', tag === 'saved' && 'is-on')} onClick={() => setTag('saved')}><Icon name="bookmark" size={14} />Saqlangan</button>}
        </div>
        <div className="patool__right">
          <Search value={q} onChange={setQ} placeholder="Maqola nomi, mavzu yoki muallif…" className="ptsearch pasearch" />
          <label className="pdsel pasort"><Icon name="sort" size={16} /><span>{SORTS.find((x) => x.value === sort).label}</span><Icon name="chevDown" size={16} />
            <select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Saralash">{SORTS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select>
          </label>
        </div>
      </div>

      {list.length === 0
        ? (
          <Card>
            <Empty icon="bookmark" title={filtered ? 'Hech narsa topilmadi' : 'Maqola yo‘q'}
              text={filtered ? 'Qidiruv yoki filtrni o‘zgartirib ko‘ring.' : canCreate ? 'Birinchi maqolani yozing.' : 'Tez orada maqolalar qo‘shiladi.'}
              action={filtered ? <Btn onClick={() => { setQ(''); setTag('') }}>Filtrni tozalash</Btn> : canCreate && <Btn variant="primary" icon="plus" onClick={() => setEditing({})}>Maqola yozish</Btn>} />
          </Card>
        )
        : (
          <div className="pgrid pacards">
            {list.map((a) => <ArticleCard key={a.id} a={a} au={authorOf(a)} saved={saved.includes(a.id)} onSave={() => toggleSaved(a.id)} menu={menuFor(a)} />)}
          </div>
        )}

      {/* Pastki qism */}
      {published.length > 0 && (
        <div className="pabottom">
          <Card id="part-recent" pad={false} className="palist">
            <header className="ptcard-h">
              <h3 className="pdt"><span className="pdt__ico"><Icon name="trending" size={18} /></span>So‘nggi maqolalar</h3>
              <button type="button" className="ptlink" onClick={() => pick('', 'new')}>Barchasini ko‘rish <Icon name="arrowRight" size={15} /></button>
            </header>
            <ul>
              {recent.map((a) => (
                <li key={a.id}>
                  <a href={`#/platform/articles/${a.id}`} className="palist__row">
                    <LookIcon a={a} />
                    <span className="palist__body"><b>{a.title}</b><small>{authorOf(a)?.name} · {fmtDate(a.createdAt)}</small></span>
                    <span className="palist__views" title="O‘qishlar"><Icon name="eye" size={16} />{fmtNum(a.views || 0)}</span>
                  </a>
                </li>
              ))}
            </ul>
          </Card>
          <Card pad={false} className="palist">
            <header className="ptcard-h">
              <h3 className="pdt"><span className="pdt__ico"><Icon name="trophy" size={18} /></span>Eng ko‘p o‘qilgan maqolalar</h3>
              <button type="button" className="ptlink" onClick={() => pick('', 'views')}>Barchasini ko‘rish <Icon name="arrowRight" size={15} /></button>
            </header>
            <ul>
              {top.map((a, i) => (
                <li key={a.id}>
                  <a href={`#/platform/articles/${a.id}`} className="palist__row">
                    <span className={cx('parank', `parank--${i + 1}`)}>{i + 1}</span>
                    <LookIcon a={a} />
                    <span className="palist__body"><b>{a.title}</b><small>{authorOf(a)?.name} · {fmtNum(a.views || 0)} marta o‘qilgan</small></span>
                    <Icon name="chevRight" size={18} className="palist__chev" />
                  </a>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      )}

      <ArticleForm open={!!editing} article={editing} onClose={() => setEditing(null)} />
      <Confirm open={!!del} onClose={() => setDel(null)} danger title="Maqolani o‘chirish" text={`«${del?.title}» o‘chiriladi.`} confirmLabel="O‘chirish" onConfirm={() => { remove('articles', del.id); toast('O‘chirildi') }} />
    </>
  )
}

function LookIcon({ a }) {
  const lk = lookOf(a)
  if (a.cover) return <span className="palist__ico palist__ico--img"><img src={a.cover} alt="" loading="lazy" /></span>
  return <span className={cx('palist__ico', `patone--${lk.tone}`)}><Icon name={lk.icon} size={18} /></span>
}

function ArticleCard({ a, au, saved, onSave, menu }) {
  const lk = lookOf(a)
  const href = `#/platform/articles/${a.id}`
  return (
    <article className="pacard" onClick={() => { window.location.hash = href }}>
      <div className={cx('pacard__cover', `patone--${lk.tone}`, a.cover && 'has-cover')}>
        <Cover src={a.cover} />
        <div className="pacard__tags">
          {a.tags.map((t) => <span key={t} className={cx('patag', `patag--${TAG_TONE[t] || 'blue'}`)}>{t}</span>)}
          {!a.published && <Badge tone="amber">Qoralama</Badge>}
        </div>
        {!a.cover && <span className="pacard__art"><Icon name={lk.icon} size={40} stroke={1.5} /></span>}
        <button type="button" className={cx('pacard__save', saved && 'is-on')} aria-label={saved ? 'Saqlanganlardan olish' : 'Saqlash'} aria-pressed={saved}
          onClick={(e) => { e.stopPropagation(); onSave() }}><Icon name="bookmark" size={18} /></button>
      </div>
      <div className="pacard__body">
        <h4><a href={href} onClick={(e) => e.stopPropagation()}>{a.title}</a></h4>
        <p>{a.excerpt}</p>
        <div className="pacard__foot">
          <UAvatar user={au} size={38} />
          <b className="pacard__au">{au?.name || '—'}</b>
          <span className="pacard__meta">
            <span><Icon name="calendar" size={14} />{fmtDate(a.createdAt)}</span>
            <span><Icon name="clock" size={14} />{a.readTime} daq</span>
          </span>
          <span onClick={(e) => e.stopPropagation()}>
            <Menu items={menu} trigger={<button type="button" className="phw__more" aria-label="Amallar"><Icon name="moreV" size={18} /></button>} />
          </span>
        </div>
      </div>
    </article>
  )
}

// Bannerdagi bezak: logo belgisi (suv belgisi uslubida)
export function HeroArt() {
  return <img className="pahero__art" src="/logo/logo-mark.png" alt="" aria-hidden="true" />
}

function ArticleForm({ open, article, onClose }) {
  const { user, scope } = useAuth()
  const toast = useToast()
  const isNew = !article?.id
  const [f, setF] = useState({})
  const [err, setErr] = useState({})
  const bodyRef = useRef(null)
  const fileRef = useRef(null)
  const [busy, setBusy] = useState(false)
  useFormInit(open, article?.id, () => { setErr({}); setF(isNew ? { title: '', excerpt: '', body: '', tags: '', groupIds: [], published: true, cover: '', images: {} } : { ...article, cover: article.cover || '', images: { ...(article.images || {}) }, tags: article.tags.join(', ') }) })
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }))
  const submit = () => {
    const er = {}
    if (!f.title?.trim()) er.title = 'Sarlavhani kiriting'
    if (!f.body?.trim()) er.body = 'Matnni kiriting'
    setErr(er); if (Object.keys(er).length) return
    const body = f.body.trim()
    const text = plain(body)
    // Matndan o'chirilgan rasmlar saqlanmaydi
    const keep = new Set(usedKeys(body))
    const images = Object.fromEntries(Object.entries(f.images || {}).filter(([k]) => keep.has(k)))
    const data = { title: f.title.trim(), excerpt: f.excerpt?.trim() || (text.length > 140 ? text.slice(0, 140) + '…' : text), body, tags: f.tags.split(',').map((t) => t.trim()).filter(Boolean), groupIds: f.groupIds || [], published: !!f.published, readTime: Math.max(1, Math.round(text.split(/\s+/).length / 180)), cover: f.cover || '', images }
    if (isNew) {
      if (!scope.orgId) return toast(NO_ORG, 'err')
      const a = add('articles', { ...data, orgId: scope.orgId, authorId: user.id })
      if (data.published) { notify([...new Set(scope.groups.filter((g) => !data.groupIds.length || data.groupIds.includes(g.id)).flatMap((g) => g.studentIds))], `Yangi maqola: «${a.title}»`, `#/platform/articles/${a.id}`); logActivity(scope.orgId, user.id, 'maqola chop etdi', a.title) }
      toast(data.published ? 'Maqola chop etildi' : 'Qoralama saqlandi')
    } else { patch('articles', article.id, data); toast('Saqlandi') }
    onClose()
  }
  // Matnga rasm qo'shish: kursor turgan joyga alohida abzats sifatida
  const addImages = async (files) => {
    const list = [...files].filter((x) => x.type.startsWith('image/'))
    if (!list.length) return
    const bad = list.map(checkImage).find(Boolean)
    if (bad) { setErr((e) => ({ ...e, body: bad })); return }
    setBusy(true)
    try {
      const read = await Promise.all(list.map((x) => readImage(x, { maxW: 1600, maxH: 1600, budget: 450_000 })))
      const el = bodyRef.current
      const cur = f.body || ''
      const at = el ? el.selectionEnd : cur.length
      const added = {}
      const insert = read.map((r) => { const k = newKey(); added[k] = r.src; return `![](img:${k})` }).join('\n\n')
      const before = cur.slice(0, at).replace(/\s+$/, ''), after = cur.slice(at).replace(/^\s+/, '')
      setF((x) => ({ ...x, body: [before, insert, after].filter(Boolean).join('\n\n'), images: { ...(x.images || {}), ...added } }))
      setErr((e) => ({ ...e, body: '' }))
      const pos = (before ? before.length + 2 : 0) + insert.length
      requestAnimationFrame(() => { if (el) { el.focus(); el.setSelectionRange(pos, pos) } })
    } catch { setErr((e) => ({ ...e, body: 'Rasmni o‘qib bo‘lmadi, boshqa fayl tanlang' })) } finally { setBusy(false) }
  }
  const removeImage = (k) => setF((x) => ({ ...x, body: (x.body || '').split(/\n\s*\n/).filter((p) => !p.includes(`(img:${k})`)).join('\n\n') }))
  const inBody = usedKeys(f.body || '').filter((k) => f.images?.[k])
  const tone = lookOf({ title: f.title || '', tags: (f.tags || '').split(',').map((t) => t.trim()) }).tone

  return (
    <Modal open={open} onClose={onClose} width={760} title={isNew ? 'Maqola yozish' : 'Maqolani tahrirlash'} footer={<><Btn onClick={onClose}>Bekor</Btn><Btn variant="primary" onClick={submit}>{f.published ? 'Chop etish' : 'Qoralama saqlash'}</Btn></>}>
      <div className="pform">
        <FField label="Sarlavha" error={err.title}><Input value={f.title || ''} onChange={(e) => set('title', e.target.value)} autoFocus /></FField>
        <FField label="Qisqacha (ixtiyoriy)"><Input value={f.excerpt || ''} onChange={(e) => set('excerpt', e.target.value)} /></FField>
        <div className={cx('pfield', err.cover && 'is-error')}>
          <span className="pfield__label">Muqova</span>
          <CoverPicker value={f.cover} onChange={(v) => set('cover', v)} onError={(m) => setErr((e) => ({ ...e, cover: m }))} className={`patone--${tone}`} />
          {err.cover ? <span className="pfield__error">{err.cover}</span> : <span className="pfield__hint">Kartada va maqola boshida ko‘rinadi · JPG, PNG yoki WEBP, 16:9 tavsiya etiladi. Rasm bo‘lmasa teg rangidagi fon ishlatiladi.</span>}
        </div>
        <div className={cx('pfield', err.body && 'is-error')}>
          <div className="paed__head">
            <span className="pfield__label">Matn</span>
            <Btn size="sm" icon="image" onClick={() => fileRef.current?.click()} disabled={busy}>{busy ? 'Yuklanmoqda…' : 'Rasm qo‘shish'}</Btn>
            <input ref={fileRef} type="file" accept={IMAGE_TYPES} multiple hidden onChange={(e) => { addImages(e.target.files); e.target.value = '' }} />
          </div>
          <Textarea ref={bodyRef} style={{ minHeight: 240 }} value={f.body || ''} onChange={(e) => set('body', e.target.value)}
            onPaste={(e) => { if (e.clipboardData.files.length) { e.preventDefault(); addImages(e.clipboardData.files) } }}
            onDragOver={(e) => { if (e.dataTransfer.types.includes('Files')) e.preventDefault() }}
            onDrop={(e) => { if (e.dataTransfer.files.length) { e.preventDefault(); addImages(e.dataTransfer.files) } }} />
          {inBody.length > 0 && (
            <div className="paed__imgs">
              {inBody.map((k, i) => (
                <figure key={k} className="paed__img">
                  <img src={f.images[k]} alt="" />
                  <figcaption>{i + 1}-rasm</figcaption>
                  <button type="button" aria-label="Rasmni olib tashlash" title="Olib tashlash" onClick={() => removeImage(k)}><Icon name="x" size={14} stroke={2.5} /></button>
                </figure>
              ))}
            </div>
          )}
          {err.body ? <span className="pfield__error">{err.body}</span> : <span className="pfield__hint">Abzatslarni bo‘sh qator bilan ajrating. Rasmni tugma, Ctrl+V yoki sudrab tashlash orqali qo‘shing; izohni ![…] qavsi ichiga yozing.</span>}
        </div>
        <div className="pform__row">
          <FField label="Teglar" hint="Vergul bilan"><Input value={f.tags || ''} onChange={(e) => set('tags', e.target.value)} placeholder="Riba, Asoslar" /></FField>
          <FField label="Holati"><label className="prow" style={{ height: 46, fontSize: 14 }}><input type="checkbox" checked={!!f.published} onChange={(e) => set('published', e.target.checked)} /> Chop etilgan</label></FField>
        </div>
        <FField label="Kimlar ko‘radi"><ChipSelect allLabel="Barcha guruhlar" value={f.groupIds || []} onChange={(v) => set('groupIds', v)} options={scope.groups.map((g) => ({ value: g.id, label: g.name, color: g.color }))} /></FField>
      </div>
    </Modal>
  )
}

function Reader({ id }) {
  const { user, db, scope } = useAuth()
  const a = db.articles.find((x) => x.id === id)
  // Har bir foydalanuvchi o'qishi bir marta hisoblanadi
  useEffect(() => {
    if (a?.published && !(a.readBy || []).includes(user.id)) patch('articles', a.id, (x) => ({ views: (x.views || 0) + 1, readBy: [...(x.readBy || []), user.id] }))
  }, [a?.id, a?.published, user.id]) // eslint-disable-line react-hooks/exhaustive-deps
  if (!a) return <Card><Empty icon="bookmark" title="Maqola topilmadi" action={<Btn as="a" href="#/platform/articles">Orqaga</Btn>} /></Card>
  const au = db.users.find((u) => u.id === a.authorId)
  const more = scope.articles.filter((x) => x.id !== a.id && x.published).slice(0, 3)
  return (
    <Card>
      <div className="preader">
        <a href="#/platform/articles" className="prow" style={{ color: 'var(--pf-primary-2)', fontSize: 14, fontWeight: 600, marginBottom: 18 }}><Icon name="arrowLeft" size={16} /> Maqolalar</a>
        <div className="part__tags">{a.tags.map((t) => <span key={t} className={cx('patag', `patag--${TAG_TONE[t] || 'blue'}`)}>{t}</span>)}</div>
        <h1>{a.title}</h1>
        <div className="preader__meta"><UAvatar user={au} size={36} /><div><b style={{ color: 'var(--pf-text)' }}>{au?.name}</b><br />{fmtDate(a.createdAt)} · {a.readTime} daqiqa o‘qish · {fmtNum(a.views || 0)} marta o‘qilgan</div></div>
        {a.cover && <img className="preader__cover" src={a.cover} alt="" />}
        <div className="preader__body">{a.body.split(/\n\s*\n/).map((p, i) => {
          const m = p.trim().match(IMG_RE)
          if (!m) return <p key={i}>{p}</p>
          const src = imgSrc(a, m[2])
          return src ? <figure key={i} className="preader__fig"><img src={src} alt={m[1]} loading="lazy" />{m[1] && <figcaption>{m[1]}</figcaption>}</figure> : null
        })}</div>
        {more.length > 0 && (
          <div style={{ marginTop: 30, paddingTop: 20, borderTop: '1px solid var(--pf-line)' }}>
            <h3 style={{ fontFamily: 'var(--f-head)', fontSize: 17, marginBottom: 8 }}>Yana o‘qing</h3>
            {more.map((m) => <a key={m.id} href={`#/platform/articles/${m.id}`} className="pitem"><LookIcon a={m} /><div className="pitem__body"><b>{m.title}</b><span>{m.readTime} daq</span></div><Icon name="chevRight" size={16} /></a>)}
          </div>
        )}
      </div>
    </Card>
  )
}
