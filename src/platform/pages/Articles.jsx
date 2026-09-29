import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../store/auth.jsx'
import { add, patch, remove, notify, logActivity } from '../store/db.js'
import { PageHead, Card, Btn, Badge, Modal, FField, Input, Textarea, ChipSelect, Empty, Icon, UAvatar, Confirm, Menu, useToast, Search } from '../ui/kit.jsx'
import { fmtDate } from '../ui/format.js'

export default function Articles({ param }) {
  if (param) return <Reader id={param} />
  return <ArticleList />
}

function ArticleList() {
  const { user, db, scope, can } = useAuth()
  const toast = useToast()
  const [q, setQ] = useState('')
  const [tag, setTag] = useState('')
  const [editing, setEditing] = useState(null)
  const [del, setDel] = useState(null)
  const isStaff = user.role !== 'student'
  const visible = scope.articles.filter((a) => a.published || a.authorId === user.id || user.role === 'org_admin' || user.role === 'superadmin')
  const tags = [...new Set(visible.flatMap((a) => a.tags))]
  const list = useMemo(() => visible.filter((a) => (!tag || a.tags.includes(tag)) && (a.title + a.excerpt).toLowerCase().includes(q.toLowerCase())).sort((a, b) => b.createdAt - a.createdAt), [visible, tag, q])
  return (
    <>
      <PageHead icon="bookmark" title="Maqolalar" sub="O‘quv materiallari, qo‘llanmalar va tahlillar" actions={isStaff && can('content.create') && <Btn variant="primary" icon="plus" onClick={() => setEditing({})}>Maqola yozish</Btn>} />
      <div className="prow prow--between">
        <div className="pchips">
          <button className={`pchip ${!tag ? 'is-on' : ''}`} onClick={() => setTag('')}>Barchasi</button>
          {tags.map((t) => <button key={t} className={`pchip ${tag === t ? 'is-on' : ''}`} onClick={() => setTag(t)}>{t}</button>)}
        </div>
        <Search value={q} onChange={setQ} placeholder="Maqola…" />
      </div>
      {list.length === 0 ? <Card><Empty icon="bookmark" title="Maqola yo‘q" /></Card> : (
        <div className="pgrid pgrid--cards">
          {list.map((a) => {
            const au = db.users.find((u) => u.id === a.authorId)
            const mine = a.authorId === user.id || user.role === 'org_admin' || user.role === 'superadmin'
            return (
              <article key={a.id} className="part" onClick={() => (window.location.hash = `#/platform/articles/${a.id}`)}>
                <div className="part__tags">{a.tags.map((t) => <Badge key={t} tone="blue">{t}</Badge>)}{!a.published && <Badge tone="amber">Qoralama</Badge>}</div>
                <h4>{a.title}</h4>
                <p>{a.excerpt}</p>
                <div className="part__foot">
                  <UAvatar user={au} size={28} /><b>{au?.name}</b><span>· {fmtDate(a.createdAt)} · {a.readTime} daq</span>
                  {isStaff && mine && <span style={{ marginLeft: 'auto' }} onClick={(e) => e.stopPropagation()}><Menu items={[{ label: 'Tahrirlash', icon: 'edit', onClick: () => setEditing(a) }, { label: a.published ? 'Qoralamaga o‘tkazish' : 'Chop etish', icon: a.published ? 'eyeOff' : 'eye', onClick: () => patch('articles', a.id, { published: !a.published }) }, 'sep', { label: 'O‘chirish', icon: 'trash', danger: true, onClick: () => setDel(a) }]} /></span>}
                </div>
              </article>
            )
          })}
        </div>
      )}
      <ArticleForm open={!!editing} article={editing} onClose={() => setEditing(null)} />
      <Confirm open={!!del} onClose={() => setDel(null)} danger title="Maqolani o‘chirish" text={`«${del?.title}» o‘chiriladi.`} confirmLabel="O‘chirish" onConfirm={() => { remove('articles', del.id); toast('O‘chirildi') }} />
    </>
  )
}

function ArticleForm({ open, article, onClose }) {
  const { user, scope } = useAuth()
  const toast = useToast()
  const isNew = !article?.id
  const [f, setF] = useState({})
  const [err, setErr] = useState({})
  useEffect(() => { if (open) { setErr({}); setF(isNew ? { title: '', excerpt: '', body: '', tags: '', groupIds: [], published: true } : { ...article, tags: article.tags.join(', ') }) } }, [open, article, isNew])
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }))
  const submit = () => {
    const er = {}
    if (!f.title?.trim()) er.title = 'Sarlavhani kiriting'
    if (!f.body?.trim()) er.body = 'Matnni kiriting'
    setErr(er); if (Object.keys(er).length) return
    const body = f.body.trim()
    const data = { title: f.title.trim(), excerpt: f.excerpt?.trim() || body.slice(0, 140) + '…', body, tags: f.tags.split(',').map((t) => t.trim()).filter(Boolean), groupIds: f.groupIds || [], published: !!f.published, readTime: Math.max(1, Math.round(body.split(/\s+/).length / 180)) }
    if (isNew) {
      const a = add('articles', { ...data, orgId: scope.orgId || scope.groups[0]?.orgId, authorId: user.id })
      if (data.published) { notify([...new Set(scope.groups.filter((g) => !data.groupIds.length || data.groupIds.includes(g.id)).flatMap((g) => g.studentIds))], `Yangi maqola: «${a.title}»`, `#/platform/articles/${a.id}`); logActivity(scope.orgId, user.id, 'maqola chop etdi', a.title) }
      toast(data.published ? 'Maqola chop etildi' : 'Qoralama saqlandi')
    } else { patch('articles', article.id, data); toast('Saqlandi') }
    onClose()
  }
  return (
    <Modal open={open} onClose={onClose} width={760} title={isNew ? 'Maqola yozish' : 'Maqolani tahrirlash'} footer={<><Btn onClick={onClose}>Bekor</Btn><Btn variant="primary" onClick={submit}>{f.published ? 'Chop etish' : 'Qoralama saqlash'}</Btn></>}>
      <div className="pform">
        <FField label="Sarlavha" error={err.title}><Input value={f.title || ''} onChange={(e) => set('title', e.target.value)} autoFocus /></FField>
        <FField label="Qisqacha (ixtiyoriy)"><Input value={f.excerpt || ''} onChange={(e) => set('excerpt', e.target.value)} /></FField>
        <FField label="Matn" error={err.body} hint="Abzatslarni bo‘sh qator bilan ajrating"><Textarea style={{ minHeight: 240 }} value={f.body || ''} onChange={(e) => set('body', e.target.value)} /></FField>
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
  const { db, scope } = useAuth()
  const a = db.articles.find((x) => x.id === id)
  if (!a) return <Card><Empty icon="bookmark" title="Maqola topilmadi" action={<Btn as="a" href="#/platform/articles">Orqaga</Btn>} /></Card>
  const au = db.users.find((u) => u.id === a.authorId)
  const more = scope.articles.filter((x) => x.id !== a.id && x.published).slice(0, 3)
  return (
    <Card>
      <div className="preader">
        <a href="#/platform/articles" className="prow" style={{ color: 'var(--pf-primary-2)', fontSize: 14, fontWeight: 600, marginBottom: 18 }}><Icon name="arrowLeft" size={16} /> Maqolalar</a>
        <div className="part__tags">{a.tags.map((t) => <Badge key={t} tone="blue">{t}</Badge>)}</div>
        <h1>{a.title}</h1>
        <div className="preader__meta"><UAvatar user={au} size={36} /><div><b style={{ color: 'var(--pf-text)' }}>{au?.name}</b><br />{fmtDate(a.createdAt)} · {a.readTime} daqiqa o‘qish</div></div>
        <div className="preader__body">{a.body.split(/\n\s*\n/).map((p, i) => <p key={i}>{p}</p>)}</div>
        {more.length > 0 && (
          <div style={{ marginTop: 30, paddingTop: 20, borderTop: '1px solid var(--pf-line)' }}>
            <h3 style={{ fontFamily: 'var(--f-head)', fontSize: 17, marginBottom: 8 }}>Yana o‘qing</h3>
            {more.map((m) => <a key={m.id} href={`#/platform/articles/${m.id}`} className="pitem"><div className="pitem__icon"><Icon name="bookmark" size={18} /></div><div className="pitem__body"><b>{m.title}</b><span>{m.readTime} daq</span></div><Icon name="chevRight" size={16} /></a>)}
          </div>
        )}
      </div>
    </Card>
  )
}
