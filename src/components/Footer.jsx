import { useState } from 'react'
import { CONTACTS } from '../data/content.js'
import { POSTS } from '../data/posts.js'
import { Icon, SocialIcon } from './ui.jsx'
import { leadsApi } from '../platform/api/client.js'

const COLUMNS = [
  {
    title: 'Navigatsiya',
    links: [
      { label: 'Yo‘nalishlar', href: '#yonalishlar' },
      { label: 'Kurslar', href: '#kurslar' },
      { label: 'Fikrlar', href: '#fikrlar' },
      { label: 'Blog', href: '#/blog' },
      { label: 'Aloqa', href: '#aloqa' },
    ],
  },
  {
    title: 'Kompaniya',
    links: [
      { label: 'Biz haqimizda', href: '#biz-haqimizda' },
      { label: 'Ustoz bo‘lish', href: '#aloqa' },
      { label: 'Foydalanish shartlari', href: '#shartlar' },
      { label: 'Maxfiylik siyosati', href: '#maxfiylik' },
    ],
  },
]

const SOCIALS = ['telegram', 'instagram', 'youtube', 'facebook']

export default function Footer() {
  const [email, setEmail] = useState('')
  const [done, setDone] = useState(false)
  const [spin, setSpin] = useState(false)

  const subscribe = (e) => {
    e.preventDefault()
    if (!/^\S+@\S+\.\S+$/.test(email)) return
    leadsApi.send({ kind: 'subscribe', email: email.trim() }).then(() => setDone(true)).catch((er) => window.alert(er.message))
  }

  // "Omadingizni sinang" — tasodifiy maqolaga olib boradi
  const lucky = () => {
    setSpin(true)
    const post = POSTS[Math.floor(Math.random() * POSTS.length)]
    setTimeout(() => { window.location.hash = `#/blog/${post.slug}` }, 550)
    setTimeout(() => setSpin(false), 700)
  }

  return (
    <footer className="ft">
      <div className="ft__inner">
        <div className="ft__cards">
          {/* Chap — brend kartasi */}
          <div className="ft-brand">
            <img src="/logo/logo-white.png" alt="Islom Iqtisodiyoti" className="ft-brand__logo" />
            <div className="ft-brand__bottom">
              <p className="ft-brand__tag">
                Islom moliyasini o‘rganing,<br />
                <span>halol daromad sari.</span>
              </p>
              <div className="ft-brand__row">
                <span className="ft-hand ft-brand__hand">Biz bilan qoling!</span>
                <div className="ft-soc">
                  {SOCIALS.map((s) => (
                    <a key={s} href={CONTACTS[s]} target="_blank" rel="noreferrer" className="ft-soc__btn" aria-label={s}>
                      <SocialIcon name={s} size={16} />
                    </a>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* O'ng — navigatsiya kartasi */}
          <div className="ft-main">
            <div className="ft-main__cols">
              {COLUMNS.map((col) => (
                <nav key={col.title} className="ft-col" aria-label={col.title}>
                  <h4 className="ft-hand">{col.title}</h4>
                  <ul>
                    {col.links.map((l) => <li key={l.label}><a href={l.href}>{l.label}</a></li>)}
                  </ul>
                </nav>
              ))}
            </div>

            <button type="button" className={`ft-lucky ${spin ? 'is-spin' : ''}`} onClick={lucky} aria-label="Tasodifiy maqolani ochish">
              <span className="ft-lucky__tile"><img src="/logo/logo-mark.png" alt="" /></span>
              <svg className="ft-lucky__arrow" viewBox="0 0 40 24" aria-hidden="true">
                <path d="M37 4 C 30 18, 16 21, 5 15" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                <path d="M9 11.5 L4.5 15 L10 17" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span className="ft-hand ft-lucky__txt">Omadingizni sinang?</span>
            </button>

            <div className="ft-main__bottom">
              <span className="ft-copy">© 2026 Islom Iqtisodiyoti. Barcha huquqlar himoyalangan.</span>

              <div className="ft-news">
                <p className="ft-news__title">
                  <span>Moliya dunyosi tez o‘zgaradi.</span>
                  Islom Iqtisodiyoti bilan oldinda bo‘ling.
                </p>
                {done ? (
                  <p className="ft-news__ok"><Icon name="check" size={16} stroke={2.4} /> Obuna bo‘ldingiz, rahmat!</p>
                ) : (
                  <form onSubmit={subscribe} className="ft-news__form">
                    <input type="email" placeholder="Email manzilingiz" value={email}
                      onChange={(e) => setEmail(e.target.value)} aria-label="Email" />
                    <button type="submit">Obuna bo‘lish</button>
                  </form>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Katta fon yozuvi */}
        <div className="ft__mark" aria-hidden="true">
          <svg viewBox="0 0 1000 150" preserveAspectRatio="xMidYMin slice">
            <text x="0" y="176" textLength="1000" lengthAdjust="spacingAndGlyphs">Iqtisodiyot</text>
          </svg>
        </div>
      </div>
    </footer>
  )
}
