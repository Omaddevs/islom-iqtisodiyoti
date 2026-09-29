// Dars xonasi — Zoom uslubidagi jonli dars interfeysi.
// Hozircha video/audio oqimlari faqat o'z kamerangiz uchun (getUserMedia) ishlaydi;
// boshqa ishtirokchilar uchun WebRTC/SFU server ulanganda shu komponentga oqimlar beriladi.
import { useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '../store/auth.jsx'
import { add, patch } from '../store/db.js'
import { Icon, Btn, Badge, UAvatar, cx, useToast } from '../ui/kit.jsx'
import { fmtTime, fmtDuration, fmtWhen } from '../ui/format.js'
import { initials } from '../store/ids.js'

// Ishtirokchilar holati (demo): id asosida barqaror "tasodifiy" qiymatlar
const seedBool = (id, salt, p = 0.5) => {
  let h = 0; for (const c of id + salt) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return (h % 100) / 100 < p
}

function useCamera(enabled) {
  const [stream, setStream] = useState(null)
  const [error, setError] = useState(null)
  useEffect(() => {
    let s
    if (!enabled) { setStream(null); return }
    if (!navigator.mediaDevices?.getUserMedia) { setError('Kamera qo‘llab-quvvatlanmaydi'); return }
    navigator.mediaDevices.getUserMedia({ video: { width: 1280, height: 720 }, audio: false })
      .then((st) => { s = st; setStream(st); setError(null) })
      .catch(() => setError('Kameraga ruxsat berilmadi'))
    return () => { s?.getTracks().forEach((t) => t.stop()) }
  }, [enabled])
  return { stream, error }
}

function Video({ stream }) {
  const ref = useRef(null)
  useEffect(() => { if (ref.current) ref.current.srcObject = stream || null }, [stream])
  if (!stream) return null
  return <video ref={ref} autoPlay muted playsInline />
}

function Tile({ user, me, mic, cam, hand, stream, main, sharing, onClick, label }) {
  return (
    <div className={cx('tile', main ? 'tile--main' : 'tile--sm')} style={{ '--tc': user?.avatarColor }} onClick={onClick}>
      {sharing ? (
        <div className="tile__share">
          <div><Icon name="screen" size={44} /><b>{user?.name} ekranini ulashmoqda</b><span>Real ulanishda bu yerda ekran ko‘rinadi</span></div>
        </div>
      ) : cam && stream ? <Video stream={stream} /> : (
        <span className="tile__av">{initials(user?.name)}</span>
      )}
      {hand && <span className="tile__hand"><Icon name="hand" size={14} /> Qo‘l ko‘tardi</span>}
      <span className="tile__name">{!mic && <Icon name="micOff" size={13} />}{user?.name}{me ? ' (siz)' : ''}{label && <small style={{ opacity: .7 }}> · {label}</small>}</span>
      {main && (
        <div className="tile__badges">
          <span className={mic ? 'is-on' : 'is-off'}><Icon name={mic ? 'mic' : 'micOff'} size={16} /></span>
          <span className={cam ? 'is-on' : 'is-off'}><Icon name={cam ? 'video' : 'videoOff'} size={16} /></span>
        </div>
      )}
    </div>
  )
}

export default function MeetingRoom({ id }) {
  const { user, db } = useAuth()
  const toast = useToast()
  const m = db.meetings.find((x) => x.id === id)
  const g = m && db.groups.find((x) => x.id === m.groupId)
  const host = m && db.users.find((u) => u.id === m.hostId)
  const isHost = m?.hostId === user.id

  const [joined, setJoined] = useState(false)
  const [mic, setMic] = useState(true)
  const [cam, setCam] = useState(false)
  const [share, setShare] = useState(false)
  const [rec, setRec] = useState(false)
  const [hand, setHand] = useState(false)
  const [panel, setPanel] = useState(() => window.innerWidth > 1024) // mobil ekranda panel yopiq boshlanadi
  const [grid, setGrid] = useState(false)
  const [pinned, setPinned] = useState(null)
  const [notice, setNotice] = useState('')
  const [tick, setTick] = useState(Date.now())
  const { stream, error: camError } = useCamera(cam)

  useEffect(() => { const t = setInterval(() => setTick(Date.now()), 1000); return () => clearInterval(t) }, [])
  useEffect(() => { if (camError) { setCam(false); toast(camError, 'err') } }, [camError, toast])
  useEffect(() => { document.title = m ? `${m.title} — Dars xonasi` : 'Dars xonasi' }, [m])
  useEffect(() => { if (!notice) return; const t = setTimeout(() => setNotice(''), 2500); return () => clearTimeout(t) }, [notice])

  // Ishtirokchilar: ustoz + guruh o'quvchilari (demo holatlar bilan)
  const people = useMemo(() => {
    if (!g) return []
    const ids = [g.teacherId, ...g.studentIds].filter(Boolean)
    return ids.map((uid) => db.users.find((u) => u.id === uid)).filter(Boolean).map((u) => u.id === user.id
      ? { user: u, me: true, mic, cam, hand, stream, present: true }
      : { user: u, mic: seedBool(u.id, 'mic', .35), cam: seedBool(u.id, 'cam', .3), hand: seedBool(u.id, 'hand', .12), present: u.id === m.hostId || seedBool(u.id, 'in', .8) })
  }, [g, db.users, user.id, mic, cam, hand, stream, m])
  const present = people.filter((p) => p.present)
  const me = people.find((p) => p.me)
  const speaker = present.find((p) => p.user.id === (pinned || m?.hostId)) || present[0]
  const others = present.filter((p) => p !== speaker)
  const stripMax = 3
  const strip = others.slice(0, stripMax)
  const extra = others.length - strip.length

  const messages = db.messages.filter((x) => x.meetingId === id).sort((a, b) => a.at - b.at)
  const [text, setText] = useState('')
  const chatRef = useRef(null)
  useEffect(() => { chatRef.current?.scrollTo({ top: 1e9, behavior: 'smooth' }) }, [messages.length, joined])

  if (!m) return <div className="room__lobby"><div><h1>Dars topilmadi</h1><p>Havola noto‘g‘ri yoki dars o‘chirilgan.</p><br /><Btn as="a" href="#/platform/meetings" variant="primary">Darslar ro‘yxatiga</Btn></div></div>

  const startTs = m.startedAt || m.startsAt
  const elapsed = Math.max(0, Math.floor((tick - startTs) / 1000))
  const remaining = Math.max(0, m.durationMin * 60 - elapsed)

  const leave = () => { window.location.hash = '#/platform/meetings' }
  const startLesson = () => { patch('meetings', m.id, { status: 'live', startedAt: Date.now() }); setJoined(true) }
  const endLesson = () => {
    const recVideo = add('videos', { orgId: m.orgId, groupIds: [m.groupId], authorId: m.hostId, title: m.title, module: m.topic || 'Dars yozuvi', duration: Math.max(60, elapsed), thumb: g?.color || '#4aa3f8', description: m.description || '', views: 0, kind: 'recording' })
    patch('meetings', m.id, { status: 'ended', endedAt: Date.now(), recordingId: recVideo.id })
    toast('Dars yakunlandi. Yozuv video darslarga qo‘shildi')
    leave()
  }
  const send = (e) => {
    e.preventDefault()
    if (!text.trim()) return
    add('messages', { meetingId: id, userId: user.id, text: text.trim(), at: Date.now() })
    setText('')
  }
  const toggleShare = () => { setShare((v) => !v); setNotice(share ? 'Ekran ulashish to‘xtatildi' : 'Siz ekraningizni ulashyapsiz') }
  const toggleRec = () => { setRec((v) => !v); setNotice(rec ? 'Yozib olish to‘xtatildi' : 'Dars yozib olinmoqda') }
  const toggleHand = () => { setHand((v) => !v); if (!hand) add('messages', { meetingId: id, userId: user.id, text: '✋ qo‘l ko‘tardi', at: Date.now(), sys: true }) }

  /* ---------- Kutish xonasi (lobby) ---------- */
  if (!joined) {
    const notStarted = m.status === 'scheduled'
    const ended = m.status === 'ended'
    return (
      <div className="room__lobby">
        <div className="room__lobby-box">
          <div className="tile tile--main" style={{ '--tc': user.avatarColor, minHeight: 0 }}>
            {cam && stream ? <Video stream={stream} /> : <span className="tile__av">{initials(user.name)}</span>}
            <span className="tile__name">{!mic && <Icon name="micOff" size={13} />}{user.name}</span>
          </div>
          <div>
            <Badge tone={m.status === 'live' ? 'live' : ended ? 'gray' : 'blue'} dot={m.status === 'live'}>{m.status === 'live' ? 'Jonli dars ketmoqda' : ended ? 'Dars yakunlangan' : `Boshlanadi: ${fmtWhen(m.startsAt)}`}</Badge>
            <h1 style={{ marginTop: 12 }}>{m.title}</h1>
            <p>{g?.name} · {g?.course}<br />Ustoz: {host?.name} · {m.durationMin} daqiqa · {present.length} ishtirokchi</p>
            <div className="room__lobby-ctl">
              <button className={cx('rctl', !mic && 'is-off')} onClick={() => setMic((v) => !v)}><Icon name={mic ? 'mic' : 'micOff'} size={20} />{mic ? 'Mikrofon' : 'O‘chiq'}</button>
              <button className={cx('rctl', !cam && 'is-off')} onClick={() => setCam((v) => !v)}><Icon name={cam ? 'video' : 'videoOff'} size={20} />{cam ? 'Kamera' : 'O‘chiq'}</button>
            </div>
            <div className="room__lobby-btns">
              {ended ? (
                <>{m.recordingId && <Btn variant="primary" size="lg" icon="play" as="a" href={`#/platform/videos/${m.recordingId}`}>Yozuvni ko‘rish</Btn>}<Btn size="lg" onClick={leave} style={{ background: 'transparent', color: '#fff', borderColor: 'rgba(255,255,255,.2)' }}>Orqaga</Btn></>
              ) : notStarted && isHost ? (
                <><Btn variant="primary" size="lg" icon="play" onClick={startLesson}>Darsni boshlash</Btn><Btn size="lg" onClick={leave} style={{ background: 'transparent', color: '#fff', borderColor: 'rgba(255,255,255,.2)' }}>Orqaga</Btn></>
              ) : (
                <><Btn variant={m.status === 'live' ? 'live' : 'primary'} size="lg" icon="video" onClick={() => setJoined(true)}>{m.status === 'live' ? 'Darsga qo‘shilish' : 'Xonaga kirib kutish'}</Btn><Btn size="lg" onClick={leave} style={{ background: 'transparent', color: '#fff', borderColor: 'rgba(255,255,255,.2)' }}>Orqaga</Btn></>
              )}
            </div>
            {notStarted && !isHost && <p style={{ fontSize: 13, marginTop: 14 }}>Ustoz darsni boshlaganida avtomatik ulanasiz.</p>}
          </div>
        </div>
      </div>
    )
  }

  /* ---------- Dars xonasi ---------- */
  return (
    <div className="room">
      {notice && <div className="room__notice">{notice}</div>}
      <header className="room__top">
        <div>
          <h1>{m.title}</h1>
          <div className="room__sub"><span>{g?.name} · {g?.course}</span>{m.topic && <span>{m.topic}</span>}<span>{fmtTime(m.startsAt)} da</span>{rec && <span style={{ color: '#ff8a80' }}>● Yozilmoqda</span>}</div>
        </div>
        {m.status === 'live' ? (
          <div className="room__timer"><small>Qolgan vaqt</small><b>{fmtDuration(remaining)}</b></div>
        ) : (
          <div className="room__timer" style={{ color: 'rgba(255,255,255,.7)' }}><small>Dars boshlanmagan</small><b style={{ fontSize: 16 }}>{fmtWhen(m.startsAt)}</b></div>
        )}
      </header>

      <div className={cx('room__body', !panel && 'no-panel')}>
        <div className={cx('room__stage', grid && 'is-grid')}>
          {grid ? present.map((p) => (
            <Tile key={p.user.id} user={p.user} me={p.me} mic={p.mic} cam={p.cam} hand={p.hand} stream={p.stream} main onClick={() => { setPinned(p.user.id); setGrid(false) }} label={p.user.id === m.hostId ? 'ustoz' : undefined} />
          )) : (
            <>
              {speaker && <Tile user={speaker.user} me={speaker.me} mic={speaker.mic} cam={speaker.cam} hand={speaker.hand} stream={speaker.stream} main sharing={speaker.me && share} label={speaker.user.id === m.hostId ? 'ustoz' : undefined} />}
              <div className="room__strip">
                {strip.map((p) => <Tile key={p.user.id} user={p.user} me={p.me} mic={p.mic} cam={p.cam} hand={p.hand} stream={p.stream} onClick={() => setPinned(p.user.id)} />)}
                {extra > 0 && <div className="tile tile--sm tile--more" onClick={() => setGrid(true)}><b><Icon name="users" size={18} /> +{extra}</b></div>}
              </div>
            </>
          )}
        </div>

        {panel && (
          <aside className="room__panel">
            <section className="rpanel rpanel--people">
              <div className="rpanel__head"><h3>Ishtirokchilar</h3><Badge tone="blue">{present.length}</Badge><button onClick={() => setPanel(false)} aria-label="Yopish"><Icon name="x" size={16} /></button></div>
              <div className="rpanel__list">
                {present.map((p) => (
                  <div key={p.user.id} className="rperson">
                    <UAvatar user={p.user} size={30} />
                    <b>{p.user.name}{p.me && <small> (siz)</small>}{p.user.id === m.hostId && <small> · ustoz</small>}</b>
                    {p.hand && <span style={{ color: '#d97706' }}><Icon name="hand" size={15} /></span>}
                    <span className={p.mic ? 'is-on' : 'is-off'}><Icon name={p.mic ? 'mic' : 'micOff'} size={15} /></span>
                    <span className={p.cam ? 'is-on' : 'is-off'}><Icon name={p.cam ? 'video' : 'videoOff'} size={15} /></span>
                  </div>
                ))}
              </div>
            </section>
            <section className="rpanel rpanel--chat">
              <div className="rpanel__head"><h3>Chat</h3><Badge tone="blue">{messages.length}</Badge></div>
              <div className="rchat__list" ref={chatRef}>
                {messages.length === 0 && <div className="rmsg__sys">Chat bo‘sh. Birinchi bo‘lib yozing!</div>}
                {messages.map((msg) => {
                  const u = db.users.find((x) => x.id === msg.userId)
                  if (msg.sys) return <div key={msg.id} className="rmsg__sys">{u?.name} {msg.text}</div>
                  const mine = msg.userId === user.id
                  return (
                    <div key={msg.id} className={cx('rmsg', mine && 'is-me')}>
                      <UAvatar user={u} size={30} />
                      <div className="rmsg__body">
                        <div className="rmsg__meta"><b>{mine ? 'Siz' : u?.name}</b><span>{fmtTime(msg.at)}</span></div>
                        <div className="rmsg__text">{msg.text}</div>
                      </div>
                    </div>
                  )
                })}
              </div>
              <form className="rchat__form" onSubmit={send}>
                <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Xabar yozing…" />
                <button type="submit" aria-label="Yuborish"><Icon name="send" size={17} /></button>
              </form>
            </section>
          </aside>
        )}
      </div>

      <footer className="room__bar">
        <button className={cx('rctl', !mic && 'is-off')} onClick={() => setMic((v) => !v)}><Icon name={mic ? 'mic' : 'micOff'} size={20} />{mic ? 'Mikrofon' : 'Ovozsiz'}</button>
        <button className={cx('rctl', !cam && 'is-off')} onClick={() => setCam((v) => !v)}><Icon name={cam ? 'video' : 'videoOff'} size={20} />{cam ? 'Kamera' : 'Kamera o‘chiq'}</button>
        <button className={cx('rctl', share && 'is-on')} onClick={toggleShare}><Icon name="screen" size={20} />Ekran</button>
        {isHost && <button className={cx('rctl', rec && 'is-rec')} onClick={toggleRec}><Icon name="record" size={20} />{rec ? 'Yozilmoqda' : 'Yozib olish'}</button>}
        {!isHost && <button className={cx('rctl', hand && 'is-on')} onClick={toggleHand}><Icon name="hand" size={20} />{hand ? 'Qo‘l tushirish' : 'Qo‘l ko‘tarish'}</button>}
        <span className="sep" />
        <button className={cx('rctl', panel && 'is-on')} onClick={() => setPanel((v) => !v)}><Icon name="message" size={20} />Chat</button>
        <button className={cx('rctl', grid && 'is-on')} onClick={() => setGrid((v) => !v)}><Icon name="layoutGrid" size={20} />{grid ? 'Ma’ruzachi' : 'Hammasi'}</button>
        <span className="sep" />
        {isHost && m.status === 'live' ? (
          <button className="rctl rctl--leave" onClick={endLesson}><Icon name="phoneOff" size={20} />Yakunlash</button>
        ) : (
          <button className="rctl rctl--leave" onClick={leave}><Icon name="phoneOff" size={20} />Chiqish</button>
        )}
        {isHost && m.status === 'scheduled' && <button className="rctl is-on" onClick={startLesson} style={{ width: 96 }}><Icon name="play" size={20} />Boshlash</button>}
      </footer>
    </div>
  )
}
