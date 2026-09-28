import { useEffect, useMemo, useRef, useState } from 'react'
import { POSTS, postBySlug } from '../data/posts.js'
import { COURSES, formatNum, formatPrice } from '../data/content.js'
import { Avatar, Cover, Icon, SocialIcon } from '../components/ui.jsx'
import { PostCard } from './BlogPage.jsx'

const AUTHOR_ROLE = {
  'Abdulloh Karimov': 'Islom moliyasi bo‘yicha ekspert, shariat maslahatchisi',
  'Dilshod Rahimov': 'Islom banki mutaxassisi, 10 yillik tajriba',
  'Muhammad Aliyev': 'Islom huquqi (fiqh) va shartnomalar bo‘yicha ustoz',
  'Jasur Sobirov': 'Kapital bozori va sukuk bo‘yicha tahlilchi',
  'Nodira Qosimova': 'Takaful va ijtimoiy moliya mutaxassisi',
  'Sardor Yusupov': 'Tadbirkor, halol biznes bo‘yicha murabbiy',
}

function Block({ b, id }) {
  const [type, a, c] = b
  switch (type) {
    case 'h2': return <h2 id={id}>{a}</h2>
    case 'ul': return <ul>{a.map((x) => <li key={x}>{x}</li>)}</ul>
    case 'ol': return <ol>{a.map((x) => <li key={x}>{x}</li>)}</ol>
    case 'quote': return <blockquote><p>{a}</p>{c && <cite>— {c}</cite>}</blockquote>
    case 'note': return <aside className="prose__note"><Icon name="info" size={20} /><p>{a}</p></aside>
    default: return <p>{a}</p>
  }
}

function useReadingProgress(ref) {
  const [pct, setPct] = useState(0)
  useEffect(() => {
    const onScroll = () => {
      const el = ref.current
      if (!el) return
      const r = el.getBoundingClientRect()
      const total = r.height - window.innerHeight * 0.6
      setPct(Math.min(100, Math.max(0, ((window.innerHeight * 0.4 - r.top) / total) * 100)))
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [ref])
  return pct
}

function useActiveHeading(ids) {
  const [active, setActive] = useState(ids[0])
  useEffect(() => {
    const onScroll = () => {
      let cur = ids[0]
      ids.forEach((id) => {
        const el = document.getElementById(id)
        if (el && el.getBoundingClientRect().top < 140) cur = id
      })
      setActive(cur)
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [ids])
  return active
}

function Share({ title, vertical }) {
  const [copied, setCopied] = useState(false)
  const url = window.location.href
  const copy = async () => {
    try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1800) } catch { /* ruxsat yo'q */ }
  }
  const enc = encodeURIComponent
  return (
    <div className={`share ${vertical ? 'share--v' : ''}`}>
      <a className="share__btn" target="_blank" rel="noreferrer" aria-label="Telegramda ulashish"
        href={`https://t.me/share/url?url=${enc(url)}&text=${enc(title)}`}><SocialIcon name="telegram" size={17} /></a>
      <a className="share__btn" target="_blank" rel="noreferrer" aria-label="Facebookda ulashish"
        href={`https://www.facebook.com/sharer/sharer.php?u=${enc(url)}`}><SocialIcon name="facebook" size={17} /></a>
      <button type="button" className={`share__btn ${copied ? 'is-done' : ''}`} onClick={copy} aria-label="Havolani nusxalash">
        <Icon name={copied ? 'check' : 'link'} size={17} stroke={2} />
      </button>
      {copied && <span className="share__toast">Havola nusxalandi</span>}
    </div>
  )
}

function NotFound() {
  return (
    <div className="bpage">
      <div className="bempty bempty--page">
        <span><Icon name="book" size={28} /></span>
        <h3>Maqola topilmadi</h3>
        <p>Siz qidirgan maqola o‘chirilgan yoki manzil noto‘g‘ri kiritilgan.</p>
        <a href="#/blog" className="link-arrow"><Icon name="arrowLeft" size={16} /> Blogga qaytish</a>
      </div>
    </div>
  )
}

export default function ArticlePage({ slug }) {
  const p = postBySlug(slug)
  const bodyRef = useRef(null)
  const pct = useReadingProgress(bodyRef)

  const heads = useMemo(() => (p ? p.body.map((b, i) => (b[0] === 'h2' ? { id: `s-${i}`, text: b[1] } : null)).filter(Boolean) : []), [p])
  const ids = useMemo(() => heads.map((h) => h.id), [heads])
  const active = useActiveHeading(ids)

  useEffect(() => { if (p) document.title = `${p.title} — Islom Iqtisodiyoti` }, [p])

  if (!p) return <NotFound />

  const idx = POSTS.indexOf(p)
  const newer = POSTS[idx - 1]
  const older = POSTS[idx + 1]
  const related = [...POSTS.filter((x) => x !== p && x.dir === p.dir), ...POSTS.filter((x) => x !== p && x.dir !== p.dir)].slice(0, 3)
  const course = COURSES.filter((c) => c.dir === p.dir).sort((a, b) => b.students - a.students)[0]

  const goTo = (e, id) => {
    e.preventDefault() // hash-router'ni buzmaslik uchun
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <article className="apage">
      <div className="aprogress" style={{ transform: `scaleX(${pct / 100})` }} aria-hidden="true" />

      <header className="ahead">
        <nav className="crumbs" aria-label="Breadcrumb">
          <a href="#/">Bosh sahifa</a><Icon name="chevRight" size={14} />
          <a href="#/blog">Blog</a><Icon name="chevRight" size={14} />
          <span>{p.cat}</span>
        </nav>
        <span className="chip" style={{ '--dc': p.color }}>{p.cat}</span>
        <h1 className="ahead__title">{p.title}</h1>
        <p className="ahead__lead">{p.excerpt}</p>
        <div className="ahead__row">
          <div className="ahead__author">
            <Avatar name={p.author} size={46} />
            <div>
              <b>{p.author}</b>
              <span>{AUTHOR_ROLE[p.author]}</span>
            </div>
          </div>
          <div className="ahead__meta">
            <span><Icon name="calendar" size={16} /> {p.date}</span>
            <span><Icon name="clock" size={16} /> {p.read} daqiqa</span>
            <span><Icon name="eye" size={16} /> {formatNum(p.views)}</span>
          </div>
        </div>
      </header>

      <div className="acover">
        <Cover color={p.color} icon={p.icon} label={p.cat} className="acover__img" />
      </div>

      <div className="alayout">
        <aside className="alayout__rail">
          <div className="rail-sticky">
            <span className="rail-label">Ulashish</span>
            <Share title={p.title} vertical />
          </div>
        </aside>

        <div className="alayout__main" ref={bodyRef}>
          {heads.length > 1 && (
            <details className="toc-mobile">
              <summary>Mundarija <Icon name="chevDown" size={18} /></summary>
              <ol>{heads.map((h) => <li key={h.id}><a href={`#${h.id}`} onClick={(e) => goTo(e, h.id)}>{h.text}</a></li>)}</ol>
            </details>
          )}

          <div className="prose">
            {p.body.map((b, i) => <Block key={i} b={b} id={`s-${i}`} />)}
          </div>

          <div className="afoot">
            <div className="afoot__tags">
              {p.tags.map((t) => <a key={t} href={`#/blog?tag=${encodeURIComponent(t)}`} className="wtag">#{t}</a>)}
            </div>
            <div className="afoot__share"><span>Maqola foydali bo‘ldimi? Ulashing:</span><Share title={p.title} /></div>
          </div>

          <div className="abio">
            <Avatar name={p.author} size={64} />
            <div>
              <span className="abio__label">Muallif</span>
              <h4>{p.author}</h4>
              <p>{AUTHOR_ROLE[p.author]}. Islom Iqtisodiyoti platformasida kurslar olib boradi va amaliy maqolalar yozadi.</p>
            </div>
          </div>

          <nav className="apager" aria-label="Boshqa maqolalar">
            {older ? (
              <a href={`#/blog/${older.slug}`} className="apager__link">
                <span><Icon name="arrowLeft" size={16} /> Oldingi maqola</span>
                <b>{older.title}</b>
              </a>
            ) : <span />}
            {newer && (
              <a href={`#/blog/${newer.slug}`} className="apager__link apager__link--next">
                <span>Keyingi maqola <Icon name="arrowRight" size={16} /></span>
                <b>{newer.title}</b>
              </a>
            )}
          </nav>
        </div>

        <aside className="alayout__side">
          <div className="side-sticky">
            {heads.length > 1 && (
              <section className="widget toc">
                <h4 className="widget__title"><Icon name="list" size={18} /> Mundarija</h4>
                <ol>
                  {heads.map((h) => (
                    <li key={h.id} className={active === h.id ? 'is-active' : ''}>
                      <a href={`#${h.id}`} onClick={(e) => goTo(e, h.id)}>{h.text}</a>
                    </li>
                  ))}
                </ol>
              </section>
            )}
            {course && (
              <a href="#kurslar" className="apromo" style={{ '--cc': p.color }}>
                <span className="apromo__label">Mavzu bo‘yicha kurs</span>
                <h4>{course.title}</h4>
                <span className="apromo__meta">{course.lessons} dars · {course.hours} soat · {formatPrice(course.price)}</span>
                <span className="apromo__btn">Kursni ko‘rish <Icon name="arrowRight" size={16} /></span>
              </a>
            )}
          </div>
        </aside>
      </div>

      <section className="arelated">
        <div className="arelated__head">
          <h2>O‘xshash maqolalar</h2>
          <a href="#/blog" className="link-arrow">Barcha maqolalar <Icon name="arrowRight" size={18} /></a>
        </div>
        <div className="bgrid bgrid--3">{related.map((x) => <PostCard key={x.id} p={x} />)}</div>
      </section>
    </article>
  )
}
