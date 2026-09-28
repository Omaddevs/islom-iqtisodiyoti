import { useEffect, useRef, useState } from 'react'
import { TESTIMONIALS } from '../data/content.js'
import { Avatar, Icon, SectionHead, Stars } from './ui.jsx'
import DirIcon from './DirIcons.jsx'

const DISTRIBUTION = [
  { stars: 5, pct: 86 },
  { stars: 4, pct: 10 },
  { stars: 3, pct: 3 },
  { stars: 2, pct: 1 },
  { stars: 1, pct: 0 },
]

export default function Testimonials() {
  const track = useRef(null)
  const [edge, setEdge] = useState({ start: true, end: false })

  const update = () => {
    const el = track.current
    if (!el) return
    setEdge({ start: el.scrollLeft < 8, end: el.scrollLeft + el.clientWidth > el.scrollWidth - 8 })
  }

  useEffect(() => {
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  const scroll = (dir) => {
    const el = track.current
    const card = el.querySelector('.review')
    el.scrollBy({ left: dir * (card.offsetWidth + 20), behavior: 'smooth' })
  }

  return (
    <section className="section" id="fikrlar">
      <SectionHead
        eyebrow="Fikrlar"
        title="O‘quvchilarimiz biz haqimizda"
        action={
          <div className="arrows">
            <button className="arrow-btn" aria-label="Oldingi" disabled={edge.start} onClick={() => scroll(-1)}>
              <Icon name="chevLeft" size={20} />
            </button>
            <button className="arrow-btn" aria-label="Keyingi" disabled={edge.end} onClick={() => scroll(1)}>
              <Icon name="chevRight" size={20} />
            </button>
          </div>
        }
      />

      <div className="reviews">
        <aside className="score">
          <img src="/logo/logo-mark.png" alt="" className="score__mark" aria-hidden="true" />
          <div className="score__head">
            <span className="score__trophy"><DirIcon name="trophy" size={56} /></span>
            <span className="score__badge"><Icon name="check" size={12} /> Tasdiqlangan baholar</span>
          </div>
          <div className="score__big">4.9<small>/5</small></div>
          <Stars value={5} size={20} />
          <p className="score__count">2 400+ ta baholash asosida</p>
          <ul className="score__bars">
            {DISTRIBUTION.map((r) => (
              <li key={r.stars}>
                <span>{r.stars}★</span>
                <span className="score__bar"><i style={{ width: `${r.pct}%` }} /></span>
                <span className="score__pct">{r.pct}%</span>
              </li>
            ))}
          </ul>
        </aside>

        <div className="reviews__track" ref={track} onScroll={update}>
          {TESTIMONIALS.map((t) => (
            <figure key={t.name} className="review" style={{ '--cc': t.color }}>
              <div className="review__head">
                <img src="/logo/logo-mark.png" alt="" className="cover__mark" aria-hidden="true" />
                <span className="review__icon"><DirIcon name={t.icon} size={34} /></span>
                <span className="review__course">
                  <small>Kurs</small>
                  {t.course}
                </span>
              </div>
              <div className="review__body">
                <div className="review__rating">
                  <Stars value={t.rating} size={16} />
                  <b>{t.rating.toFixed(1)}</b>
                  <span className="review__quote"><DirIcon name="quote" size={38} /></span>
                </div>
                <blockquote>{t.text}</blockquote>
                <figcaption>
                  <Avatar name={t.name} size={44} />
                  <span>
                    <b>{t.name} <Icon name="check" size={12} className="review__verified" /></b>
                    <small>{t.role}</small>
                  </span>
                </figcaption>
              </div>
            </figure>
          ))}
        </div>
      </div>
    </section>
  )
}
