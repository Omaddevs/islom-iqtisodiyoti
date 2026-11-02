// Dars xonasining real vaqt yadrosi (React'dan mustaqil).
//
//  • WebSocket — signaling va xona holati (backend/realtime/hub.js)
//  • WebRTC mesh — har bir ishtirokchi bilan to'g'ridan-to'g'ri P2P ulanish
//
// Ulanish qoidasi: yangi kirgan ishtirokchi mavjudlarga offer yuboradi ("impolite"),
// mavjudlar javob beradi ("polite"). Har bir ulanishda qat'iy 2 ta transceiver bor:
// [0] audio, [1] video. Kamera ↔ ekran almashinuvi replaceTrack orqali — qayta kelishuvsiz.
import { wsUrl } from '../platform/api/client.js'

const RECONNECT_DELAYS = [500, 1000, 2000, 4000, 8000]

// Ishtirokchilar soniga qarab video sifatini moslash (mesh'da upload yuklamasi N-1 barobar)
const videoBitrate = (n, screen) => screen ? 1_500_000 : n <= 2 ? 1_200_000 : n <= 4 ? 700_000 : n <= 7 ? 400_000 : 250_000

export class MeetingClient {
  constructor({ getTicket, onEvent }) {
    this.getTicket = getTicket          // async () => { ticket, iceServers }
    this.emit = onEvent                  // (type, payload) => void
    this.ws = null
    this.selfId = null
    this.iceServers = []
    this.pcs = new Map()                 // peerId → { pc, stream, polite, makingOffer, ignoreOffer, pendingIce }
    this.local = { audio: null, video: null, screen: null }
    this.media = { mic: true, cam: false }
    this.closed = false
    this.attempt = 0
    this.state = 'idle'
  }

  // ---------- Mahalliy media ----------
  async initMedia({ mic, cam, audioDeviceId, videoDeviceId }) {
    this.media = { mic, cam }
    this.devices = { audioDeviceId, videoDeviceId }
    // Mikrofon trekini doim olamiz (o'chiq bo'lsa ham enabled=false) — keyin yoqish tez bo'ladi
    try { this.local.audio = await this.getAudio() } catch (e) { this.media.mic = false; this.emit('media-error', { kind: 'mic', error: e }) }
    if (this.local.audio) this.local.audio.enabled = mic
    if (cam) {
      try { this.local.video = await this.getVideo() } catch (e) { this.media.cam = false; this.emit('media-error', { kind: 'cam', error: e }) }
    }
    this.emitLocal()
  }

  async getAudio() {
    const s = await navigator.mediaDevices.getUserMedia({
      audio: { deviceId: this.devices?.audioDeviceId ? { exact: this.devices.audioDeviceId } : undefined, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    })
    return s.getAudioTracks()[0]
  }

  async getVideo() {
    const s = await navigator.mediaDevices.getUserMedia({
      video: { deviceId: this.devices?.videoDeviceId ? { exact: this.devices.videoDeviceId } : undefined, width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 24, max: 30 } },
    })
    return s.getVideoTracks()[0]
  }

  localStream() {
    const tracks = [this.local.audio, this.local.screen || this.local.video].filter(Boolean)
    return tracks.length ? new MediaStream(tracks) : null
  }
  emitLocal() {
    this.emit('local', { stream: this.localStream(), camStream: this.local.video ? new MediaStream([this.local.video]) : null, media: { ...this.media, screen: !!this.local.screen } })
  }

  // ---------- Signaling ----------
  async connect() {
    this.closed = false
    this.setState(this.attempt ? 'reconnecting' : 'connecting')
    let t
    try { t = await this.getTicket() } catch (e) {
      if (e.status && e.status !== 0) { this.setState('failed'); return this.emit('fatal', { error: e }) }
      return this.scheduleReconnect()
    }
    this.iceServers = t.iceServers || []
    const ws = new WebSocket(wsUrl(`/ws?ticket=${encodeURIComponent(t.ticket)}`))
    this.ws = ws
    ws.onmessage = (e) => { try { this.onMessage(JSON.parse(e.data)) } catch (err) { console.error('[meet]', err) } }
    ws.onclose = (e) => {
      if (this.ws !== ws) return
      this.teardownPeers()
      if (this.closed) return
      // 4000+ — server ataylab yopgan (tugadi, chiqarildi, ...): qayta ulanmaymiz
      if (e.code >= 4000 && e.code < 4400) return
      this.scheduleReconnect()
    }
    ws.onerror = () => {}
    this.pingTimer = setInterval(() => this.send({ t: 'ping' }), 20_000)
  }

  scheduleReconnect() {
    clearInterval(this.pingTimer)
    if (this.closed) return
    const delay = RECONNECT_DELAYS[Math.min(this.attempt, RECONNECT_DELAYS.length - 1)]
    this.attempt++
    this.setState('reconnecting')
    this.retryTimer = setTimeout(() => this.connect(), delay)
  }

  setState(s) { this.state = s; this.emit('state', s) }
  send(msg) { if (this.ws?.readyState === 1) this.ws.send(JSON.stringify(msg)) }

  onMessage(m) {
    switch (m.t) {
      case 'hello':
        this.selfId = m.id
        this.send({ t: 'join', media: { mic: this.media.mic, cam: this.media.cam } })
        break
      case 'waiting':
        this.setState('waiting')
        this.emit('waiting', m)
        break
      case 'welcome':
        this.attempt = 0
        this.setState('joined')
        if (m.forceMute) this.setMic(false, { silent: true })
        this.emit('welcome', m)
        // Yangi kirgan — mavjud har bir ishtirokchiga offer yuboradi
        for (const p of m.peers) this.createPeer(p.id, { initiator: true })
        this.sendMedia()
        break
      case 'peer:join':
        this.createPeer(m.peer.id, { initiator: false })
        this.emit('peer:join', m.peer)
        break
      case 'peer:leave':
        this.closePeer(m.id)
        this.emit('peer:leave', m)
        break
      case 'signal':
        this.onSignal(m.from, m.data)
        break
      case 'muted':
        this.setMic(false)
        this.emit('notice', { text: `${m.by} mikrofoningizni o‘chirdi`, tone: 'warn' })
        break
      case 'hand:lower':
        this.emit('hand', false)
        break
      case 'share:stop':
        if (this.local.screen) { this.stopScreen(); this.emit('notice', { text: `${m.by} ekran ulashishni to‘xtatdi` }) }
        break
      default:
        this.emit(m.t, m)
    }
  }

  // ---------- WebRTC ----------
  createPeer(id, { initiator }) {
    if (this.pcs.has(id)) this.closePeer(id)
    const pc = new RTCPeerConnection({ iceServers: this.iceServers, bundlePolicy: 'max-bundle' })
    const entry = { pc, stream: new MediaStream(), polite: !initiator, makingOffer: false, ignoreOffer: false, pendingIce: [], initiator }
    this.pcs.set(id, entry)

    if (initiator) {
      pc.addTransceiver('audio', { direction: 'sendrecv' })
      pc.addTransceiver('video', { direction: 'sendrecv' })
      this.attachLocal(entry)
    }

    pc.ontrack = (e) => {
      const s = entry.stream
      s.getTracks().filter((t) => t.kind === e.track.kind).forEach((t) => s.removeTrack(t))
      s.addTrack(e.track)
      // Yangi MediaStream obyekti — React video elementini yangilashi uchun
      entry.stream = new MediaStream(s.getTracks())
      this.emit('stream', { id, stream: entry.stream })
      e.track.onunmute = () => this.emit('stream', { id, stream: entry.stream })
    }
    pc.onicecandidate = (e) => { if (e.candidate) this.send({ t: 'signal', to: id, data: { candidate: e.candidate } }) }
    pc.onnegotiationneeded = async () => {
      if (!entry.initiator) return // javob beruvchi tomon offer boshlamaydi
      try {
        entry.makingOffer = true
        await pc.setLocalDescription()
        this.send({ t: 'signal', to: id, data: { description: pc.localDescription } })
      } catch (err) { console.warn('[meet] offer', err) } finally { entry.makingOffer = false }
    }
    pc.onconnectionstatechange = () => {
      this.emit('conn', { id, state: pc.connectionState })
      if (pc.connectionState === 'failed' && entry.initiator) pc.restartIce()
    }
    return entry
  }

  attachLocal(entry) {
    const [a, v] = entry.pc.getTransceivers()
    a?.sender.replaceTrack(this.local.audio || null)
    v?.sender.replaceTrack(this.local.screen || this.local.video || null)
    this.tuneBitrate(entry)
  }

  tuneBitrate(entry) {
    const v = entry.pc.getTransceivers()[1]
    if (!v?.sender) return
    const params = v.sender.getParameters()
    if (!params.encodings?.length) return
    params.encodings[0].maxBitrate = videoBitrate(this.pcs.size + 1, !!this.local.screen)
    v.sender.setParameters(params).catch(() => {})
  }

  async onSignal(from, { description, candidate }) {
    let entry = this.pcs.get(from)
    if (!entry) entry = this.createPeer(from, { initiator: false })
    const { pc } = entry
    try {
      if (description) {
        const collision = description.type === 'offer' && (entry.makingOffer || pc.signalingState !== 'stable')
        entry.ignoreOffer = !entry.polite && collision
        if (entry.ignoreOffer) return
        await pc.setRemoteDescription(description)
        if (description.type === 'offer') {
          // Javob beruvchi: offer bilan kelgan transceiver'larni ikki tomonlama qilib, o'z treklarimizni ulaymiz
          for (const t of pc.getTransceivers()) if (t.direction !== 'stopped') t.direction = 'sendrecv'
          this.attachLocal(entry)
          await pc.setLocalDescription()
          this.send({ t: 'signal', to: from, data: { description: pc.localDescription } })
        }
        for (const c of entry.pendingIce.splice(0)) await pc.addIceCandidate(c).catch(() => {})
      } else if (candidate) {
        if (!pc.remoteDescription) entry.pendingIce.push(candidate)
        else await pc.addIceCandidate(candidate).catch((e) => { if (!entry.ignoreOffer) throw e })
      }
    } catch (e) {
      console.warn('[meet] signal', e)
    }
  }

  closePeer(id) {
    const e = this.pcs.get(id)
    if (!e) return
    e.pc.close()
    this.pcs.delete(id)
    this.pcs.forEach((x) => this.tuneBitrate(x))
  }
  teardownPeers() { for (const id of [...this.pcs.keys()]) this.closePeer(id) }

  replaceVideo(track) {
    for (const e of this.pcs.values()) {
      e.pc.getTransceivers()[1]?.sender.replaceTrack(track || null).catch(() => {})
      this.tuneBitrate(e)
    }
  }
  replaceAudio(track) {
    for (const e of this.pcs.values()) e.pc.getTransceivers()[0]?.sender.replaceTrack(track || null).catch(() => {})
  }

  // ---------- Boshqaruv ----------
  sendMedia(extra = {}) {
    this.send({ t: 'media', mic: this.media.mic, cam: this.media.cam, screen: !!this.local.screen, ...extra })
  }

  async setMic(on, { silent } = {}) {
    if (on && !this.local.audio) {
      try { this.local.audio = await this.getAudio(); this.replaceAudio(this.local.audio) } catch (e) { this.emit('media-error', { kind: 'mic', error: e }); return }
    }
    if (this.local.audio) this.local.audio.enabled = on
    this.media.mic = on
    if (!silent || this.state === 'joined') this.sendMedia()
    this.emitLocal()
  }

  async setCam(on) {
    if (on) {
      try { this.local.video = await this.getVideo() } catch (e) { this.emit('media-error', { kind: 'cam', error: e }); return }
      if (!this.local.screen) this.replaceVideo(this.local.video)
    } else {
      // Trekni to'xtatamiz — kamera chirog'i o'chadi
      this.local.video?.stop()
      this.local.video = null
      if (!this.local.screen) this.replaceVideo(null)
    }
    this.media.cam = on
    this.sendMedia()
    this.emitLocal()
  }

  async switchDevice(kind, deviceId) {
    this.devices = { ...this.devices, [kind === 'audio' ? 'audioDeviceId' : 'videoDeviceId']: deviceId }
    try {
      if (kind === 'audio' && this.local.audio) {
        const enabled = this.local.audio.enabled
        this.local.audio.stop()
        this.local.audio = await this.getAudio()
        this.local.audio.enabled = enabled
        this.replaceAudio(this.local.audio)
      }
      if (kind === 'video' && this.local.video) {
        this.local.video.stop()
        this.local.video = await this.getVideo()
        if (!this.local.screen) this.replaceVideo(this.local.video)
      }
    } catch (e) { this.emit('media-error', { kind: kind === 'audio' ? 'mic' : 'cam', error: e }) }
    this.emitLocal()
  }

  async startScreen() {
    if (!navigator.mediaDevices?.getDisplayMedia) throw new Error('unsupported')
    const s = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: { ideal: 15, max: 30 } }, audio: false })
    const track = s.getVideoTracks()[0]
    track.contentHint = 'detail'
    track.onended = () => this.stopScreen() // brauzerning "Ulashishni to'xtatish" tugmasi
    this.local.screen = track
    this.replaceVideo(track)
    this.sendMedia()
    this.emitLocal()
  }

  stopScreen() {
    if (!this.local.screen) return
    this.local.screen.onended = null
    this.local.screen.stop()
    this.local.screen = null
    this.replaceVideo(this.local.video)
    this.sendMedia()
    this.emitLocal()
  }

  setHand(on) { this.send({ t: 'media', hand: on }) }
  chat(text) { this.send({ t: 'chat', text }) }
  react(emoji) { this.send({ t: 'react', emoji }) }
  host(action, payload = {}) { this.send({ t: `host:${action}`, ...payload }) }

  leave() {
    this.closed = true
    clearTimeout(this.retryTimer)
    clearInterval(this.pingTimer)
    const ws = this.ws
    this.ws = null
    ws?.close(1000, 'leave')
    this.teardownPeers()
    for (const t of Object.values(this.local)) t?.stop()
    this.local = { audio: null, video: null, screen: null }
  }
}

// ---------- Yordamchilar ----------

// Ovoz darajasi: bir nechta oqimni bitta AudioContext bilan kuzatadi → { id: 0..1 }
export class LevelMeter {
  constructor() {
    this.ctx = null
    this.nodes = new Map()
  }
  ensure() {
    if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)()
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {})
    return this.ctx
  }
  set(id, stream) {
    const track = stream?.getAudioTracks()[0]
    const cur = this.nodes.get(id)
    if (cur?.trackId === track?.id) return
    this.remove(id)
    if (!track) return
    const ctx = this.ensure()
    const src = ctx.createMediaStreamSource(new MediaStream([track]))
    const an = ctx.createAnalyser()
    an.fftSize = 512
    an.smoothingTimeConstant = 0.6
    src.connect(an)
    this.nodes.set(id, { src, an, buf: new Uint8Array(an.fftSize), trackId: track.id })
  }
  remove(id) {
    const n = this.nodes.get(id)
    if (!n) return
    n.src.disconnect()
    this.nodes.delete(id)
  }
  read() {
    const out = {}
    for (const [id, n] of this.nodes) {
      n.an.getByteTimeDomainData(n.buf)
      let sum = 0
      for (let i = 0; i < n.buf.length; i++) { const v = (n.buf[i] - 128) / 128; sum += v * v }
      out[id] = Math.min(1, Math.sqrt(sum / n.buf.length) * 4)
    }
    return out
  }
  close() { for (const id of [...this.nodes.keys()]) this.remove(id); this.ctx?.close().catch(() => {}) }
}

// Dars yozuvi → webm. Ikki rejim:
//  - sahna: asosiy video canvasga chiziladi;
//  - ekran (display): getDisplayMedia oqimi to'g'ridan-to'g'ri yoziladi.
// Ikkalasida ham barcha ishtirokchilar ovozi aralashtiriladi.
export class StageRecorder {
  constructor() { this.chunks = []; this.startedAt = 0 }

  start({ getFrame, audioStreams, display, onEnded }) {
    this.ctx = new (window.AudioContext || window.webkitAudioContext)()
    this.dest = this.ctx.createMediaStreamDestination()
    this.sources = new Map()
    this.syncAudio(audioStreams)

    if (display) {
      this.display = display
      // Tab/tizim ovozi ham bo'lsa — aralashmaga qo'shamiz
      if (display.getAudioTracks()[0]) this.ctx.createMediaStreamSource(new MediaStream(display.getAudioTracks())).connect(this.dest)
      // Brauzerning «Ulashishni to'xtatish» tugmasi bosilsa — yozuvni yakunlaymiz
      display.getVideoTracks()[0]?.addEventListener('ended', () => onEnded?.())
      return this.record(new MediaStream([...display.getVideoTracks(), ...this.dest.stream.getAudioTracks()]))
    }

    const canvas = document.createElement('canvas')
    canvas.width = 1280
    canvas.height = 720
    const g = canvas.getContext('2d')

    const draw = () => {
      const f = getFrame() // { video?: HTMLVideoElement, name, color, initials }
      g.fillStyle = '#0f1b2d'
      g.fillRect(0, 0, 1280, 720)
      if (f?.video && f.video.readyState >= 2 && f.video.videoWidth) {
        const { videoWidth: w, videoHeight: h } = f.video
        const k = Math.min(1280 / w, 720 / h)
        g.drawImage(f.video, (1280 - w * k) / 2, (720 - h * k) / 2, w * k, h * k)
      } else if (f) {
        g.fillStyle = f.color || '#4aa3f8'
        g.beginPath(); g.arc(640, 330, 90, 0, Math.PI * 2); g.fill()
        g.fillStyle = '#fff'; g.font = '700 64px Inter, system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'
        g.fillText(f.initials || '', 640, 334)
      }
      if (f?.name) {
        g.font = '600 24px Inter, system-ui, sans-serif'; g.textAlign = 'left'; g.textBaseline = 'alphabetic'
        const w = g.measureText(f.name).width + 32
        g.fillStyle = 'rgba(0,0,0,.5)'; g.beginPath(); g.roundRect(24, 720 - 72, w, 48, 12); g.fill()
        g.fillStyle = '#fff'; g.fillText(f.name, 40, 720 - 40)
      }
    }
    // requestAnimationFrame fon oynada to'xtaydi — taymer ishonchliroq
    this.timer = setInterval(draw, 1000 / 24)
    draw()
    this.record(new MediaStream([...canvas.captureStream(24).getVideoTracks(), ...this.dest.stream.getAudioTracks()]))
  }

  record(stream) {
    const mime = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'].find((t) => MediaRecorder.isTypeSupported(t)) || ''
    this.rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 2_500_000 })
    this.rec.ondataavailable = (e) => { if (e.data.size) this.chunks.push(e.data) }
    this.rec.start(1000)
    this.startedAt = Date.now()
  }

  syncAudio(streams) {
    if (!this.ctx) return
    for (const [key, s] of Object.entries(streams)) {
      const track = s?.getAudioTracks()[0]
      const cur = this.sources.get(key)
      if (cur?.trackId === track?.id) continue
      cur?.node.disconnect()
      this.sources.delete(key)
      if (track) {
        const node = this.ctx.createMediaStreamSource(new MediaStream([track]))
        node.connect(this.dest)
        this.sources.set(key, { node, trackId: track.id })
      }
    }
  }

  stop() {
    return new Promise((resolve) => {
      clearInterval(this.timer)
      this.display?.getTracks().forEach((t) => t.stop())
      if (!this.rec || this.rec.state === 'inactive') return resolve(null)
      this.rec.onstop = () => {
        const blob = new Blob(this.chunks, { type: (this.rec.mimeType || 'video/webm').split(';')[0] })
        this.ctx?.close().catch(() => {})
        resolve({ blob, duration: (Date.now() - this.startedAt) / 1000 })
      }
      this.rec.stop()
    })
  }
}

export async function listDevices() {
  try {
    const all = await navigator.mediaDevices.enumerateDevices()
    return {
      audio: all.filter((d) => d.kind === 'audioinput' && d.deviceId),
      video: all.filter((d) => d.kind === 'videoinput' && d.deviceId),
      output: all.filter((d) => d.kind === 'audiooutput' && d.deviceId),
    }
  } catch { return { audio: [], video: [], output: [] } }
}

export const mediaErrorText = (kind, e) => {
  const what = kind === 'mic' ? 'Mikrofon' : 'Kamera'
  if (e?.name === 'NotAllowedError') return `${what}ga ruxsat berilmadi. Brauzer manzil satridagi qulf belgisidan ruxsat bering`
  if (e?.name === 'NotFoundError') return `${what} topilmadi`
  if (e?.name === 'NotReadableError') return `${what} boshqa dastur tomonidan band`
  return `${what}ni yoqib bo‘lmadi`
}
