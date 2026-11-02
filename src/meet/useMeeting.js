// MeetingClient hodisalarini React holatiga aylantiruvchi hook.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { MeetingClient, LevelMeter, mediaErrorText } from './rtc.js'

let reactSeq = 0

export function useMeeting({ getTicket, onToast }) {
  const [status, setStatus] = useState('idle')        // idle | connecting | waiting | joined | reconnecting | ended | kicked | denied | replaced | failed | left
  const [reason, setReason] = useState(null)          // waiting / denied / ended sababi
  const [self, setSelf] = useState(null)
  const [peers, setPeers] = useState({})              // id → peer (+ stream)
  const [local, setLocal] = useState({ stream: null, camStream: null, media: { mic: true, cam: false, screen: false } })
  const [hand, setHandState] = useState(false)
  const [meeting, setMeeting] = useState(null)
  const [chat, setChat] = useState([])
  const [lobby, setLobby] = useState([])
  const [recording, setRecording] = useState(null)
  const [reactions, setReactions] = useState([])      // [{ key, from, emoji }]
  const [levels, setLevels] = useState({})
  const [conn, setConn] = useState({})                // id → RTCPeerConnectionState
  const clientRef = useRef(null)
  const meterRef = useRef(null)
  const toastRef = useRef(onToast)
  toastRef.current = onToast

  const upsertPeer = (id, patch) => setPeers((ps) => (ps[id] || patch.id ? { ...ps, [id]: { ...ps[id], ...patch } } : ps))

  const onEvent = useCallback((type, m) => {
    const toast = (text, tone) => toastRef.current?.(text, tone)
    switch (type) {
      case 'state':
        setStatus((s) => (['ended', 'kicked', 'denied', 'replaced', 'left', 'failed'].includes(s) ? s : m))
        break
      case 'fatal':
        setStatus('failed'); setReason(m.error?.message || 'Ulanib bo‘lmadi')
        break
      case 'local':
        setLocal(m)
        break
      case 'media-error':
        toast(mediaErrorText(m.kind, m.error), 'err')
        break
      case 'waiting':
        setReason(m.reason); setMeeting(m.meeting)
        break
      case 'welcome':
        setSelf(m.self)
        setMeeting(m.meeting)
        setChat(m.chat || [])
        setLobby(m.lobby || [])
        setRecording(m.recording)
        setHandState(false)
        setPeers(Object.fromEntries(m.peers.map((p) => [p.id, p])))
        if (m.forceMute) toast('Ustoz sozlamasiga ko‘ra mikrofoningiz o‘chirilgan holda kirdingiz')
        break
      case 'peer:join':
        setPeers((ps) => ({ ...ps, [m.id]: { ...ps[m.id], ...m } }))
        break
      case 'peer:leave':
        setPeers((ps) => { const n = { ...ps }; delete n[m.id]; return n })
        meterRef.current?.remove(m.id)
        break
      case 'peer:update':
        setPeers((ps) => (ps[m.id] ? { ...ps, [m.id]: { ...ps[m.id], media: m.media } } : ps))
        setSelf((s) => (s && s.id === m.id ? { ...s, media: m.media } : s))
        break
      case 'stream':
        upsertPeer(m.id, { stream: m.stream })
        meterRef.current?.set(m.id, m.stream)
        break
      case 'conn':
        setConn((c) => ({ ...c, [m.id]: m.state }))
        break
      case 'chat':
        setChat((c) => [...c, m.msg].slice(-300))
        break
      case 'react': {
        const key = ++reactSeq
        setReactions((r) => [...r, { key, from: m.from, emoji: m.emoji }])
        setTimeout(() => setReactions((r) => r.filter((x) => x.key !== key)), 4200)
        break
      }
      case 'lobby':
        setLobby((prev) => {
          if (m.waiting.length > prev.length) toast(`${m.waiting.at(-1).name} kutish zalida — ruxsat kutmoqda`)
          return m.waiting
        })
        break
      case 'meeting':
        setMeeting(m.meeting)
        break
      case 'rec':
        setRecording(m.recording)
        break
      case 'hand':
        setHandState(m)
        if (!m) toast('Ustoz qo‘lingizni tushirdi')
        break
      case 'notice':
        toast(m.text, m.tone)
        break
      case 'kicked':
        setStatus('kicked'); setReason(m.by)
        break
      case 'denied':
        setStatus('denied'); setReason(m.reason)
        break
      case 'ended':
        setStatus('ended'); setReason(m.reason)
        break
      case 'replaced':
        setStatus('replaced')
        break
      case 'error':
        if (m.message) toast(m.message, 'err')
        if (m.code === 'ticket') setStatus('failed')
        break
      default:
    }
  }, [])

  // Klient faqat bir marta yaratiladi
  if (!clientRef.current) clientRef.current = new MeetingClient({ getTicket: (...a) => getTicketRef.current(...a), onEvent })
  const getTicketRef = useRef(getTicket)
  getTicketRef.current = getTicket
  const client = clientRef.current

  useEffect(() => {
    meterRef.current = new LevelMeter()
    const t = setInterval(() => {
      const lv = meterRef.current.read()
      setLevels((prev) => {
        // Kichik o'zgarishlarda qayta chizmaymiz
        const keys = new Set([...Object.keys(prev), ...Object.keys(lv)])
        for (const k of keys) if (Math.abs((prev[k] || 0) - (lv[k] || 0)) > 0.04) return lv
        return prev
      })
    }, 150)
    return () => { clearInterval(t); meterRef.current?.close(); client.leave() }
  }, [client])

  // O'z ovozimiz darajasi (mikrofon indikatori uchun)
  useEffect(() => { meterRef.current?.set('self', local.media.mic ? local.stream : null) }, [local.stream, local.media.mic])

  const join = useCallback(async (opts) => {
    await client.initMedia(opts)
    setStatus('connecting')
    await client.connect()
  }, [client])

  const leave = useCallback(() => { client.leave(); setStatus('left') }, [client])

  const actions = useMemo(() => ({
    join,
    leave,
    setMic: (on) => client.setMic(on),
    setCam: (on) => client.setCam(on),
    switchDevice: (kind, id) => client.switchDevice(kind, id),
    startScreen: () => client.startScreen(),
    stopScreen: () => client.stopScreen(),
    setHand: (on) => { setHandState(on); client.setHand(on) },
    chat: (text) => client.chat(text),
    react: (emoji) => client.react(emoji),
    host: (action, payload) => client.host(action, payload),
  }), [client, join, leave])

  return { status, reason, self, peers, local, hand, meeting, chat, lobby, recording, reactions, levels, conn, actions, client }
}
