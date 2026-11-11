// Islom Iqtisodiyoti — Telegram bot (long polling, backend jarayoni ichida).
//
// • Platforma foydalanuvchilari (superadmin, tashkilot admini, ustoz, o'quvchi) telefon raqamini
//   (Telegram kontakti) yuborib akkauntiga bog'lanadi → Mini App parolsiz ochiladi.
// • Begona odam: «uzr, xizmat ko'rsata olmaymiz» + loyiha haqida + «Kursga yozilish» (adminga murojaat).
// • Boshqaruv paneli: statistika, xabar yuborish (nusxa) va forward, bot adminlarini qo'shish/o'chirish.
//   Bot adminlari va platforma superadminlari — butun platforma; tashkilot admini — o'z tashkiloti;
//   ustoz — o'z guruhlari.
import { one, many, query } from '../lib/db.js'
import { digits } from '../lib/ids.js'
import { tgCall, TgError, appUrl, envAdminIds } from '../lib/telegram.js'

const SITE = 'https://islom-iqtisodiyoti.uz'
const ROLE = { superadmin: 'Bosh administrator', org_admin: 'Tashkilot administratori', teacher: 'Ustoz', student: 'O‘quvchi' }
const B = { panel: '🛠 Boshqaruv paneli', profile: '👤 Profilim', help: 'ℹ️ Yordam', cancel: '✖️ Bekor qilish' }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const esc = (s) => String(s ?? '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c])
const fmtN = (n) => Number(n || 0).toLocaleString('ru-RU')

// Suhbat holati (admin xabar yozayotgani va h.k.) — xotirada; server qayta ishga tushsa tozalanadi
const state = new Map()

const send = (chat_id, text, extra = {}) => tgCall('sendMessage', { chat_id, text, parse_mode: 'HTML', link_preview_options: { is_disabled: true }, ...extra })
const ik = (rows) => ({ reply_markup: { inline_keyboard: rows } })
const openApp = (text = '📲 Platformani ochish') => ({ text, web_app: { url: appUrl() } })

// ---------- Kim bilan gaplashyapmiz ----------
async function whoIs(from) {
  const row = await one(`SELECT b.*, u.id AS uid, u.name, u.role, u.org_id, u.status AS ustatus, o.name AS org_name, o.status AS org_status
    FROM bot_users b LEFT JOIN users u ON u.id = b.user_id LEFT JOIN organizations o ON o.id = u.org_id WHERE b.tg_id = $1`, [from.id])
  const user = row?.uid && row.ustatus === 'active' && (row.role === 'superadmin' || row.org_status === 'active')
    ? { id: row.uid, name: row.name, role: row.role, orgId: row.org_id, orgName: row.org_name } : null
  const botAdmin = envAdminIds().includes(from.id) || !!(await one('SELECT 1 FROM bot_admins WHERE tg_id = $1', [from.id]))
  // Panel darajasi: full — butun platforma, org — o'z tashkiloti, teacher — o'z guruhlari
  const level = botAdmin || user?.role === 'superadmin' ? 'full' : user?.role === 'org_admin' ? 'org' : user?.role === 'teacher' ? 'teacher' : null
  return { user, botAdmin, level, phone: row?.phone }
}

async function touch(from) {
  await query(`INSERT INTO bot_users (tg_id, first_name, username) VALUES ($1, $2, $3)
    ON CONFLICT (tg_id) DO UPDATE SET first_name = EXCLUDED.first_name, username = EXCLUDED.username, blocked = false, last_at = now()`,
  [from.id, from.first_name || null, from.username || null])
}

const mainKeyboard = (me) => {
  const rows = []
  if (me.level) rows.push([{ text: B.panel }])
  rows.push([{ text: B.profile }, { text: B.help }])
  return { reply_markup: { keyboard: rows, resize_keyboard: true, is_persistent: true } }
}

// Bog'langan foydalanuvchida chat pastidagi «Menyu» tugmasi Mini App'ni ochadi
const setMenu = (chatId, on) => tgCall('setChatMenuButton', {
  chat_id: chatId, menu_button: on ? { type: 'web_app', text: 'Platforma', web_app: { url: appUrl() } } : { type: 'commands' },
}).catch(() => {})

// ---------- /start ----------
async function onStart(msg, me) {
  const chat = msg.chat.id
  if (me.user) {
    await setMenu(chat, true)
    await send(chat, `Assalomu alaykum, <b>${esc(me.user.name)}</b>! 👋\n\n${ROLE[me.user.role]}${me.user.orgName ? ` · ${esc(me.user.orgName)}` : ''}\n\nPlatformani bot ichida ochish uchun quyidagi tugmani yoki pastdagi «Platforma» menyusini bosing.`, ik([[openApp()]]))
    return send(chat, 'Asosiy menyu 👇', mainKeyboard(me))
  }
  if (me.botAdmin) {
    await send(chat, `Assalomu alaykum! Siz <b>bot administratori</b>siz.\n\nBoshqaruv paneli — «${B.panel}» tugmasi yoki /admin buyrug'i.\nPlatforma akkauntingizni ham bog'lash uchun telefon raqamingizni yuboring.`, mainKeyboard(me))
    return askContact(chat, true)
  }
  return askContact(chat)
}

const askContact = (chat, short = false) => send(chat, short
  ? '📱 Akkauntni bog‘lash uchun raqamingizni yuboring:'
  : 'Assalomu alaykum! 👋 <b>Islom Iqtisodiyoti</b> platformasining rasmiy botiga xush kelibsiz.\n\nBot platforma foydalanuvchilari (o‘quvchi, ustoz, tashkilot) uchun ishlaydi. Hisobingizni tasdiqlash uchun pastdagi tugma orqali <b>telefon raqamingizni</b> yuboring.',
{ reply_markup: { keyboard: [[{ text: '📱 Telefon raqamni yuborish', request_contact: true }]], resize_keyboard: true, one_time_keyboard: true } })

// ---------- Kontakt: akkauntga bog'lash ----------
async function onContact(msg, me) {
  const chat = msg.chat.id
  const c = msg.contact
  const st = state.get(msg.from.id)
  // Admin qo'shish jarayonida yuborilgan kontakt — boshqa odamniki bo'lishi mumkin
  if (st?.step === 'admin_add' && me.level === 'full') return addAdmin(msg, c.user_id, [c.first_name, c.last_name].filter(Boolean).join(' '))
  if (c.user_id !== msg.from.id) return send(chat, 'Iltimos, <b>o‘zingizning</b> raqamingizni tugma orqali yuboring.')
  const phone = digits(c.phone_number)
  await query('UPDATE bot_users SET phone = $2 WHERE tg_id = $1', [msg.from.id, phone])
  const u = await one(`SELECT u.*, o.status AS org_status FROM users u LEFT JOIN organizations o ON o.id = u.org_id WHERE u.phone = $1`, [phone])
  const okUser = u && u.status === 'active' && (u.role === 'superadmin' || u.org_status === 'active')
  if (!okUser) return notServed(chat, me, !!u)
  // Raqam boshqa Telegram akkauntga bog'langan bo'lsa — yangisiga o'tkaziladi (raqam egasi tasdiqlagan)
  await query('UPDATE bot_users SET user_id = NULL WHERE user_id = $1 AND tg_id <> $2', [u.id, msg.from.id])
  await query('UPDATE bot_users SET user_id = $2 WHERE tg_id = $1', [msg.from.id, u.id])
  return onStart(msg, await whoIs(msg.from))
}

async function notServed(chat, me, blocked) {
  const kb = me.level ? mainKeyboard(me) : { reply_markup: { remove_keyboard: true } }
  await send(chat, blocked
    ? '⚠️ Hisobingiz yoki tashkilotingiz vaqtincha faol emas. Administrator bilan bog‘laning.'
    : '😔 <b>Uzr, bot sizga xizmat ko‘rsata olmaydi.</b>\nBu raqam platformada ro‘yxatdan o‘tmagan.', kb)
  return send(chat, `🕌 <b>Islom Iqtisodiyoti</b> — islom moliyasi va iqtisodiyotini o‘rgatuvchi onlayn ta’lim platformasi.\n\n` +
    `📚 Islom moliyasi asoslari, murobaha, ijara, mushoraka, sukuk\n🎥 Jonli onlayn darslar va video kurslar\n📝 Testlar, uy vazifalari, lug‘at va kutubxona\n👨‍🏫 Tajribali ustozlar, guruhlarda o‘qish\n\n` +
    `Kursga yozilish uchun quyidagi tugmani bosing — administrator siz bilan bog‘lanadi.`,
  ik([[{ text: '✍️ Kursga yozilish — adminga murojaat', callback_data: 'lead' }], [{ text: '🌐 Sayt', url: SITE }]]))
}

// ---------- Kursga yozilish (murojaat) ----------
const leadSent = new Map() // tg_id → vaqt (spamdan himoya)
async function onLead(cb) {
  const from = cb.from
  const last = leadSent.get(from.id)
  if (last && Date.now() - last < 6 * 3600e3) return tgCall('answerCallbackQuery', { callback_query_id: cb.id, text: 'Murojaatingiz allaqachon qabul qilingan ✅', show_alert: true })
  leadSent.set(from.id, Date.now())
  const b = await one('SELECT phone FROM bot_users WHERE tg_id = $1', [from.id])
  const name = [from.first_name, from.last_name].filter(Boolean).join(' ')
  await query(`INSERT INTO leads (kind, name, phone, message) VALUES ('telegram', $1, $2, $3)`,
    [name || null, b?.phone || null, `Telegram bot orqali kursga yozilish${from.username ? ` (@${from.username})` : ''}`])
  await tgCall('answerCallbackQuery', { callback_query_id: cb.id })
  await send(cb.message.chat.id, '✅ <b>Murojaatingiz qabul qilindi!</b>\nAdministrator tez orada siz bilan bog‘lanadi. Rahmat!')
  const text = `🆕 <b>Kursga yozilish — yangi murojaat</b>\n\n👤 ${esc(name || '—')}${from.username ? ` (@${esc(from.username)})` : ''}\n📞 ${b?.phone ? `+${b.phone}` : 'raqam yuborilmagan'}\n🆔 <code>${from.id}</code>`
  for (const id of await fullAdminIds()) send(id, text, ik([[{ text: '💬 Yozish', url: `tg://user?id=${from.id}` }]])).catch(() => {})
}

async function fullAdminIds() {
  const rows = await many(`SELECT tg_id FROM bot_admins UNION SELECT b.tg_id FROM bot_users b JOIN users u ON u.id = b.user_id WHERE u.role = 'superadmin'`)
  return [...new Set([...envAdminIds(), ...rows.map((r) => Number(r.tg_id))])]
}

// ---------- Profil ----------
async function onProfile(chat, me) {
  if (!me.user) return me.botAdmin ? askContact(chat, true) : askContact(chat)
  let groups = []
  if (me.user.role === 'teacher') groups = await many('SELECT name FROM groups WHERE teacher_id = $1 ORDER BY name', [me.user.id])
  if (me.user.role === 'student') groups = await many('SELECT g.name FROM group_members m JOIN groups g ON g.id = m.group_id WHERE m.user_id = $1 ORDER BY g.name', [me.user.id])
  return send(chat, `👤 <b>${esc(me.user.name)}</b>\n🎓 ${ROLE[me.user.role]}${me.user.orgName ? `\n🏢 ${esc(me.user.orgName)}` : ''}${groups.length ? `\n👥 ${groups.map((g) => esc(g.name)).join(', ')}` : ''}\n📞 +${esc(me.phone || '')}`,
    ik([[openApp()], [{ text: '🔓 Akkauntdan uzish', callback_data: 'unlink' }]]))
}

// ---------- Boshqaruv paneli ----------
function panelMenu(me) {
  const rows = [[{ text: '📊 Statistika', callback_data: 'p:stats' }], [{ text: '📢 Xabar yuborish', callback_data: 'p:send:copy' }, { text: '↪️ Forward', callback_data: 'p:send:fwd' }]]
  if (me.level === 'full') rows.push([{ text: '👮 Bot adminlari', callback_data: 'p:admins' }])
  return ik(rows)
}
const scopeLabel = { full: 'butun platforma', org: 'tashkilotingiz', teacher: 'guruhlaringiz' }
const showPanel = (chat, me) => send(chat, `🛠 <b>Boshqaruv paneli</b>\nQamrov: ${scopeLabel[me.level]}`, panelMenu(me))

async function stats(me) {
  if (me.level === 'full') {
    const r = await one(`SELECT
      (SELECT count(*) FROM organizations) orgs, (SELECT count(*) FROM groups) groups,
      (SELECT count(*) FROM users WHERE role='org_admin') admins, (SELECT count(*) FROM users WHERE role='teacher') teachers,
      (SELECT count(*) FROM users WHERE role='student') students,
      (SELECT count(*) FROM bot_users) bot, (SELECT count(*) FROM bot_users WHERE user_id IS NOT NULL) linked,
      (SELECT count(*) FROM bot_users WHERE blocked) blocked, (SELECT count(*) FROM bot_users WHERE started_at > now() - interval '1 day') today,
      (SELECT count(*) FROM bot_users WHERE started_at > now() - interval '7 day') week,
      (SELECT count(*) FROM leads WHERE status='new') leads,
      (SELECT count(*) FROM meetings WHERE status='live') live`)
    const byRole = await many(`SELECT u.role, count(*) n FROM bot_users b JOIN users u ON u.id=b.user_id GROUP BY u.role`)
    const lr = Object.fromEntries(byRole.map((x) => [x.role, x.n]))
    return `📊 <b>Statistika</b>\n\n<b>Platforma</b>\n🏢 Tashkilotlar: ${fmtN(r.orgs)}\n👥 Guruhlar: ${fmtN(r.groups)}\n🧑‍💼 Tashkilot adminlari: ${fmtN(r.admins)}\n👨‍🏫 Ustozlar: ${fmtN(r.teachers)}\n🎓 O‘quvchilar: ${fmtN(r.students)}\n🔴 Hozir jonli darslar: ${fmtN(r.live)}\n📨 Yangi arizalar: ${fmtN(r.leads)}\n\n` +
      `<b>Bot</b>\n👤 Obunachilar: ${fmtN(r.bot)} (bugun +${fmtN(r.today)}, hafta +${fmtN(r.week)})\n🔗 Akkauntga bog‘langan: ${fmtN(r.linked)}\n   · adminlar ${fmtN((lr.superadmin || 0) + (lr.org_admin || 0))}, ustozlar ${fmtN(lr.teacher)}, o‘quvchilar ${fmtN(lr.student)}\n🚫 Botni bloklagan: ${fmtN(r.blocked)}`
  }
  if (me.level === 'org') {
    const r = await one(`SELECT (SELECT count(*) FROM groups WHERE org_id=$1) groups,
      (SELECT count(*) FROM users WHERE org_id=$1 AND role='teacher') teachers, (SELECT count(*) FROM users WHERE org_id=$1 AND role='student') students,
      (SELECT count(*) FROM bot_users b JOIN users u ON u.id=b.user_id WHERE u.org_id=$1) linked`, [me.user.orgId])
    return `📊 <b>${esc(me.user.orgName)}</b>\n\n👥 Guruhlar: ${fmtN(r.groups)}\n👨‍🏫 Ustozlar: ${fmtN(r.teachers)}\n🎓 O‘quvchilar: ${fmtN(r.students)}\n🔗 Botga ulangan: ${fmtN(r.linked)}`
  }
  const gs = await many(`SELECT g.name, count(m.user_id) n, count(b.tg_id) linked FROM groups g
    LEFT JOIN group_members m ON m.group_id=g.id LEFT JOIN bot_users b ON b.user_id=m.user_id
    WHERE g.teacher_id=$1 GROUP BY g.id ORDER BY g.name`, [me.user.id])
  if (!gs.length) return '📊 Sizga hali guruh biriktirilmagan.'
  return `📊 <b>Guruhlarim</b>\n\n${gs.map((g) => `👥 <b>${esc(g.name)}</b> — ${fmtN(g.n)} o‘quvchi, botda ${fmtN(g.linked)}`).join('\n')}`
}

// Kimlarga yuborish mumkin (daraja bo'yicha). Har bir variant — SQL sharti
async function audiences(me) {
  const list = []
  if (me.level === 'full') {
    list.push({ k: 'all', label: '🌍 Barcha obunachilar' }, { k: 'linked', label: '🔗 Platforma foydalanuvchilari' },
      { k: 'r:org_admin', label: '🧑‍💼 Tashkilot adminlari' }, { k: 'r:teacher', label: '👨‍🏫 Ustozlar' }, { k: 'r:student', label: '🎓 O‘quvchilar' },
      { k: 'guest', label: '👤 Bog‘lanmagan obunachilar' })
    for (const o of await many('SELECT id, name FROM organizations ORDER BY name LIMIT 20')) list.push({ k: `o:${o.id}`, label: `🏢 ${o.name}` })
  } else if (me.level === 'org') {
    list.push({ k: `o:${me.user.orgId}`, label: '🏢 Butun tashkilot' }, { k: `or:teacher`, label: '👨‍🏫 Ustozlar' }, { k: `or:student`, label: '🎓 O‘quvchilar' })
    for (const g of await many('SELECT id, name FROM groups WHERE org_id=$1 ORDER BY name LIMIT 20', [me.user.orgId])) list.push({ k: `g:${g.id}`, label: `👥 ${g.name}` })
  } else if (me.level === 'teacher') {
    list.push({ k: 'my', label: '👥 Barcha guruhlarim' })
    for (const g of await many('SELECT id, name FROM groups WHERE teacher_id=$1 ORDER BY name LIMIT 20', [me.user.id])) list.push({ k: `g:${g.id}`, label: `👥 ${g.name}` })
  }
  return list
}

// Qabul qiluvchilar ro'yxati — daraja qayta tekshiriladi (callback soxtalashtirilsa ham)
async function recipients(me, k) {
  const base = 'SELECT b.tg_id FROM bot_users b LEFT JOIN users u ON u.id = b.user_id WHERE NOT b.blocked'
  const [t, v] = [k.split(':')[0], k.slice(k.indexOf(':') + 1)]
  let rows
  if (me.level === 'full') {
    if (k === 'all') rows = await many(base)
    else if (k === 'linked') rows = await many(`${base} AND u.id IS NOT NULL`)
    else if (k === 'guest') rows = await many(`${base} AND u.id IS NULL`)
    else if (t === 'r') rows = await many(`${base} AND u.role = $1`, [v])
    else if (t === 'o') rows = await many(`${base} AND u.org_id = $1`, [v])
  }
  if (me.level === 'org' || (me.level === 'full' && !rows && me.user?.orgId)) {
    const org = me.user.orgId
    if (k === `o:${org}`) rows = await many(`${base} AND u.org_id = $1`, [org])
    else if (t === 'or') rows = await many(`${base} AND u.org_id = $1 AND u.role = $2`, [org, v])
    else if (t === 'g') rows = await many(`${base} AND u.id IN (SELECT m.user_id FROM group_members m JOIN groups g ON g.id=m.group_id WHERE g.id=$1 AND g.org_id=$2)`, [v, org])
  }
  if (me.level === 'teacher') {
    if (k === 'my') rows = await many(`${base} AND u.id IN (SELECT m.user_id FROM group_members m JOIN groups g ON g.id=m.group_id WHERE g.teacher_id=$1)`, [me.user.id])
    else if (t === 'g') rows = await many(`${base} AND u.id IN (SELECT m.user_id FROM group_members m JOIN groups g ON g.id=m.group_id WHERE g.id=$1 AND g.teacher_id=$2)`, [v, me.user.id])
  }
  return rows ? [...new Set(rows.map((r) => Number(r.tg_id)))] : null
}

// Ommaviy yuborish: ~25 xabar/soniya, 429 bo'lsa kutadi, bloklaganlarni belgilaydi
async function broadcast(chat, from, st, ids) {
  const status = await send(chat, `⏳ Yuborilmoqda… 0 / ${ids.length}`)
  let ok = 0, fail = 0
  for (let i = 0; i < ids.length; i++) {
    const id = ids[i]
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        await tgCall(st.mode === 'fwd' ? 'forwardMessage' : 'copyMessage', { chat_id: id, from_chat_id: chat, message_id: st.messageId })
        ok++; break
      } catch (e) {
        if (e instanceof TgError && e.code === 429) { await sleep((e.retryAfter || 1) * 1000 + 200); continue }
        if (e instanceof TgError && (e.code === 403 || e.code === 400)) await query('UPDATE bot_users SET blocked = true WHERE tg_id = $1', [id]).catch(() => {})
        fail++; break
      }
    }
    await sleep(40)
    if ((i + 1) % 25 === 0) tgCall('editMessageText', { chat_id: chat, message_id: status.message_id, text: `⏳ Yuborilmoqda… ${i + 1} / ${ids.length}` }).catch(() => {})
  }
  await tgCall('editMessageText', { chat_id: chat, message_id: status.message_id, parse_mode: 'HTML', text: `✅ <b>Yuborildi</b>\n\n📬 Yetkazildi: ${ok}\n❌ Yetkazilmadi: ${fail}` }).catch(() => {})
}

// ---------- Bot adminlari ----------
async function adminsView(chat, edit) {
  const envIds = envAdminIds()
  const rows = await many('SELECT a.tg_id, a.name, b.first_name, b.username FROM bot_admins a LEFT JOIN bot_users b ON b.tg_id = a.tg_id ORDER BY a.added_at')
  const lines = [...envIds.map((id) => `⭐ <code>${id}</code> — asosiy admin`),
    ...rows.map((r) => `👮 <code>${r.tg_id}</code> — ${esc(r.name || r.first_name || '')}${r.username ? ` @${esc(r.username)}` : ''}`)]
  const kb = rows.filter((r) => !envIds.includes(Number(r.tg_id))).map((r) => [{ text: `❌ ${r.name || r.first_name || r.tg_id}`, callback_data: `adm:del:${r.tg_id}` }])
  kb.push([{ text: '➕ Admin qo‘shish', callback_data: 'adm:add' }], [{ text: '⬅️ Orqaga', callback_data: 'p:menu' }])
  const text = `👮 <b>Bot adminlari</b>\n\n${lines.join('\n') || '—'}\n\n<i>Platforma superadminlari ham avtomatik admin hisoblanadi.</i>`
  return edit ? tgCall('editMessageText', { chat_id: chat, message_id: edit, text, parse_mode: 'HTML', reply_markup: { inline_keyboard: kb } }) : send(chat, text, ik(kb))
}

async function addAdmin(msg, id, name) {
  const chat = msg.chat.id
  if (!id) return send(chat, '⚠️ Foydalanuvchi ID’sini aniqlab bo‘lmadi. Raqamli ID yuboring (masalan, <code>123456789</code>).')
  state.delete(msg.from.id)
  await query(`INSERT INTO bot_admins (tg_id, name, added_by) VALUES ($1, $2, $3) ON CONFLICT (tg_id) DO NOTHING`, [id, name || null, msg.from.id])
  await send(chat, `✅ <code>${id}</code> bot admini qilib qo‘shildi.`, mainKeyboard(await whoIs(msg.from)))
  send(id, `🛠 Sizga <b>Islom Iqtisodiyoti</b> botida administrator huquqi berildi. /admin`).catch(() => {})
  return adminsView(chat)
}

// ---------- Xabarlar ----------
async function onMessage(msg) {
  if (msg.chat.type !== 'private' || !msg.from || msg.from.is_bot) return
  await touch(msg.from)
  const me = await whoIs(msg.from)
  const chat = msg.chat.id
  const text = msg.text || ''
  const st = state.get(msg.from.id)

  if (text === B.cancel || text === '/cancel') { state.delete(msg.from.id); return send(chat, 'Bekor qilindi.', mainKeyboard(me)) }
  if (text.startsWith('/start')) { state.delete(msg.from.id); return onStart(msg, me) }
  if (msg.contact) return onContact(msg, me)

  // Admin qo'shish: ID, forward qilingan xabar yoki kontakt
  if (st?.step === 'admin_add' && me.level === 'full') {
    const fwd = msg.forward_origin?.type === 'user' ? msg.forward_origin.sender_user : null
    if (fwd) return addAdmin(msg, fwd.id, [fwd.first_name, fwd.last_name].filter(Boolean).join(' '))
    if (/^\d{5,15}$/.test(text.trim())) return addAdmin(msg, Number(text.trim()))
    return send(chat, '⚠️ Raqamli ID yuboring yoki o‘sha odamning xabarini forward qiling. (Uning sozlamalarida forward yashirilgan bo‘lsa — ID kerak.)')
  }
  // Ommaviy xabar matni/mediasi kutilmoqda
  if (st?.step === 'compose' && me.level) {
    state.set(msg.from.id, { ...st, step: 'confirm', messageId: msg.message_id })
    return send(chat, `👆 Shu xabar <b>${st.count}</b> kishiga ${st.mode === 'fwd' ? 'forward qilinadi' : 'yuboriladi'}. Tasdiqlaysizmi?`,
      { reply_to_message_id: msg.message_id, ...ik([[{ text: '✅ Yuborish', callback_data: 'b:go' }, { text: '✖️ Bekor', callback_data: 'b:no' }]]) })
  }

  if (text === B.panel || text === '/admin') return me.level ? showPanel(chat, me) : send(chat, '⛔ Boshqaruv paneli faqat administrator va ustozlar uchun.')
  if (text === B.profile || text === '/profil') return onProfile(chat, me)
  if (text === B.help || text === '/help') {
    return send(chat, `ℹ️ <b>Yordam</b>\n\n📲 Platforma — pastdagi «Platforma» menyusi (bot ichida ochiladi)\n👤 /profil — hisobingiz\n${me.level ? '🛠 /admin — boshqaruv paneli (statistika, xabar yuborish)\n' : ''}🔁 /start — qaytadan boshlash\n\nSavollar bo‘yicha: ${SITE}`)
  }
  if (!me.user && !me.level) return askContact(chat)
  return send(chat, 'Quyidagi menyudan tanlang 👇', mainKeyboard(me))
}

// ---------- Tugmalar (callback) ----------
async function onCallback(cb) {
  const from = cb.from
  const chat = cb.message?.chat.id
  const mid = cb.message?.message_id
  const d = cb.data || ''
  const answer = (text, alert) => tgCall('answerCallbackQuery', { callback_query_id: cb.id, text, show_alert: !!alert }).catch(() => {})
  await touch(from)
  if (d === 'lead') return onLead(cb)
  const me = await whoIs(from)

  if (d === 'unlink') {
    await query('UPDATE bot_users SET user_id = NULL WHERE tg_id = $1', [from.id])
    await setMenu(chat, false); await answer('Akkaunt uzildi')
    return send(chat, '🔓 Telegram akkauntingiz platformadan uzildi. Qayta bog‘lash: /start', mainKeyboard(await whoIs(from)))
  }
  if (!me.level) return answer('⛔ Ruxsat yo‘q', true)

  if (d === 'p:menu') { await answer(); return tgCall('editMessageText', { chat_id: chat, message_id: mid, parse_mode: 'HTML', text: `🛠 <b>Boshqaruv paneli</b>\nQamrov: ${scopeLabel[me.level]}`, ...panelMenu(me) }) }
  if (d === 'p:stats') {
    await answer()
    return tgCall('editMessageText', { chat_id: chat, message_id: mid, parse_mode: 'HTML', text: await stats(me), ...ik([[{ text: '🔄 Yangilash', callback_data: 'p:stats' }, { text: '⬅️ Orqaga', callback_data: 'p:menu' }]]) }).catch(() => {})
  }
  if (d.startsWith('p:send:')) {
    await answer()
    const mode = d.slice(7)
    const auds = await audiences(me)
    const kb = auds.map((a) => [{ text: a.label, callback_data: `a:${mode}:${a.k}`.slice(0, 64) }])
    kb.push([{ text: '⬅️ Orqaga', callback_data: 'p:menu' }])
    return tgCall('editMessageText', { chat_id: chat, message_id: mid, parse_mode: 'HTML', text: `${mode === 'fwd' ? '↪️ <b>Forward</b> — xabar asl muallifi ko‘rsatilgan holda yuboriladi.' : '📢 <b>Xabar yuborish</b> — matn, rasm, video, fayl, ovozli xabar… istalgan turdagi xabar.'}\n\nKimlarga yuboramiz?`, reply_markup: { inline_keyboard: kb } })
  }
  if (d.startsWith('a:')) {
    const [, mode, ...rest] = d.split(':')
    const k = rest.join(':')
    const ids = await recipients(me, k)
    if (!ids) return answer('⛔ Bu auditoriyaga ruxsat yo‘q', true)
    if (!ids.length) return answer('Bu auditoriyada botga ulangan hech kim yo‘q', true)
    await answer()
    state.set(from.id, { step: 'compose', mode, k, count: ids.length })
    return send(chat, `✍️ Endi yuboriladigan xabarni ${mode === 'fwd' ? '<b>forward qiling</b> (yoki yuboring)' : '<b>yozing yoki yuboring</b>'}.\nQabul qiluvchilar: <b>${ids.length}</b>`, { reply_markup: { keyboard: [[{ text: B.cancel }]], resize_keyboard: true } })
  }
  if (d === 'b:no') { state.delete(from.id); await answer('Bekor qilindi'); return send(chat, 'Bekor qilindi.', mainKeyboard(me)) }
  if (d === 'b:go') {
    const st = state.get(from.id)
    if (st?.step !== 'confirm') return answer('Xabar topilmadi — qaytadan boshlang', true)
    state.delete(from.id)
    const ids = await recipients(me, st.k)
    if (!ids) return answer('⛔ Ruxsat yo‘q', true)
    await answer('Yuborish boshlandi')
    await tgCall('editMessageReplyMarkup', { chat_id: chat, message_id: mid, reply_markup: { inline_keyboard: [] } }).catch(() => {})
    await send(chat, '🚀 Yuborish boshlandi. Tugagach hisobot keladi.', mainKeyboard(me))
    broadcast(chat, from, st, ids).catch((e) => console.error('[bot] broadcast', e))
    return
  }
  if (me.level !== 'full') return answer('⛔ Ruxsat yo‘q', true)
  if (d === 'p:admins') { await answer(); return adminsView(chat, mid) }
  if (d === 'adm:add') {
    await answer()
    state.set(from.id, { step: 'admin_add' })
    return send(chat, '➕ Yangi admin:\n• Telegram <b>ID</b>sini yuboring (masalan, <code>123456789</code>), yoki\n• o‘sha odamning istalgan xabarini <b>forward</b> qiling, yoki\n• uning <b>kontakt</b>ini yuboring.', { reply_markup: { keyboard: [[{ text: B.cancel }]], resize_keyboard: true } })
  }
  if (d.startsWith('adm:del:')) {
    const id = Number(d.slice(8))
    if (envAdminIds().includes(id)) return answer('Asosiy adminni o‘chirib bo‘lmaydi', true)
    await query('DELETE FROM bot_admins WHERE tg_id = $1', [id])
    await answer('O‘chirildi')
    return adminsView(chat, mid)
  }
  return answer()
}

// ---------- Ishga tushirish (long polling) ----------
export function startBot() {
  if (!process.env.BOT_TOKEN || process.env.BOT_ENABLED === 'false') return null
  const ctrl = new AbortController()
  let offset = 0
  const run = async () => {
    try {
      await tgCall('deleteWebhook', {})
      await tgCall('setMyCommands', { commands: [
        { command: 'start', description: 'Boshlash / platformani ochish' }, { command: 'profil', description: 'Mening hisobim' },
        { command: 'admin', description: 'Boshqaruv paneli' }, { command: 'help', description: 'Yordam' }] })
      await tgCall('setChatMenuButton', { menu_button: { type: 'commands' } }) // umumiy — faqat bog'langanlarda Mini App
      const me = await tgCall('getMe')
      console.log(`✓ Telegram bot: @${me.username}`)
    } catch (e) { console.error('[bot] start', e.message) }
    while (!ctrl.signal.aborted) {
      try {
        const updates = await tgCall('getUpdates', { offset, timeout: 50, allowed_updates: ['message', 'callback_query'] }, { signal: ctrl.signal })
        for (const u of updates) {
          offset = u.update_id + 1
          const h = u.message ? onMessage(u.message) : u.callback_query ? onCallback(u.callback_query) : null
          h?.catch((e) => console.error('[bot]', e.message))
        }
      } catch (e) {
        if (ctrl.signal.aborted) break
        console.error('[bot] polling', e.message)
        await sleep(e.code === 409 ? 15000 : 3000) // 409 — boshqa nusxa ishlayapti
      }
    }
  }
  run()
  return { stop: () => ctrl.abort() }
}

// Sinovlar uchun (smoke)
export const _internals = { whoIs, stats, audiences, recipients }
