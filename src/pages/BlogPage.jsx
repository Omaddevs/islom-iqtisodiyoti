import { useEffect, useMemo, useState } from 'react'
import { BLOG_CATEGORIES, POSTS } from '../data/posts.js'
import { CONTACTS, formatNum } from '../data/content.js'
import { Avatar, Cover, Icon, SocialIcon } from '../components/ui.jsx'

const PAGE = 9
const ALL = 'all'

export function PostCard({ p }) {
  return (
    <a href={`#/blog/${p.slug}`} className="pcard">
      <div className="pcard__media">
        <Cover color={p.color} icon={p.icon} />
        <span className="pcard__cat">{p.cat}</span>
      </div>
      <div className="pcard__body">
        <h3 className="pcard__title">{p.title}</h3>
        <p className="pcard__excerpt">{p.excerpt}</p>
        <div className="pcard__foot">
          <span className="pcard__author"><Avatar name={p.author} size={26} /> {p.author}</span>
          <span className="pcard__date">{p.date}</span>
        </div>
      </div>
    </a>
  )
}

function HeroMain({ p }) {
  return (
    <a href={`#/blog/${p.slug}`} className="bhero__main">
      <Cover color={p.color} icon={p.icon} className="bhero__cover" />
      <div className="bhero__shade" />
      <div className="bhero__content">
        <span className="chip chip--glass">{p.cat}</span>
        <h2 className="bhero__title">{p.title}</h2>
        <p className="bhero__excerpt">{p.excerpt}</p>
        <div className="bhero__meta">
          <span className="bhero__author"><Avatar name={p.author} size={30} /> {p.author}</span>
          <span><Icon name="calendar" size={15} /> {p.date}</span>
          <span><Icon name="clock" size={15} /> {p.read} daqiqa</span>
        </div>
      </div>
    </a>
  )
}

function HeroSide({ p }) {
  return (
    <a href={`#/blog/${p.slug}`} className="bhero__side">
      <div className="bhero__side-media">
        <Cover color={p.color} icon={p.icon} />
      </div>
      <div className="bhero__side-body">
        <span className="chip" style={{ '--dc': p.color }}>{p.cat}</span>
        <h3>{p.title}</h3>
        <span className="bhero__side-meta"><Icon name="clock" size={14} /> {p.read} daqiqa · {p.date}</span>
      </div>
    </a>
  )
}

export function Widget({ title, icon, children }) {
  return (
    <section className="widget">
      <h4 className="widget__title">{icon && <Icon name={icon} size={18} />} {title}</h4>
      {children}
    </section>
  )
}

export function PopularWidget({ exclude }) {
  const top = [...POSTS].filter((p) => p.slug !== exclude).sort((a, b) => b.views - a.views).slice(0, 5)
  return (
    <Widget title="Ko‘p o‘qilganlar" icon="trending">
      <ol className="wpop">
        {top.map((p, i) => (
          <li key={p.id}>
            <a href={`#/blog/${p.slug}`}>
              <span className="wpop__n">{String(i + 1).padStart(2, '0')}</span>
              <span className="wpop__body">
                <b>{p.title}</b>
                <small><Icon name="eye" size={13} /> {formatNum(p.views)} marta o‘qilgan</small>
              </span>
            </a>
          </li>
        ))}
      </ol>
    </Widget>
  )
}

export function TelegramCard() {
  return (
    <div className="wtg">
      <img src="/logo/logo-mark.png" alt="" className="wtg__mark" aria-hidden="true" />
      <span className="wtg__icon"><SocialIcon name="telegram" size={22} /></span>
      <h4>Yangi maqolalarni o‘tkazib yubormang</h4>
      <p>Har hafta islom moliyasi bo‘yicha foydali maqola va yangiliklar Telegram kanalimizda.</p>
      <a href={CONTACTS.telegram} target="_blank" rel="noreferrer" className="wtg__btn">
        Kanalga qo‘shilish <Icon name="arrowRight" size={16} />
      </a>
    </div>
  )
}

export default function BlogPage({ initialTag = '' }) {
  const [cat, setCat] = useState(ALL)
  const [query, setQuery] = useState('')
  const [tag, setTag] = useState(initialTag)
  const [limit, setLimit] = useState(PAGE)

  useEffect(() => { document.title = 'Blog — Islom Iqtisodiyoti' }, [])
  useEffect(() => setLimit(PAGE), [cat, query, tag])

  const q = query.trim().toLowerCase()
  const filtering = cat !== ALL || q || tag
  const hero = POSTS.filter((p) => p.featured).slice(0, 3)

  const list = useMemo(() => POSTS.filter((p) =>
    (cat === ALL || p.dir === cat) &&
    (!tag || p.tags.includes(tag)) &&
    (!q || `${p.title} ${p.excerpt} ${p.tags.join(' ')}`.toLowerCase().includes(q)) &&
    (filtering || !hero.includes(p)),
  ), [cat, q, tag, filtering, hero])

  const tags = useMemo(() => {
    const count = {}
    POSTS.forEach((p) => p.tags.forEach((t) => { count[t] = (count[t] || 0) + 1 }))
    return Object.entries(count).sort((a, b) => b[1] - a[1]).slice(0, 14).map(([t]) => t)
  }, [])

  const reset = () => { setCat(ALL); setQuery(''); setTag('') }

  return (
    <div className="bpage">
      <header className="bpage__head">
        <nav className="crumbs" aria-label="Breadcrumb">
          <a href="#/">Bosh sahifa</a><Icon name="chevRight" size={14} /><span>Blog</span>
        </nav>
        <div className="bpage__intro">
          <div>
            <p className="eyebrow">Blog</p>
            <h1 className="bpage__title">Islom moliyasi bo‘yicha maqolalar</h1>
            <p className="bpage__text">Riba, islom banki, sukuk, takaful va zakot haqida sodda tilda yozilgan amaliy maqolalar va tahlillar.</p>
          </div>
          <label className="bsearch">
            <Icon name="search" size={19} />
            <input type="search" placeholder="Maqola qidirish..." value={query}
              onChange={(e) => setQuery(e.target.value)} aria-label="Maqola qidirish" />
            {query && (
              <button type="button" onClick={() => setQuery('')} aria-label="Tozalash"><Icon name="x" size={16} /></button>
            )}
          </label>
        </div>

        <div className="btabs" role="tablist">
          <button role="tab" aria-selected={cat === ALL} className={`btab ${cat === ALL ? 'is-active' : ''}`}
            onClick={() => setCat(ALL)}>
            Hammasi <span>{POSTS.length}</span>
          </button>
          {BLOG_CATEGORIES.map((d) => (
            <button key={d.id} role="tab" aria-selected={cat === d.id}
              className={`btab ${cat === d.id ? 'is-active' : ''}`} style={{ '--dc': d.color }}
              onClick={() => setCat(d.id)}>
              <i style={{ background: d.color }} />
              {d.title} <span>{POSTS.filter((p) => p.dir === d.id).length}</span>
            </button>
          ))}
        </div>
      </header>

      {!filtering && (
        <section className="bhero" aria-label="Tanlangan maqolalar">
          <HeroMain p={hero[0]} />
          <div className="bhero__col">
            {hero.slice(1).map((p) => <HeroSide key={p.id} p={p} />)}
          </div>
        </section>
      )}

      <div className="blayout">
        <div className="blayout__main">
          <div className="blayout__bar">
            <h2>{filtering ? 'Natijalar' : 'So‘nggi maqolalar'} <span>{list.length}</span></h2>
            {filtering && (
              <button type="button" className="breset" onClick={reset}>
                <Icon name="x" size={15} /> Filtrlarni tozalash
              </button>
            )}
          </div>
          {tag && <p className="bactive-tag">Teg: <b>#{tag}</b></p>}

          {list.length ? (
            <div className="bgrid">
              {list.slice(0, limit).map((p) => <PostCard key={p.id} p={p} />)}
            </div>
          ) : (
            <div className="bempty">
              <span><Icon name="search" size={28} /></span>
              <h3>Hech narsa topilmadi</h3>
              <p>Boshqa kalit so‘z bilan qidirib ko‘ring yoki filtrlarni tozalang.</p>
              <button type="button" className="link-arrow" onClick={reset}>Barcha maqolalar</button>
            </div>
          )}

          {list.length > limit && (
            <div className="more">
              <button type="button" className="btn btn--primary bmore" onClick={() => setLimit((n) => n + PAGE)}>
                Yana ko‘rsatish
              </button>
            </div>
          )}
        </div>

        <aside className="blayout__side">
          <PopularWidget />
          <TelegramCard />
          <Widget title="Teglar" icon="tag">
            <div className="wtags">
              {tags.map((t) => (
                <button key={t} type="button" className={`wtag ${tag === t ? 'is-active' : ''}`}
                  onClick={() => setTag(tag === t ? '' : t)}>#{t}</button>
              ))}
            </div>
          </Widget>
        </aside>
      </div>
    </div>
  )
}
