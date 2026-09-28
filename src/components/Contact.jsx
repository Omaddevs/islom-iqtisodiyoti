import { useEffect, useId, useRef, useState } from 'react'
import { CONTACTS } from '../data/content.js'
import { Icon, SectionHead, SocialIcon } from './ui.jsx'

const TOPICS = [
  { value: 'Kurslar haqida savol', hint: 'Dastur, daraja va sertifikat', icon: 'book' },
  { value: 'To‘lov va chegirmalar', hint: 'Narxlar, bo‘lib to‘lash, promo-kod', icon: 'tag' },
  { value: 'Korporativ o‘qitish', hint: 'Bank va kompaniyalar uchun', icon: 'briefcase' },
  { value: 'Hamkorlik', hint: 'Muallif yoki hamkor bo‘lish', icon: 'users' },
  { value: 'Boshqa', hint: 'Boshqa mavzudagi savollar', icon: 'info' },
]

const INFO = [
  { icon: 'phone', label: 'Telefon', value: CONTACTS.phone, href: `tel:${CONTACTS.phone.replace(/\s/g, '')}` },
  { icon: 'mail', label: 'Email', value: CONTACTS.email, href: `mailto:${CONTACTS.email}` },
  { icon: 'pin', label: 'Manzil', value: CONTACTS.address },
  { icon: 'clock', label: 'Ish vaqti', value: CONTACTS.hours },
]

const MSG_MAX = 500
const EMPTY = { name: '', phone: '+998 ', topic: TOPICS[0].value, message: '' }

// +998 90 123 45 67 ko'rinishiga keltiradi
function formatPhone(raw) {
  let d = raw.replace(/\D/g, '')
  if (d.startsWith('998')) d = d.slice(3)
  d = d.slice(0, 9)
  const parts = [d.slice(0, 2), d.slice(2, 5), d.slice(5, 7), d.slice(7, 9)].filter(Boolean)
  return '+998 ' + parts.join(' ')
}

export default function Contact() {
  const [form, setForm] = useState(EMPTY)
  const [errors, setErrors] = useState({})
  const [status, setStatus] = useState('idle') // idle | sending | sent

  const update = (k, v) => {
    setForm((f) => ({ ...f, [k]: v }))
    if (errors[k]) setErrors((e) => ({ ...e, [k]: undefined }))
  }
  const set = (k) => (e) => update(k, e.target.value)

  const validate = () => {
    const e = {}
    if (form.name.trim().length < 2) e.name = 'Ismingizni kiriting'
    if (form.phone.replace(/\D/g, '').length < 12) e.phone = 'Telefon raqamini to‘liq kiriting'
    if (form.message.trim().length < 10) e.message = 'Xabar kamida 10 ta belgidan iborat bo‘lsin'
    return e
  }

  const submit = (ev) => {
    ev.preventDefault()
    const e = validate()
    setErrors(e)
    if (Object.keys(e).length) return
    setStatus('sending')
    // TODO: backend API ulanganda shu yerda so'rov yuboriladi
    setTimeout(() => setStatus('sent'), 900)
  }

  return (
    <section className="section" id="aloqa">
      <div className="contact">
        <div className="contact__info">
          <SectionHead
            eyebrow="Aloqa"
            title="Savolingiz bormi? Biz bilan bog‘laning"
            text="Kurs tanlash, to‘lov yoki hamkorlik bo‘yicha yozing — mutaxassislarimiz ish vaqtida 30 daqiqa ichida javob beradi."
          />
          <ul className="contact__list">
            {INFO.map((i) => {
              const Tag = i.href ? 'a' : 'div'
              return (
                <li key={i.label}>
                  <Tag className="contact__item" {...(i.href ? { href: i.href } : {})}>
                    <span className="contact__icon"><Icon name={i.icon} size={20} /></span>
                    <span className="contact__text">
                      <small>{i.label}</small>
                      <b>{i.value}</b>
                    </span>
                    {i.href && <Icon name="arrowUpRight" size={16} className="contact__go" />}
                  </Tag>
                </li>
              )
            })}
          </ul>

          <a className="contact__tg" href={CONTACTS.telegram} target="_blank" rel="noreferrer">
            <span className="contact__tg-icon"><SocialIcon name="telegram" size={22} /></span>
            <span className="contact__text">
              <b>Telegram orqali tezroq</b>
              <small>O‘rtacha javob vaqti — 5 daqiqa</small>
            </span>
            <span className="contact__tg-status"><i /> Onlayn</span>
          </a>
        </div>

        <div className="form-card">
          {status === 'sent' ? (
            <div className="form-done">
              <span className="form-done__icon"><Icon name="check" size={32} stroke={2.4} /></span>
              <h3>Xabaringiz yuborildi!</h3>
              <p>Rahmat, {form.name.trim().split(' ')[0]}. Tez orada {form.phone} raqamiga qo‘ng‘iroq qilamiz.</p>
              <button className="btn btn--primary" onClick={() => { setForm(EMPTY); setStatus('idle') }}>
                Yana yozish
              </button>
            </div>
          ) : (
            <form onSubmit={submit} noValidate>
              <div className="form-card__head">
                <h3 className="form-card__title">Xabar qoldiring</h3>
                <p>Barcha maydonlarni to‘ldiring — sizga o‘zimiz bog‘lanamiz.</p>
              </div>
              <div className="form-row">
                <Field label="Ismingiz" icon="users" error={errors.name}>
                  <input value={form.name} onChange={set('name')} placeholder="Ism familiya" autoComplete="name" />
                </Field>
                <Field label="Telefon raqam" icon="phone" error={errors.phone}>
                  <input value={form.phone} onChange={(e) => update('phone', formatPhone(e.target.value))}
                    placeholder="+998 90 123 45 67" inputMode="tel" autoComplete="tel" />
                </Field>
              </div>
              <Field label="Mavzu" as="div">
                <Dropdown options={TOPICS} value={form.topic} onChange={(v) => update('topic', v)} />
              </Field>
              <Field label="Xabar" error={errors.message}
                extra={<span className="field__count">{form.message.length}/{MSG_MAX}</span>}>
                <textarea rows={5} value={form.message} maxLength={MSG_MAX} onChange={set('message')}
                  placeholder="Savolingizni batafsil yozing…" />
              </Field>
              <button type="submit" className="btn btn--primary form-card__submit" disabled={status === 'sending'}>
                {status === 'sending' ? <span className="spinner" /> : <Icon name="send" size={18} />}
                {status === 'sending' ? 'Yuborilmoqda…' : 'Yuborish'}
              </button>
              <p className="form-card__note">
                <Icon name="shield" size={14} /> Yuborish orqali shaxsiy ma’lumotlarni qayta ishlashga rozilik bildirasiz.
              </p>
            </form>
          )}
        </div>
      </div>
    </section>
  )
}

function Field({ label, icon, error, extra, as = 'label', children }) {
  const Tag = as
  return (
    <Tag className={`field ${error ? 'field--error' : ''} ${icon ? 'field--icon' : ''}`}>
      <span className="field__top">
        <span className="field__label">{label}</span>
        {extra}
      </span>
      <span className="field__control">
        {icon && <Icon name={icon} size={18} className="field__icon" />}
        {children}
      </span>
      {error && <span className="field__error"><Icon name="info" size={14} /> {error}</span>}
    </Tag>
  )
}

// Maxsus dropdown: klaviatura (↑ ↓ Enter Esc Home End), tashqariga bosish va ARIA listbox
function Dropdown({ options, value, onChange }) {
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const root = useRef(null)
  const btn = useRef(null)
  const id = useId()
  const current = options.find((o) => o.value === value) ?? options[0]

  useEffect(() => {
    if (!open) return
    const close = (e) => { if (!root.current?.contains(e.target)) setOpen(false) }
    document.addEventListener('pointerdown', close)
    return () => document.removeEventListener('pointerdown', close)
  }, [open])

  const openList = () => {
    setActive(Math.max(0, options.indexOf(current)))
    setOpen(true)
  }
  const pick = (i) => {
    onChange(options[i].value)
    setOpen(false)
    btn.current?.focus()
  }

  const onKey = (e) => {
    const last = options.length - 1
    if (!open) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) { e.preventDefault(); openList() }
      return
    }
    const moves = {
      ArrowDown: () => setActive((a) => (a === last ? 0 : a + 1)),
      ArrowUp: () => setActive((a) => (a === 0 ? last : a - 1)),
      Home: () => setActive(0),
      End: () => setActive(last),
      Enter: () => pick(active),
      ' ': () => pick(active),
      Escape: () => setOpen(false),
      Tab: () => setOpen(false),
    }
    if (moves[e.key]) {
      if (e.key !== 'Tab') e.preventDefault()
      moves[e.key]()
    }
  }

  return (
    <div className={`dd ${open ? 'is-open' : ''}`} ref={root}>
      <button type="button" ref={btn} className="dd__btn" onClick={() => (open ? setOpen(false) : openList())}
        onKeyDown={onKey} aria-haspopup="listbox" aria-expanded={open} aria-controls={`${id}-list`}
        aria-activedescendant={open ? `${id}-${active}` : undefined}>
        <span className="dd__ico"><Icon name={current.icon} size={18} /></span>
        <span className="dd__val">{current.value}</span>
        <Icon name="chevDown" size={18} className="dd__chev" />
      </button>

      <ul className="dd__list" id={`${id}-list`} role="listbox" aria-label="Mavzu">
        {options.map((o, i) => {
          const selected = o.value === current.value
          return (
            <li key={o.value} id={`${id}-${i}`} role="option" aria-selected={selected}
              className={`dd__opt ${i === active ? 'is-active' : ''} ${selected ? 'is-selected' : ''}`}
              onPointerEnter={() => setActive(i)} onPointerDown={(e) => e.preventDefault()} onClick={() => pick(i)}>
              <span className="dd__ico"><Icon name={o.icon} size={18} /></span>
              <span className="dd__txt">
                <b>{o.value}</b>
                <small>{o.hint}</small>
              </span>
              {selected && <Icon name="check" size={18} stroke={2.4} className="dd__check" />}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
