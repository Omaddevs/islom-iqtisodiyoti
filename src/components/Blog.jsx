import { POSTS } from '../data/posts.js'
import { Cover, Icon, SectionHead } from './ui.jsx'

function Meta({ p }) {
  return (
    <div className="post__meta">
      <span><Icon name="calendar" size={14} /> {p.date}</span>
      <span><Icon name="clock" size={14} /> {p.read} daqiqa</span>
    </div>
  )
}

export default function Blog() {
  const [featured, ...rest] = POSTS.slice(0, 4)
  return (
    <section className="section" id="blog">
      <SectionHead
        eyebrow="Blog"
        title="Foydali maqolalar"
        action={
          <a href="#/blog" className="link-arrow">
            Barcha maqolalar <Icon name="arrowRight" size={18} />
          </a>
        }
      />

      <div className="blog">
        <a href={`#/blog/${featured.slug}`} className="post post--featured">
          <div className="post__media">
            <Cover color={featured.color} icon={featured.icon} className="cover--lg" />
            <span className="post__cat">{featured.cat}</span>
          </div>
          <div className="post__body">
            <Meta p={featured} />
            <h3 className="post__title">{featured.title}</h3>
            <p className="post__excerpt">{featured.excerpt}</p>
            <span className="post__more">O‘qish <Icon name="arrowRight" size={16} /></span>
          </div>
        </a>

        <div className="blog__list">
          {rest.map((p) => (
            <a key={p.id} href={`#/blog/${p.slug}`} className="post post--row">
              <div className="post__media">
                <Cover color={p.color} icon={p.icon} className="cover--sm" />
              </div>
              <div className="post__body">
                <span className="post__cat post__cat--inline" style={{ '--dc': p.color }}>{p.cat}</span>
                <h3 className="post__title">{p.title}</h3>
                <Meta p={p} />
              </div>
            </a>
          ))}
        </div>
      </div>
    </section>
  )
}
