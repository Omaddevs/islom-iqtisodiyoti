// Himoyalangan material ko'ruvchisi. Asl fayl brauzerga kelmaydi: hujjat sahifalari rasm sifatida canvas'ga
// chiziladi. Yuklab olish, nusxalash va chop etish yopiladi; oyna fokusni yo'qotganda yoki
// skrinshot tugmalari bosilganda kontent yashiriladi va urinish jurnalga yoziladi.
// Eslatma: brauzer skrinshotni butunlay taqiqlay olmaydi.
import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Btn, Icon, cx } from './kit.jsx'
import { materialsApi } from '../api/client.js'

const fmtSize = (b) => (b >= 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`)
export { fmtSize }

/* ---------- Bitta sahifa: faqat ekranga yaqinlashganda yuklanadi ---------- */
function Page({ fileId, n, ratio, width, onSeen, onRatio, shieldKey }) {
  const box = useRef(null)
  const canvas = useRef(null)
  const [near, setNear] = useState(false)
  const [state, setState] = useState('idle') // idle | ok | err
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    const el = box.current
    const root = el.closest('.psv__scroll')
    const io = new IntersectionObserver(([e]) => setNear(e.isIntersecting), { root, rootMargin: '1400px 0px' })
    const seen = new IntersectionObserver(([e]) => { if (e.isIntersecting) onSeen(n) }, { root, rootMargin: '-45% 0px -45% 0px' })
    io.observe(el); seen.observe(el)
    return () => { io.disconnect(); seen.disconnect() }
  }, [n, onSeen])

  useEffect(() => {
    // Ekrandan uzoqlashgan sahifa xotiradan chiqariladi
    if (!near) { const c = canvas.current; if (c) { c.width = 0; c.height = 0 } setState('idle'); return undefined }
    const ctl = new AbortController()
    let alive = true
    ;(async () => {
      try {
        const res = await fetch(materialsApi.pageUrl(fileId, n), { credentials: 'include', signal: ctl.signal, cache: 'no-store' })
        if (res.status === 429) { const s = (await res.json().catch(() => ({}))).retryAfter || 5; setTimeout(() => alive && setAttempt((a) => a + 1), s * 1000); return }
        if (!res.ok) throw new Error(String(res.status))
        const bmp = await createImageBitmap(await res.blob())
        if (!alive || !canvas.current) { bmp.close(); return }
        canvas.current.width = bmp.width
        canvas.current.height = bmp.height
        canvas.current.getContext('2d').drawImage(bmp, 0, 0)
        onRatio(n, bmp.height / bmp.width)
        bmp.close()
        setState('ok')
      } catch (e) { if (alive && e.name !== 'AbortError') setState('err') }
    })()
    return () => { alive = false; ctl.abort() }
  }, [near, fileId, n, attempt, onRatio, shieldKey])

  return (
    <div ref={box} className="psv__page" data-page={n} style={{ width, height: Math.round(width * ratio) }}>
      <canvas ref={canvas} aria-label={`${n}-sahifa`} />
      {state !== 'ok' && (
        <div className="psv__pstate">
          {state === 'err'
            ? <button type="button" onClick={() => { setState('idle'); setAttempt((a) => a + 1) }}><Icon name="refresh" size={16} />Qayta yuklash</button>
            : <span className="psv__spin" aria-label="Yuklanmoqda" />}
        </div>
      )}
    </div>
  )
}

/* ---------- Sahifali hujjat ---------- */
function PagesView({ meta, zoom, setCurrent, scrollRef }) {
  const [boxW, setBoxW] = useState(0)
  const [ratios, setRatios] = useState({})
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return undefined
    const up = () => { if (el.clientWidth > 0) setBoxW(el.clientWidth) } // yashirin paytda (chop etish, kichraytirish) sahifalar saqlanadi
    up()
    const ro = new ResizeObserver(up)
    ro.observe(el)
    return () => ro.disconnect()
  }, [scrollRef])
  const onRatio = useCallback((n, r) => setRatios((x) => (Math.abs((x[n] || 0) - r) < 0.002 ? x : { ...x, [n]: r })), [])
  const onSeen = useCallback((n) => setCurrent(n), [setCurrent])
  const width = Math.max(240, Math.round(Math.min(boxW - 32, 1000) * zoom))
  if (!boxW) return null
  return (
    <div className="psv__pages">
      {Array.from({ length: meta.pages }, (_, i) => i + 1).map((n) => (
        <Page key={n} fileId={meta.id} n={n} ratio={ratios[n] || meta.ratio || 1.414} width={width} onSeen={onSeen} onRatio={onRatio} />
      ))}
    </div>
  )
}

/* ---------- Audio / video: ustida harakatlanuvchi ism ---------- */
function MediaView({ meta, mark, hidden }) {
  const el = useRef(null)
  const [pos, setPos] = useState({ left: '8%', top: '10%' })
  useEffect(() => {
    const iv = setInterval(() => setPos({ left: `${4 + Math.random() * 56}%`, top: `${6 + Math.random() * 76}%` }), 7000)
    return () => clearInterval(iv)
  }, [])
  useEffect(() => { if (hidden) el.current?.pause() }, [hidden])
  const Tag = meta.kind === 'video' ? 'video' : 'audio'
  return (
    <div className={cx('psv__media', `psv__media--${meta.kind}`)}>
      {meta.kind === 'audio' && <span className="psv__audioart"><Icon name="headphones" size={52} stroke={1.5} /></span>}
      <Tag ref={el} src={materialsApi.mediaUrl(meta.id)} controls controlsList="nodownload nofullscreen noremoteplayback noplaybackrate" disablePictureInPicture disableRemotePlayback playsInline preload="metadata" />
      {meta.kind === 'video' && <span className="psv__mark" style={pos} aria-hidden="true">{mark}</span>}
    </div>
  )
}

/* ---------- Asosiy oyna ---------- */
export function SecureViewer({ item, user, onClose }) {
  const fileId = item.fileId
  const root = useRef(null)
  const scrollRef = useRef(null)
  const [meta, setMeta] = useState(null)
  const [error, setError] = useState(null)
  const [zoom, setZoom] = useState(1)
  const [current, setCurrent] = useState(1)
  const [jump, setJump] = useState('')
  const [unfocused, setUnfocused] = useState(false)
  const [capture, setCapture] = useState(null) // 'hold' — Win/Cmd bosilgan, 'flag' — urinish qayd etildi
  const captureTimer = useRef(null)
  const lastFlag = useRef(0)
  const closeRef = useRef(onClose)
  closeRef.current = onClose
  const hidden = unfocused || !!capture
  const mark = `${user.name} · ${user.phone || ''}`

  // Holat: fayl tayyor bo'lguncha so'rab turiladi
  useEffect(() => {
    let alive = true, timer
    const load = async () => {
      try {
        const m = await materialsApi.get(fileId)
        if (!alive) return
        setMeta(m)
        if (m.status === 'processing') timer = setTimeout(load, 2500)
      } catch (e) { if (alive) setError(e.message) }
    }
    load()
    materialsApi.event(fileId, 'open')
    return () => { alive = false; clearTimeout(timer) }
  }, [fileId])

  const flagCapture = useCallback((detail) => {
    setCapture('flag')
    clearTimeout(captureTimer.current)
    captureTimer.current = setTimeout(() => setCapture(null), 4000)
    // Bir bosish ikki hodisa berishi mumkin (keydown va keyup): jurnalga bir marta yoziladi
    if (Date.now() - lastFlag.current < 1500) return
    lastFlag.current = Date.now()
    materialsApi.event(fileId, 'capture', detail)
    // Clipboard'ga tushgan rasmni almashtirishga urinamiz (brauzer ruxsat bersa)
    navigator.clipboard?.writeText?.('Himoyalangan material').catch?.(() => {})
  }, [fileId])

  useEffect(() => {
    document.body.classList.add('psv-open')
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const block = (e) => e.preventDefault()
    const onKey = (e) => {
      const k = e.key?.toLowerCase()
      if (e.key === 'Escape' && !document.fullscreenElement) { closeRef.current(); return }
      if (e.key === 'PrintScreen') { e.preventDefault(); flagCapture('PrintScreen'); return }
      if (e.key === 'Meta' || e.key === 'OS') { // Win+Shift+S, Cmd+Shift+4: tizim oynasi ochilishidan oldin yashiriladi
        setCapture((c) => c || 'hold')
        clearTimeout(captureTimer.current)
        captureTimer.current = setTimeout(() => setCapture(null), 6000)
        return
      }
      if (e.metaKey && e.shiftKey && ['s', '3', '4', '5'].includes(k)) { e.preventDefault(); flagCapture('Ekran tasviri tugmalari'); return }
      const mod = e.ctrlKey || e.metaKey
      if ((mod && ['s', 'p', 'u', 'c', 'a'].includes(k)) || e.key === 'F12' || (mod && e.shiftKey && ['i', 'j', 'c', 's'].includes(k))) e.preventDefault()
      if (mod && k === 'p') flagCapture('Chop etish')
    }
    const onKeyUp = (e) => {
      if (e.key === 'PrintScreen') flagCapture('PrintScreen')
      if (e.key === 'Meta' || e.key === 'OS') {
        clearTimeout(captureTimer.current)
        captureTimer.current = setTimeout(() => setCapture(null), 1500)
      }
    }
    const onBlur = () => setUnfocused(true)
    const onFocus = () => setUnfocused(false)
    const onVis = () => setUnfocused(document.hidden || !document.hasFocus())
    const onPrint = () => flagCapture('Chop etish')
    document.addEventListener('keydown', onKey, true)
    document.addEventListener('keyup', onKeyUp, true)
    window.addEventListener('blur', onBlur)
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVis)
    window.addEventListener('beforeprint', onPrint)
    const el = root.current
    for (const t of ['contextmenu', 'dragstart', 'selectstart', 'copy', 'cut']) el.addEventListener(t, block)
    return () => {
      document.body.classList.remove('psv-open')
      document.body.style.overflow = prevOverflow
      clearTimeout(captureTimer.current)
      document.removeEventListener('keydown', onKey, true)
      document.removeEventListener('keyup', onKeyUp, true)
      window.removeEventListener('blur', onBlur)
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVis)
      window.removeEventListener('beforeprint', onPrint)
      for (const t of ['contextmenu', 'dragstart', 'selectstart', 'copy', 'cut']) el.removeEventListener(t, block)
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {})
    }
  }, [flagCapture])

  const goto = useCallback((n) => {
    if (!meta) return
    const t = Math.max(1, Math.min(meta.pages, n))
    scrollRef.current?.querySelector(`[data-page="${t}"]`)?.scrollIntoView({ block: 'start' })
    setCurrent(t)
  }, [meta])
  const isPages = meta?.status === 'ready' && meta.kind === 'pages'
  useEffect(() => {
    if (!isPages) return undefined
    const onKey = (e) => {
      if (e.target.tagName === 'INPUT') return
      if (e.key === 'ArrowRight' || e.key === 'PageDown') { e.preventDefault(); goto(current + 1) }
      else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); goto(current - 1) }
      else if (e.key === '+' || e.key === '=') setZoom((z) => Math.min(3, +(z + 0.25).toFixed(2)))
      else if (e.key === '-') setZoom((z) => Math.max(0.5, +(z - 0.25).toFixed(2)))
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [isPages, current, goto])

  const fullscreen = () => { if (document.fullscreenElement) document.exitFullscreen().catch(() => {}); else root.current?.requestFullscreen?.().catch(() => {}) }
  const canFullscreen = !!document.documentElement.requestFullscreen

  return createPortal(
    <div ref={root} className="psv" role="dialog" aria-modal="true" aria-label={item.title}>
      <header className="psv__bar">
        <button type="button" className="psv__btn" onClick={onClose} aria-label="Yopish" title="Yopish"><Icon name="x" size={19} /></button>
        <div className="psv__ttl"><b title={item.title}>{item.title}</b><span><Icon name="lock" size={12} />Himoyalangan · {(item.fileExt || '').toUpperCase() || 'Fayl'}</span></div>
        {isPages && (
          <div className="psv__tools">
            <div className="psv__nav">
              <button type="button" className="psv__btn" onClick={() => goto(current - 1)} disabled={current <= 1} aria-label="Oldingi sahifa"><Icon name="chevLeft" size={18} /></button>
              <form onSubmit={(e) => { e.preventDefault(); if (jump) goto(Number(jump)); setJump('') }}>
                <input value={jump || current} inputMode="numeric" aria-label="Sahifa raqami" onChange={(e) => setJump(e.target.value.replace(/\D/g, ''))} onBlur={() => setJump('')} />
              </form>
              <span>/ {meta.pages}</span>
              <button type="button" className="psv__btn" onClick={() => goto(current + 1)} disabled={current >= meta.pages} aria-label="Keyingi sahifa"><Icon name="chevRight" size={18} /></button>
            </div>
            <div className="psv__zoom">
              <button type="button" className="psv__btn" onClick={() => setZoom((z) => Math.max(0.5, +(z - 0.25).toFixed(2)))} disabled={zoom <= 0.5} aria-label="Kichraytirish"><Icon name="minus" size={17} /></button>
              <button type="button" className="psv__pct" onClick={() => setZoom(1)} title="Asl o‘lcham">{Math.round(zoom * 100)}%</button>
              <button type="button" className="psv__btn" onClick={() => setZoom((z) => Math.min(3, +(z + 0.25).toFixed(2)))} disabled={zoom >= 3} aria-label="Kattalashtirish"><Icon name="plus" size={17} /></button>
            </div>
          </div>
        )}
        {canFullscreen && <button type="button" className="psv__btn psv__fs" onClick={fullscreen} aria-label="To‘liq ekran" title="To‘liq ekran"><Icon name="maximize" size={17} /></button>}
      </header>

      <div ref={scrollRef} className={cx('psv__scroll', hidden && 'is-hidden')}>
        {error ? <Notice icon="alertCircle" title="Materialni ochib bo‘lmadi" text={error} />
          : !meta ? <Notice spin title="Yuklanmoqda…" />
            : meta.status === 'processing' ? <Notice spin title="Fayl tayyorlanmoqda" text="Hujjat ko‘rish uchun sahifalarga aylantirilmoqda. Katta fayllar bir necha daqiqa olishi mumkin." />
              : meta.status === 'failed' ? <Notice icon="alertCircle" title="Faylni platformada ochib bo‘lmadi" text={meta.error} meta={meta} />
                : meta.kind === 'none' ? <Notice icon="fileText" title="Bu fayl turini platformada ko‘rib bo‘lmaydi" text={`«.${meta.ext || '?'}» turidagi fayl brauzerda ochilmaydi. PDF, Word, Excel, PowerPoint, rasm, audio yoki video ko‘rinishida yuklang.`} meta={meta} />
                  : meta.kind === 'pages' ? <PagesView meta={meta} zoom={zoom} setCurrent={setCurrent} scrollRef={scrollRef} />
                    : <MediaView meta={meta} mark={mark} hidden={hidden} />}
      </div>

      {hidden && (
        <button type="button" className="psv__shield" onClick={() => { setUnfocused(false); setCapture(null) }}>
          <Icon name="lock" size={34} />
          <b>{capture === 'flag' ? 'Ekran tasvirini olish taqiqlangan' : 'Material himoyalangan'}</b>
          <span>{capture === 'flag' ? 'Bu urinish ustozingiz jurnaliga yozildi.' : 'Davom etish uchun shu yerni bosing'}</span>
        </button>
      )}
    </div>,
    document.body,
  )
}

function Notice({ icon, spin, title, text, meta }) {
  return (
    <div className="psv__notice">
      {spin ? <span className="psv__spin psv__spin--lg" /> : <Icon name={icon} size={38} stroke={1.6} />}
      <h3>{title}</h3>
      {text && <p>{text}</p>}
      {meta?.canManage && <Btn as="a" href={materialsApi.sourceUrl(meta.id)} icon="download" variant="primary">Asl faylni yuklab olish</Btn>}
    </div>
  )
}
