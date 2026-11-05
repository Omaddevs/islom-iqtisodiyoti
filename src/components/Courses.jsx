import { COURSES } from '../data/content.js'
import { Icon, SectionHead } from './ui.jsx'
import DirIcon from './DirIcons.jsx'
import { leadClick } from './LeadModal.jsx'

const byId = (id) => COURSES.find((c) => c.id === id)

function CourseCard({ c }) {
  return (
    <article className="course" style={{ '--cc': c.color }}>
      <div className="course__head">
        <img src="/logo/logo-mark.png" alt="" className="cover__mark" aria-hidden="true" />
        <div className="course__tags">
          <span className="course__stage">{c.stage}</span>
          <span className="course__kind">
            <Icon name={c.kind === 'Sertifikat' ? 'award' : 'bookOpen'} size={14} /> {c.kind}
          </span>
        </div>
        <div className="course__dir">
          <span className="course__icon"><DirIcon name={c.icon} size={36} /></span>
          <span className="course__dirname">
            <small>Asosiy soha</small>
            {c.field}
          </span>
        </div>
      </div>

      <div className="course__body">
        <h3 className="course__title">{c.title}</h3>
        <p className="course__goal">{c.goal}</p>
        <div className="course__meta">
          <span><Icon name="checkCircle" size={15} /> Asos talabi: {c.prereq}</span>
          {c.volume && <span><Icon name="clock" size={15} /> {c.volume}</span>}
        </div>
        <div className="course__foot">
          <span className="course__price">
            <small>Narx va muddat</small>
            <b>Tez orada e’lon qilinadi</b>
          </span>
          <a href="#royxat" className="course__btn" onClick={leadClick({ kind: 'course', course: c })}>
            Batafsil <Icon name="arrowRight" size={16} />
          </a>
        </div>
      </div>
    </article>
  )
}

function PathNode({ id, label }) {
  const c = byId(id)
  return (
    <button type="button" className="cpath__node" style={{ '--cc': c.color }} onClick={leadClick({ kind: 'course', course: c })}>
      <small>{c.stage}</small>
      <b>{label}</b>
    </button>
  )
}

function CertificationPath() {
  return (
    <div className="cpath">
      <h3 className="cpath__title">Sertifikatlash yo‘li</h3>

      <div className="cpath__tracks">
        <div className="cpath__track">
          <p className="cpath__label">Buxgalteriya-audit yo‘nalishi</p>
          <div className="cpath__flow">
            <PathNode id="buxgalter" label="Buxgalter" />
            <Icon name="arrowRight" size={20} className="cpath__arrow" />
            <div className="cpath__branch">
              <PathNode id="auditor" label="Auditor" />
              <PathNode id="ichki-auditor" label="Ichki auditor" />
            </div>
          </div>
        </div>

        <div className="cpath__track">
          <p className="cpath__label">Bank amaliyoti yo‘nalishi</p>
          <div className="cpath__flow">
            <PathNode id="mutaxassis" label="Islom moliyasi va banki bo‘yicha mutaxassis" />
          </div>
          <p className="cpath__hint">To‘g‘ridan-to‘g‘ri, dastlabki shartsiz.</p>
        </div>
      </div>

      <div className="cpath__notes">
        <p>
          <Icon name="award" size={18} />
          <span>
            <b>Barcha sertifikatlar uchun umumiy talab:</b> Palata tomonidan tasdiqlangan o‘quv dasturini
            o‘zlashtirish, sertifikatlash imtihonini muvaffaqiyatli topshirish hamda AAOIFI Etika kodeksi
            talablariga rioya etish.
          </span>
        </p>
        <p>
          <Icon name="info" size={18} />
          <span>
            <b>Joriy holat:</b> Nizom loyihasi tasdiqlash bosqichida. Kurslar hajmi, o‘qish muddati, imtihon
            tartibi va to‘lov miqdori Nizom tasdiqlangandan so‘ng belgilanadi.
          </span>
        </p>
      </div>
    </div>
  )
}

export default function Courses() {
  return (
    <section className="section" id="kurslar">
      <SectionHead
        eyebrow="Kurslar"
        title="Kurs va malaka sertifikatlari"
        text="Fundamental kurs hamda O‘zbekiston Respublikasi Auditorlar palatasining AAOIFI standartlariga asoslangan to‘rtta malaka sertifikati."
      />

      <div className="course-grid">
        {COURSES.map((c) => <CourseCard key={c.id} c={c} />)}
      </div>

      <CertificationPath />
    </section>
  )
}
