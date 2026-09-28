import { useMemo, useState } from 'react'
import { COURSES, LEVELS, dirById, formatNum, formatPrice } from '../data/content.js'
import { Avatar, Icon, SectionHead, Stars } from './ui.jsx'
import DirIcon from './DirIcons.jsx'

// Daraja ko‘rsatkichi: 1–3 ta to‘lgan ustuncha
const LEVEL_STEP = { 'Boshlang‘ich': 1, 'O‘rta': 2, 'Yuqori': 3 }

export function CourseCard({ c }) {
  const d = dirById(c.dir)
  const free = c.price === 0
  return (
    <article className="course" style={{ '--cc': d.color }}>
      {/* Fikrlar kartasidagi kabi gradient sarlavha + logo belgisi */}
      <div className="course__head">
        <img src="/logo/logo-mark.png" alt="" className="cover__mark" aria-hidden="true" />
        <div className="course__tags">
          <span className="course__level">
            <span className="course__signal" aria-hidden="true">
              {[1, 2, 3].map((i) => <i key={i} className={i <= LEVEL_STEP[c.level] ? 'on' : ''} />)}
            </span>
            {c.level}
          </span>
          {free && <span className="course__free">Bepul</span>}
        </div>
        <div className="course__dir">
          <span className="course__icon"><DirIcon name={d.icon} size={36} /></span>
          <span className="course__dirname">
            <small>Yo‘nalish</small>
            {d.title}
          </span>
        </div>
      </div>

      <div className="course__body">
        <div className="course__rating">
          <Stars value={c.rating} size={15} />
          <b>{c.rating.toFixed(1)}</b>
          <span className="course__students"><Icon name="users" size={15} /> {formatNum(c.students)}</span>
        </div>
        <h3 className="course__title">{c.title}</h3>
        <div className="course__meta">
          <span><Icon name="play" size={15} /> {c.lessons} dars</span>
          <span><Icon name="clock" size={15} /> {c.hours} soat</span>
        </div>
        <div className="course__teacher">
          <Avatar name={c.teacher} size={40} />
          <span>
            <b>{c.teacher} <Icon name="check" size={12} className="review__verified" /></b>
            <small>Ustoz</small>
          </span>
        </div>
        <div className="course__foot">
          <span className="course__price">
            <small>Narxi</small>
            <b className={free ? 'is-free' : ''}>{formatPrice(c.price)}</b>
          </span>
          <a href="#royxat" className="course__btn">
            Batafsil <Icon name="arrowRight" size={16} />
          </a>
        </div>
      </div>
    </article>
  )
}

const TABS = ['Barchasi', ...LEVELS]

export default function Courses() {
  const [tab, setTab] = useState('Barchasi')
  const [showAll, setShowAll] = useState(false)

  const list = useMemo(
    () => COURSES
      .filter((c) => tab === 'Barchasi' || c.level === tab)
      .sort((a, b) => b.students - a.students),
    [tab],
  )

  const count = (t) => (t === 'Barchasi' ? COURSES.length : COURSES.filter((c) => c.level === t).length)

  return (
    <section className="section" id="kurslar">
      <SectionHead
        eyebrow="Kurslar"
        title="Eng mashhur kurslarimiz"
        action={
          <div className="tabs" role="tablist" aria-label="Daraja bo‘yicha saralash">
            {TABS.map((t) => (
              <button key={t} role="tab" aria-selected={tab === t}
                className={`tab ${tab === t ? 'tab--active' : ''}`} onClick={() => setTab(t)}>
                {t}
                <span className="tab__count">{count(t)}</span>
              </button>
            ))}
          </div>
        }
      />

      <div className="course-grid">
        {(showAll ? list : list.slice(0, 6)).map((c) => <CourseCard key={c.id} c={c} />)}
      </div>

      {list.length > 6 && (
        <div className="more">
          <button type="button" className="link-arrow" onClick={() => setShowAll((v) => !v)}>
            {showAll ? 'Kamroq ko‘rsatish' : `Barcha kurslar (${list.length})`}
            <Icon name="chevDown" size={18} className={showAll ? 'rot180' : ''} />
          </button>
        </div>
      )}
    </section>
  )
}
