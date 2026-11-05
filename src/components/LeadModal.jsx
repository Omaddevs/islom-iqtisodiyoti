import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { CONTACTS } from '../data/content.js'
import { Icon, SocialIcon } from './ui.jsx'
import DirIcon from './DirIcons.jsx'
import { formatPhone, isFullPhone } from '../utils/phone.js'
import { leadsApi } from '../platform/api/client.js'

// Istalgan joydan chaqiriladi: openLead({ kind: 'course', course }) | 'partner' | 'start'
const EVENT = 'lead:open'
export const openLead = (detail) => window.dispatchEvent(new CustomEvent(EVENT, { detail }))
// <a href> tugmalar uchun: sahifa o'tishini to'xtatib, popupni ochadi
export const leadClick = (detail) => (e) => { e.preventDefault(); openLead(detail) }

const VARIANTS = {
  course: {
    icon: 'book',
    eyebrow: 'Dasturga ariza',
    title: 'Ariza qoldiring',
    text: 'Ma’lumotlaringizni qoldiring — boshlanish sanasi, tartibi va to‘lov belgilangach menejerimiz siz bilan bog‘lanadi.',
    submit: 'Ariza yuborish',
  },
  partner: {
    icon: 'briefcase',
    eyebrow: 'Hamkorlik',
    title: 'Hamkor bo‘ling',
    text: 'Korporativ o‘qitish va qo‘shma dasturlar bo‘yicha taklifimizni tayyorlab, siz bilan bog‘lanamiz.',
    perks: ['Korporativ o‘qitish', 'Qo‘shma dasturlar', 'Sertifikatlash'],
    submit: 'So‘rov yuborish',
  },
  start: {
    icon: 'gift',
    eyebrow: 'Bepul boshlash',
    title: 'Bepul o‘qishni boshlang',
    text: 'Ism va raqamingizni qoldiring — sizga mos kursni tanlab, platformaga bepul kirish ochib beramiz.',
    perks: ['Bepul kirish', 'Sertifikat', 'AI Ustoz'],
    submit: 'Bepul boshlash',
  },
}

const EMPTY = { name: '', phone: '+998 ' }
const TG = CONTACTS.telegram


export default function LeadModal() {
  const [ctx, setCtx] = useState(null) // { kind, course? }
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState('form') // info (kurs tafsiloti) | form
  const [form, setForm] = useState(EMPTY)
  const [errors, setErrors] = useState({})
  const [status, setStatus] = useState('idle') // idle | sending | sent
  const dialog = useRef(null)
  const nameInput = useRef(null)
  const trigger = useRef(null)
  const titleId = useId()

  useEffect(() => {
    const onOpen = (e) => {
      trigger.current = document.activeElement
      setCtx(e.detail)
      setStep(e.detail.course ? 'info' : 'form')
      setForm(EMPTY)
      setErrors({})
      setStatus('idle')
      // avval yopiq holatda chiziladi, keyingi kadrda ochiladi — kirish animatsiyasi ishlashi uchun
      requestAnimationFrame(() => requestAnimationFrame(() => setOpen(true)))
    }
    window.addEventListener(EVENT, onOpen)
    return () => window.removeEventListener(EVENT, onOpen)
  }, [])

  const close = () => setOpen(false)

  // Scroll qulfi (html'da — sticky header buzilmasligi uchun), Esc, fokus tuzog'i
  useEffect(() => {
    if (!open) return
    const root = document.documentElement
    root.style.overflow = 'hidden'
    const t = setTimeout(() => (nameInput.current ?? dialog.current)?.focus({ preventScroll: true }), 60)

    const onKey = (e) => {
      if (e.key === 'Escape') return close()
      if (e.key !== 'Tab' || !dialog.current) return
      const items = dialog.current.querySelectorAll('button, a[href], input')
      const first = items[0], last = items[items.length - 1]
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      clearTimeout(t)
      root.style.overflow = ''
      document.removeEventListener('keydown', onKey)
      trigger.current?.focus?.({ preventScroll: true })
    }
  }, [open])

  // Tafsilot ↔ forma almashganda: yuqoridan boshlanadi, fokus yo'qolmaydi
  useEffect(() => {
    if (!open || !dialog.current) return
    dialog.current.scrollTop = 0
    ;(nameInput.current ?? dialog.current).focus({ preventScroll: true })
  }, [step]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!ctx) return null
  const v = VARIANTS[ctx.kind] ?? VARIANTS.start
  const course = ctx.course

  const update = (k, val) => {
    setForm((f) => ({ ...f, [k]: val }))
    if (errors[k]) setErrors((e) => ({ ...e, [k]: undefined }))
  }

  const submit = (ev) => {
    ev.preventDefault()
    const e = {}
    const name = form.name.trim().replace(/\s+/g, ' ')
    if (name.length < 2) e.name = 'Ismingizni kiriting'
    else if (name.split(' ').length < 2) e.name = 'Familiyani ham kiriting'
    if (!isFullPhone(form.phone)) e.phone = 'Raqamni to‘liq kiriting'
    setErrors(e)
    if (Object.keys(e).length) {
      dialog.current?.querySelector(`[name="${Object.keys(e)[0]}"]`)?.focus()
      return
    }
    setStatus('sending')
    // Ariza serverga — bosh admin «Arizalar» bo'limida ko'radi
    leadsApi.send({ kind: ctx.kind, course: course?.title, name, phone: form.phone })
      .then(() => setStatus('sent'))
      .catch((er) => { setErrors({ phone: er.message }); setStatus('idle') })
  }

  const firstName = form.name.trim().split(/\s+/)[0]

  return createPortal(
    <div className={`lead ${open ? 'is-open' : ''}`} onTransitionEnd={(e) => { if (!open && e.target === e.currentTarget) setCtx(null) }}>
      <div className="lead__backdrop" onClick={close} />

      <div className={`lead__dialog ${status === 'sent' ? 'is-done' : ''} ${step === 'info' ? 'lead__dialog--info' : ''}`} ref={dialog} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby={titleId}
        style={course && status !== 'sent' ? { '--lc': course.color } : undefined}>
        <span className="lead__grab" aria-hidden="true" />
        <button type="button" className="lead__close" onClick={close} aria-label="Yopish">
          <Icon name="x" size={20} />
        </button>

        {status === 'sent' ? (
          <div className="lead__done">
            <span className="lead__done-icon"><Icon name="check" size={30} stroke={2.6} /></span>
            <h3 id={titleId}>So‘rovingiz qabul qilindi!</h3>
            <p>
              Rahmat, {firstName}. <b>{form.phone}</b> raqamiga tez orada qo‘ng‘iroq qilamiz.
            </p>
            <div className="lead__done-actions">
              <button type="button" className="lead__submit" onClick={close}>Yaxshi</button>
              <a className="lead__tg" href={TG} target="_blank" rel="noreferrer">
                <SocialIcon name="telegram" size={15} /> Telegram’da yozish
              </a>
            </div>
          </div>
        ) : step === 'info' ? (
          <CourseInfo course={course} titleId={titleId} onApply={() => setStep('form')} />
        ) : (
          <>
            {course && (
              <button type="button" className="lead__back" onClick={() => setStep('info')}>
                <Icon name="arrowLeft" size={16} /> Orqaga
              </button>
            )}
            <div className="lead__head">
              <span className="lead__badge"><Icon name={v.icon} size={22} /></span>
              <p className="lead__eyebrow">{v.eyebrow}</p>
              <h3 className="lead__title" id={titleId}>{v.title}</h3>
              <p className="lead__text">{v.text}</p>
            </div>

            {course && (
              <div className="lead__course">
                <span className="lead__course-icon"><DirIcon name={course.icon} size={28} /></span>
                <span className="lead__course-body">
                  <b>{course.title}</b>
                  <small>{course.kind} · {course.stage}</small>
                </span>
              </div>
            )}

            {v.perks && (
              <ul className="lead__perks">
                {v.perks.map((p) => <li key={p}><Icon name="check" size={14} stroke={2.4} /> {p}</li>)}
              </ul>
            )}

            <form className="lead__form" onSubmit={submit} noValidate>
              <LeadField label="Ism va familiya" icon="user" error={errors.name}>
                <input ref={nameInput} name="name" value={form.name} onChange={(e) => update('name', e.target.value)}
                  placeholder="Masalan, Aziz Karimov" autoComplete="name" aria-invalid={!!errors.name} />
              </LeadField>
              <LeadField label="Telefon raqam" icon="phone" error={errors.phone}>
                <input name="phone" value={form.phone} onChange={(e) => update('phone', formatPhone(e.target.value))}
                  placeholder="+998 90 123 45 67" inputMode="tel" autoComplete="tel" aria-invalid={!!errors.phone} />
              </LeadField>

              <button type="submit" className="lead__submit" disabled={status === 'sending'}>
                {status === 'sending'
                  ? <><span className="spinner" /> Yuborilmoqda…</>
                  : <>{v.submit} <Icon name="arrowRight" size={18} /></>}
              </button>

              <p className="lead__note">
                <Icon name="lock" size={14} /> Ma’lumotlaringiz uchinchi shaxslarga berilmaydi
              </p>
            </form>
          </>
        )}
      </div>
    </div>,
    document.body,
  )
}

function CourseInfo({ course, titleId, onApply }) {
  const facts = [
    ['Bosqich', course.stage],
    ['Asos talabi', course.prereq],
    ['Asosiy soha', course.field],
    course.volume && ['Namunaviy hajm', course.volume],
  ].filter(Boolean)
  return (
    <>
      <div className="linfo__head">
        <span className="lead__course-icon"><DirIcon name={course.icon} size={28} /></span>
        <div>
          <p className="lead__eyebrow">{course.kind}</p>
          <h3 className="linfo__title" id={titleId}>{course.title}</h3>
        </div>
      </div>

      <dl className="linfo__facts">
        {facts.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
      </dl>

      <h4 className="linfo__h">Maqsadi</h4>
      <p className="linfo__text">{course.goal}</p>

      <h4 className="linfo__h">Kimlar uchun</h4>
      <ul className="linfo__list">{course.audience.map((t) => <li key={t}>{t}</li>)}</ul>

      <h4 className="linfo__h">Bosqich va talablar</h4>
      <ul className="linfo__list">{course.requirements.map((t) => <li key={t}>{t}</li>)}</ul>

      <p className="linfo__note">
        <Icon name="info" size={16} />
        {course.kind === 'Sertifikat'
          ? 'Kurs hajmi, o‘qish muddati, imtihon tartibi va to‘lov miqdori Nizom tasdiqlangandan so‘ng belgilanadi.'
          : 'Hajmi, muddati va to‘lov miqdori tez orada e’lon qilinadi.'}
      </p>

      <div className="linfo__cta">
        <button type="button" className="lead__submit" onClick={onApply}>
          Ariza qoldirish <Icon name="arrowRight" size={18} />
        </button>
      </div>
    </>
  )
}

function LeadField({ label, icon, error, children }) {
  return (
    <label className={`lead-field ${error ? 'is-error' : ''}`}>
      <span className="lead-field__label">{label}</span>
      <span className="lead-field__control">
        <Icon name={icon} size={18} className="lead-field__icon" />
        {children}
      </span>
      {error && <span className="lead-field__err"><Icon name="info" size={13} /> {error}</span>}
    </label>
  )
}
