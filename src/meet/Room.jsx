// Dars xonasi — jonli video dars interfeysi (ma'ruzachi / to'r ko'rinishi, ishtirokchilar, chat, host boshqaruvi)
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Icon, Modal, Btn, Menu, Confirm, cx, useToast } from '../platform/ui/kit.jsx'
import { DAYS, MONTHS, fmtTime } from '../platform/ui/format.js'
import { initials } from '../platform/store/ids.js'
import { meetingsApi } from '../platform/api/meetings.js'
import { StageRecorder, listDevices } from './rtc.js'
import InviteModal from './Invite.jsx'

const REACTIONS = ['👍', '👏', '❤️', '😂', '😮', '🎉', '🤲']
const PALETTE = ['#4aa3f8', '#8b5cf6', '#14b8a6', '#f59e0b', '#ef4444', '#10b981', '#6366f1', '#ec4899']
export const colorFor = (name = '') => PALETTE[[...name].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7) % PALETTE.length]

const pad = (n) => String(n).padStart(2, '0')
const hms = (sec) => { const s = Math.abs(Math.floor(sec)); return `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}` }
const dateLine = (ts) => { const d = new Date(ts); return `${DAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}` }

function useNow(ms = 1000) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), ms); return () => clearInterval(t) }, [ms])
  return now
}

const isMobileQ = () => window.matchMedia('(max-width: 1080px)').matches

/* ---------------- Video / plitka ---------------- */
const VideoEl = memo(function VideoEl({ stream, mirror, fit, main }) {
  const ref = useRef(null)
  useEffect(() => {
    const v = ref.current
    if (!v) return
    if (v.srcObject !== stream) v.srcObject = stream || null
    v.play?.().catch(() => {})
  }, [stream])
  return <video ref={ref} autoPlay playsInline muted data-main-video={main ? '' : undefined} className={cx(mirror && 'is-mirror', fit === 'contain' && 'is-contain')} />
})

// Uzoqdagi ishtirokchilar ovozi — plitkadan mustaqil (ko'rinmayotganlar ham eshitiladi)
function RemoteAudio({ stream, volume, sinkId }) {
  const ref = useRef(null)
  useEffect(() => { const a = ref.current; if (a && a.srcObject !== stream) { a.srcObject = stream || null; a.play?.().catch(() => {}) } }, [stream])
  useEffect(() => { if (ref.current) ref.current.volume = volume }, [volume])
  useEffect(() => { if (sinkId && ref.current?.setSinkId) ref.current.setSinkId(sinkId).catch(() => {}) }, [sinkId])
  return <audio ref={ref} autoPlay />
}

function Tile({ p, main, level = 0, pinned, onPin, reactions, compact, onClick, conn }) {
  const hasVideo = p.media?.screen || p.media?.cam
  const stream = p.isSelf ? (p.media?.screen ? p.stream : p.camStream || p.stream) : p.stream
  const speaking = p.media?.mic && level > 0.08
  const hostTag = p.role === 'host' ? 'ustoz' : p.guest ? 'mehmon' : null
  return (
    <div className={cx('mt-tile', main ? 'mt-tile--main' : 'mt-tile--sm', speaking && 'is-speaking', compact && 'is-compact')} style={{ '--tc': p.color }} onClick={onClick}>
      {hasVideo && stream
        ? <VideoEl stream={stream} main={main} mirror={p.isSelf && !p.media?.screen} fit={p.media?.screen ? 'contain' : 'cover'} />
        : <div className="mt-tile__ph"><span className="mt-tile__av" style={{ '--lv': speaking ? level : 0 }}>{initials(p.name)}</span></div>}

      {main ? (
        <span className="mt-chip mt-chip--top"><span className="mt-chip__av">{initials(p.name)}</span>{p.name}{p.isSelf && ' (siz)'}{hostTag && <small>· {hostTag}</small>}</span>
      ) : (
        <span className="mt-chip mt-chip--bottom">{!p.media?.mic && <Icon name="micOff" size={12} />}{p.name}{p.isSelf && ' (siz)'}</span>
      )}

      <div className="mt-tile__tr">
        {p.media?.hand && <span className="mt-sq mt-sq--hand" title="Qo‘l ko‘tardi">✋</span>}
        {p.media?.screen && main && <span className="mt-sq mt-sq--info"><Icon name="screen" size={16} /></span>}
        {!p.media?.mic
          ? <span className="mt-sq mt-sq--off" title="Mikrofon o‘chiq"><Icon name="micOff" size={16} /></span>
          : <span className={cx('mt-sq', speaking ? 'mt-sq--on' : 'mt-sq--glass')} title="Ovoz"><Bars level={speaking ? level : 0} /></span>}
        {main && onPin && (
          <button type="button" className={cx('mt-sq', pinned ? 'mt-sq--on' : 'mt-sq--glass')} onClick={(e) => { e.stopPropagation(); onPin() }} title={pinned ? 'Mahkamlashni bekor qilish' : 'Mahkamlash'}>
            <Icon name="pinTack" size={16} />
          </button>
        )}
      </div>
      {conn && conn !== 'connected' && !p.isSelf && <span className="mt-tile__conn">{conn === 'failed' ? 'Ulanish uzildi' : 'Ulanmoqda…'}</span>}
      <div className="mt-tile__react">{reactions?.map((r) => <span key={r.key}>{r.emoji}</span>)}</div>
    </div>
  )
}

function Bars({ level }) {
  // Jimlikda ham to'lqin shakli ko'rinadi; gapirganda balandlashadi
  const h = (base, k) => `${Math.min(100, base + level * 160 * k)}%`
  return <span className="mt-bars"><i style={{ height: h(35, 0.7) }} /><i style={{ height: h(70, 1) }} /><i style={{ height: h(50, 1.2) }} /><i style={{ height: h(80, 0.8) }} /><i style={{ height: h(40, 0.6) }} /></span>
}

// «Murobaha shartnomasi 2026-11-02 15-06.webm» — fayl nomida taqiqlangan belgilarsiz
const recFileName = (title) => {
  const d = new Date(), p = (n) => String(n).padStart(2, '0')
  const safe = (title || 'dars').replace(/[\\/:*?"<>|]+/g, ' ').trim().slice(0, 80)
  return `${safe} ${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}-${p(d.getMinutes())}.webm`
}
const saveFile = (blob, name) => {
  const url = URL.createObjectURL(blob)
  const a = Object.assign(document.createElement('a'), { href: url, download: name })
  document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

/* ---------------- Asosiy komponent ---------------- */
export default function Room({ mt, info, onLeft }) {
  const { self, peers, local, hand, meeting, chat, lobby, recording, reactions, levels, conn, actions, status } = mt
  const toast = useToast()
  const now = useNow()
  const isHost = self?.role === 'host'
  const m = { ...info, ...meeting }

  const [mobile, setMobile] = useState(isMobileQ)
  const [show, setShow] = useState(() => (isMobileQ() ? { people: false, chat: false } : { people: true, chat: true }))
  const [view, setView] = useState('speaker')
  const [pinned, setPinned] = useState(null)
  const [active, setActive] = useState(null)
  const [volume, setVolume] = useState(1)
  const [sinkId, setSinkId] = useState('')
  const [invite, setInvite] = useState(false)
  const [settings, setSettings] = useState(false)
  const [attendance, setAttendance] = useState(false)
  const [confirmEnd, setConfirmEnd] = useState(false)
  const [pop, setPop] = useState(null) // 'volume' | 'react' | 'leave'
  const [recBusy, setRecBusy] = useState(false)
  const [lastSeenChat, setLastSeenChat] = useState(chat.length)
  const recRef = useRef(null)
  const stageRef = useRef(null)

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 1080px)')
    const on = () => { setMobile(mq.matches); if (mq.matches) setShow({ people: false, chat: false }) }
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  useEffect(() => { document.title = `${m.title || 'Dars'} — Jonli dars` }, [m.title])

  // ---- Ishtirokchilar ro'yxati (o'zimiz + boshqalar) ----
  const me = useMemo(() => self && ({
    ...self, isSelf: true, color: self.color || colorFor(self.name), stream: local.stream, camStream: local.camStream,
    media: { ...local.media, hand },
  }), [self, local, hand])
  const others = useMemo(() => Object.values(peers).map((p) => ({ ...p, color: p.color || colorFor(p.name) }))
    .sort((a, b) => (b.role === 'host') - (a.role === 'host') || a.joinedAt - b.joinedAt), [peers])
  const everyone = useMemo(() => (me ? [me, ...others] : others), [me, others])
  const lv = (p) => levels[p.isSelf ? 'self' : p.id] || 0

  // ---- Faol ma'ruzachi (eng baland ovoz, ~1.5s barqarorlik bilan) ----
  const activeSince = useRef(0)
  useEffect(() => {
    let best = null
    let bestLv = 0.1
    for (const p of others) { const l = levels[p.id] || 0; if (p.media?.mic && l > bestLv) { best = p.id; bestLv = l } }
    if (best && best !== active && Date.now() - activeSince.current > 1500) { setActive(best); activeSince.current = Date.now() }
  }, [levels, others, active])

  const sharer = everyone.find((p) => p.media?.screen)
  const byId = (id) => everyone.find((p) => p.id === id)
  const mainP = byId(pinned) || sharer || byId(active) || others.find((p) => p.role === 'host') || others[0] || me
  const rest = everyone.filter((p) => p !== mainP)
  const STRIP = mobile ? 4 : 3
  const strip = rest.length > STRIP ? rest.slice(0, STRIP - 1) : rest
  const more = rest.length - strip.length

  const reactsFor = (id) => reactions.filter((r) => r.from === id)

  // ---- Hisoblagichlar ----
  const invited = m.invitedCount || 0
  const presentMembers = everyone.filter((p) => p.userId && p.role !== 'host' && !p.guest).length
  const absent = Math.max(0, invited - presentMembers)
  const startTs = m.startedAt || m.startsAt
  const left = startTs ? (startTs + (m.durationMin || 60) * 60e3 - now) / 1000 : 0

  // ---- Chat ----
  const chatOpen = show.chat
  useEffect(() => { if (chatOpen) setLastSeenChat(chat.length) }, [chatOpen, chat.length])
  const unread = chatOpen ? 0 : Math.max(0, chat.length - lastSeenChat)

  const toggle = (k) => setShow((s) => (mobile ? { people: false, chat: false, [k]: !s[k] } : { ...s, [k]: !s[k] }))

  // ---- Boshqaruv ----
  const toggleMic = useCallback(() => actions.setMic(!local.media.mic), [actions, local.media.mic])
  const toggleCam = useCallback(() => actions.setCam(!local.media.cam), [actions, local.media.cam])
  const toggleScreen = async () => {
    if (local.media.screen) return actions.stopScreen()
    if (!navigator.mediaDevices?.getDisplayMedia) return toast('Bu qurilmada ekran ulashish qo‘llab-quvvatlanmaydi', 'err')
    try { await actions.startScreen() } catch (e) { if (e?.name !== 'NotAllowedError') toast('Ekran ulashishni boshlab bo‘lmadi', 'err') }
  }

  // Klaviatura: M — mikrofon, V — kamera
  useEffect(() => {
    const onKey = (e) => {
      if (e.target.closest('input, textarea, select, [contenteditable]') || e.metaKey || e.ctrlKey || e.altKey) return
      if (e.key === 'm' || e.key === 'M') toggleMic()
      if (e.key === 'v' || e.key === 'V') toggleCam()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [toggleMic, toggleCam])

  // ---- Yozib olish (faqat host) ----
  const mainRef = useRef(mainP)
  mainRef.current = mainP
  const audioMap = useMemo(() => Object.fromEntries(everyone.map((p) => [p.id, p.stream])), [everyone])
  useEffect(() => { recRef.current?.syncAudio(audioMap) }, [audioMap])

  // mode: 'stage' — dars sahnasi; 'screen' — foydalanuvchi tanlagan ekran/oyna/tab
  const startRec = async (mode = 'stage') => {
    if (!window.MediaRecorder) return toast('Brauzeringiz yozib olishni qo‘llab-quvvatlamaydi', 'err')
    let display = null
    if (mode === 'screen') {
      if (!navigator.mediaDevices?.getDisplayMedia) return toast('Brauzeringiz ekranni yozib olishni qo‘llab-quvvatlamaydi', 'err')
      try {
        display = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 30 }, audio: true, preferCurrentTab: true, selfBrowserSurface: 'include' })
      } catch { return } // foydalanuvchi oynani yopdi
    }
    const r = new StageRecorder()
    r.start({
      audioStreams: audioMap,
      display,
      onEnded: () => { if (recRef.current === r) stopRec() },
      getFrame: () => {
        const p = mainRef.current
        const hasVideo = p?.media?.screen || p?.media?.cam
        return p && { video: hasVideo ? stageRef.current?.querySelector('[data-main-video]') : null, name: p.name, color: p.color, initials: initials(p.name) }
      },
    })
    recRef.current = r
    actions.host('rec', { on: true })
    toast('Yozib olish boshlandi — ishtirokchilar xabardor qilindi')
  }
  const stopRec = async () => {
    const r = recRef.current
    if (!r) return
    recRef.current = null
    actions.host('rec', { on: false })
    setRecBusy(true)
    const out = await r.stop()
    if (!out?.blob?.size) { setRecBusy(false); return }
    // Avval faylni kompyuterga saqlaymiz, keyin serverga ham yuklaymiz
    saveFile(out.blob, recFileName(m.title))
    toast('Yozuv kompyuteringizga saqlandi, serverga yuklanmoqda…')
    try {
      await meetingsApi.uploadRecording(m.id, out.blob, out.duration)
      toast('Yozuv serverga ham saqlandi — «Onlayn darslar» sahifasida ko‘rish mumkin')
    } catch (e) {
      toast(`Serverga yuklab bo‘lmadi: ${e.message}. Fayl kompyuteringizda saqlangan`, 'err')
    } finally { setRecBusy(false) }
  }
  useEffect(() => {
    const warn = (e) => { if (recRef.current) { e.preventDefault(); e.returnValue = '' } }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [])

  const leave = async () => { if (recRef.current) await stopRec(); actions.leave(); onLeft?.() }
  const endForAll = async () => { if (recRef.current) await stopRec(); actions.host('end') }

  const fullscreen = () => {
    const el = stageRef.current?.querySelector('.mt-tile--main')
    if (document.fullscreenElement) document.exitFullscreen()
    else el?.requestFullscreen?.().catch(() => {})
  }

  const reconnecting = status === 'reconnecting' || status === 'connecting'

  return (
    <div className="mt">
      {reconnecting && <div className="mt-banner"><span className="mt-spin" /> Aloqa tiklanmoqda…</div>}
      {recording && <div className="mt-recflag"><i /> Dars yozib olinmoqda{recording.name ? ` · ${recording.name}` : ''}</div>}
      {/* Ishtirokchilar paneli yopiq bo'lsa — kutish zali so'rovi ko'zdan qochmasin */}
      {isHost && lobby.length > 0 && !show.people && (
        <div className="mt-knock" role="alert">
          <span className="mt-av" style={{ '--tc': lobby[0].color || colorFor(lobby[0].name) }}>{initials(lobby[0].name)}</span>
          <div><b>{lobby[0].name}</b><span>{lobby.length > 1 ? `va yana ${lobby.length - 1} kishi kutmoqda` : 'darsga kirmoqchi'}</span></div>
          {lobby.length > 1
            ? <button type="button" onClick={() => toggle('people')}>Ko‘rish</button>
            : <button type="button" onClick={() => actions.host('deny', { id: lobby[0].id })}>Rad</button>}
          <button type="button" className="is-ok" onClick={() => actions.host('admit', lobby.length > 1 ? { all: true } : { id: lobby[0].id })}>
            {lobby.length > 1 ? 'Hammasi' : 'Qabul'}
          </button>
        </div>
      )}

      <div className={cx('mt__grid', !show.people && !show.chat && 'no-side')}>
        {/* ======== Chap: sahna ======== */}
        <section className="mt-main">
          <header className="mt-head">
            <div className="mt-head__t">
              <h1>{m.title}</h1>
              <p>{m.topic && <span>{m.topic}</span>}{m.topic && m.groupName && <i>•</i>}{m.groupName && <b>{m.groupName}</b>}</p>
            </div>
            {m.startsAt && <div className="mt-head__date">{dateLine(m.startedAt || m.startsAt)}</div>}
            <div className={cx('mt-head__timer', left < 0 && 'is-over')}>
              <small>{left >= 0 ? 'Qolgan vaqt' : 'Vaqtdan oshdi'}</small>
              <b><i />{hms(left)}</b>
            </div>
          </header>

          <div className="mt-info">
            <span><Icon name="userPlus" size={17} /> Taklif qilingan <em className="is-green">{invited}</em></span>
            <span><Icon name="user" size={17} /> Kelmaganlar <em className="is-red">{absent}</em></span>
            <span className="mt-info__sp" />
            <span><Icon name="users" size={17} /> Ishtirokchilar <em className="is-blue">{everyone.length}</em></span>
            <button type="button" className="mt-info__add" onClick={() => setInvite(true)}><Icon name="userPlus" size={16} /> Odam qo‘shish</button>
          </div>

          <div className={cx('mt-stage', view === 'grid' && 'is-grid', view === 'speaker' && rest.length === 0 && 'is-solo')} ref={stageRef}>
            {view === 'grid' ? everyone.map((p) => (
              <Tile key={p.id} p={p} level={lv(p)} reactions={reactsFor(p.id)} conn={conn[p.id]} compact={everyone.length > 6}
                onClick={() => { setPinned(p.id); setView('speaker') }} />
            )) : (
              <>
                {mainP && (
                  <div className="mt-stage__main">
                    <Tile p={mainP} main level={lv(mainP)} pinned={pinned === mainP.id} reactions={reactsFor(mainP.id)} conn={conn[mainP.id]}
                      onPin={() => setPinned((x) => (x === mainP.id ? null : mainP.id))} />
                    <div className="mt-over">
                      <button type="button" className={cx('mt-ob', !local.media.mic && 'is-off')} onClick={toggleMic} title="Mikrofon (M)"><Icon name={local.media.mic ? 'mic' : 'micOff'} size={19} /></button>
                      <button type="button" className={cx('mt-ob', !local.media.cam && 'is-off')} onClick={toggleCam} title="Kamera (V)"><Icon name={local.media.cam ? 'video' : 'videoOff'} size={19} /></button>
                      <button type="button" className="mt-ob mt-ob--end" onClick={() => setPop(pop === 'leave' ? null : 'leave')} title="Chiqish"><Icon name="phoneOff" size={20} /></button>
                      <button type="button" className={cx('mt-ob', pop === 'react' && 'is-on')} onClick={() => setPop(pop === 'react' ? null : 'react')} title="Reaksiya"><Icon name="smile" size={19} /></button>
                      <button type="button" className="mt-ob" onClick={fullscreen} title="To‘liq ekran"><Icon name="maximize" size={18} /></button>
                      {pop === 'react' && (
                        <div className="mt-pop mt-pop--react" onMouseLeave={() => setPop(null)}>
                          {REACTIONS.map((e) => <button key={e} type="button" onClick={() => { actions.react(e); setPop(null) }}>{e}</button>)}
                        </div>
                      )}
                      {pop === 'leave' && (
                        <div className="mt-pop mt-pop--leave">
                          <button type="button" onClick={leave}><Icon name="logOut" size={17} /> Darsdan chiqish</button>
                          {isHost && <button type="button" className="is-danger" onClick={() => { setPop(null); setConfirmEnd(true) }}><Icon name="phoneOff" size={17} /> Hamma uchun yakunlash</button>}
                        </div>
                      )}
                    </div>
                  </div>
                )}
                {rest.length > 0 && (
                  <div className="mt-strip">
                    {strip.map((p) => <Tile key={p.id} p={p} level={lv(p)} reactions={reactsFor(p.id)} conn={conn[p.id]} onClick={() => setPinned(p.id)} />)}
                    {more > 0 && (
                      <button type="button" className="mt-tile mt-tile--sm mt-more" onClick={() => setView('grid')} style={{ '--tc': rest[strip.length]?.color }}>
                        <span className="mt-more__bg">{initials(rest[strip.length]?.name)}</span>
                        <b><Icon name="users" size={18} /> {more}+</b>
                      </button>
                    )}
                  </div>
                )}
              </>
            )}
          </div>

          {/* ======== Pastki panel ======== */}
          <nav className="mt-bar">
            <div className="mt-bar__side">
              <div className="mt-popwrap">
                <button type="button" className={cx('mt-tb', pop === 'volume' && 'is-on')} onClick={() => setPop(pop === 'volume' ? null : 'volume')}>
                  <span><Icon name="volume" size={19} /></span>Ovoz
                </button>
                {pop === 'volume' && (
                  <div className="mt-pop mt-pop--vol">
                    <label>Ishtirokchilar ovozi <b>{Math.round(volume * 100)}%</b></label>
                    <input type="range" min="0" max="1" step="0.05" value={volume} onChange={(e) => setVolume(Number(e.target.value))} />
                    <button type="button" onClick={() => { setPop(null); setSettings(true) }}><Icon name="settings" size={15} /> Qurilmalar sozlamasi</button>
                  </div>
                )}
              </div>
            </div>
            <div className="mt-bar__mid">
              <button type="button" className={cx('mt-tb', show.people && 'is-sel')} onClick={() => toggle('people')}>
                <span><Icon name="users" size={19} />{isHost && lobby.length > 0 && <i className="mt-dot">{lobby.length}</i>}</span>Ishtirokchilar
              </button>
              <button type="button" className={cx('mt-tb', show.chat && 'is-sel')} onClick={() => toggle('chat')}>
                <span><Icon name="message" size={19} />{unread > 0 && <i className="mt-dot">{unread > 9 ? '9+' : unread}</i>}</span>Chat
              </button>
              <button type="button" className={cx('mt-tb', hand && 'is-sel')} onClick={() => actions.setHand(!hand)}>
                <span><Icon name="hand" size={19} /></span>{hand ? 'Qo‘lni tushirish' : 'Qo‘l ko‘tarish'}
              </button>
              <button type="button" className={cx('mt-tb', local.media.screen && 'is-on')} onClick={toggleScreen}>
                <span><Icon name="screen" size={19} /></span>{local.media.screen ? 'To‘xtatish' : 'Ekran ulashish'}
              </button>
              {isHost && (recRef.current || recBusy || recording ? (
                <button type="button" className={cx('mt-tb', recording && 'is-rec')} disabled={recBusy || !recRef.current} onClick={stopRec}>
                  <span><Icon name="record" size={19} /></span>{recBusy ? 'Saqlanmoqda…' : 'To‘xtatish'}
                </button>
              ) : (
                <Menu align="left" trigger={<button type="button" className="mt-tb"><span><Icon name="record" size={19} /></span>Yozib olish</button>} items={[
                  { label: 'Dars sahnasini yozish', icon: 'video', onClick: () => startRec('stage') },
                  { label: 'Ekranni yozish (oyna / tab)', icon: 'screen', onClick: () => startRec('screen') },
                ]} />
              ))}
              <button type="button" className={cx('mt-tb', view === 'grid' && 'is-sel')} onClick={() => setView(view === 'grid' ? 'speaker' : 'grid')}>
                <span><Icon name={view === 'grid' ? 'user' : 'layoutGrid'} size={19} /></span>{view === 'grid' ? 'Ma’ruzachi' : 'To‘r ko‘rinish'}
              </button>
            </div>
            <div className="mt-bar__side mt-bar__side--r">
              <Menu align="right" trigger={<button type="button" className="mt-tb"><span><Icon name="more" size={19} /></span>Yana</button>} items={[
                { label: 'Taklif havolasi', icon: 'link', onClick: () => setInvite(true) },
                { label: 'Qurilmalar sozlamasi', icon: 'settings', onClick: () => setSettings(true) },
                isHost && 'sep',
                isHost && { label: 'Hammani ovozsiz qilish', icon: 'micOff', onClick: () => { actions.host('mute', { all: true }); toast('Barcha ishtirokchilarga mikrofonni o‘chirish so‘rovi yuborildi') } },
                isHost && { label: m.locked ? 'Darsni ochish' : 'Darsni qulflash', icon: m.locked ? 'lockOpen' : 'lock', onClick: () => actions.host('lock', { locked: !m.locked }) },
                isHost && { label: 'Davomat', icon: 'clipboard', onClick: () => setAttendance(true) },
                isHost && 'sep',
                isHost && { label: 'Hamma uchun yakunlash', icon: 'phoneOff', danger: true, onClick: () => setConfirmEnd(true) },
              ]} />
            </div>
          </nav>
        </section>

        {/* ======== O'ng: ishtirokchilar va chat ======== */}
        {(show.people || show.chat) && (
          <aside className={cx('mt-side', mobile && 'is-sheet')}>
            {mobile && <div className="mt-side__scrim" onClick={() => setShow({ people: false, chat: false })} />}
            {show.people && (
              <People everyone={everyone} lobby={lobby} isHost={isHost} actions={actions} m={m} levels={levels}
                onInvite={() => setInvite(true)} onClose={() => toggle('people')} />
            )}
            {show.chat && <Chat chat={chat} self={self} onSend={actions.chat} onClose={() => toggle('chat')} />}
          </aside>
        )}
      </div>

      {Object.values(peers).map((p) => p.stream && <RemoteAudio key={p.id} stream={p.stream} volume={volume} sinkId={sinkId} />)}

      <InviteModal open={invite} onClose={() => setInvite(false)} meeting={{ ...info, ...m }} />
      <DeviceSettings open={settings} onClose={() => setSettings(false)} actions={actions} sinkId={sinkId} setSinkId={setSinkId} />
      {isHost && <Attendance open={attendance} onClose={() => setAttendance(false)} meetingId={m.id} />}
      <Confirm open={confirmEnd} onClose={() => setConfirmEnd(false)} danger title="Darsni yakunlash"
        text="Dars barcha ishtirokchilar uchun yakunlanadi va hamma xonadan chiqariladi." confirmLabel="Yakunlash" onConfirm={endForAll} />
    </div>
  )
}

/* ---------------- Ishtirokchilar ---------------- */
function People({ everyone, lobby, isHost, actions, m, levels, onInvite, onClose }) {
  const hostItems = (p) => {
    const items = [
      p.media?.mic && { label: 'Mikrofonini o‘chirish', icon: 'micOff', onClick: () => actions.host('mute', { id: p.id }) },
      p.media?.hand && { label: 'Qo‘lini tushirish', icon: 'hand', onClick: () => actions.host('lowerHand', { id: p.id }) },
      p.media?.screen && { label: 'Ekran ulashishni to‘xtatish', icon: 'screen', onClick: () => actions.host('stopShare', { id: p.id }) },
      p.role !== 'host' && { label: 'Darsdan chiqarish', icon: 'logOut', danger: true, onClick: () => actions.host('kick', { id: p.id }) },
    ].filter(Boolean)
    return items.length ? items : [{ label: 'Amal yo‘q', icon: 'info', onClick: () => {} }]
  }
  const [q, setQ] = useState('')
  const list = q ? everyone.filter((p) => p.name.toLowerCase().includes(q.toLowerCase())) : everyone
  const hands = everyone.filter((p) => p.media?.hand).length
  return (
    <section className="mt-card mt-card--people">
      <header className="mt-card__head">
        <h3>Ishtirokchilar</h3><em className="is-blue">{everyone.length}</em>
        {hands > 0 && <span className="mt-hands">✋ {hands}</span>}
        <div className="mt-card__act">
          <Menu align="right" trigger={<button type="button" className="mt-ico" aria-label="Amallar"><Icon name="more" size={18} /></button>} items={[
            { label: 'Odam qo‘shish', icon: 'userPlus', onClick: onInvite },
            isHost && { label: 'Hammani ovozsiz qilish', icon: 'micOff', onClick: () => actions.host('mute', { all: true }) },
            isHost && { label: m.locked ? 'Darsni ochish' : 'Darsni qulflash', icon: m.locked ? 'lockOpen' : 'lock', onClick: () => actions.host('lock', { locked: !m.locked }) },
          ]} />
          <button type="button" className="mt-ico mt-ico--x" onClick={onClose} aria-label="Yopish"><Icon name="x" size={17} /></button>
        </div>
      </header>

      {isHost && lobby.length > 0 && (
        <div className="mt-lobby">
          <div className="mt-lobby__h"><b>Kutish zalida · {lobby.length}</b>{lobby.length > 1 && <button type="button" onClick={() => actions.host('admit', { all: true })}>Hammasini qabul qilish</button>}</div>
          {lobby.map((w) => (
            <div key={w.id} className="mt-lobby__row">
              <span className="mt-av" style={{ '--tc': w.color || colorFor(w.name) }}>{initials(w.name)}</span>
              <b>{w.name}{w.guest && <small> · mehmon</small>}</b>
              <button type="button" className="is-ok" onClick={() => actions.host('admit', { id: w.id })}>Qabul</button>
              <button type="button" onClick={() => actions.host('deny', { id: w.id })}>Rad</button>
            </div>
          ))}
        </div>
      )}
      {m.locked && <div className="mt-note"><Icon name="lock" size={15} /> Dars qulflangan — yangi ishtirokchilar kira olmaydi</div>}

      {everyone.length > 6 && (
        <label className="mt-search"><Icon name="search" size={15} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ishtirokchini qidirish" /></label>
      )}
      <div className="mt-people">
        {list.map((p) => {
          const lvl = levels[p.isSelf ? 'self' : p.id] || 0
          return (
            <div key={p.id} className="mt-person">
              <span className={cx('mt-av', p.media?.mic && lvl > 0.08 && 'is-speaking')} style={{ '--tc': p.color }}>{initials(p.name)}</span>
              <b>{p.name}{p.isSelf && <small> (siz)</small>}{p.role === 'host' && <small> · ustoz</small>}{p.guest && <small> · mehmon</small>}</b>
              {p.media?.hand && <span className="mt-person__hand" title="Qo‘l ko‘tardi">✋</span>}
              {p.media?.screen && <span className="mt-st is-on" title="Ekran ulashmoqda"><Icon name="screen" size={15} /></span>}
              <i className="mt-person__sep" />
              <span className={cx('mt-st', p.media?.mic ? 'is-on' : 'is-off')}><Icon name={p.media?.mic ? 'mic' : 'micOff'} size={15} /></span>
              <span className={cx('mt-st', p.media?.cam ? 'is-on' : 'is-off')}><Icon name={p.media?.cam ? 'video' : 'videoOff'} size={15} /></span>
              {isHost && !p.isSelf && (
                <Menu align="right" trigger={<button type="button" className="mt-ico mt-ico--sm" aria-label="Boshqarish"><Icon name="moreV" size={16} /></button>} items={hostItems(p)} />
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}

/* ---------------- Chat ---------------- */
const QUICK = ['👍', '🙏', '😊', '👏', '✅', '❓', '🤲']
function Chat({ chat, self, onSend, onClose }) {
  const [text, setText] = useState('')
  const [emo, setEmo] = useState(false)
  const listRef = useRef(null)
  const stick = useRef(true)
  const inputRef = useRef(null)
  useEffect(() => { const el = listRef.current; if (el && stick.current) el.scrollTop = el.scrollHeight }, [chat.length])
  const onScroll = () => { const el = listRef.current; stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60 }
  const send = (e) => {
    e.preventDefault()
    const t = text.trim()
    if (!t) return
    onSend(t)
    setText('')
    stick.current = true
  }
  const mine = (msg) => (self?.userId ? msg.userId === self.userId : msg.peerId === self?.id)

  return (
    <section className="mt-card mt-card--chat">
      <header className="mt-card__head">
        <h3>Chat</h3><em className="is-red">{chat.length}</em>
        <div className="mt-card__act"><button type="button" className="mt-ico mt-ico--x" onClick={onClose} aria-label="Yopish"><Icon name="x" size={17} /></button></div>
      </header>
      <div className="mt-chat" ref={listRef} onScroll={onScroll}>
        {chat.length === 0 && <div className="mt-chat__empty"><Icon name="message" size={26} /><b>Hali xabar yo‘q</b><span>Savol yoki fikringizni yozing — hamma ko‘radi</span></div>}
        {chat.map((msg, i) => {
          if (msg.kind === 'system') return <div key={msg.id} className="mt-msg__sys">{msg.name} {msg.text}</div>
          const me = mine(msg)
          const prev = chat[i - 1]
          const grouped = prev && prev.kind !== 'system' && prev.name === msg.name && msg.at - prev.at < 120e3
          return (
            <div key={msg.id} className={cx('mt-msg', me && 'is-me', grouped && 'is-grouped')}>
              {!grouped && (
                <div className="mt-msg__meta">
                  {!me && <span className="mt-av mt-av--xs" style={{ '--tc': msg.color || colorFor(msg.name) }}>{initials(msg.name)}</span>}
                  <b>{me ? 'Siz' : msg.name}</b><span>{fmtTime(msg.at)}</span>
                </div>
              )}
              <div className="mt-msg__bubble">{msg.text}</div>
            </div>
          )
        })}
      </div>
      <form className="mt-chat__form" onSubmit={send}>
        <div className="mt-popwrap">
          <button type="button" className="mt-ico" onClick={() => setEmo((v) => !v)} aria-label="Emoji"><Icon name="smile" size={19} /></button>
          {emo && <div className="mt-pop mt-pop--emo">{QUICK.map((e) => <button key={e} type="button" onClick={() => { setText((t) => t + e); setEmo(false); inputRef.current?.focus() }}>{e}</button>)}</div>}
        </div>
        <input ref={inputRef} value={text} onChange={(e) => setText(e.target.value)} maxLength={2000} placeholder="Xabar yozing…" />
        <button type="submit" className="mt-send" disabled={!text.trim()} aria-label="Yuborish"><Icon name="send" size={17} /></button>
      </form>
    </section>
  )
}

/* ---------------- Qurilmalar ---------------- */
function DeviceSettings({ open, onClose, actions, sinkId, setSinkId }) {
  const [dev, setDev] = useState({ audio: [], video: [], output: [] })
  const [sel, setSel] = useState({ audio: '', video: '' })
  useEffect(() => { if (open) listDevices().then(setDev) }, [open])
  const pick = (kind, id) => { setSel((s) => ({ ...s, [kind]: id })); actions.switchDevice(kind, id) }
  const canSink = typeof HTMLMediaElement !== 'undefined' && 'setSinkId' in HTMLMediaElement.prototype
  const row = (label, icon, items, value, onChange) => (
    <label className="mt-dev">
      <span><Icon name={icon} size={16} /> {label}</span>
      <select className="pinput" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">Standart</option>
        {items.map((d, i) => <option key={d.deviceId} value={d.deviceId}>{d.label || `${label} ${i + 1}`}</option>)}
      </select>
    </label>
  )
  return (
    <Modal open={open} onClose={onClose} title="Qurilmalar" sub="Mikrofon, kamera va karnayni tanlang" width={480} footer={<Btn variant="primary" onClick={onClose}>Tayyor</Btn>}>
      <div className="pform">
        {row('Mikrofon', 'mic', dev.audio, sel.audio, (id) => pick('audio', id))}
        {row('Kamera', 'video', dev.video, sel.video, (id) => pick('video', id))}
        {canSink && row('Karnay', 'volume', dev.output, sinkId, setSinkId)}
        <p className="pmuted" style={{ fontSize: 13 }}>Klaviatura: <kbd>M</kbd> — mikrofon, <kbd>V</kbd> — kamera</p>
      </div>
    </Modal>
  )
}

/* ---------------- Davomat (host) ---------------- */
function Attendance({ open, onClose, meetingId }) {
  const [data, setData] = useState(null)
  const [err, setErr] = useState(null)
  useEffect(() => {
    if (!open) return
    setData(null); setErr(null)
    meetingsApi.attendance(meetingId).then(setData).catch((e) => setErr(e.message))
  }, [open, meetingId])
  const mins = (s) => (s < 60 ? `${s} soniya` : `${Math.round(s / 60)} daqiqa`)
  return (
    <Modal open={open} onClose={onClose} title="Davomat" sub="Kim qancha vaqt darsda bo‘lgani" width={520}>
      {err && <p className="pmuted">{err}</p>}
      {!data && !err && <p className="pmuted">Yuklanmoqda…</p>}
      {data && (
        <div className="mt-att">
          <h4>Qatnashganlar · {data.present.length}</h4>
          {data.present.map((p) => (
            <div key={p.key} className="mt-att__row">
              <span className="mt-av mt-av--xs" style={{ '--tc': colorFor(p.name) }}>{initials(p.name)}</span>
              <b>{p.name}{p.guest && <small> · mehmon</small>}</b>
              <span>{fmtTime(p.first_join)} dan · {mins(p.seconds)}</span>
            </div>
          ))}
          {data.absent.length > 0 && <>
            <h4>Kelmaganlar · {data.absent.length}</h4>
            {data.absent.map((p) => (
              <div key={p.id} className="mt-att__row is-absent">
                <span className="mt-av mt-av--xs" style={{ '--tc': '#9aa6b8' }}>{initials(p.name)}</span><b>{p.name}</b><span>—</span>
              </div>
            ))}
          </>}
        </div>
      )}
    </Modal>
  )
}
