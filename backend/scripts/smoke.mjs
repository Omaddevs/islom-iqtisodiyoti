// End-to-end tekshiruv: auth, rollar, platforma ma'lumotlari, darslar va WebSocket (brauzersiz).
// Server ishlab turgan bo'lishi kerak. Ishga tushirish: npm run test:smoke
// Vaqtinchalik test tashkiloti yaratiladi va oxirida butunlay o'chiriladi.
import WebSocket from 'ws'
import sharp from 'sharp'

const B = process.env.API || `http://localhost:${process.env.PORT || 4020}`
const ORIGIN = (process.env.APP_ORIGIN || 'http://localhost:2026').split(',')[0]
const ADMIN = { phone: process.env.SUPERADMIN_PHONE || '+998 90 739 21 11', password: process.env.SUPERADMIN_PASSWORD }
if (!ADMIN.password) { console.error('✗ backend/.env da SUPERADMIN_PASSWORD kerak'); process.exit(1) }

async function api(path, { method = 'GET', body, cookie } = {}) {
  const r = await fetch(B + path, { method, headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) }, body: body && JSON.stringify(body) })
  return { status: r.status, data: await r.json().catch(() => null), cookie: r.headers.get('set-cookie')?.split(';')[0] }
}
const ops = (cookie, list) => api('/api/data', { method: 'POST', cookie, body: { ops: list } })
const login = (phone, password) => api('/api/auth/login', { method: 'POST', body: { phone, password } })

// Vaqtinchalik tashkilot — xato bo'lsa ham o'chiriladi
const RUN = Date.now().toString(36)
const ORG = `org_smoke${RUN}`
let A
const cleanup = async () => { if (A?.cookie) await ops(A.cookie, [{ col: 'organizations', op: 'delete', id: ORG }, { col: 'notifications', op: 'delete', id: `n1${RUN}` }]).catch(() => {}) }
const ok = async (c, m) => { if (!c) { console.error('✗', m); await cleanup(); process.exit(1) } console.log('✓', m) }

function client(ticket, name) {
  const ws = new WebSocket(`${B.replace('http', 'ws')}/ws?ticket=${ticket}`, { headers: { origin: ORIGIN } })
  const inbox = []
  const waiters = []
  ws.on('message', (d) => {
    const m = JSON.parse(d)
    const w = waiters.find((x) => x.pred(m))
    if (w) { waiters.splice(waiters.indexOf(w), 1); w.res(m) } else inbox.push(m)
  })
  const next = (t, pred = () => true) => {
    const hit = inbox.find((m) => m.t === t && pred(m))
    if (hit) { inbox.splice(inbox.indexOf(hit), 1); return Promise.resolve(hit) }
    return new Promise((res, rej) => {
      waiters.push({ pred: (m) => m.t === t && pred(m), res })
      setTimeout(() => rej(new Error(`${name}: '${t}' kelmadi`)), 4000)
    })
  }
  return { ws, next, send: (m) => ws.send(JSON.stringify(m)) }
}

// ---- Tayyorlov: bosh admin test tashkilotini va foydalanuvchilarni yaratadi ----
const rnd = () => String(Math.floor(1e6 + Math.random() * 8e6))
const P = { oa: `+99877${rnd()}`, t1: `+99877${rnd()}`, t2: `+99877${rnd()}`, s1: `+99877${rnd()}`, s2: `+99877${rnd()}` }
const G1 = `g1${RUN}`, G2 = `g2${RUN}`

A = await login(ADMIN.phone, ADMIN.password)
await ok(A.status === 200 && A.data.user.role === 'superadmin', `bosh admin kirdi: ${A.data?.user?.name}`)
await ok((await login(ADMIN.phone, 'notright')).status === 401, 'noto‘g‘ri parol rad etildi')

const mk = (id, role, name, phone, password = 'parol123') => ({ col: 'users', op: 'insert', item: { id, orgId: ORG, role, name, phone, password } })
const setup = await ops(A.cookie, [
  { col: 'organizations', op: 'insert', item: { id: ORG, name: 'Smoke test markazi', plan: 'basic' } },
  mk(`u_oa${RUN}`, 'org_admin', 'Smoke Admin', P.oa),
  mk(`u_t1${RUN}`, 'teacher', 'Smoke Ustoz', P.t1),
  mk(`u_t2${RUN}`, 'teacher', 'Boshqa Ustoz', P.t2),
  mk(`u_s1${RUN}`, 'student', 'Smoke Talaba', P.s1),
  mk(`u_s2${RUN}`, 'student', 'Ikkinchi Talaba', P.s2),
  { col: 'groups', op: 'insert', item: { id: G1, orgId: ORG, name: 'SM-1', course: 'Smoke kursi', teacherId: `u_t1${RUN}`, studentIds: [`u_s1${RUN}`], schedule: [] } },
  { col: 'groups', op: 'insert', item: { id: G2, orgId: ORG, name: 'SM-2', course: 'Boshqa kurs', teacherId: `u_t2${RUN}`, studentIds: [`u_s2${RUN}`], schedule: [] } },
])
await ok(setup.status === 200 && !JSON.stringify(setup.data).includes('parol123'), 'tashkilot, admin, ustozlar, o‘quvchilar, guruhlar yaratildi (parol qaytarilmaydi)')
await ok((await ops(A.cookie, [mk(`u_x${RUN}`, 'student', 'Takror Raqam', P.s1)])).status === 409, 'band telefon raqam rad etildi')
await ok((await ops(A.cookie, [mk(`u_sa${RUN}`, 'superadmin', 'Ikkinchi Bosh', `+99877${rnd()}`)])).status === 403, 'ikkinchi bosh administrator yaratib bo‘lmaydi')

// ---- Rollar chegarasi ----
const OA = await login(P.oa, 'parol123')
await ok(OA.status === 200 && OA.data.user.role === 'org_admin', 'tashkilot admini kirdi')
await ok((await ops(OA.cookie, [mk(`u_oa2${RUN}`, 'org_admin', 'Yana Admin', `+99877${rnd()}`)])).status === 403, 'tashkilot admini boshqa admin yarata olmaydi')
await ok((await ops(OA.cookie, [{ col: 'organizations', op: 'patch', id: ORG, changes: { plan: 'pro' } }])).status === 403, 'tashkilot admini tarifni o‘zgartira olmaydi')

const t = await login(P.t1, 'parol123')
await ok(t.status === 200 && t.cookie, `ustoz kirdi: ${t.data?.user?.name}`)
await ok((await ops(t.cookie, [mk(`u_t3${RUN}`, 'teacher', 'Soxta Ustoz', `+99877${rnd()}`)])).status === 403, 'ustoz boshqa ustoz yarata olmaydi')
await ok((await ops(t.cookie, [{ col: 'users', op: 'patch', id: `u_s2${RUN}`, changes: { name: 'Begona Odam' } }])).status === 403, 'ustoz boshqa guruh o‘quvchisini tahrirlay olmaydi')
await ok((await ops(t.cookie, [{ col: 'groups', op: 'patch', id: G1, changes: { teacherId: `u_t2${RUN}` } }])).status === 403, 'ustoz guruhga boshqa ustozni biriktira olmaydi')
const G3 = `g3${RUN}`
await ok((await ops(t.cookie, [{ col: 'groups', op: 'insert', item: { id: `${G3}x`, orgId: ORG, name: 'SM-X', course: 'Begona', teacherId: `u_t2${RUN}`, schedule: [] } }])).status === 403, 'ustoz boshqa ustoz nomidan guruh yarata olmaydi')
await ok((await ops(t.cookie, [{ col: 'groups', op: 'insert', item: { id: `${G3}y`, orgId: ORG, name: 'SM-Y', course: 'Ustozsiz', schedule: [] } }])).status === 403, 'ustoz o‘zini biriktirmasdan guruh yarata olmaydi')
const ownGroup = await ops(t.cookie, [{ col: 'groups', op: 'insert', item: { id: G3, orgId: ORG, name: 'SM-3', course: 'Ustoz kursi', teacherId: `u_t1${RUN}`, schedule: [] } }])
await ok(ownGroup.status === 200 && ownGroup.data.results[0].item.teacherId === `u_t1${RUN}`, 'ustoz o‘z guruhini yaratdi')
await ok((await ops(t.cookie, [{ col: 'groups', op: 'patch', id: G3, changes: { name: 'SM-3b' } }])).status === 200, 'ustoz o‘z guruhini tahrirladi')
await ok((await ops(t.cookie, [{ col: 'groups', op: 'delete', id: G3 }])).status === 403, 'ustoz guruhni o‘chira olmaydi')
await ok((await ops(OA.cookie, [{ col: 'groups', op: 'delete', id: G3 }])).status === 200, 'admin ustoz guruhini o‘chirdi')

const test = await ops(t.cookie, [{ col: 'tests', op: 'insert', item: { id: `t${RUN}`, orgId: ORG, groupIds: [G1], authorId: 'u_admin', title: 'Smoke test', timeLimit: 5, questions: [
  { id: 'q1', text: '2+2?', options: ['3', '4'], correct: 1 }, { id: 'q2', text: '3+3?', options: ['6', '7'], correct: 0 }] } }])
await ok(test.status === 200 && test.data.results[0].item.authorId === `u_t1${RUN}`, 'ustoz test yaratdi (muallif serverda belgilanadi)')

const s = await login(P.s1, 'parol123')
await ok(s.status === 200 && s.data.user.role === 'student', 'o‘quvchi kirdi')
const sView = await api('/api/data', { cookie: s.cookie })
const sTest = sView.data.tests.find((x) => x.id === `t${RUN}`)
await ok(sTest && sTest.questions.every((q) => q.correct === undefined), 'o‘quvchi topshirishdan oldin to‘g‘ri javoblarni ko‘rmaydi')
await ok(!sView.data.users.some((u) => u.id !== `u_s1${RUN}` && u.phone), 'o‘quvchi boshqalarning telefon raqamlarini ko‘rmaydi')
await ok(!sView.data.groups.some((g) => g.id === G2), 'o‘quvchi boshqa guruhlarni ko‘rmaydi')
await ops(OA.cookie, [{ col: 'activity', op: 'insert', item: { id: `ac${RUN}`, orgId: ORG, text: 'ustoz qo‘shdi', target: 'X' } }])
await ok((await api('/api/data', { cookie: s.cookie })).data.activity.length === 0, 'o‘quvchiga boshqaruv jurnali yuborilmaydi')
await ok((await ops(s.cookie, [{ col: 'videos', op: 'insert', item: { id: `v${RUN}`, orgId: ORG, title: 'X' } }])).status === 403, 'o‘quvchi kontent yarata olmaydi')
await ok((await ops(s.cookie, [{ col: 'users', op: 'patch', id: `u_s1${RUN}`, changes: { role: 'org_admin' } }])).status === 403, 'o‘quvchi o‘z rolini o‘zgartira olmaydi')
const att0 = await ops(s.cookie, [{ col: 'testAttempts', op: 'insert', item: { id: `ta${RUN}`, testId: `t${RUN}`, answers: { q1: 1, q2: 1 }, score: 99 } }])
await ok(att0.status === 200 && att0.data.results[0].item.score === 1, 'test bali serverda hisoblandi (1/2, yuborilgan 99 e’tiborsiz)')
await ok((await ops(s.cookie, [{ col: 'testAttempts', op: 'insert', item: { id: `ta2${RUN}`, testId: `t${RUN}`, answers: {} } }])).status === 409, 'testni ikkinchi marta topshirib bo‘lmaydi')
await ok((await api('/api/data', { cookie: s.cookie })).data.tests.find((x) => x.id === `t${RUN}`).questions[0].correct === 1, 'topshirgandan keyin o‘quvchi to‘g‘ri javoblarni ko‘radi')
const badQ = (id, questions) => ops(t.cookie, [{ col: 'tests', op: 'insert', item: { id, orgId: ORG, groupIds: [G1], title: 'Yaroqsiz', timeLimit: 5, questions } }])
await ok((await badQ(`tb1${RUN}`, [{ id: 'a', text: 'S?', options: ['1', '2'], correct: 5 }])).status === 422, 'to‘g‘ri javob mavjud bo‘lmagan variantni ko‘rsata olmaydi')
await ok((await badQ(`tb2${RUN}`, [{ id: 'a', text: 'S?', options: ['1', ' '], correct: 0 }])).status === 422, 'bo‘sh variantli savol qabul qilinmaydi')
await ok((await badQ(`tb3${RUN}`, [])).status === 422, 'savolsiz test yaratilmaydi')
await ok((await ops(t.cookie, [{ col: 'tests', op: 'patch', id: `t${RUN}`, changes: { questions: [{ id: 'q1', text: '2+2?', options: ['3', '4'], correct: 0 }, { id: 'q2', text: '3+3?', options: ['6', '7'], correct: 0 }] } }])).status === 409, 'topshirilgan testning savollari o‘zgartirilmaydi')
await ok((await ops(t.cookie, [{ col: 'tests', op: 'patch', id: `t${RUN}`, changes: { title: 'Smoke test 2' } }])).status === 200, 'topshirilgan testning nomi o‘zgartiriladi')
// Savol izohlari va ustoz izohi
const withExplain = [{ id: 'q1', text: '2+2?', options: ['3', '4'], correct: 1, explain: '2 ga 2 qo‘shilsa 4' }, { id: 'q2', text: '3+3?', options: ['6', '7'], correct: 0 }]
await ok((await ops(t.cookie, [{ col: 'tests', op: 'patch', id: `t${RUN}`, changes: { questions: withExplain } }])).status === 200, 'topshirilgan testga izoh qo‘shildi (savollar o‘zgarmadi)')
await ok((await api('/api/data', { cookie: s.cookie })).data.tests.find((x) => x.id === `t${RUN}`).questions[0].explain === '2 ga 2 qo‘shilsa 4', 'topshirgan o‘quvchi izohni ko‘radi')
await ops(t.cookie, [{ col: 'tests', op: 'insert', item: { id: `tx${RUN}`, orgId: ORG, groupIds: [G1], title: 'Izohli test', timeLimit: 5, questions: [{ id: 'a', text: 'S?', options: ['1', '2'], correct: 1, explain: 'Javob 2', notes: ['1 emas', ''], ref: 'SS 1, 2/6/2', quote: 'Iqtibos', section: 'Qabz', kind: 'calc', bloom: 'apply' }] } }])
const sx = (await api('/api/data', { cookie: s.cookie })).data.tests.find((x) => x.id === `tx${RUN}`)
await ok(sx && sx.questions.every((q) => ['explain', 'correct', 'notes', 'ref', 'quote', 'section', 'bloom'].every((k) => q[k] === undefined) && q.kind === 'calc'), 'topshirmagan o‘quvchiga izoh, manba va Bloom yuborilmaydi (savol turi ko‘rinadi)')
const tq = (await api('/api/data', { cookie: t.cookie })).data.tests.find((x) => x.id === `tx${RUN}`).questions[0]
await ok(tq.notes.length === 2 && tq.ref === 'SS 1, 2/6/2' && tq.bloom === 'apply', 'ustoz savol tasnifi va variant izohlarini saqladi')
await ok((await ops(t.cookie, [{ col: 'tests', op: 'insert', item: { id: `ty${RUN}`, orgId: ORG, groupIds: [G1], title: 'X', timeLimit: 5, questions: [{ id: 'a', text: 'S?', options: ['1', '2'], correct: 0, bloom: 'yodlash' }] } }])).data.results[0].item.questions[0].bloom === undefined, 'noma’lum Bloom darajasi saqlanmaydi')
await ok((await ops(s.cookie, [{ col: 'testAttempts', op: 'patch', id: `ta${RUN}`, changes: { feedback: 'o‘zim' } }])).status === 403, 'o‘quvchi o‘ziga izoh yoza olmaydi')
const t2 = await login(P.t2, 'parol123')
await ok((await ops(t2.cookie, [{ col: 'testAttempts', op: 'patch', id: `ta${RUN}`, changes: { feedback: 'begona' } }])).status === 403, 'boshqa guruh ustozi izoh yoza olmaydi')
await ok((await ops(t.cookie, [{ col: 'testAttempts', op: 'patch', id: `ta${RUN}`, changes: { feedback: 'x', score: 2 } }])).status === 403, 'ustoz natija balini o‘zgartira olmaydi')
const fb = await ops(t.cookie, [{ col: 'testAttempts', op: 'patch', id: `ta${RUN}`, changes: { feedback: '  2-savolni qayta ko‘ring  ' } }])
await ok(fb.status === 200 && fb.data.results[0].item.feedback === '2-savolni qayta ko‘ring' && fb.data.results[0].item.score === 1 && fb.data.results[0].item.feedbackBy === `u_t1${RUN}`, 'ustoz o‘quvchiga izoh yozdi, ball o‘zgarmadi')
await ok((await api('/api/data', { cookie: s.cookie })).data.testAttempts.find((a) => a.id === `ta${RUN}`)?.feedback === '2-savolni qayta ko‘ring', 'o‘quvchi ustoz izohini ko‘radi')
await ok((await ops(OA.cookie, [{ col: 'testAttempts', op: 'patch', id: `ta${RUN}`, changes: { feedback: '' } }])).data.results[0].item.feedback === null, 'administrator izohni o‘chirdi')
const lateT = await ops(t.cookie, [{ col: 'tests', op: 'insert', item: { id: `tl${RUN}`, orgId: ORG, groupIds: [G1], title: 'Yopilgan', timeLimit: 1, dueAt: Date.now() - 10 * 60e3, questions: [{ id: 'a', text: 'S?', options: ['1', '2'], correct: 0 }] } }])
await ok(lateT.status === 200 && (await ops(s.cookie, [{ col: 'testAttempts', op: 'insert', item: { id: `tal${RUN}`, testId: `tl${RUN}`, answers: { a: 0 } } }])).status === 422, 'muddati o‘tgan test qabul qilinmaydi')
const otherT = await ops(t.cookie, [{ col: 'tests', op: 'insert', item: { id: `to${RUN}`, orgId: ORG, groupIds: [G2], title: 'Boshqa guruh', timeLimit: 5, questions: [{ id: 'a', text: 'S?', options: ['1', '2'], correct: 0 }] } }])
await ok(otherT.status === 200 && (await ops(s.cookie, [{ col: 'testAttempts', op: 'insert', item: { id: `tao${RUN}`, testId: `to${RUN}`, answers: { a: 0 } } }])).status === 404, 'o‘quvchi boshqa guruh testini topshira olmaydi')
const junk = await ops(s.cookie, [{ col: 'tests', op: 'insert', item: { id: `tj${RUN}`, orgId: ORG, title: 'X' } }])
await ok(junk.status === 403, 'o‘quvchi test yarata olmaydi')

// ---- Dars jadvali va bildirishnomalar ----
const tk = (ms) => new Date(ms + 5 * 3600e3).toISOString() // Toshkent devor soati
const tomorrow = tk(Date.now() + 864e5).slice(0, 10)
const tmrDow = new Date(`${tomorrow}T00:00:00Z`).getUTCDay()
const L1 = `ls1${RUN}`
const lesson = (id, groupId, extra = {}) => ({ col: 'lessons', op: 'insert', item: { id, groupId, title: 'Smoke darsi', repeat: 'weekly', date: tomorrow, days: [tmrDow], time: '18:00', durationMin: 90, online: false, room: '204', ...extra } })
const notesOf = async (cookie) => (await api('/api/data', { cookie })).data.notifications
await ok((await ops(s.cookie, [lesson(`lsx${RUN}`, G1)])).status === 403, 'o‘quvchi dars qo‘sha olmaydi')
await ok((await ops(t.cookie, [lesson(`lsy${RUN}`, G2)])).status === 403, 'ustoz boshqa ustoz guruhiga dars qo‘sha olmaydi')
await ok((await ops(t.cookie, [lesson(`lsz${RUN}`, G1, { days: [] })])).status === 422, 'hafta kuni tanlanmagan dars rad etildi')
await ok((await ops(t.cookie, [lesson(`lsz${RUN}`, G1, { time: '25:00' })])).status === 422, 'noto‘g‘ri vaqt rad etildi')
await ok((await ops(t.cookie, [lesson(`lsz${RUN}`, G1, { online: true, url: 'javascript:alert(1)' })])).status === 422, 'xavfli havola rad etildi')
const mkL = await ops(t.cookie, [lesson(L1, G1)])
await ok(mkL.status === 200 && mkL.data.results[0].item.authorId === `u_t1${RUN}` && mkL.data.results[0].item.orgId === ORG, 'ustoz o‘z guruhiga haftalik dars qo‘shdi')
const sData = await api('/api/data', { cookie: s.cookie })
await ok(sData.data.lessons.some((l) => l.id === L1) && sData.data.notifications.some((n) => n.text.includes('Jadvalga yangi dars') && n.href === `#/platform/schedule/${L1}.${tomorrow}`), 'guruh o‘quvchisi darsni ko‘rdi va bildirishnoma oldi')
const sOther = await login(P.s2, 'parol123')
await ok(!(await api('/api/data', { cookie: sOther.cookie })).data.lessons.some((l) => l.id === L1), 'boshqa guruh o‘quvchisi bu darsni ko‘rmaydi')
await ok(!(await notesOf(t.cookie)).some((n) => n.text.includes('Smoke darsi')), 'dars qo‘shgan ustozning o‘ziga xabar bormaydi')
await ok((await ops(t.cookie, [{ col: 'lessons', op: 'patch', id: L1, changes: { skips: [tomorrow] } }])).status === 200 && (await notesOf(s.cookie)).some((n) => n.text.includes('kuni bo‘lmaydi')), 'bir kun bekor qilindi — o‘quvchiga xabar bordi')
await ok((await ops(OA.cookie, [{ col: 'lessons', op: 'patch', id: L1, changes: { time: '19:30', skips: [] } }])).status === 200, 'admin ustoz darsining vaqtini o‘zgartirdi')
await ok((await notesOf(s.cookie)).some((n) => n.text.includes('o‘zgartirildi') && n.text.includes('19:30')) && (await notesOf(t.cookie)).some((n) => n.text.includes('o‘zgartirildi')), 'vaqt o‘zgargani o‘quvchiga ham, ustozga ham yetdi')
await ok((await ops(t.cookie, [{ col: 'lessons', op: 'patch', id: L1, changes: { groupId: G2 } }])).status === 422, 'darsni boshqa guruhga ko‘chirib bo‘lmaydi')
await ok((await ops(s.cookie, [{ col: 'lessons', op: 'patch', id: L1, changes: { title: 'X' } }])).status === 403, 'o‘quvchi darsni o‘zgartira olmaydi')
if (!process.env.API) {
  // Eslatma: 30 daqiqadan keyin boshlanadigan dars (faqat lokal bazada — funksiya bazaga to'g'ridan-to'g'ri ulanadi)
  const { remindLessons } = await import('../lib/lessons.js')
  const soon = tk(Date.now() + 30 * 60e3)
  await ok((await ops(t.cookie, [lesson(`lsr${RUN}`, G1, { title: 'Yaqin dars', repeat: 'once', date: soon.slice(0, 10), days: [], time: soon.slice(11, 16) })])).status === 200, 'yaqin orada boshlanadigan bir martalik dars qo‘shildi')
  const n1 = await remindLessons(), n2 = await remindLessons()
  await ok(n1 >= 2 && n2 === 0 && (await notesOf(s.cookie)).some((n) => n.text.startsWith('Eslatma: «Yaqin dars»')), `dars oldidan eslatma o‘quvchi va ustozga bordi, takrorlanmadi (${n1}/${n2})`)
  const { pool } = await import('../lib/db.js')
  await pool.end()
}
await ok((await ops(t.cookie, [{ col: 'lessons', op: 'delete', id: L1 }])).status === 200 && (await notesOf(s.cookie)).some((n) => n.text.includes('jadvaldan olib tashlandi')), 'dars o‘chirildi — o‘quvchiga xabar bordi')

// ---- Himoyalangan materiallar (LibreOffice'siz: rasm, audio, zip) ----
const upMaterial = (cookie, name, bytes, extra = {}) => fetch(`${B}/api/materials`, { method: 'POST', headers: { 'content-type': 'application/octet-stream', 'x-file-name': encodeURIComponent(name), cookie, ...extra }, body: bytes })
const get = (path, cookie, headers = {}) => fetch(B + path, { headers: { ...(cookie ? { cookie } : {}), ...headers } })
const PNG = await sharp({ create: { width: 320, height: 240, channels: 3, background: '#3b8ef0' } }).png().toBuffer()
await ok((await upMaterial(s.cookie, 'x.png', PNG)).status === 403, 'o‘quvchi fayl yuklay olmaydi')
await ok((await fetch(`${B}/api/materials`, { method: 'POST', headers: { 'x-file-name': 'x.png' }, body: PNG })).status === 401, 'kirmagan foydalanuvchi fayl yuklay olmaydi')
const upImg = await upMaterial(t.cookie, '../../Sxema rasmi.png', PNG)
const matImg = await upImg.json()
await ok(upImg.status === 201 && matImg.name === 'Sxema rasmi.png' && matImg.kind === 'pages', 'ustoz rasm yukladi, fayl nomidagi yo‘l olib tashlandi')
let ready = matImg
for (let i = 0; i < 40 && ready.status === 'processing'; i++) { await new Promise((r) => setTimeout(r, 250)); ready = await (await get(`/api/materials/${matImg.id}`, t.cookie)).json() }
await ok(ready.status === 'ready' && ready.pages === 1, 'rasm ko‘rish uchun tayyorlandi')
const page1 = `/api/materials/${matImg.id}/pages/1`
await ok((await get(page1)).status === 401, 'kirmagan foydalanuvchi sahifani ko‘ra olmaydi')
await ok((await get(page1, s.cookie)).status === 403, 'kutubxonaga qo‘shilmagan faylni o‘quvchi ko‘ra olmaydi')
await ok((await ops(t.cookie, [{ col: 'library', op: 'insert', item: { id: `lb${RUN}`, orgId: ORG, title: 'Sxema', type: 'document', groupIds: [G1], fileId: matImg.id, fileName: 'soxta.exe', fileSize: 1 } }])).status === 200, 'ustoz faylni guruhga berdi')
const libItem = (await api('/api/data', { cookie: s.cookie })).data.library.find((x) => x.id === `lb${RUN}`)
await ok(libItem.fileName === 'Sxema rasmi.png' && !libItem.url, 'fayl nomi serverdan olinadi, o‘quvchiga havola berilmaydi')
const sPage = await get(page1, s.cookie)
await ok(sPage.status === 200 && sPage.headers.get('content-type') === 'image/jpeg' && sPage.headers.get('cache-control').includes('no-store'), 'guruh o‘quvchisi sahifa rasmini oldi, kesh yo‘q')
const tPage = await get(page1, t.cookie)
await ok(tPage.status === 200 && Buffer.compare(Buffer.from(await sPage.arrayBuffer()), Buffer.from(await tPage.arrayBuffer())) === 0, 'sahifa rasmi fon yozuvisiz, hamma ko‘ruvchiga bir xil')
await ok((await get(`/api/materials/${matImg.id}/source`, s.cookie)).status === 403, 'o‘quvchi asl faylni yuklab ola olmaydi')
await ok((await get(`/api/materials/${matImg.id}/media`, s.cookie)).status === 404, 'rasm media yo‘li orqali berilmaydi')
const srcRes = await get(`/api/materials/${matImg.id}/source`, t.cookie)
await ok(srcRes.status === 200 && srcRes.headers.get('content-disposition').startsWith('attachment') && Buffer.compare(Buffer.from(await srcRes.arrayBuffer()), PNG) === 0, 'yuklagan ustoz asl faylni oladi')
await ok((await get(page1.replace(matImg.id, 'mf_yoq'), s.cookie)).status === 404 && (await get(`/api/materials/${encodeURIComponent('../../.env')}`, t.cookie)).status === 404, 'noto‘g‘ri identifikator rad etiladi')
await ok((await get(`/api/materials/${matImg.id}/pages/2`, s.cookie)).status === 404 && (await get(`/api/materials/${matImg.id}/pages/0`, s.cookie)).status === 404, 'mavjud bo‘lmagan sahifa berilmaydi')
const s2Login = await login(P.s2, 'parol123')
await ok((await get(page1, s2Login.cookie)).status === 403, 'boshqa guruh o‘quvchisi faylni ko‘ra olmaydi')
await ok((await ops(t.cookie, [{ col: 'library', op: 'insert', item: { id: `lb2${RUN}`, orgId: ORG, title: 'X', fileId: 'mf_begona' } }])).status === 422, 'mavjud bo‘lmagan fayl biriktirilmaydi')
const upAudio = await (await upMaterial(t.cookie, 'Ma’ruza.mp3', Buffer.alloc(5000, 7))).json()
await ops(t.cookie, [{ col: 'library', op: 'insert', item: { id: `lb3${RUN}`, orgId: ORG, title: 'Ma’ruza', type: 'audio', groupIds: [], fileId: upAudio.id } }])
for (let i = 0; i < 20 && (await (await get(`/api/materials/${upAudio.id}`, s.cookie)).json()).status !== 'ready'; i++) await new Promise((r) => setTimeout(r, 200))
const part = await get(`/api/materials/${upAudio.id}/media`, s.cookie, { range: 'bytes=100-199' })
await ok(part.status === 206 && part.headers.get('content-range') === 'bytes 100-199/5000' && (await part.arrayBuffer()).byteLength === 100, 'audio bo‘lib-bo‘lib uzatiladi (Range)')
await ok((await get(`/api/materials/${upAudio.id}/media`, s.cookie, { range: 'bytes=9000-' })).status === 416, 'noto‘g‘ri diapazon rad etiladi')
const upZip = await (await upMaterial(t.cookie, 'Arxiv.zip', Buffer.from('PK'))).json()
await ok(upZip.kind === 'none' && upZip.status === 'ready', 'istalgan fayl turi qabul qilinadi (zip saqlanadi, ochilmaydi)')
await ok((await api(`/api/materials/${matImg.id}/events`, { method: 'POST', cookie: s.cookie, body: { type: 'capture', detail: 'PrintScreen' } })).status === 204, 'skrinshot urinishi jurnalga yoziladi')
await ok((await api(`/api/materials/${matImg.id}/events`, { cookie: s.cookie })).status === 403, 'o‘quvchi jurnalni ko‘ra olmaydi')
await ok((await api(`/api/materials/${matImg.id}/events`, { cookie: t.cookie })).data.viewers.some((v) => v.id === `u_s1${RUN}` && v.captures === 1), 'ustoz jurnalda urinishni ko‘radi')
await ok((await ops(s.cookie, [{ col: 'users', op: 'patch', id: `u_s1${RUN}`, changes: { password: 'yangi123', currentPassword: 'xato' } }])).status === 422, 'joriy parolsiz parol almashtirilmaydi')
const s2 = await login(P.s1, 'parol123') // ikkinchi qurilma
const goodPw = await ops(s.cookie, [{ col: 'users', op: 'patch', id: `u_s1${RUN}`, changes: { password: 'yangi123', currentPassword: 'parol123' } }])
await ok(goodPw.status === 200 && (await login(P.s1, 'yangi123')).status === 200, 'o‘quvchi parolini almashtirdi va yangi parol bilan kirdi')
await ok((await api('/api/data', { cookie: s2.cookie })).status === 401, 'parol almashgach boshqa qurilmadagi eski sessiya bekor bo‘ldi')
await ok(goodPw.cookie && (await api('/api/data', { cookie: goodPw.cookie })).status === 200, 'parolni almashtirgan qurilmaga yangi sessiya berildi')
s.cookie = goodPw.cookie
const e1 = await fetch(B + '/api/data', { headers: { cookie: s.cookie } })
const e2 = await fetch(B + '/api/data', { headers: { cookie: s.cookie, 'if-none-match': e1.headers.get('etag') } })
await ok(e1.headers.get('etag') && e2.status === 304, 'o‘zgarmagan ma’lumot qayta yuklanmaydi (ETag → 304)')

const nt = await ops(s.cookie, [{ col: 'notifications', op: 'insert', item: { id: `n1${RUN}`, userId: 'u_admin', text: 'Test topshirildi' } }, { col: 'notifications', op: 'insert', item: { id: `n2${RUN}`, userId: 'u_begona', text: 'x' } }])
await ok(nt.status === 200 && nt.data.results[0].item && nt.data.results[1].item === null, 'bildirishnoma: bosh adminga yetadi, mavjud bo‘lmagan oluvchi jim o‘tkaziladi')
await ok((await ops(OA.cookie, [{ col: 'users', op: 'patch', id: `u_s2${RUN}`, changes: { status: 'blocked' } }])).status === 200, 'admin o‘quvchini blokladi')
await ok((await login(P.s2, 'parol123')).status === 403, 'bloklangan o‘quvchi kira olmaydi')
await ok((await ops(t.cookie, [{ col: 'library', op: 'insert', item: { id: `l${RUN}`, orgId: ORG, title: 'X', url: 'javascript:alert(1)' } }])).status === 422, '`javascript:` havolasi rad etildi')

// ---- Login cheklovi: faqat noto'g'ri urinishlar sanaladi ----
let okLogins = 0
for (let i = 0; i < 10; i++) if ((await login(P.t1, 'parol123')).status === 200) okLogins++
await ok(okLogins === 10, 'ketma-ket 10 ta to‘g‘ri kirish cheklovga tushmadi')
for (let i = 0; i < 8; i++) await login(P.t2, 'xato-parol')
await ok((await login(P.t2, 'parol123')).status === 429, '8 ta noto‘g‘ri urinishdan keyin hisob vaqtincha bloklandi (429)')

// ---- Rasmlar: fayl sifatida yuklanadi, bazaga faqat havola ----
const JPG = Buffer.from('/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=', 'base64')
const upload = (cookie, body, type = 'image/jpeg') => fetch(B + '/api/uploads', { method: 'POST', headers: { cookie, 'content-type': type }, body }).then(async (r) => ({ status: r.status, data: await r.json().catch(() => null) }))
const up = await upload(t.cookie, JPG)
await ok(up.status === 201 && /^\/api\/files\/img_[a-z0-9]+\.jpg$/.test(up.data?.url), 'ustoz rasm yukladi → fayl havolasi')
const img = await fetch(B + up.data.url, { headers: { cookie: t.cookie } })
await ok(img.status === 200 && img.headers.get('content-type') === 'image/jpeg', 'yuklangan rasm qaytariladi')
await ok((await fetch(B + up.data.url)).status === 401, 'rasm tizimga kirmaganlarga berilmaydi')
await ok((await upload(t.cookie, Buffer.from('<script>alert(1)</script>'))).status === 415, 'rasm niqobidagi boshqa fayl rad etildi')
await ok((await upload(s.cookie, JPG)).status === 403, 'o‘quvchi rasm yuklay olmaydi')
await ok((await ops(t.cookie, [{ col: 'videos', op: 'insert', item: { id: `vi${RUN}`, orgId: ORG, title: 'X', cover: 'data:image/jpeg;base64,' + 'A'.repeat(5000) } }])).status === 422, 'bazaga data-URL rasm yozilmaydi')

// ---- Saytdagi arizalar ----
const lead = await api('/api/leads', { method: 'POST', body: { kind: 'course', name: `Smoke ${RUN}`, phone: '+998 90 123 45 67', course: 'Islom moliyasi' } })
await ok(lead.status === 201, 'saytdan ariza qabul qilindi (akkauntsiz)')
await ok((await api('/api/leads', { method: 'POST', body: { kind: 'contact', name: 'X' } })).status === 422, 'telefon/emailsiz ariza rad etildi')
const leads = await api('/api/leads', { cookie: A.cookie })
const myLead = leads.data?.leads?.find((l) => l.name === `Smoke ${RUN}`)
await ok(myLead, 'bosh admin arizani ko‘rdi')
await ok((await api('/api/leads', { cookie: OA.cookie })).status === 403, 'tashkilot admini arizalarni ko‘ra olmaydi')
await api(`/api/leads/${myLead.id}`, { method: 'DELETE', cookie: A.cookie })

// ---- Saytdagi hamkorlar: ro'yxat ochiq, boshqaruv faqat bosh adminda ----
const pBefore = await api('/api/partners')
await ok(pBefore.status === 200 && Array.isArray(pBefore.data.partners), 'hamkorlar ro‘yxati akkauntsiz ochiq')
const pLogo = await upload(A.cookie, JPG)
const pBody = { name: `Hamkor ${RUN}`, type: 'Islom banki', logo: pLogo.data.url, color: '#4aa3f8' }
await ok((await fetch(B + pLogo.data.url)).status === 401, 'logo hamkorga biriktirilmaguncha ochiq emas')
await ok((await api('/api/partners', { method: 'POST', body: pBody })).status === 401, 'akkauntsiz hamkor qo‘shib bo‘lmaydi')
await ok((await api('/api/partners', { method: 'POST', cookie: OA.cookie, body: pBody })).status === 403, 'tashkilot admini hamkor qo‘sha olmaydi')
await ok((await api('/api/partners', { method: 'POST', cookie: A.cookie, body: { ...pBody, logo: 'https://evil.example/x.jpg' } })).status === 422, 'tashqi havola logo sifatida rad etildi')
const pNew = await api('/api/partners', { method: 'POST', cookie: A.cookie, body: pBody })
await ok(pNew.status === 201 && pNew.data.partner.logo === pBody.logo, 'bosh admin hamkor qo‘shdi')
await ok((await api('/api/partners')).data.partners.some((x) => x.id === pNew.data.partner.id), 'yangi hamkor ochiq ro‘yxatda')
await ok((await fetch(B + pLogo.data.url)).status === 200, 'hamkor logosi akkauntsiz ochiladi')
await ok((await fetch(B + up.data.url)).status === 401, 'boshqa rasmlar avvalgidek yopiq')
await ok((await api(`/api/partners/${pNew.data.partner.id}`, { method: 'PATCH', cookie: OA.cookie, body: pBody })).status === 403, 'tashkilot admini hamkorni tahrirlay olmaydi')
await ok((await api(`/api/partners/${pNew.data.partner.id}`, { method: 'PATCH', cookie: A.cookie, body: { ...pBody, type: 'Takaful' } })).data.partner.type === 'Takaful', 'hamkor tahrirlandi')
await ok((await api(`/api/partners/${pNew.data.partner.id}`, { method: 'DELETE', cookie: OA.cookie })).status === 403, 'tashkilot admini hamkorni o‘chira olmaydi')
await api(`/api/partners/${pNew.data.partner.id}`, { method: 'DELETE', cookie: A.cookie })
await ok(!(await api('/api/partners')).data.partners.some((x) => x.id === pNew.data.partner.id), 'hamkor o‘chirildi')
await ok((await fetch(B + pLogo.data.url)).status === 401, 'o‘chirilgan hamkor logosi yana yopiq')

// ---- Onlayn darslar va real vaqt xonasi ----
const list = await api('/api/meetings', { cookie: t.cookie })
await ok(list.status === 200 && Array.isArray(list.data.meetings), `darslar ro‘yxati: ${list.data.meetings.length} ta`)

const created = await api('/api/meetings', { method: 'POST', cookie: t.cookie, body: { title: 'Smoke test darsi', groupId: G1, startsAt: Date.now() + 60e3, durationMin: 45, passcode: 'sabr7' } })
await ok(created.status === 201 && created.data.meeting.code, `dars yaratildi: ${created.data?.meeting?.code}`)
const m = created.data.meeting
const forbidden = await api('/api/meetings', { method: 'POST', cookie: t.cookie, body: { title: 'Begona guruh', groupId: G2, startsAt: Date.now(), durationMin: 30 } })
await ok(forbidden.status === 403, 'ustoz boshqa ustozning guruhiga dars yarata olmaydi')

const ht = await api(`/api/join/${m.code}`, { method: 'POST', cookie: t.cookie, body: {} })
await ok(ht.status === 200 && ht.data.role === 'host' && ht.data.iceServers.length, 'host chiptasi olindi')

const info = await api(`/api/join/${m.code}`)
await ok(info.data.viewer.needsPasscode && !info.data.viewer.user, 'mehmon uchun parol talab qilinadi')
const g0 = await api(`/api/join/${m.code}`, { method: 'POST', body: { name: 'Mehmon Ali' } })
await ok(g0.status === 403 && g0.data.needPasscode, 'parolsiz mehmon rad etildi')
const gt = await api(`/api/join/${m.code}`, { method: 'POST', body: { name: 'Mehmon Ali', passcode: 'sabr7' } })
await ok(gt.status === 200 && gt.data.role === 'participant', 'mehmon chiptasi olindi')

const st = await api(`/api/join/${m.code}`, { method: 'POST', cookie: s.cookie, body: {} })
await ok(st.status === 200, 'o‘quvchi chiptasi olindi (parolsiz — guruh a’zosi)')

// O'quvchi host'dan oldin keladi → ustozni kutadi
const S = client(st.data.ticket, 'student')
await S.next('hello'); S.send({ t: 'join', media: { mic: true, cam: true } })
await ok((await S.next('waiting')).reason === 'host', 'o‘quvchi ustozni kutmoqda (dars boshlanmagan)')

// Host kiradi → dars jonli, o'quvchi avtomatik qabul qilinadi
const H = client(ht.data.ticket, 'host')
await H.next('hello'); H.send({ t: 'join', media: { mic: true, cam: true } })
const hw = await H.next('welcome')
await ok(hw.self.role === 'host' && hw.meeting.status === 'live', 'host kirdi, dars jonli')
const sWel = await S.next('welcome')
await ok(sWel.peers.some((p) => p.role === 'host'), 'o‘quvchi avtomatik qabul qilindi')
await H.next('peer:join', (x) => x.peer.id === sWel.self.id)

// Mehmon → kutish zali → host ruxsat beradi
const G = client(gt.data.ticket, 'guest')
await G.next('hello'); G.send({ t: 'join', media: { mic: false, cam: false } })
await ok((await G.next('waiting')).reason === 'approval', 'mehmon kutish zalida')
const lobby = await H.next('lobby', (x) => x.waiting.length === 1)
await ok(lobby.waiting[0].name === 'Mehmon Ali', 'host kutish zali ro‘yxatini oldi')
H.send({ t: 'host:admit', id: lobby.waiting[0].id })
const gWel = await G.next('welcome')
await ok(gWel.peers.length === 2, 'mehmon qabul qilindi, 2 ishtirokchini ko‘radi')

G.send({ t: 'signal', to: hw.self.id, data: { description: { type: 'offer', sdp: 'v=0' } } })
const sig = await H.next('signal')
await ok(sig.from === gWel.self.id && sig.data.description.type === 'offer', 'signal (offer) host’ga yetib bordi')

S.send({ t: 'chat', text: 'Assalomu alaykum!' })
const c1 = await G.next('chat')
await ok(c1.msg.text === 'Assalomu alaykum!' && c1.msg.id, 'chat xabari hammaga tarqaldi va saqlandi')

S.send({ t: 'media', hand: true })
await ok((await H.next('peer:update', (x) => x.media.hand)).id === sWel.self.id, 'qo‘l ko‘tarish holati tarqaldi')
H.send({ t: 'host:mute', id: sWel.self.id })
await S.next('muted'); await ok(true, 'host o‘quvchi mikrofonini o‘chirishni so‘radi')

G.send({ t: 'host:end' })
await ok((await G.next('error')).code === 'forbidden', 'mehmon host amalini bajara olmaydi')

H.send({ t: 'host:lock', locked: true })
await S.next('meeting', (x) => x.meeting.locked)
const g2 = await api(`/api/join/${m.code}`, { method: 'POST', body: { name: 'Kechikkan', passcode: 'sabr7' } })
await ok(g2.status === 423, 'qulflangan darsga yangi mehmon kira olmaydi')

const att = await api(`/api/meetings/${m.id}/attendance`, { cookie: t.cookie })
await ok(att.data.present.length === 3, `davomat: ${att.data.present.length} ishtirokchi, ${att.data.absent.length} kelmagan`)

H.send({ t: 'host:end' })
await ok((await S.next('ended')).reason === 'ended', 'dars yakunlandi, hamma chiqarildi')
const after = await api(`/api/meetings/${m.id}`, { cookie: t.cookie })
await ok(after.data.meeting.status === 'ended', 'bazada holat: ended')
for (const c of [S, H, G]) c.ws.close()

// ---- Tashkilot to'xtatilsa — a'zolari kira olmaydi; o'chirilsa — hammasi bilan birga o'chadi ----
await ops(A.cookie, [{ col: 'organizations', op: 'patch', id: ORG, changes: { status: 'suspended' } }])
await ok((await login(P.oa, 'parol123')).status === 403, 'to‘xtatilgan tashkilot a’zosi kira olmaydi')
await ok((await api('/api/data', { cookie: t.cookie })).status === 401, 'to‘xtatilgan tashkilotdagi faol sessiya ham bekor bo‘ldi')
await cleanup()
await ok((await login(P.s1, 'yangi123')).status === 401, 'tashkilot o‘chirildi — uning foydalanuvchilari ham')
console.log('\nHammasi joyida ✔')
process.exit(0)
