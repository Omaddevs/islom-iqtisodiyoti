import { leadClick } from './LeadModal.jsx'

// Footerdan oldingi och CTA — suzib yuruvchi 3D kristallar bilan
function Crystal({ className }) {
  const id = className.replace(/\s+/g, '-')
  return (
    <svg className={`gem ${className}`} viewBox="0 0 120 140" aria-hidden="true">
      <defs>
        <linearGradient id={`${id}-a`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#d6f0ff" />
          <stop offset=".55" stopColor="#6cc2ff" />
          <stop offset="1" stopColor="#2f8df5" />
        </linearGradient>
        <linearGradient id={`${id}-b`} x1="1" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#58b4ff" />
          <stop offset="1" stopColor="#1463dc" />
        </linearGradient>
        <linearGradient id={`${id}-c`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#3f9dfa" />
          <stop offset="1" stopColor="#0d4fc0" />
        </linearGradient>
        <linearGradient id={`${id}-d`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#8fd3ff" />
          <stop offset="1" stopColor="#2a7fef" />
        </linearGradient>
      </defs>
      {/* yuqori qirralar */}
      <path d="M58 4 L6 66 L52 74 Z" fill={`url(#${id}-a)`} />
      <path d="M58 4 L52 74 L114 60 Z" fill={`url(#${id}-b)`} />
      {/* pastki qirralar */}
      <path d="M6 66 L52 74 L64 136 Z" fill={`url(#${id}-d)`} />
      <path d="M52 74 L114 60 L64 136 Z" fill={`url(#${id}-c)`} />
      {/* yorug' qirra chiziqlari */}
      <path d="M58 4 L52 74 L64 136 M6 66 L52 74 L114 60" fill="none" stroke="#fff" strokeOpacity=".55" strokeWidth="1.2" strokeLinejoin="round" />
      <path d="M58 4 L6 66 L64 136 L114 60 Z" fill="none" stroke="#e8f6ff" strokeOpacity=".7" strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M50 20 L22 56" stroke="#fff" strokeOpacity=".8" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}

export default function StartSection() {
  return (
    <section className="start" id="boshlash">
      <Crystal className="gem--l" />
      <Crystal className="gem--r" />

      <div className="start__inner">
        <p className="start__hand">Boshlashga tayyormisiz?</p>
        <h2 className="start__title">Halol moliya bilimini <br />bugundan boshlang</h2>
        <p className="start__sub">Nazariyaga kamroq, amaliy ko‘nikmaga ko‘proq vaqt ajrating.</p>
        <a href="#/kirish" className="start__btn" onClick={leadClick({ kind: 'start' })}>Bepul boshlash</a>
      </div>
    </section>
  )
}
