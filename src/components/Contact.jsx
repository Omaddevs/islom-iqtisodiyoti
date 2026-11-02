import { useEffect, useId, useRef, useState } from 'react'
import { CONTACTS } from '../data/content.js'
import { Icon, SocialIcon } from './ui.jsx'
import { formatPhone, isFullPhone } from '../utils/phone.js'
import { leadsApi } from '../platform/api/client.js'

const TOPICS = [
  { value: 'Kurslar haqida savol', hint: 'Dastur, daraja va sertifikat', icon: 'book' },
  { value: 'To‘lov va chegirmalar', hint: 'Narxlar, bo‘lib to‘lash, promo-kod', icon: 'tag' },
  { value: 'Korporativ o‘qitish', hint: 'Bank va kompaniyalar uchun', icon: 'briefcase' },
  { value: 'Hamkorlik', hint: 'Muallif yoki hamkor bo‘lish', icon: 'users' },
  { value: 'Boshqa', hint: 'Boshqa mavzudagi savollar', icon: 'info' },
]

const MSG_MAX = 500
const EMPTY = { first: '', last: '', phone: '+998 ', topic: TOPICS[0].value, message: '' }
const TEL = `tel:${CONTACTS.phone.replace(/\s/g, '')}`

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
    if (form.first.trim().length < 2) e.first = 'Ismingizni kiriting'
    if (!isFullPhone(form.phone)) e.phone = 'Telefon raqamini to‘liq kiriting'
    if (form.message.trim().length < 10) e.message = 'Kamida 10 ta belgi yozing'
    return e
  }

  const submit = (ev) => {
    ev.preventDefault()
    const e = validate()
    setErrors(e)
    if (Object.keys(e).length) return
    setStatus('sending')
    leadsApi.send({ kind: 'contact', name: `${form.first} ${form.last}`.trim(), phone: form.phone, topic: form.topic, message: form.message })
      .then(() => setStatus('sent'))
      .catch((er) => { setErrors({ message: er.message }); setStatus('idle') })
  }

  return (
    <section className="ct-wrap" id="aloqa">
      <div className="ct">
        <div className="ct__bg" aria-hidden="true"><div className="ct__beam" /></div>

        <div className="ct__info">
          <div>
            <p className="ct-hand ct__eyebrow">Biz bilan bog‘laning</p>
            <h2 className="ct__title">Savolingizga javob <br />bir xabar narida.</h2>
            <p className="ct__text">
              Kurs tanlash, to‘lov yoki hamkorlik bo‘yicha yozing — mutaxassislarimiz ish vaqtida
              30 daqiqa ichida javob beradi.
            </p>
          </div>

          <div className="ct__call">
            <p className="ct-hand ct__call-hand">Qo‘ng‘iroq afzalmi?</p>
            <p className="ct__call-row">
              15 daqiqalik bepul maslahat:
              <a href={TEL}>{CONTACTS.phone} <Icon name="arrowUpRight" size={14} /></a>
            </p>
            <p className="ct__call-row">
              Yoki tezroq:
              <a href={CONTACTS.telegram} target="_blank" rel="noreferrer">
                <SocialIcon name="telegram" size={13} /> Telegram’da yozing <Icon name="arrowUpRight" size={14} />
              </a>
            </p>
          </div>
        </div>

        <div className="ct-form">
          {status === 'sent' ? (
            <div className="ct-done">
              <span className="ct-done__icon"><Icon name="check" size={28} stroke={2.4} /></span>
              <h3>Xabaringiz yuborildi!</h3>
              <p>Rahmat, {form.first.trim()}. Tez orada {form.phone} raqamiga bog‘lanamiz.</p>
              <button type="button" className="ct-btn" onClick={() => { setForm(EMPTY); setStatus('idle') }}>
                Yana yozish
              </button>
            </div>
          ) : (
            <form onSubmit={submit} noValidate>
              <div className="ct-row">
                <CtField label="Ism" error={errors.first}>
                  <input value={form.first} onChange={set('first')} placeholder="Ismingizni kiriting" autoComplete="given-name" />
                </CtField>
                <CtField label="Familiya">
                  <input value={form.last} onChange={set('last')} placeholder="Familiyangizni kiriting" autoComplete="family-name" />
                </CtField>
              </div>
              <CtField label="Telefon raqam" error={errors.phone}>
                <input value={form.phone} onChange={(e) => update('phone', formatPhone(e.target.value))}
                  placeholder="+998 90 123 45 67" inputMode="tel" autoComplete="tel" />
              </CtField>
              <CtField label="Mavzu" as="div">
                <Dropdown options={TOPICS} value={form.topic} onChange={(v) => update('topic', v)} />
              </CtField>
              <CtField label="Xabar" error={errors.message}
                extra={<span className="ct-field__count">{form.message.length}/{MSG_MAX}</span>}>
                <textarea rows={4} value={form.message} maxLength={MSG_MAX} onChange={set('message')}
                  placeholder="Savolingizni yozing…" />
              </CtField>
              <button type="submit" className="ct-btn" disabled={status === 'sending'}>
                {status === 'sending' ? <><span className="spinner" /> Yuborilmoqda…</> : 'Xabar yuborish'}
              </button>
            </form>
          )}
        </div>
      </div>
    </section>
  )
}

function CtField({ label, error, extra, as = 'label', children }) {
  const Tag = as
  return (
    <Tag className={`ct-field ${error ? 'is-error' : ''}`}>
      <span className="ct-field__top">
        <span className="ct-field__label">{label}</span>
        {error ? <span className="ct-field__err">{error}</span> : extra}
      </span>
      {children}
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
