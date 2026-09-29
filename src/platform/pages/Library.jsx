import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../store/auth.jsx'
import { add, patch, remove, notify, logActivity } from '../store/db.js'
import { PageHead, Card, Btn, Badge, Tabs, Modal, FField, Input, Textarea, Select, ChipSelect, Empty, Icon, Confirm, Menu, useToast, Search } from '../ui/kit.jsx'

const TYPES = { book: { label: 'Kitob', icon: 'book', tone: 'blue' }, pdf: { label: 'PDF', icon: 'fileText', tone: 'violet' }, audio: { label: 'Audio', icon: 'headphones', tone: 'green' }, link: { label: 'Havola', icon: 'globe', tone: 'teal' } }

export default function Library() {
  const { user, db, scope, can } = useAuth()
  const toast = useToast()
  const [type, setType] = useState('all')
  const [q, setQ] = useState('')
  const [editing, setEditing] = useState(null)
  const [del, setDel] = useState(null)
  const isStaff = user.role !== 'student'
  const list = useMemo(() => scope.library.filter((l) => (type === 'all' || l.type === type) && (l.title + l.author).toLowerCase().includes(q.toLowerCase())).sort((a, b) => b.createdAt - a.createdAt), [scope.library, type, q])
  return (
    <>
      <PageHead icon="bookOpen" title="Kutubxona" sub={`${scope.library.length} ta material`} actions={isStaff && can('content.create') && <Btn variant="primary" icon="plus" onClick={() => setEditing({})}>Material qo‘shish</Btn>} />
      <div className="prow prow--between">
        <Tabs value={type} onChange={setType} items={[{ value: 'all', label: 'Barchasi', count: scope.library.length }, ...Object.entries(TYPES).map(([k, t]) => ({ value: k, label: t.label, icon: t.icon, count: scope.library.filter((l) => l.type === k).length }))]} />
        <Search value={q} onChange={setQ} placeholder="Kitob yoki muallif…" />
      </div>
      {list.length === 0 ? <Card><Empty icon="bookOpen" title="Material topilmadi" /></Card> : (
        <div className="pgrid pgrid--cards">
          {list.map((l) => {
            const t = TYPES[l.type] || TYPES.book
            const groups = db.groups.filter((g) => l.groupIds.includes(g.id))
            const mine = l.authorId === user.id || user.role === 'org_admin' || user.role === 'superadmin'
            return (
              <article key={l.id} className="pbook">
                <div className="pbook__cover" style={{ '--bc': l.cover }}><Icon name={t.icon} size={28} /></div>
                <div className="pbook__body">
                  <div className="prow prow--between" style={{ alignItems: 'flex-start', flexWrap: 'nowrap' }}><h4>{l.title}</h4><Badge tone={t.tone}>{t.label}</Badge></div>
                  <p>{l.author}{l.year ? ` · ${l.year}` : ''}{l.pages ? ` · ${l.pages} bet` : ''}</p>
                  <div className="pbook__desc">{l.description}</div>
                  <div className="pbook__foot">
                    <span className="pmuted" style={{ fontSize: 12 }}>{groups.length ? groups.map((g) => g.name).join(', ') : 'Barcha guruhlar'}</span>
                    <div className="prow" style={{ gap: 6 }}>
                      <Btn size="sm" variant="soft" icon={l.type === 'link' ? 'externalLink' : l.type === 'audio' ? 'play' : 'download'} as="a" href={l.url || '#'} target={l.url ? '_blank' : undefined} rel="noreferrer" onClick={(e) => { if (!l.url) { e.preventDefault(); toast('Fayl backend ulanganda yuklanadi', 'err') } }}>{l.type === 'link' ? 'Ochish' : l.type === 'audio' ? 'Tinglash' : 'Yuklab olish'}</Btn>
                      {isStaff && mine && <Menu items={[{ label: 'Tahrirlash', icon: 'edit', onClick: () => setEditing(l) }, { label: 'O‘chirish', icon: 'trash', danger: true, onClick: () => setDel(l) }]} />}
                    </div>
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      )}
      <LibForm open={!!editing} item={editing} onClose={() => setEditing(null)} />
      <Confirm open={!!del} onClose={() => setDel(null)} danger title="Materialni o‘chirish" text={`«${del?.title}» o‘chiriladi.`} confirmLabel="O‘chirish" onConfirm={() => { remove('library', del.id); toast('O‘chirildi') }} />
    </>
  )
}

function LibForm({ open, item, onClose }) {
  const { user, scope } = useAuth()
  const toast = useToast()
  const isNew = !item?.id
  const [f, setF] = useState({})
  const [err, setErr] = useState({})
  useEffect(() => { if (open) { setErr({}); setF(isNew ? { title: '', author: '', type: 'book', pages: '', year: new Date().getFullYear(), url: '', description: '', groupIds: [] } : { ...item }) } }, [open, item, isNew])
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }))
  const submit = () => {
    const er = {}
    if (!f.title?.trim()) er.title = 'Nomini kiriting'
    if (f.type === 'link' && !f.url?.trim()) er.url = 'Havolani kiriting'
    setErr(er); if (Object.keys(er).length) return
    const data = { title: f.title.trim(), author: f.author?.trim(), type: f.type, pages: Number(f.pages) || 0, year: Number(f.year) || null, url: f.url?.trim(), description: f.description?.trim(), groupIds: f.groupIds || [] }
    if (isNew) {
      const colors = ['#4aa3f8', '#6366f1', '#14b8a6', '#f59e0b', '#8b5cf6', '#0ea5e9']
      add('library', { ...data, orgId: scope.orgId || scope.groups[0]?.orgId, authorId: user.id, cover: colors[Math.floor(Math.random() * colors.length)] })
      notify([...new Set(scope.groups.filter((g) => !data.groupIds.length || data.groupIds.includes(g.id)).flatMap((g) => g.studentIds))], `Kutubxonaga yangi material: «${data.title}»`, '#/platform/library')
      logActivity(scope.orgId, user.id, 'kutubxonaga material qo‘shdi', data.title)
      toast('Material qo‘shildi')
    } else { patch('library', item.id, data); toast('Saqlandi') }
    onClose()
  }
  return (
    <Modal open={open} onClose={onClose} title={isNew ? 'Material qo‘shish' : 'Materialni tahrirlash'} footer={<><Btn onClick={onClose}>Bekor</Btn><Btn variant="primary" onClick={submit}>{isNew ? 'Qo‘shish' : 'Saqlash'}</Btn></>}>
      <div className="pform">
        <FField label="Nomi" error={err.title}><Input value={f.title || ''} onChange={(e) => set('title', e.target.value)} autoFocus /></FField>
        <div className="pform__row">
          <FField label="Muallif"><Input value={f.author || ''} onChange={(e) => set('author', e.target.value)} /></FField>
          <FField label="Turi"><Select value={f.type} onChange={(v) => set('type', v)} options={Object.entries(TYPES).map(([k, t]) => ({ value: k, label: t.label }))} /></FField>
        </div>
        <div className="pform__row">
          <FField label="Betlar soni"><Input type="number" value={f.pages || ''} onChange={(e) => set('pages', e.target.value)} /></FField>
          <FField label="Yil"><Input type="number" value={f.year || ''} onChange={(e) => set('year', e.target.value)} /></FField>
        </div>
        <FField label={f.type === 'link' ? 'Havola' : 'Fayl havolasi'} error={err.url} hint="Backend ulanganda fayl yuklash qo‘shiladi"><Input value={f.url || ''} onChange={(e) => set('url', e.target.value)} placeholder="https://…" /></FField>
        <FField label="Kimlar ko‘radi"><ChipSelect allLabel="Barcha guruhlar" value={f.groupIds || []} onChange={(v) => set('groupIds', v)} options={scope.groups.map((g) => ({ value: g.id, label: g.name, color: g.color }))} /></FField>
        <FField label="Tavsif"><Textarea value={f.description || ''} onChange={(e) => set('description', e.target.value)} /></FField>
      </div>
    </Modal>
  )
}
