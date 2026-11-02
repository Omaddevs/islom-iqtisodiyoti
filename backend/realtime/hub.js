// Dars xonalari hub'i: WebSocket orqali signaling (WebRTC offer/answer/ICE), ishtirokchilar holati,
// kutish zali, chat, reaksiyalar va host boshqaruvi.
//
// Media oqimlari serverdan o'tmaydi — brauzerlar o'zaro P2P (mesh) ulanadi. Server faqat
// kim bilan kim ulanishini va xona holatini boshqaradi.
//
// Protokol: har bir xabar JSON, `t` maydoni turini bildiradi.
//   mijoz → server: join, signal, media, chat, react, host:* , ping
//   server → mijoz: welcome, waiting, peer:join, peer:leave, peer:update, signal, chat, react,
//                   lobby, meeting, muted, share:stop, rec, kicked, denied, ended, replaced, error, pong
import { randomUUID } from 'node:crypto'
import { verifyRoomTicket } from '../lib/tickets.js'
import { getMeeting } from '../lib/meetings.js'
import * as store from './store.js'

const MAX_PEERS = 100          // bitta xonada (mesh uchun amalda ~12 gacha kamerali qulay)
const CHAT_LIMIT = { n: 8, ms: 5000 }
const REACTIONS = new Set(['👍', '👏', '❤️', '😂', '😮', '🎉', '🤲', '✋'])

const send = (ws, msg) => { if (ws.readyState === 1) ws.send(JSON.stringify(msg)) }

const publicPeer = (p) => ({
  id: p.id, userId: p.userId, name: p.name, color: p.color, role: p.role, guest: p.guest,
  media: p.media, joinedAt: p.joinedAt,
})

const publicMeeting = (m) => ({
  id: m.id, code: m.code, title: m.title, topic: m.topic, status: m.status, startsAt: m.starts_at, startedAt: m.started_at,
  durationMin: m.duration_min, hostId: m.host_id, hostName: m.host_name, groupName: m.group_name, groupCourse: m.group_course,
  locked: m.locked, waitingRoom: m.waiting_room, allowGuests: m.allow_guests, muteOnEntry: m.mute_on_entry,
  invitedCount: m.invited_count ?? 0, hasPasscode: !!m.passcode,
})

class Room {
  constructor(meeting) {
    this.id = meeting.id
    this.meeting = meeting
    this.peers = new Map()    // qabul qilinganlar
    this.waiting = new Map()  // kutish zalidagilar
    this.recording = null     // { by, since }
  }
  get hosts() { return [...this.peers.values()].filter((p) => p.role === 'host') }
  broadcast(msg, exceptId) { for (const p of this.peers.values()) if (p.id !== exceptId) send(p.ws, msg) }
  toHosts(msg) { for (const p of this.hosts) send(p.ws, msg) }
  lobbyList() { return [...this.waiting.values()].filter((p) => p.waitReason === 'approval').map((p) => ({ ...publicPeer(p), since: p.waitSince })) }
  pushLobby() { this.toHosts({ t: 'lobby', waiting: this.lobbyList() }) }
}

export function createHub({ allowedOrigins, log = console }) {
  const rooms = new Map()

  const roomFor = async (meetingId) => {
    let r = rooms.get(meetingId)
    if (r) return r
    const m = await getMeeting(meetingId)
    if (!m) return null
    r = rooms.get(meetingId) || new Room(m) // parallel ulanishlarda ikki marta yaratilmasin
    rooms.set(meetingId, r)
    return r
  }
  const dropIfEmpty = (r) => { if (!r.peers.size && !r.waiting.size) rooms.delete(r.id) }

  // ---- Qabul qilish ----
  async function admit(r, p) {
    r.waiting.delete(p.id)
    r.peers.set(p.id, p)
    p.state = 'in'
    p.joinedAt = Date.now()
    if (r.meeting.mute_on_entry && p.role !== 'host') p.media.mic = false
    try { p.attendanceId = await store.attendanceOpen(r.id, p) } catch (e) { log.error('[hub] attendance', e) }
    if (p.ws.readyState !== 1) return leave(r, p) // kutish paytida uzilib qolgan bo'lishi mumkin
    const chat = await store.recentMessages(r.id).catch(() => [])
    send(p.ws, {
      t: 'welcome',
      self: publicPeer(p),
      peers: [...r.peers.values()].filter((x) => x.id !== p.id).map(publicPeer),
      meeting: publicMeeting(r.meeting),
      chat,
      recording: r.recording,
      forceMute: r.meeting.mute_on_entry && p.role !== 'host',
      ...(p.role === 'host' ? { lobby: r.lobbyList() } : {}),
    })
    r.broadcast({ t: 'peer:join', peer: publicPeer(p) }, p.id)
  }

  function wait(r, p, reason) {
    p.state = 'waiting'
    p.waitReason = reason
    p.waitSince = p.waitSince || Date.now()
    r.waiting.set(p.id, p)
    send(p.ws, { t: 'waiting', reason, meeting: publicMeeting(r.meeting) })
    if (reason === 'approval') r.pushLobby()
  }

  const needsApproval = (r, p) => r.meeting.waiting_room && !p.member && p.role !== 'host'

  // Kutayotganlarni qayta ko'rib chiqish (host keldi / dars boshlandi / sozlama o'zgardi)
  async function release(r) {
    const live = r.meeting.status === 'live'
    const hostHere = r.hosts.length > 0
    for (const p of [...r.waiting.values()]) {
      if (!live) continue
      if (needsApproval(r, p)) {
        if (p.waitReason !== 'approval') wait(r, p, 'approval')
      } else {
        await admit(r, p)
      }
    }
    if (hostHere) r.pushLobby()
  }

  async function join(r, p) {
    // Bir foydalanuvchi ikkinchi oynadan kirsa — eskisini yopamiz (qayta ulanishda "arvoh" qolmasin)
    if (p.userId) {
      for (const old of [...r.peers.values(), ...r.waiting.values()]) {
        if (old.userId === p.userId && old.id !== p.id) { send(old.ws, { t: 'replaced' }); leave(r, old); old.ws.close(4001, 'replaced') }
      }
    }
    if (r.meeting.status === 'ended') { send(p.ws, { t: 'ended', reason: 'ended' }); return p.ws.close(4000, 'ended') }
    if (r.meeting.locked && p.role !== 'host') { send(p.ws, { t: 'denied', reason: 'locked' }); return p.ws.close(4003, 'locked') }
    if (r.peers.size >= MAX_PEERS) { send(p.ws, { t: 'denied', reason: 'full' }); return p.ws.close(4003, 'full') }

    if (p.role === 'host') {
      if (r.meeting.status !== 'live') {
        await store.markLive(r.id)
        r.meeting = (await getMeeting(r.id)) || r.meeting
      }
      await admit(r, p)
      r.broadcast({ t: 'meeting', meeting: publicMeeting(r.meeting) }, p.id)
      return release(r)
    }
    if (r.meeting.status !== 'live') return wait(r, p, 'host')
    if (needsApproval(r, p)) return wait(r, p, 'approval')
    return admit(r, p)
  }

  function leave(r, p) {
    if (p.state === 'gone') return
    const wasIn = p.state === 'in'
    p.state = 'gone'
    r.peers.delete(p.id)
    r.waiting.delete(p.id)
    store.attendanceClose(p.attendanceId).catch(() => {})
    if (wasIn) {
      r.broadcast({ t: 'peer:leave', id: p.id })
      if (r.recording?.by === p.id) { r.recording = null; r.broadcast({ t: 'rec', recording: null }) }
    } else if (p.waitReason === 'approval') {
      r.pushLobby()
    }
    dropIfEmpty(r)
  }

  // ---- Xabarlarni qayta ishlash ----
  const handlers = {
    signal(r, p, m) {
      const to = r.peers.get(m.to)
      if (!to || p.state !== 'in') return
      send(to.ws, { t: 'signal', from: p.id, data: m.data })
    },
    media(r, p, m) {
      if (p.state !== 'in') return
      const next = {}
      for (const k of ['mic', 'cam', 'screen', 'hand']) if (typeof m[k] === 'boolean') next[k] = m[k]
      // Ekranni bir vaqtda faqat bitta odam ulashadi: yangisi eskisini almashtiradi
      if (next.screen) {
        for (const o of r.peers.values()) {
          if (o.id !== p.id && o.media.screen) { o.media.screen = false; send(o.ws, { t: 'share:stop', by: p.name }); r.broadcast({ t: 'peer:update', id: o.id, media: o.media }) }
        }
      }
      Object.assign(p.media, next)
      r.broadcast({ t: 'peer:update', id: p.id, media: p.media })
    },
    async chat(r, p, m) {
      if (p.state !== 'in') return
      const text = String(m.text || '').trim().slice(0, 2000)
      if (!text) return
      const now = Date.now()
      p.chatTimes = (p.chatTimes || []).filter((t) => now - t < CHAT_LIMIT.ms)
      if (p.chatTimes.length >= CHAT_LIMIT.n) return send(p.ws, { t: 'error', code: 'slow', message: 'Juda tez yozyapsiz' })
      p.chatTimes.push(now)
      const msg = await store.saveMessage(r.id, { userId: p.userId, name: p.name, text })
      r.broadcast({ t: 'chat', msg: { ...msg, peerId: p.id, color: p.color } })
    },
    react(r, p, m) {
      if (p.state !== 'in' || !REACTIONS.has(m.emoji)) return
      r.broadcast({ t: 'react', from: p.id, emoji: m.emoji })
    },
  }

  const hostHandlers = {
    async admit(r, _p, m) {
      const ids = m.all ? [...r.waiting.keys()] : [m.id]
      for (const id of ids) { const w = r.waiting.get(id); if (w && w.waitReason === 'approval') await admit(r, w) }
      r.pushLobby()
    },
    deny(r, _p, m) {
      const w = r.waiting.get(m.id)
      if (!w) return
      send(w.ws, { t: 'denied', reason: 'host' })
      leave(r, w)
      w.ws.close(4003, 'denied')
    },
    mute(r, p, m) {
      const targets = m.all ? [...r.peers.values()].filter((x) => x.role !== 'host') : [r.peers.get(m.id)].filter(Boolean)
      for (const t of targets) send(t.ws, { t: 'muted', by: p.name })
    },
    lowerHand(r, _p, m) {
      const t = r.peers.get(m.id)
      if (!t) return
      t.media.hand = false
      send(t.ws, { t: 'hand:lower' })
      r.broadcast({ t: 'peer:update', id: t.id, media: t.media })
    },
    stopShare(r, p, m) {
      const t = r.peers.get(m.id)
      if (t) send(t.ws, { t: 'share:stop', by: p.name })
    },
    kick(r, p, m) {
      const t = r.peers.get(m.id)
      if (!t || t.role === 'host') return
      send(t.ws, { t: 'kicked', by: p.name })
      leave(r, t)
      t.ws.close(4004, 'kicked')
    },
    async lock(r, _p, m) {
      await store.setLocked(r.id, !!m.locked)
      r.meeting = { ...r.meeting, locked: !!m.locked }
      r.broadcast({ t: 'meeting', meeting: publicMeeting(r.meeting) })
    },
    rec(r, p, m) {
      r.recording = m.on ? { by: p.id, name: p.name, since: Date.now() } : null
      r.broadcast({ t: 'rec', recording: r.recording })
    },
    async end(r) {
      await store.endMeetingInDb(r.id)
      endMeeting(r.id, 'ended')
    },
  }

  async function onMessage(r, p, raw) {
    let m
    try { m = JSON.parse(raw) } catch { return }
    if (!m || typeof m.t !== 'string') return
    if (m.t === 'ping') return send(p.ws, { t: 'pong', at: Date.now() })
    if (m.t === 'join') {
      if (p.state !== 'new') return
      if (m.media) p.media = { mic: !!m.media.mic, cam: !!m.media.cam, screen: false, hand: false }
      return join(r, p)
    }
    if (m.t.startsWith('host:')) {
      if (p.role !== 'host' || p.state !== 'in') return send(p.ws, { t: 'error', code: 'forbidden', message: 'Bu amal faqat ustoz uchun' })
      return hostHandlers[m.t.slice(5)]?.(r, p, m)
    }
    return handlers[m.t]?.(r, p, m)
  }

  // ---- Ulanish ----
  async function onConnection(ws, req) {
    const url = new URL(req.url, 'http://x')
    let ticket
    try { ticket = await verifyRoomTicket(url.searchParams.get('ticket') || '') } catch {
      send(ws, { t: 'error', code: 'ticket', message: 'Ulanish muddati o‘tgan. Sahifani yangilang' })
      return ws.close(4401, 'bad ticket')
    }
    const r = await roomFor(ticket.mid)
    if (!r) { send(ws, { t: 'ended', reason: 'deleted' }); return ws.close(4000, 'no meeting') }

    const p = {
      id: randomUUID().slice(0, 12),
      ws, state: 'new',
      userId: ticket.uid, name: ticket.name, color: ticket.color, role: ticket.role, guest: ticket.guest, member: ticket.member,
      media: { mic: true, cam: false, screen: false, hand: false },
    }
    ws.isAlive = true
    ws.on('pong', () => { ws.isAlive = true })
    ws.on('message', (d) => onMessage(r, p, d.toString()).catch((e) => log.error('[hub] message', e)))
    ws.on('close', () => leave(r, p))
    ws.on('error', () => {})
    send(ws, { t: 'hello', id: p.id })
  }

  function endMeeting(id, reason = 'ended') {
    const r = rooms.get(id)
    if (!r) return
    for (const p of [...r.peers.values(), ...r.waiting.values()]) {
      send(p.ws, { t: 'ended', reason })
      store.attendanceClose(p.attendanceId).catch(() => {})
      p.state = 'gone'
      p.ws.close(4000, 'ended')
    }
    rooms.delete(id)
  }

  function meetingUpdated(m) {
    const r = rooms.get(m?.id)
    if (!r) return
    r.meeting = m
    r.broadcast({ t: 'meeting', meeting: publicMeeting(m) })
    release(r).catch((e) => log.error('[hub] release', e))
  }

  // Uzilgan (javob bermayotgan) ulanishlarni tozalash
  function heartbeat(wss) {
    return setInterval(() => {
      for (const ws of wss.clients) {
        if (!ws.isAlive) { ws.terminate(); continue }
        ws.isAlive = false
        ws.ping()
      }
    }, 25_000)
  }

  const originOk = (origin) => !origin || allowedOrigins.includes(origin)

  return {
    onConnection, endMeeting, meetingUpdated, heartbeat, originOk,
    count: (id) => rooms.get(id)?.peers.size ?? 0,
    stats: () => ({ rooms: rooms.size, peers: [...rooms.values()].reduce((a, r) => a + r.peers.size, 0) }),
  }
}
