import { useEffect, useRef, useState } from 'react'
import { CONTACTS } from '../data/content.js'
import { Field, Icon } from '../components/ui.jsx'
import { formatPhone, isFullPhone } from '../utils/phone.js'
import { useAuth } from '../platform/store/auth.jsx'
import { ROLES } from '../platform/store/seed.js'

const PERKS = [
  'Jonli darslar, video darslar va testlar',
  'Uy vazifalari, lug‘at va kutubxona',
  'Ustozlar bilan bevosita muloqot',
]

// Demo hisoblar (backend ulanguncha)
const DEMO = [
  { role: 'superadmin', phone: '+998 90 000 00 01', password: 'admin123' },
  { role: 'org_admin', phone: '+998 90 000 00 02', password: 'admin123' },
  { role: 'teacher', phone: '+998 90 000 00 03', password: 'ustoz123' },
  { role: 'student', phone: '+998 90 000 00 04', password: 'talaba123' },
]

export default function LoginPage() {
  const { user, login } = useAuth()
  const [form, setForm] = useState({ phone: '+998 ', password: '' })
  const [errors, setErrors] = useState({})
  const [showPass, setShowPass] = useState(false)
  const [caps, setCaps] = useState(false)
  const [status, setStatus] = useState('idle') // idle | sending
  const phoneRef = useRef(null)

  useEffect(() => {
    document.title = 'Kirish — Islom Iqtisodiyoti'
    phoneRef.current?.focus()
  }, [])

  // Allaqachon kirgan bo'lsa — to'g'ridan-to'g'ri platformaga
  useEffect(() => { if (user) window.location.hash = '#/platform' }, [user])

  const update = (k, v) => {
    setForm((f) => ({ ...f, [k]: v }))
    if (errors[k] || errors.form) setErrors((e) => ({ ...e, [k]: undefined, form: undefined }))
  }

  const validate = () => {
    const e = {}
    if (!isFullPhone(form.phone)) e.phone = 'Telefon raqamini to‘liq kiriting'
    if (!form.password) e.password = 'Parolni kiriting'
    else if (form.password.length < 6) e.password = 'Parol kamida 6 ta belgidan iborat'
    return e
  }

  const doLogin = (phone, password) => {
    setStatus('sending')
    // Backend ulanganda: await api.login(phone, password)
    setTimeout(() => {
      const r = login(phone, password)
      if (!r.ok) { setErrors({ form: r.error }); setStatus('idle'); return }
      window.location.hash = '#/platform'
    }, 500)
  }

  const submit = (ev) => {
    ev.preventDefault()
    const e = validate()
    setErrors(e)
    if (Object.keys(e).length) return
    doLogin(form.phone, form.password)
  }

  const quick = (d) => { setForm({ phone: d.phone, password: d.password }); setErrors({}); doLogin(d.phone, d.password) }
  const onPassKey = (e) => setCaps(e.getModifierState?.('CapsLock') ?? false)

  return (
    <div className="auth">
      <aside className="auth__side">
        <img src="/logo/logo-mark.png" alt="" className="auth__mark" aria-hidden="true" />
        <a href="#/" className="auth__logo" aria-label="Bosh sahifa">
          <img src="/logo/logo-white.png" alt="Islom Iqtisodiyoti" />
        </a>
        <div className="auth__pitch">
          <h2>Onlayn ta’lim platformasiga xush kelibsiz</h2>
          <ul>
            {PERKS.map((p) => (
              <li key={p}><span><Icon name="check" size={14} stroke={2.6} /></span>{p}</li>
            ))}
          </ul>
        </div>
        <p className="auth__quote">
          “Bilim — eng foydali sarmoya.” <span>50 000+ o‘quvchi biz bilan o‘qimoqda</span>
        </p>
      </aside>

      <main className="auth__main">
        <div className="auth__top">
          <a href="#/" className="auth__logo auth__logo--dark" aria-label="Bosh sahifa">
            <img src="/logo/logo.png" alt="Islom Iqtisodiyoti" />
          </a>
          <a href="#/" className="auth__back"><Icon name="arrowLeft" size={16} /> Bosh sahifa</a>
        </div>

        <div className="auth__card">
          <span className="auth__badge"><Icon name="logIn" size={22} /></span>
          <h1 className="auth__title">Platformaga kirish</h1>
          <p className="auth__sub">Tashkilotingiz bergan telefon raqam va parolni kiriting</p>

          {errors.form && (
            <div className="auth__alert" role="alert"><Icon name="info" size={18} /> {errors.form}</div>
          )}

          <form className="auth__form" onSubmit={submit} noValidate>
            <Field label="Telefon raqam" icon="phone" error={errors.phone}>
              <input ref={phoneRef} type="tel" name="phone" value={form.phone}
                onChange={(e) => update('phone', formatPhone(e.target.value))}
                placeholder="+998 90 123 45 67" inputMode="tel" autoComplete="tel" />
            </Field>

            <Field label="Parol" icon="lock" error={errors.password}
              extra={caps && <span className="auth__caps">Caps Lock yoqilgan</span>}>
              <input type={showPass ? 'text' : 'password'} name="password" value={form.password}
                onChange={(e) => update('password', e.target.value)} onKeyUp={onPassKey} onKeyDown={onPassKey}
                placeholder="Parolingiz" autoComplete="current-password" className="has-toggle" />
              <button type="button" className="auth__toggle" onClick={() => setShowPass((v) => !v)}
                aria-label={showPass ? 'Parolni yashirish' : 'Parolni ko‘rsatish'} aria-pressed={showPass}>
                <Icon name={showPass ? 'eyeOff' : 'eye'} size={18} />
              </button>
            </Field>

            <button type="submit" className="btn btn--primary auth__submit" disabled={status === 'sending'}>
              {status === 'sending' ? <span className="spinner" /> : null}
              {status === 'sending' ? 'Kirilmoqda…' : 'Kirish'}
            </button>
          </form>

          <div className="auth__demo">
            <b><Icon name="spark" size={15} /> Demo hisoblar</b>
            <p>Rolni tanlang — avtomatik kirasiz. Har bir rol o‘z imkoniyatlariga ega.</p>
            <div className="auth__demo-grid">
              {DEMO.map((d) => (
                <button key={d.role} type="button" onClick={() => quick(d)} disabled={status === 'sending'}>
                  <i style={{ background: ROLES[d.role].color }} />
                  <span><b>{ROLES[d.role].label}</b><span>{d.phone} · {d.password}</span></span>
                </button>
              ))}
            </div>
          </div>

          <p className="auth__help">
            Parolni unutdingizmi yoki hisobingiz yo‘qmi?{' '}
            <a href={`tel:${CONTACTS.phone.replace(/\s/g, '')}`}>{CONTACTS.phone}</a>
          </p>
        </div>

        <p className="auth__legal">© {new Date().getFullYear()} Islom Iqtisodiyoti</p>
      </main>
    </div>
  )
}
