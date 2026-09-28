const IMG_1 = '/images/ustoz-1.jpg'
const IMG_2 =
  'https://images.unsplash.com/photo-1544531586-fde5298cdd40?auto=format&fit=crop&w=420&h=500&q=80'

export default function Hero() {
  return (
    <section className="hero">
      <div className="hero__glow" aria-hidden="true" />

      <div className="hero__content">
        <p className="hero__eyebrow">Islom iqtisodiyoti onlayn ta'lim platformasi</p>
        <h1 className="hero__title">
          Islom moliyasiga oid <br className="hide-sm" />
          bilimlarni o‘rgatamiz
        </h1>
        <a href="#kurslar" className="btn btn--primary hero__cta">O‘qishni boshlash</a>
      </div>

      <div className="hero__media" aria-hidden="true">
        <div className="hero__shape" />
        <div className="hero__photo hero__photo--1">
          <img src={IMG_1} alt="" loading="eager" />
        </div>
        <div className="hero__photo hero__photo--2">
          <img src={IMG_2} alt="" loading="eager" />
        </div>
        <div className="hero__cutout" />
        <div className="hero__badge">
          {/* Moliyaviy o'sish belgisi */}
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"
            strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 17l6-6 4 4 8-8" />
            <path d="M15 7h6v6" />
          </svg>
        </div>
      </div>
    </section>
  )
}
