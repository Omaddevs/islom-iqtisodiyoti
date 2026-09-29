import { useEffect, useState } from 'react'
import { useAuth } from '../store/auth.jsx'
import { add, patch, setDB, logActivity } from '../store/db.js'
import { PageHead, Card, Btn, Badge, Modal, FField, Input, Textarea, Select, Empty, Icon, Confirm, Menu, useToast, Credentials, cx } from '../ui/kit.jsx'
import { fmtDate } from '../ui/format.js'
import { genPassword, genPhone, prettyPhone, digits } from '../store/ids.js'
import { formatPhone, isFullPhone } from '../../utils/phone.js'
import { hashQuery } from './Meetings.jsx'

const COLORS = ['#4aa3f8', '#14b8a6', '#8b5cf6', '#f59e0b', '#10b981', '#f43f5e', '#0ea5e9', '#6366f1']

export default function Organizations() {
  const { user, db, setViewOrg } = useAuth()
  const toast = useToast()
  const [editing, setEditing] = useState(null)
  const [creds, setCreds] = useState(null)
  const [del, setDel] = useState(null)
  useEffect(() => { if (hashQuery().get('new')) setEditing({}) }, [])
  if (user.role !== 'superadmin') return <Card><Empty icon="shield" title="Ruxsat yo‘q" text="Bu bo‘lim faqat bosh administrator uchun." /></Card>

  const toggle = (o) => { patch('organizations', o.id, { status: o.status === 'active' ? 'suspended' : 'active' }); toast(o.status === 'active' ? 'Tashkilot to‘xtatildi' : 'Tashkilot faollashtirildi') }
  const doDelete = (o) => {
    setDB((s) => {
      const drop = (col) => s[col].filter((x) => x.orgId !== o.id)
      return { ...s, organizations: s.organizations.filter((x) => x.id !== o.id), users: drop('users'), groups: drop('groups'), meetings: drop('meetings'), videos: drop('videos'), tests: drop('tests'), vocabSets: drop('vocabSets'), library: drop('library'), articles: drop('articles'), homework: drop('homework'), activity: drop('activity') }
    })
    toast('Tashkilot va uning ma’lumotlari o‘chirildi')
  }

  return (
    <>
      <PageHead icon="building" title="Tashkilotlar" sub="Har bir tashkilot o‘z adminlari, ustozlari, o‘quvchilari va kontentiga ega. Ma’lumotlar bir-biridan ajratilgan." actions={<Btn variant="primary" icon="plus" onClick={() => setEditing({})}>Tashkilot qo‘shish</Btn>} />
      <div className="pgrid pgrid--cards">
        {db.organizations.map((o) => {
          const us = db.users.filter((u) => u.orgId === o.id)
          const admins = us.filter((u) => u.role === 'org_admin')
          return (
            <article key={o.id} className="porg">
              <div className="porg__head">
                <div className="porg__logo" style={{ background: o.color }}>{o.name[0]}</div>
                <div style={{ minWidth: 0, flex: 1 }}><h4>{o.name}</h4><span>{o.slug} · {fmtDate(o.createdAt)} dan</span></div>
                <Menu items={[
                  { label: 'Tashkilot ichiga kirish', icon: 'logIn', onClick: () => { setViewOrg(o.id); window.location.hash = '#/platform' } },
                  { label: 'Tahrirlash', icon: 'edit', onClick: () => setEditing(o) },
                  { label: 'Admin qo‘shish', icon: 'userPlus', onClick: () => setEditing({ ...o, _addAdmin: true }) },
                  'sep',
                  { label: o.status === 'active' ? 'To‘xtatish' : 'Faollashtirish', icon: o.status === 'active' ? 'block' : 'checkCircle', onClick: () => toggle(o) },
                  { label: 'O‘chirish', icon: 'trash', danger: true, onClick: () => setDel(o) },
                ]} />
              </div>
              <div className="prow" style={{ marginTop: 12, gap: 6 }}>
                <Badge tone={o.plan === 'pro' ? 'violet' : 'gray'}>{o.plan === 'pro' ? 'Pro tarif' : 'Basic tarif'}</Badge>
                <Badge tone={o.status === 'active' ? 'green' : 'red'} dot>{o.status === 'active' ? 'Faol' : 'To‘xtatilgan'}</Badge>
              </div>
              {o.description && <p className="pmuted" style={{ marginTop: 10, fontSize: 13.5 }}>{o.description}</p>}
              <div className="porg__stats">
                <div><b>{admins.length}</b><span>admin</span></div>
                <div><b>{us.filter((u) => u.role === 'teacher').length}</b><span>ustoz</span></div>
                <div><b>{us.filter((u) => u.role === 'student').length}</b><span>o‘quvchi</span></div>
                <div><b>{db.groups.filter((g) => g.orgId === o.id).length}</b><span>guruh</span></div>
              </div>
              <div style={{ fontSize: 13, color: 'var(--pf-text-2)' }}>
                <div className="prow" style={{ gap: 6, marginBottom: 4 }}><Icon name="phone" size={14} /> {o.phone || '—'}</div>
                <div className="prow" style={{ gap: 6 }}><Icon name="mail" size={14} /> {o.email || '—'}</div>
              </div>
              <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--pf-line)' }}>
                <span className="pmuted" style={{ fontSize: 12, display: 'block', marginBottom: 6 }}>Adminlar</span>
                {admins.length === 0 && <span className="pmuted" style={{ fontSize: 13 }}>Admin yo‘q</span>}
                {admins.map((a) => <div key={a.id} className="prow prow--between" style={{ fontSize: 13.5, marginBottom: 4 }}><span>{a.name}</span><Btn size="sm" variant="ghost" icon="key" onClick={() => setCreds(a)}>Login</Btn></div>)}
              </div>
              <div style={{ marginTop: 14 }}><Btn variant="soft" icon="logIn" style={{ width: '100%' }} onClick={() => { setViewOrg(o.id); window.location.hash = '#/platform' }}>Tashkilot ichiga kirish</Btn></div>
            </article>
          )
        })}
      </div>
      <OrgForm open={!!editing} org={editing} onClose={() => setEditing(null)} onCreds={setCreds} />
      <Modal open={!!creds} onClose={() => setCreds(null)} title="Admin kirish ma’lumotlari" width={480} footer={<Btn variant="primary" onClick={() => setCreds(null)}>Tayyor</Btn>}><Credentials user={creds} note="Tashkilot admini shu ma’lumotlar bilan kiradi va o‘z ustoz/o‘quvchilarini yaratadi." /></Modal>
      <Confirm open={!!del} onClose={() => setDel(null)} danger title="Tashkilotni o‘chirish" text={`«${del?.name}» va unga tegishli barcha foydalanuvchilar, guruhlar va materiallar o‘chiriladi. Bu amalni qaytarib bo‘lmaydi.`} confirmLabel="O‘chirish" onConfirm={() => doDelete(del)} />
    </>
  )
}

function OrgForm({ open, org, onClose, onCreds }) {
  const { user, db } = useAuth()
  const toast = useToast()
  const isNew = !org?.id
  const addAdmin = !!org?._addAdmin
  const [f, setF] = useState({})
  const [err, setErr] = useState({})
  useEffect(() => {
    if (!open) return
    setErr({})
    const taken = new Set(db.users.map((u) => digits(u.phone)))
    const adminPart = { adminName: '', adminPhone: genPhone(taken), adminPassword: genPassword() }
    setF(isNew ? { name: '', slug: '', plan: 'basic', color: COLORS[db.organizations.length % COLORS.length], phone: '+998 ', email: '', description: '', ...adminPart } : { ...org, ...adminPart })
  }, [open, org, isNew, db.users, db.organizations.length])
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }))
  const slugify = (s) => s.toLowerCase().replace(/[‘’'ʼ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

  const submit = () => {
    const er = {}
    if (!f.name?.trim()) er.name = 'Nomini kiriting'
    const needAdmin = isNew || addAdmin
    if (needAdmin) {
      if (!f.adminName?.trim()) er.adminName = 'Admin ismini kiriting'
      if (!isFullPhone(f.adminPhone)) er.adminPhone = 'Telefonni to‘liq kiriting'
      else if (db.users.some((u) => digits(u.phone) === digits(f.adminPhone))) er.adminPhone = 'Bu raqam band'
      if (!f.adminPassword || f.adminPassword.length < 6) er.adminPassword = 'Parol kamida 6 belgi'
    }
    setErr(er); if (Object.keys(er).length) return
    const data = { name: f.name.trim(), slug: f.slug?.trim() || slugify(f.name), plan: f.plan, color: f.color, phone: f.phone?.trim(), email: f.email?.trim(), description: f.description?.trim() }
    let orgId = org?.id
    if (isNew) { const o = add('organizations', { ...data, status: 'active' }); orgId = o.id; logActivity(null, user.id, 'tashkilot qo‘shdi', o.name); toast('Tashkilot yaratildi') }
    else if (!addAdmin) { patch('organizations', org.id, data); toast('Saqlandi') }
    if (needAdmin) {
      const a = add('users', { orgId, role: 'org_admin', name: f.adminName.trim(), phone: prettyPhone(f.adminPhone), password: f.adminPassword, title: 'Tashkilot admini', avatarColor: f.color, status: 'active', createdBy: user.id, lastSeen: null })
      onCreds(a)
    }
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} width={640} title={isNew ? 'Yangi tashkilot' : addAdmin ? `${org.name}: admin qo‘shish` : 'Tashkilotni tahrirlash'} sub={isNew ? 'Tashkilot bilan birga uning birinchi admini yaratiladi' : undefined}
      footer={<><Btn onClick={onClose}>Bekor</Btn><Btn variant="primary" onClick={submit}>{isNew ? 'Yaratish' : addAdmin ? 'Admin yaratish' : 'Saqlash'}</Btn></>}>
      <div className="pform">
        {!addAdmin && (
          <>
            <div className="pform__row">
              <FField label="Tashkilot nomi" error={err.name}><Input value={f.name || ''} onChange={(e) => { set('name', e.target.value); if (isNew) set('slug', slugify(e.target.value)) }} autoFocus /></FField>
              <FField label="Identifikator (slug)"><Input className="pinput mono" value={f.slug || ''} onChange={(e) => set('slug', e.target.value)} /></FField>
            </div>
            <div className="pform__row">
              <FField label="Tarif"><Select value={f.plan} onChange={(v) => set('plan', v)} options={[{ value: 'basic', label: 'Basic — 3 guruhgacha' }, { value: 'pro', label: 'Pro — cheksiz' }]} /></FField>
              <FField label="Rang"><div className="pswatches" style={{ paddingTop: 6 }}>{COLORS.map((c) => <button key={c} type="button" className={cx(f.color === c && 'is-on')} style={{ background: c }} onClick={() => set('color', c)} aria-label={c} />)}</div></FField>
            </div>
            <div className="pform__row">
              <FField label="Telefon"><Input value={f.phone || ''} onChange={(e) => set('phone', formatPhone(e.target.value))} /></FField>
              <FField label="Email"><Input type="email" value={f.email || ''} onChange={(e) => set('email', e.target.value)} /></FField>
            </div>
            <FField label="Tavsif"><Textarea value={f.description || ''} onChange={(e) => set('description', e.target.value)} style={{ minHeight: 80 }} /></FField>
          </>
        )}
        {(isNew || addAdmin) && (
          <div className="pqb">
            <b style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}><Icon name="shield" size={18} /> Tashkilot admini</b>
            <div className="pform">
              <FField label="Ism familiya" error={err.adminName}><Input value={f.adminName || ''} onChange={(e) => set('adminName', e.target.value)} autoFocus={addAdmin} /></FField>
              <div className="pform__row">
                <FField label="Telefon (login)" error={err.adminPhone}><div className="prow" style={{ flexWrap: 'nowrap' }}><Input className="pinput mono" value={f.adminPhone || ''} onChange={(e) => set('adminPhone', formatPhone(e.target.value))} /><Btn icon="refresh" onClick={() => set('adminPhone', genPhone(new Set(db.users.map((u) => digits(u.phone)))))} /></div></FField>
                <FField label="Parol" error={err.adminPassword}><div className="prow" style={{ flexWrap: 'nowrap' }}><Input className="pinput mono" value={f.adminPassword || ''} onChange={(e) => set('adminPassword', e.target.value)} /><Btn icon="refresh" onClick={() => set('adminPassword', genPassword())} /></div></FField>
              </div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}
