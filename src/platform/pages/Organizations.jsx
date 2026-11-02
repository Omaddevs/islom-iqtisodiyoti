import { useEffect, useState } from 'react'
import { useAuth } from '../store/auth.jsx'
import { add, patch, commit, loadDB, logActivity } from '../store/db.js'
import { Card, Btn, Badge, Modal, FField, Input, Textarea, Select, Empty, Icon, Confirm, Menu, useToast, Credentials, cx } from '../ui/kit.jsx'
import { genPassword, genPhone, prettyPhone, digits } from '../store/ids.js'
import { formatPhone, isFullPhone } from '../../utils/phone.js'
import { hashQuery } from './Meetings.jsx'
import { HeroArt } from './Articles.jsx'
import { StatSpark } from '../ui/charts.jsx'

const COLORS = ['#4aa3f8', '#14b8a6', '#8b5cf6', '#f59e0b', '#10b981', '#f43f5e', '#0ea5e9', '#6366f1']

export default function Organizations() {
  const { user, db, viewOrgId, setViewOrg } = useAuth()
  const toast = useToast()
  const [editing, setEditing] = useState(null)
  const [creds, setCreds] = useState(null)
  const [del, setDel] = useState(null)
  useEffect(() => { if (hashQuery().get('new')) setEditing({}) }, [])
  if (user.role !== 'superadmin') return <Card><Empty icon="shield" title="Ruxsat yo‘q" text="Bu bo‘lim faqat bosh administrator uchun." /></Card>

  const toggle = (o) => { patch('organizations', o.id, { status: o.status === 'active' ? 'suspended' : 'active' }); toast(o.status === 'active' ? 'Tashkilot to‘xtatildi' : 'Tashkilot faollashtirildi') }
  // Server tashkilotni barcha foydalanuvchi, guruh va materiallari bilan birga o'chiradi
  const doDelete = async (o) => {
    try {
      await commit([{ col: 'organizations', op: 'delete', id: o.id }])
      await loadDB()
      if (viewOrgId === o.id) setViewOrg(null)
      toast('Tashkilot va uning ma’lumotlari o‘chirildi')
    } catch (e) { toast(e.message, 'err') }
  }

  const enter = (o) => { setViewOrg(o.id); window.location.hash = '#/platform' }
  const allUsers = db.users.filter((u) => u.orgId)
  const byRole = (r) => allUsers.filter((u) => u.role === r)
  // 12 oylik o'sish: har oy oxirigacha yaratilgan yozuvlar soni
  const growth = (list) => Array.from({ length: 12 }, (_, i) => { const ts = Date.now() - (11 - i) * 30 * 864e5; return list.filter((x) => (x.createdAt || 0) <= ts).length })

  return (
    <>
      {/* Sarlavha banneri */}
      <section className="pthero pahero puhero pohero">
        <span className="pthero__icon"><Icon name="building" size={34} /></span>
        <div className="pthero__text">
          <h1>Tashkilotlar</h1>
          <p>Har bir tashkilot o‘z adminlari, ustozlari, o‘quvchilari va kontentiga ega. Ma’lumotlar bir-biridan ajratilgan.</p>
        </div>
        <blockquote className="pthero__quote">“Ilm bilan yuksalgan jamiyat barhayotdir.”</blockquote>
        <HeroArt />
        <Btn variant="primary" size="lg" icon="plus" className="pthero__btn" onClick={() => setEditing({})}>Tashkilot qo‘shish</Btn>
      </section>

      {/* Statistika */}
      <div className="postats">
        <StatSpark icon="building" tone="blue" color="#3b8ef0" value={db.organizations.length} label="Tashkilot" data={growth(db.organizations)} />
        <StatSpark icon="users" tone="violet" color="#8b5cf6" value={byRole('org_admin').length} label="Admin" data={growth(byRole('org_admin'))} />
        <StatSpark icon="user" tone="green" color="#10b981" value={byRole('teacher').length} label="Ustoz" data={growth(byRole('teacher'))} />
        <StatSpark icon="users" tone="amber" color="#f59e0b" value={byRole('student').length} label="O‘quvchi" data={growth(byRole('student'))} />
      </div>

      {db.organizations.length === 0 && <Card><Empty icon="building" title="Tashkilotlar yo‘q" text="Birinchi tashkilotni qo‘shing — u bilan birga admin ham yaratiladi." /></Card>}
      <div className="porgs">
        {db.organizations.map((o) => {
          const us = db.users.filter((u) => u.orgId === o.id)
          const admins = us.filter((u) => u.role === 'org_admin')
          const main = admins[0]
          const active = o.status === 'active'
          const stats = [
            { icon: 'users', tone: 'blue', n: admins.length, label: 'Admin' },
            { icon: 'user', tone: 'green', n: us.filter((u) => u.role === 'teacher').length, label: 'Ustoz' },
            { icon: 'user', tone: 'amber', n: us.filter((u) => u.role === 'student').length, label: 'O‘quvchi' },
            { icon: 'users', tone: 'violet', n: db.groups.filter((g) => g.orgId === o.id).length, label: 'Guruh' },
          ]
          return (
            <article key={o.id} className={cx('porg', !active && 'is-off')}>
              <div className="porg__head">
                <div className="porg__logo" style={{ background: `linear-gradient(145deg, ${o.color}, color-mix(in srgb, ${o.color} 78%, #000))` }}>{o.name[0]}</div>
                <div className="porg__ttl">
                  <h4 title={o.name}>{o.name}</h4>
                  <div className="porg__meta"><span className="mono">{o.slug}</span><Badge tone={active ? 'green' : 'red'} dot>{active ? 'Faol' : 'To‘xtatilgan'}</Badge></div>
                </div>
                <Menu trigger={<button type="button" className="porg__more" aria-label="Amallar"><Icon name="moreV" size={18} /></button>} items={[
                  { label: 'Tashkilot ichiga kirish', icon: 'logIn', onClick: () => enter(o) },
                  { label: 'Tahrirlash', icon: 'edit', onClick: () => setEditing(o) },
                  { label: 'Admin qo‘shish', icon: 'userPlus', onClick: () => setEditing({ ...o, _addAdmin: true }) },
                  'sep',
                  { label: active ? 'To‘xtatish' : 'Faollashtirish', icon: active ? 'block' : 'checkCircle', onClick: () => toggle(o) },
                  { label: 'O‘chirish', icon: 'trash', danger: true, onClick: () => setDel(o) },
                ]} />
              </div>

              <div className="porg__plan">
                <span className={cx('porg__tarif', o.plan === 'pro' && 'is-pro')}><Icon name={o.plan === 'pro' ? 'crown' : 'box'} size={17} />{o.plan === 'pro' ? 'Pro tarif' : 'Basic tarif'}</span>
                <p>{o.description || <span className="pmuted">Tavsif kiritilmagan</span>}</p>
              </div>

              <div className="porg__stats">
                {stats.map((s) => (
                  <div key={s.label} className={`porg__stat is-${s.tone}`}>
                    <span className="porg__sico"><Icon name={s.icon} size={17} /></span>
                    <span><b>{s.n}</b><small>{s.label}</small></span>
                  </div>
                ))}
              </div>

              <ul className="porg__contacts">
                <li><Icon name="phone" size={17} />{o.phone ? <a href={`tel:${o.phone.replace(/\s/g, '')}`}>{o.phone}</a> : <span className="pmuted">—</span>}</li>
                <li><Icon name="mail" size={17} />{o.email ? <a href={`mailto:${o.email}`}>{o.email}</a> : <span className="pmuted">—</span>}</li>
              </ul>

              <div className="porg__admin">
                <Icon name="user" size={22} />
                <div>
                  <small>Asosiy admin</small>
                  {main ? <b>{main.name}{admins.length > 1 && <em>+{admins.length - 1}</em>}</b> : <b className="pmuted">Admin yo‘q</b>}
                </div>
                {main
                  ? <Btn variant="ghost" icon="key" onClick={() => setCreds(main)}>Login</Btn>
                  : <Btn variant="ghost" icon="userPlus" onClick={() => setEditing({ ...o, _addAdmin: true })}>Qo‘shish</Btn>}
              </div>

              <Btn variant="soft" icon="logIn" className="porg__enter" onClick={() => enter(o)}>Tashkilot ichiga kirish</Btn>
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
