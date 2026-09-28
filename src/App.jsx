import { useEffect } from 'react'
import { useRoute } from './router.js'
import Header from './components/Header.jsx'
import Hero from './components/Hero.jsx'
import Stats from './components/Stats.jsx'
import Directions from './components/Directions.jsx'
import Courses from './components/Courses.jsx'
import VideoBanner from './components/VideoBanner.jsx'
import Testimonials from './components/Testimonials.jsx'
import Partners from './components/Partners.jsx'
import Blog from './components/Blog.jsx'
import Contact from './components/Contact.jsx'
import CtaSection from './components/CtaSection.jsx'
import Footer from './components/Footer.jsx'
import BlogPage from './pages/BlogPage.jsx'
import ArticlePage from './pages/ArticlePage.jsx'

function Home() {
  useEffect(() => { document.title = 'Islom Iqtisodiyoti' }, [])
  return (
    <>
      <Hero />
      <Stats />
      <Directions />
      <Courses />
      <VideoBanner />
      <Testimonials />
      <Partners />
      <Blog />
      <Contact />
      <CtaSection />
    </>
  )
}

export default function App() {
  const route = useRoute()
  const [path, search = ''] = route.split('?')

  // Sahifa almashganda: bo'lim havolasi bo'lsa o'sha joyga, aks holda yuqoriga
  useEffect(() => {
    const h = window.location.hash
    const target = h && !h.startsWith('#/') ? document.querySelector(h) : null
    if (target) target.scrollIntoView({ behavior: 'instant' })
    else window.scrollTo({ top: 0, behavior: 'instant' })
  }, [path])

  let page = <Home />
  if (path === '/blog') page = <BlogPage key={search} initialTag={new URLSearchParams(search).get('tag') || ''} />
  else if (path.startsWith('/blog/')) page = <ArticlePage key={path} slug={decodeURIComponent(path.slice(6))} />

  return (
    <>
      <Header route={path} />
      <main>{page}</main>
      {path !== '/' && <CtaSection />}
      <Footer />
    </>
  )
}
