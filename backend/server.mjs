// Custom server: Next.js API + WebSocket signaling (/ws) bitta portda.
// Next route handler'lari va hub bitta jarayonda ishlaydi — hub globalThis.__iiHub orqali ulashiladi.
import { createServer } from 'node:http'
import next from 'next'
import { WebSocketServer } from 'ws'
import { config } from './lib/config.js'
import { pool } from './lib/db.js'
import { createHub } from './realtime/hub.js'
import { closeDanglingAttendance } from './realtime/store.js'

if (process.argv.includes('--prod')) process.env.NODE_ENV = 'production'
const dev = process.env.NODE_ENV !== 'production'
const port = Number(process.env.PORT || 4020)
// Productionda faqat nginx orqali: HOST=127.0.0.1 (X-Forwarded-For soxtalashtirilmasin)
const host = process.env.HOST || undefined

// Konfiguratsiya va bazani oldindan tekshiramiz — muammo bo'lsa aniq xabar bilan to'xtaymiz
config.jwtSecret
try {
  await pool.query('SELECT 1')
} catch (e) {
  console.error(`✗ PostgreSQL'ga ulanib bo'lmadi (${e.message}).\n  → docker compose up -d db && npm run db:migrate`)
  process.exit(1)
}
await closeDanglingAttendance()

const app = next({ dev, dir: import.meta.dirname, port })
const handle = app.getRequestHandler()
await app.prepare()

const hub = createHub({ allowedOrigins: config.appOrigins })
globalThis.__iiHub = hub

const server = createServer((req, res) => handle(req, res))
const wss = new WebSocketServer({ noServer: true, maxPayload: 256 * 1024 })
const beat = hub.heartbeat(wss)
wss.on('connection', (ws, req) => hub.onConnection(ws, req).catch((e) => { console.error('[ws]', e); ws.close(1011) }))

const nextUpgrade = app.getUpgradeHandler()
server.on('upgrade', (req, socket, head) => {
  const { pathname } = new URL(req.url, 'http://x')
  if (pathname !== '/ws') return nextUpgrade(req, socket, head)
  if (!hub.originOk(req.headers.origin)) {
    socket.write('HTTP/1.1 403 Forbidden\r\n\r\n')
    return socket.destroy()
  }
  wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req))
})

server.listen(port, host, () => {
  console.log(`✓ Backend: http://localhost:${port}  (API: /api, WebSocket: /ws, ${dev ? 'dev' : 'production'})`)
})

const shutdown = () => {
  clearInterval(beat)
  for (const ws of wss.clients) ws.close(1012, 'server restart')
  server.close(() => pool.end().finally(() => process.exit(0)))
  setTimeout(() => process.exit(0), 5000).unref()
}
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
