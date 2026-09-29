import { useState } from 'react'
import { useAuth } from '../store/auth.jsx'
import { patch, resetDB } from '../store/db.js'
import { PageHead, Card, Btn, Badge, FField, Input, Textarea, Select, UAvatar, Icon, Confirm, useToast, cx } from '../ui/kit.jsx'
import { ROLES } from '../store/seed.js'
import { fmtDate } from '../ui/format.js'

const COLORS = ['#4aa3f8', '#6366f1', '#14b8a6', '#f59e0b', '#10b981', '#f43f5e', '#8b5cf6', '#0ea5e9']

export default function Settings() {
  const { user, scope, can, logout } = useAuth()
  const toast = useToast()
  const [p, setP] = useState({ name: user.name, title: user.title || '', bio: user.bio || '', avatarColor: user.avatarColor })
  const [pw, setPw] = useState({ cur: '', next: '', rep: '' })
  const [pwErr, setPwErr] = useState('')
  const [org, setOrg] = useState(scope.org ? { name: scope.org.name, phone: scope.org.phone || '', email: scope.org.email || '', description: scope.org.description || '', color: scope.org.color, plan: scope.org.plan } : null)
  const [reset, setReset] = useState(false)

  const saveProfile = () => { if (!p.name.trim()) return toast('Ismni kiriting', 'err'); patch('users', user.id, { name: p.name.trim(), title: p.title.trim(), bio: p.bio.trim(), avatarColor: p.avatarColor }); toast('Profil saqlandi') }
  const savePw = () => {
    if (pw.cur !== user.password) return setPwErr('Joriy parol noto‘g‘ri')
    if (pw.next.length < 6) return setPwErr('Yangi parol kamida 6 belgi')
    if (pw.next !== pw.rep) return setPwErr('Parollar mos emas')
    patch('users', user.id, { password: pw.next }); setPw({ cur: '', next: '', rep: '' }); setPwErr(''); toast('Parol o‘zgartirildi')
  }
  const saveOrg = () => { patch('organizations', scope.org.id, { ...org, name: org.name.trim() }); toast('Tashkilot sozlamalari saqlandi') }

  return (
    <>
      <PageHead icon="settings" title="Sozlamalar" sub="Profil, xavfsizlik va tashkilot" />
      <div className="pgrid pgrid--main">
        <div className="pstack-v" style={{ gap: 20 }}>
          <Card title="Profil">
            <div className="pprofile" style={{ marginBottom: 20 }}>
              <UAvatar user={{ ...user, ...p }} size={72} />
              <div><h3>{p.name || user.name}</h3><p>{ROLES[user.role].label}{scope.org ? ` · ${scope.org.name}` : ''}</p><p style={{ fontSize: 13 }}>Login: <span className="mono">{user.phone}</span> · ro‘yxatdan: {fmtDate(user.createdAt)}</p></div>
            </div>
            <div className="pform">
              <div className="pform__row">
                <FField label="Ism familiya"><Input value={p.name} onChange={(e) => setP({ ...p, name: e.target.value })} /></FField>
                <FField label="Lavozim"><Input value={p.title} onChange={(e) => setP({ ...p, title: e.target.value })} placeholder={user.role === 'student' ? 'O‘quvchi' : 'Ustoz'} /></FField>
              </div>
              {user.role !== 'student' && <FField label="Qisqacha ma’lumot"><Textarea value={p.bio} onChange={(e) => setP({ ...p, bio: e.target.value })} style={{ minHeight: 80 }} /></FField>}
              <FField label="Avatar rangi"><div className="pswatches">{COLORS.map((c) => <button key={c} type="button" className={cx(p.avatarColor === c && 'is-on')} style={{ background: c }} onClick={() => setP({ ...p, avatarColor: c })} aria-label={c} />)}</div></FField>
              <div><Btn variant="primary" icon="check" onClick={saveProfile}>Saqlash</Btn></div>
            </div>
          </Card>
          <Card title="Parolni o‘zgartirish" sub="Kamida 6 ta belgi">
            <div className="pform">
              <FField label="Joriy parol"><Input type="password" value={pw.cur} onChange={(e) => setPw({ ...pw, cur: e.target.value })} autoComplete="current-password" /></FField>
              <div className="pform__row">
                <FField label="Yangi parol"><Input type="password" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} autoComplete="new-password" /></FField>
                <FField label="Takrorlang" error={pwErr}><Input type="password" value={pw.rep} onChange={(e) => setPw({ ...pw, rep: e.target.value })} autoComplete="new-password" /></FField>
              </div>
              <div><Btn variant="primary" icon="key" onClick={savePw}>Parolni yangilash</Btn></div>
            </div>
          </Card>
          {can('org.settings') && org && (
            <Card title="Tashkilot sozlamalari" sub={scope.org.name}>
              <div className="pform">
                <div className="pform__row">
                  <FField label="Nomi"><Input value={org.name} onChange={(e) => setOrg({ ...org, name: e.target.value })} /></FField>
                  <FField label="Tarif">{user.role === 'superadmin' ? <Select value={org.plan} onChange={(v) => setOrg({ ...org, plan: v })} options={[{ value: 'basic', label: 'Basic' }, { value: 'pro', label: 'Pro' }]} /> : <div style={{ height: 46, display: 'flex', alignItems: 'center' }}><Badge tone={org.plan === 'pro' ? 'violet' : 'gray'}>{org.plan === 'pro' ? 'Pro tarif' : 'Basic tarif'}</Badge></div>}</FField>
                </div>
                <div className="pform__row">
                  <FField label="Telefon"><Input value={org.phone} onChange={(e) => setOrg({ ...org, phone: e.target.value })} /></FField>
                  <FField label="Email"><Input value={org.email} onChange={(e) => setOrg({ ...org, email: e.target.value })} /></FField>
                </div>
                <FField label="Tavsif"><Textarea value={org.description} onChange={(e) => setOrg({ ...org, description: e.target.value })} style={{ minHeight: 80 }} /></FField>
                <FField label="Brend rangi"><div className="pswatches">{COLORS.map((c) => <button key={c} type="button" className={cx(org.color === c && 'is-on')} style={{ background: c }} onClick={() => setOrg({ ...org, color: c })} aria-label={c} />)}</div></FField>
                <div><Btn variant="primary" icon="check" onClick={saveOrg}>Saqlash</Btn></div>
              </div>
            </Card>
          )}
        </div>
        <div className="pstack-v" style={{ gap: 20 }}>
          <Card title="Hisob">
            <div className="pitem"><div className="pitem__icon"><Icon name="shield" size={20} /></div><div className="pitem__body"><b>Rol</b><span>{ROLES[user.role].label}</span></div></div>
            <div className="pitem"><div className="pitem__icon"><Icon name="phone" size={20} /></div><div className="pitem__body"><b>Login</b><span className="mono">{user.phone}</span></div></div>
            {scope.org && <div className="pitem"><div className="pitem__icon"><Icon name="building" size={20} /></div><div className="pitem__body"><b>Tashkilot</b><span>{scope.org.name}</span></div></div>}
            <div style={{ marginTop: 14 }}><Btn variant="danger" icon="logOut" onClick={() => { logout(); window.location.hash = '#/kirish' }}>Hisobdan chiqish</Btn></div>
          </Card>
          <Card title="Demo rejim" sub="Ma’lumotlar brauzeringizda saqlanadi">
            <p className="pmuted">Backend ulanmaguncha barcha o‘zgarishlar shu qurilmada (localStorage) saqlanadi. Boshlang‘ich holatga qaytarish uchun:</p>
            <div style={{ marginTop: 12 }}><Btn icon="refresh" onClick={() => setReset(true)}>Demo ma’lumotlarni tiklash</Btn></div>
          </Card>
          <Card title="Yordam">
            <p className="pmuted">Savollar bo‘lsa <a href="#/platform/articles" style={{ color: 'var(--pf-primary-2)', fontWeight: 600 }}>qo‘llanma maqolasini</a> o‘qing yoki tashkilot admini bilan bog‘laning.</p>
          </Card>
        </div>
      </div>
      <Confirm open={reset} onClose={() => setReset(false)} danger title="Demo ma’lumotlarni tiklash" text="Barcha o‘zgarishlar o‘chib, boshlang‘ich demo holat qaytariladi. Siz tizimdan chiqasiz." confirmLabel="Tiklash" onConfirm={() => { resetDB(); logout(); window.location.hash = '#/kirish' }} />
    </>
  )
}
