import { useState } from 'react'
import { CONTACTS, DIRECTIONS } from '../data/content.js'
import { Icon, SocialIcon } from './ui.jsx'

const COLUMNS = [
  {
    title: 'Platforma',
    links: [
      { label: 'Kurslar', href: '#kurslar' },
      { label: 'Fikrlar', href: '#fikrlar' },
      { label: 'Blog', href: '#/blog' },
    ],
  },
  {
    title: 'Yo‘nalishlar',
    links: DIRECTIONS.slice(0, 4).map((d) => ({ label: d.title, href: '#yonalishlar' })),
  },
  {
    title: 'Kompaniya',
    links: [
      { label: 'Biz haqimizda', href: '#biz-haqimizda' },
      { label: 'Ustoz bo‘lish', href: '#aloqa' },
      { label: 'Hamkorlik', href: '#aloqa' },
      { label: 'Aloqa', href: '#aloqa' },
    ],
  },
]

export default function Footer() {
  const [email, setEmail] = useState('')
  const [done, setDone] = useState(false)

  const subscribe = (e) => {
    e.preventDefault()
    if (!/^\S+@\S+\.\S+$/.test(email)) return
    setDone(true) // TODO: obuna API
  }

  return (
    <footer className="footer">
      <div className="footer__inner">
        <div className="footer__top">
          <div className="footer__brand">
            <img src="/logo/logo-white.png" alt="Islom Iqtisodiyoti" className="footer__logo" />
            <p>Islom moliyasi va iqtisodiyotini o‘zbek tilida noldan professional darajagacha o‘rgatuvchi onlayn ta’lim platformasi.</p>
            <div className="socials socials--dark">
              {['telegram', 'instagram', 'youtube', 'facebook'].map((s) => (
                <a key={s} href={CONTACTS[s]} target="_blank" rel="noreferrer" className={`social social--${s}`} aria-label={s}>
                  <SocialIcon name={s} size={17} />
                </a>
              ))}
            </div>
          </div>

          {COLUMNS.map((col) => (
            <nav key={col.title} className="footer__col" aria-label={col.title}>
              <h4>{col.title}</h4>
              <ul>
                {col.links.map((l) => <li key={l.label}><a href={l.href}>{l.label}</a></li>)}
              </ul>
            </nav>
          ))}

          <div className="footer__col footer__news">
            <h4>Yangiliklarga obuna</h4>
            <p>Yangi kurslar va foydali maqolalar haqida birinchilardan bo‘lib xabar oling.</p>
            {done ? (
              <p className="footer__ok"><Icon name="check" size={16} stroke={2.4} /> Obuna bo‘ldingiz!</p>
            ) : (
              <form onSubmit={subscribe} className="footer__form">
                <input type="email" placeholder="Email manzilingiz" value={email}
                  onChange={(e) => setEmail(e.target.value)} aria-label="Email" />
                <button type="submit" aria-label="Obuna bo‘lish"><Icon name="arrowRight" size={18} /></button>
              </form>
            )}
          </div>
        </div>

        <div className="footer__bottom">
          <span>© 2026 Islom Iqtisodiyoti. Barcha huquqlar himoyalangan.</span>
          <span className="footer__legal">
            <a href="#maxfiylik">Maxfiylik siyosati</a>
            <a href="#shartlar">Foydalanish shartlari</a>
          </span>
        </div>
      </div>
    </footer>
  )
}
