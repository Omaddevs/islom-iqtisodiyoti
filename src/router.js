import { useEffect, useState } from 'react'

// Oddiy hash-router: "#/blog", "#/blog/<slug>". Oddiy "#bolim" havolalari bosh sahifaga tegishli.
const parse = () => {
  const h = window.location.hash
  return h.startsWith('#/') ? h.slice(1).replace(/\/+$/, '') || '/' : '/'
}

export function useRoute() {
  const [route, setRoute] = useState(parse)
  useEffect(() => {
    const onChange = () => setRoute(parse())
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])
  return route
}
