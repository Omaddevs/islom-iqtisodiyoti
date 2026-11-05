import { DIRECTIONS } from '../data/content.js'
import { Icon, SectionHead } from './ui.jsx'
import DirIcon from './DirIcons.jsx'

export default function Directions() {
  return (
    <section className="section" id="yonalishlar">
      <SectionHead
        eyebrow="Yo‘nalishlar"
        title="O‘zingizga mos yo‘nalishni tanlang"
        text="Islom iqtisodiyotining asosiy sohalari: nazariy asoslardan amaliy bilimlargacha."
      />

      <div className="dir-grid">
        {DIRECTIONS.map((d, i) => (
          <a key={d.id} href="#kurslar" className={`dir-card ${i === 0 ? 'dir-card--featured' : ''}`}
            style={{ '--dc': d.color }}>
            <span className="dir-card__icon"><DirIcon name={d.icon} size={46} /></span>
            <h3 className="dir-card__title">{d.title}</h3>
            <p className="dir-card__desc">{d.desc}</p>
            <div className="dir-card__foot">
              <span className="dir-card__arrow"><Icon name="arrowUpRight" size={18} /></span>
            </div>
          </a>
        ))}
      </div>
    </section>
  )
}
