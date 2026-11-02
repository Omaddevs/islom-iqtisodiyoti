// Havola orqali darsga kirish: #/join/<kod>
// Bosqichlar: ma'lumot yuklash → lobby (kamera/mikrofon tekshiruvi, ism, parol) → kutish zali → xona → yakun
import { useCallback, useEffect, useRef, useState } from 'react'
import { Icon, Btn, cx, ToastProvider, useToast } from '../platform/ui/kit.jsx'
import { initials } from '../platform/store/ids.js'
import { fmtWhen, fmtTime } from '../platform/ui/format.js'
import { meetingsApi, recordingUrl } from '../platform/api/meetings.js'
import { useMeeting } from './useMeeting.js'
import { listDevices, LevelMeter, mediaErrorText } from './rtc.js'
import Room, { colorFor } from './Room.jsx'

const GUEST_KEY = 'ii_guest_name'
const PREFS_KEY = 'ii_meet_prefs'
const readPrefs = () => { try { return JSON.parse(localStorage.getItem(PREFS_KEY)) || {} } catch { return {} } }

export default function MeetPage({ code }) {
  return <ToastProvider><Meet code={code} /></ToastProvider>
}

function Meet({ code }) {
  const toast = useToast()
  const [info, setInfo] = useState(null)
  const [viewer, setViewer] = useState(null)
  const [loadErr, setLoadErr] = useState(null)
  const cred = useRef({})

  const load = useCallback(() => {
    setLoadErr(null)
    meetingsApi.joinInfo(code).then((d) => { setInfo(d.meeting); setViewer(d.viewer) }).catch((e) => setLoadErr(e))
  }, [code])
  useEffect(load, [load])
  useEffect(() => { if (info) document.title = `${info.title} — Onlayn dars` }, [info])

  // Birinchi chipta lobby'da olinadi (xatolar shu yerda ko'rsatiladi); qayta ulanishda yangisi so'raladi
  const firstTicket = useRef(null)
  const getTicket = useCallback(async () => {
    if (firstTicket.current) { const t = firstTicket.current; firstTicket.current = null; return t }
    return meetingsApi.ticket(code, cred.current)
  }, [code])
  const mt = useMeeting({ getTicket, onToast: toast })

  const join = async ({ name, passcode, mic, cam, audioDeviceId, videoDeviceId }) => {
    cred.current = { ...(name ? { name } : {}), ...(passcode ? { passcode } : {}) }
    const t = await meetingsApi.ticket(code, cred.current) // xato bo'lsa lobby ushlaydi
    firstTicket.current = t
    if (name) try { localStorage.setItem(GUEST_KEY, name) } catch { /* */ }
    try { localStorage.setItem(PREFS_KEY, JSON.stringify({ mic, cam, audioDeviceId, videoDeviceId })) } catch { /* */ }
    await mt.actions.join({ mic, cam, audioDeviceId, videoDeviceId })
  }

  if (loadErr) {
    return (
      <Screen icon="alertCircle" tone="red" title={loadErr.status === 404 ? 'Dars topilmadi' : 'Ulanib bo‘lmadi'}
        text={loadErr.status === 404 ? 'Havola noto‘g‘ri yoki dars o‘chirilgan. Ustozingizdan yangi havola so‘rang.' : loadErr.message}>
        {loadErr.status !== 404 && <Btn variant="primary" icon="refresh" onClick={load}>Qayta urinish</Btn>}
        <Btn as="a" href="#/platform/meetings">Darslar ro‘yxati</Btn>
      </Screen>
    )
  }
  if (!info) return <div className="mj mj--center"><span className="mt-spin mt-spin--lg" /></div>

  const st = mt.status
  if (st === 'joined' || (st === 'reconnecting' && mt.self)) return <Room mt={mt} info={info} />

  if (st === 'waiting' || ((st === 'connecting' || st === 'reconnecting') && !mt.self)) {
    return <Waiting mt={mt} info={info} />
  }

  const ends = {
    ended: { icon: 'checkCircle', tone: 'green', title: mt.reason === 'deleted' ? 'Dars o‘chirildi' : 'Dars yakunlandi', text: 'Qatnashganingiz uchun rahmat! Yozuv bo‘lsa, «Onlayn darslar» sahifasida paydo bo‘ladi.' },
    kicked: { icon: 'logOut', tone: 'red', title: 'Siz darsdan chiqarildingiz', text: mt.reason ? `${mt.reason} sizni darsdan chiqardi.` : '' },
    denied: { icon: 'lock', tone: 'red', title: mt.reason === 'locked' ? 'Dars qulflangan' : mt.reason === 'full' ? 'Xona to‘lgan' : 'Kirishga ruxsat berilmadi', text: mt.reason === 'host' ? 'Ustoz so‘rovingizni rad etdi.' : 'Keyinroq qayta urinib ko‘ring.' },
    replaced: { icon: 'externalLink', tone: 'blue', title: 'Boshqa oynada ochildi', text: 'Siz shu darsga boshqa oyna yoki qurilmadan qo‘shildingiz.' },
    left: { icon: 'logOut', tone: 'blue', title: 'Siz darsdan chiqdingiz', text: 'Dars hali davom etmoqda — istalgan payt qaytib qo‘shilishingiz mumkin.' },
    failed: { icon: 'alertCircle', tone: 'red', title: 'Ulanib bo‘lmadi', text: mt.reason || 'Internet aloqasini tekshirib, qayta urinib ko‘ring.' },
  }[st]
  if (ends) {
    return (
      <Screen {...ends} meeting={info}>
        {['left', 'failed', 'replaced'].includes(st) && <Btn variant="primary" icon="video" onClick={() => window.location.reload()}>Qayta qo‘shilish</Btn>}
        <Btn as="a" href={viewer?.user ? '#/platform/meetings' : '#/'}>{viewer?.user ? 'Darslar ro‘yxati' : 'Bosh sahifa'}</Btn>
      </Screen>
    )
  }

  if (info.status === 'ended') {
    return (
      <Screen icon="checkCircle" tone="gray" title="Dars yakunlangan" text={`«${info.title}» darsi yakunlangan.`} meeting={info}>
        {info.recordingId && <video className="mj__rec" src={recordingUrl(info.recordingId)} controls preload="metadata" />}
        <Btn as="a" href={viewer?.user ? '#/platform/meetings' : '#/'}>{viewer?.user ? 'Darslar ro‘yxati' : 'Bosh sahifa'}</Btn>
      </Screen>
    )
  }

  return <Lobby info={info} viewer={viewer} onJoin={join} busy={st === 'connecting'} />
}

/* ---------------- Lobby (kirishdan oldin) ---------------- */
function Lobby({ info, viewer, onJoin }) {
  const prefs = readPrefs()
  const user = viewer?.user
  const [mic, setMic] = useState(prefs.mic ?? true)
  const [cam, setCam] = useState(prefs.cam ?? true)
  const [name, setName] = useState(() => { try { return localStorage.getItem(GUEST_KEY) || '' } catch { return '' } })
  const [passcode, setPasscode] = useState('')
  const [dev, setDev] = useState({ audio: [], video: [] })
  const [audioId, setAudioId] = useState(prefs.audioDeviceId || '')
  const [videoId, setVideoId] = useState(prefs.videoDeviceId || '')
  const [stream, setStream] = useState(null)
  const [mediaErr, setMediaErr] = useState({})
  const [level, setLevel] = useState(0)
  const [err, setErr] = useState({})
  const [busy, setBusy] = useState(false)
  const [previewKey, setPreviewKey] = useState(0)
  const videoRef = useRef(null)
  const now = Date.now()

  // Oldindan ko'rish: kamera va mikrofon
  useEffect(() => {
    let s
    let alive = true
    const want = { audio: mic ? { deviceId: audioId ? { exact: audioId } : undefined } : false, video: cam ? { deviceId: videoId ? { exact: videoId } : undefined, width: { ideal: 1280 }, height: { ideal: 720 } } : false }
    if (!want.audio && !want.video) { setStream(null); return }
    navigator.mediaDevices?.getUserMedia(want).then((st) => {
      if (!alive) return st.getTracks().forEach((t) => t.stop())
      s = st
      setStream(st)
      setMediaErr({})
      listDevices().then(setDev)
    }).catch((e) => {
      if (!alive) return
      setMediaErr({ [cam ? 'cam' : 'mic']: mediaErrorText(cam ? 'cam' : 'mic', e) })
      if (cam) setCam(false); else setMic(false)
    })
    return () => { alive = false; s?.getTracks().forEach((t) => t.stop()) }
  }, [mic, cam, audioId, videoId, previewKey])

  useEffect(() => { if (videoRef.current) videoRef.current.srcObject = stream }, [stream, cam])
  useEffect(() => {
    if (!stream?.getAudioTracks().length) { setLevel(0); return }
    const meter = new LevelMeter()
    meter.set('me', stream)
    const t = setInterval(() => setLevel(meter.read().me || 0), 120)
    return () => { clearInterval(t); meter.close() }
  }, [stream])

  const needName = !user
  const needPass = viewer?.needsPasscode
  const guestsBlocked = !user && !info.allowGuests

  const submit = async (e) => {
    e.preventDefault()
    const er = {}
    if (needName && name.trim().length < 2) er.name = 'Ismingizni kiriting'
    if (needPass && !passcode.trim()) er.passcode = 'Parolni kiriting'
    setErr(er)
    if (Object.keys(er).length) return
    setBusy(true)
    stream?.getTracks().forEach((t) => t.stop()) // qurilmalarni xonaga bo'shatamiz
    try {
      await onJoin({ name: needName ? name.trim() : undefined, passcode: passcode.trim() || undefined, mic, cam, audioDeviceId: audioId, videoDeviceId: videoId })
    } catch (ex) {
      setBusy(false)
      setErr({ [ex.data?.field || 'form']: ex.message })
      setPreviewKey((k) => k + 1) // oldindan ko'rishni qayta yoqamiz
    }
  }

  const live = info.status === 'live'
  const loginHref = `#/kirish?next=${encodeURIComponent(`/join/${info.code}`)}`
  const displayName = user?.name || name || 'Siz'

  return (
    <div className="mj">
      <header className="mj__top">
        <a href="#/" className="mj__brand"><span className="mj__logo"><Icon name="bookOpen" size={18} /></span>Islom Iqtisodiyoti</a>
        {user
          ? <span className="mj__who"><span className="mt-av mt-av--xs" style={{ '--tc': user.avatarColor || colorFor(user.name) }}>{initials(user.name)}</span>{user.name}</span>
          : <a className="mj__login" href={loginHref}><Icon name="logIn" size={16} /> Tizimga kirish</a>}
      </header>

      <main className="mj__body">
        <section className="mj__preview">
          <div className={cx('mj__cam', !cam && 'is-off')} style={{ '--tc': user?.avatarColor || colorFor(displayName) }}>
            {cam && stream?.getVideoTracks().length ? <video ref={videoRef} autoPlay playsInline muted /> : (
              <div className="mj__camoff"><span className="mt-tile__av">{initials(displayName)}</span><p>{mediaErr.cam || 'Kamera o‘chiq'}</p></div>
            )}
            <span className="mt-chip mt-chip--bottom">{!mic && <Icon name="micOff" size={12} />}{displayName}</span>
            <div className="mj__ctl">
              <button type="button" className={cx('mt-ob', !mic && 'is-off')} onClick={() => setMic((v) => !v)} aria-label="Mikrofon">
                <Icon name={mic ? 'mic' : 'micOff'} size={20} />
              </button>
              <button type="button" className={cx('mt-ob', !cam && 'is-off')} onClick={() => setCam((v) => !v)} aria-label="Kamera">
                <Icon name={cam ? 'video' : 'videoOff'} size={20} />
              </button>
            </div>
            {mic && <div className="mj__meter"><i style={{ width: `${Math.min(100, level * 140)}%` }} /></div>}
          </div>
          <div className="mj__devs">
            <label><Icon name="mic" size={15} />
              <select value={audioId} onChange={(e) => setAudioId(e.target.value)} disabled={!dev.audio.length}>
                <option value="">Standart mikrofon</option>
                {dev.audio.map((d, i) => <option key={d.deviceId} value={d.deviceId}>{d.label || `Mikrofon ${i + 1}`}</option>)}
              </select>
            </label>
            <label><Icon name="video" size={15} />
              <select value={videoId} onChange={(e) => setVideoId(e.target.value)} disabled={!dev.video.length}>
                <option value="">Standart kamera</option>
                {dev.video.map((d, i) => <option key={d.deviceId} value={d.deviceId}>{d.label || `Kamera ${i + 1}`}</option>)}
              </select>
            </label>
          </div>
          {mediaErr.mic && <p className="mj__warn"><Icon name="alertCircle" size={15} /> {mediaErr.mic}</p>}
        </section>

        <section className="mj__panel">
          <span className={cx('mj__status', live && 'is-live')}>
            <i />{live ? `Dars ketmoqda${info.online ? ` · ${info.online} kishi` : ''}` : info.startsAt > now ? `Boshlanadi: ${fmtWhen(info.startsAt)}` : 'Ustoz hali boshlamadi'}
          </span>
          <h1>{info.title}</h1>
          <ul className="mj__meta">
            <li><Icon name="user" size={16} /> {info.hostName}</li>
            {info.groupName && <li><Icon name="layers" size={16} /> {info.groupName}{info.groupCourse ? ` · ${info.groupCourse}` : ''}</li>}
            <li><Icon name="clock" size={16} /> {fmtTime(info.startsAt)} · {info.durationMin} daqiqa</li>
          </ul>
          {info.description && <p className="mj__desc">{info.description}</p>}

          {guestsBlocked ? (
            <div className="mj__block">
              <Icon name="lock" size={20} />
              <div><b>Faqat platforma foydalanuvchilari uchun</b><span>Darsga qo‘shilish uchun tizimga kiring.</span></div>
              <Btn as="a" href={loginHref} variant="primary" icon="logIn">Kirish</Btn>
            </div>
          ) : (
            <form className="mj__form" onSubmit={submit} noValidate>
              {needName && (
                <label className={cx('mj__field', err.name && 'is-err')}>
                  <span>Ismingiz</span>
                  <input value={name} onChange={(e) => { setName(e.target.value); setErr({}) }} placeholder="Masalan: Aziz Karimov" maxLength={40} autoFocus autoComplete="name" />
                  {err.name && <em>{err.name}</em>}
                </label>
              )}
              {needPass && (
                <label className={cx('mj__field', err.passcode && 'is-err')}>
                  <span>Dars paroli</span>
                  <input value={passcode} onChange={(e) => { setPasscode(e.target.value); setErr({}) }} placeholder="Ustoz bergan parol" autoComplete="off" autoFocus={!needName} />
                  {err.passcode && <em>{err.passcode}</em>}
                </label>
              )}
              {err.form && <p className="mj__err"><Icon name="alertCircle" size={16} /> {err.form}</p>}
              <button type="submit" className={cx('mj__join', live && 'is-live')} disabled={busy}>
                {busy ? <><span className="mt-spin" /> Ulanmoqda…</> : viewer?.isHost ? <><Icon name="play" size={18} /> {live ? 'Darsga qaytish' : 'Darsni boshlash'}</> : <><Icon name="video" size={18} /> {live ? 'Darsga qo‘shilish' : 'Xonaga kirish'}</>}
              </button>
              {!user && <p className="mj__hint">Platformada akkauntingiz bormi? <a href={loginHref}>Kirish</a> — davomatingiz hisobga olinadi.</p>}
              {user && !viewer?.isMember && info.allowGuests && <p className="mj__hint">Siz bu guruh a’zosi emassiz — ustoz ruxsat berishi kerak bo‘lishi mumkin.</p>}
            </form>
          )}
        </section>
      </main>
    </div>
  )
}

/* ---------------- Kutish ---------------- */
function Waiting({ mt, info }) {
  const m = { ...info, ...mt.meeting }
  const connecting = mt.status !== 'waiting'
  const byHost = mt.reason === 'host'
  return (
    <div className="mj mj--center">
      <div className="mj__wait">
        <div className="mj__pulse"><span><Icon name={connecting ? 'wifi' : byHost ? 'clock' : 'shield'} size={30} /></span></div>
        <h1>{connecting ? 'Ulanmoqda…' : byHost ? 'Ustoz hali darsni boshlamadi' : 'Ustoz ruxsatini kuting'}</h1>
        <p>{connecting ? 'Xona bilan aloqa o‘rnatilmoqda' : byHost
          ? `«${m.title}» ${m.startsAt > Date.now() ? `${fmtWhen(m.startsAt)} da boshlanadi` : 'tez orada boshlanadi'}. Ustoz kirishi bilan avtomatik ulanasiz.`
          : 'Siz kutish zalidasiz. Ustoz qabul qilgach, darsga avtomatik o‘tasiz.'}</p>
        <div className="mj__waitctl">
          <button type="button" className={cx('mt-ob', !mt.local.media.mic && 'is-off')} onClick={() => mt.actions.setMic(!mt.local.media.mic)}><Icon name={mt.local.media.mic ? 'mic' : 'micOff'} size={19} /></button>
          <button type="button" className={cx('mt-ob', !mt.local.media.cam && 'is-off')} onClick={() => mt.actions.setCam(!mt.local.media.cam)}><Icon name={mt.local.media.cam ? 'video' : 'videoOff'} size={19} /></button>
          <Btn onClick={() => mt.actions.leave()}>Chiqish</Btn>
        </div>
      </div>
    </div>
  )
}

/* ---------------- Yakuniy / xato ekranlari ---------------- */
function Screen({ icon, tone = 'blue', title, text, children, meeting }) {
  return (
    <div className="mj mj--center">
      <div className="mj__end">
        <span className={cx('mj__endic', `is-${tone}`)}><Icon name={icon} size={30} /></span>
        <h1>{title}</h1>
        {text && <p>{text}</p>}
        {meeting && <div className="mj__endm"><b>{meeting.title}</b><span>{meeting.hostName}{meeting.groupName ? ` · ${meeting.groupName}` : ''}</span></div>}
        <div className="mj__endbtns">{children}</div>
      </div>
    </div>
  )
}
