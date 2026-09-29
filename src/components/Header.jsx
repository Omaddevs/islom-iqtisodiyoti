import { useEffect, useState } from 'react'
import Logo from './Logo.jsx'
import { useAuth } from '../platform/store/auth.jsx'

// section — bosh sahifadagi mos bo'lim (faol bandni aniqlash uchun)
const NAV_LINKS = [
  { label: "Yo'nalishlar", href: '#yonalishlar', section: '#yonalishlar' },
  { label: 'Kurslar', href: '#kurslar', section: '#kurslar' },
  { label: 'Fikrlar', href: '#fikrlar', section: '#fikrlar' },
  { label: 'Blog', href: '#/blog', section: '#blog', page: '/blog' },
  { label: 'Aloqa', href: '#aloqa', section: '#aloqa' },
]

export default function Header({ route = '/' }) {
  const [open, setOpen] = useState(false)
  const { user } = useAuth()
  const loginHref = user ? '#/platform' : '#/kirish'
  const loginLabel = user ? 'Platforma' : 'Kirish'

  const [active, setActive] = useState('')

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
  }, [open])

  // Ekrandagi bo'limga mos menyu bandini belgilash
  useEffect(() => {
    setActive('')
    if (route !== '/') return
    const sections = NAV_LINKS.map((l) => document.querySelector(l.section)).filter(Boolean)
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && setActive(`#${e.target.id}`)),
      { rootMargin: '-45% 0px -50% 0px' },
    )
    sections.forEach((s) => io.observe(s))
    return () => io.disconnect()
  }, [route])

  const isActive = (l) => (l.page ? route.startsWith(l.page) : false) || (route === '/' && active === l.section)

  return (
    <header className="header">
      <div className="header__inner">
        <Logo />

        <nav className={`nav ${open ? 'nav--open' : ''}`} aria-label="Asosiy menyu">
          <ul className="nav__list">
            {NAV_LINKS.map((link) => (
              <li key={link.href}>
                <a className={`nav__link ${isActive(link) ? 'nav__link--active' : ''}`}
                  href={link.href} onClick={() => setOpen(false)}>
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
          <a href={loginHref} className="btn btn--primary nav__login-mobile">{loginLabel}</a>
        </nav>

        <a href={loginHref} className="btn btn--primary header__login">{loginLabel}</a>

        <button
          className={`burger ${open ? 'burger--open' : ''}`}
          aria-label="Menyuni ochish"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          <span /><span /><span />
        </button>
      </div>
    </header>
  )
}
