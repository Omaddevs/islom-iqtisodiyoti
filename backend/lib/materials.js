// Himoyalangan materiallar: yuklangan faylni brauzerda ko'rinadigan sahifa rasmlariga aylantirish,
// ruxsatni tekshirish va har bir sahifaga ko'ruvchining ismini yozish.
// Asl fayl o'quvchiga hech qachon berilmaydi — unga faqat ustida ismi yozilgan rasm yetib boradi.
import { spawn } from 'node:child_process'
import { copyFile, chmod, mkdtemp, readFile, rename, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import sharp from 'sharp'
import { config } from './config.js'
import { fail } from './http.js'
import { many, one, query } from './db.js'

sharp.concurrency(1)
sharp.cache(false)

export const MAX_FILE_BYTES = 500 * 1024 * 1024
const MAX_PAGES = 3000
const CONVERT_TIMEOUT_S = 300
const PAGE_LONG_SIDE = 2000

const OFFICE = new Set(['doc', 'docx', 'docm', 'dot', 'dotx', 'odt', 'rtf', 'ppt', 'pptx', 'pptm', 'pps', 'ppsx', 'pot', 'potx', 'odp', 'xls', 'xlsx', 'xlsm', 'xlsb', 'xlt', 'xltx', 'ods', 'csv', 'bmp'])
const TEXT = new Set(['txt', 'md', 'log', 'json', 'xml', 'yml', 'yaml', 'ini'])
const IMAGE = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif', 'tif', 'tiff', 'avif', 'svg'])
export const MEDIA = {
  mp4: 'video/mp4', m4v: 'video/mp4', webm: 'video/webm', ogv: 'video/ogg', mov: 'video/mp4',
  mp3: 'audio/mpeg', m4a: 'audio/mp4', aac: 'audio/aac', wav: 'audio/wav', ogg: 'audio/ogg', oga: 'audio/ogg', opus: 'audio/ogg', flac: 'audio/flac',
}

export const kindOf = (ext) => {
  if (ext === 'pdf' || OFFICE.has(ext) || TEXT.has(ext) || IMAGE.has(ext)) return 'pages'
  if (MEDIA[ext]) return MEDIA[ext].startsWith('video') ? 'video' : 'audio'
  return 'none' // Saqlanadi, lekin brauzerda ochib bo'lmaydi (zip, exe va h.k.)
}

const ID_RE = /^mf_[a-z0-9]+$/
export const isFileId = (id) => ID_RE.test(String(id || ''))
export const materialsRoot = () => resolve(config.storageDir, 'materials')
export const fileDir = (id) => join(materialsRoot(), id)
export const sourcePath = (id) => join(fileDir(id), 'source')
const pdfPath = (id) => join(fileDir(id), 'doc.pdf')
const pagePath = (id, n) => join(fileDir(id), `p-${n}.jpg`)

// ---- Tashqi dasturlar ----
// Muhit o'zgaruvchilari (baza paroli, JWT) dasturlarga uzatilmaydi
const cleanEnv = () => ({ PATH: process.env.PATH, HOME: process.env.CONVERT_HOME || tmpdir(), LANG: 'C.UTF-8', SystemRoot: process.env.SystemRoot, TEMP: process.env.TEMP, TMP: process.env.TMP })
function run(cmd, args, { timeoutS = 120, sandbox = false, cwd } = {}) {
  return new Promise((ok, no) => {
    // Hujjatni ochuvchi dastur alohida, huquqsiz foydalanuvchi ostida ishlaydi (deploy/convert-setup.sh):
    // zararli hujjat .env yoki boshqa materiallarni o'qiy olmaydi va tarmoqqa chiqa olmaydi
    const user = sandbox && process.env.CONVERT_USER
    const [bin, argv] = user ? ['sudo', ['-n', '-u', user, 'timeout', '-k', '10', String(timeoutS), cmd, ...args]] : [cmd, args]
    const p = spawn(bin, argv, { cwd, env: cleanEnv(), stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true })
    let out = '', err = ''
    p.stdout.on('data', (d) => { if (out.length < 65536) out += d })
    p.stderr.on('data', (d) => { if (err.length < 8192) err += d })
    const t = setTimeout(() => p.kill('SIGKILL'), (timeoutS + 20) * 1000)
    p.on('error', (e) => { clearTimeout(t); no(e) })
    p.on('close', (code) => { clearTimeout(t); code === 0 ? ok(out) : no(new Error(`${cmd}: kod ${code} ${err.slice(0, 500)}`)) })
  })
}
const SOFFICE = () => process.env.SOFFICE_BIN || 'soffice'
const PDFTOPPM = () => process.env.PDFTOPPM_BIN || 'pdftoppm'
const PDFINFO = () => process.env.PDFINFO_BIN || 'pdfinfo'
const fileUrl = (p) => `file:///${resolve(p).replace(/\\/g, '/').replace(/^\//, '')}`

async function officeToPdf(id, ext) {
  // Dastur o'qiy oladigan vaqtinchalik papka: faqat shu faylning nusxasi bor
  const work = await mkdtemp(join(tmpdir(), 'ii-conv-'))
  try {
    await chmod(work, 0o777)
    const input = join(work, `input.${TEXT.has(ext) ? 'txt' : ext}`)
    await copyFile(sourcePath(id), input)
    await chmod(input, 0o644)
    const profile = process.env.CONVERT_PROFILE || join(tmpdir(), 'ii-lo-profile')
    await run(SOFFICE(), [`-env:UserInstallation=${fileUrl(profile)}`, '--headless', '--norestore', '--nolockcheck', '--convert-to', 'pdf', '--outdir', work, input], { timeoutS: CONVERT_TIMEOUT_S, sandbox: true, cwd: work }) // soffice joriy papkaga kira olishi shart
    const out = join(work, 'input.pdf')
    await stat(out).catch(() => { throw new Error('PDF hosil bo‘lmadi') })
    await copyFile(out, pdfPath(id))
  } finally { await rm(work, { recursive: true, force: true }).catch(() => {}) }
}

async function pdfInfo(file) {
  const out = await run(PDFINFO(), [file], { timeoutS: 60 })
  const pages = Number(/^Pages:\s+(\d+)/m.exec(out)?.[1]) || 0
  const m = /^Page size:\s+([\d.]+) x ([\d.]+)/m.exec(out)
  return { pages, ratio: m ? Number(m[2]) / Number(m[1]) : 1.414 }
}

const renderJobs = globalThis.__iiPageJobs ?? (globalThis.__iiPageJobs = new Map())
async function renderPdfPage(id, n) {
  const target = pagePath(id, n)
  const tmp = `${target}.tmp`
  await run(PDFTOPPM(), ['-f', String(n), '-l', String(n), '-singlefile', '-jpeg', '-jpegopt', 'quality=86', '-scale-to', String(PAGE_LONG_SIDE), pdfPath(id), tmp], { timeoutS: 120 })
  await rename(`${tmp}.jpg`, target)
}
// Sahifa birinchi so'ralganda chiziladi va diskda qoladi; bir sahifa ikki marta chizilmaydi
export async function ensurePage(id, n) {
  const target = pagePath(id, n)
  if (await stat(target).then(() => true, () => false)) return target
  const key = `${id}:${n}`
  if (!renderJobs.has(key)) renderJobs.set(key, renderPdfPage(id, n).finally(() => renderJobs.delete(key)))
  await renderJobs.get(key)
  return target
}

// ---- Navbat: server bitta protsessorli, fayllar birma-bir aylantiriladi ----
const jobs = globalThis.__iiConvert ?? (globalThis.__iiConvert = { queue: [], busy: false, known: new Set() })

async function convert(id) {
  const f = await one('SELECT * FROM material_files WHERE id = $1', [id])
  if (!f || f.status !== 'processing') return
  if (f.kind !== 'pages') { await query(`UPDATE material_files SET status = 'ready' WHERE id = $1`, [id]); return }
  let pages = 1, ratio = 1
  if (IMAGE.has(f.ext)) {
    const { data, info } = await sharp(sourcePath(id), { limitInputPixels: 2e8, density: 150 }).rotate()
      .resize({ width: PAGE_LONG_SIDE, height: PAGE_LONG_SIDE, fit: 'inside', withoutEnlargement: true })
      .flatten({ background: '#ffffff' }).jpeg({ quality: 88 }).toBuffer({ resolveWithObject: true })
    await writeFile(pagePath(id, 1), data)
    ratio = info.height / info.width
  } else {
    if (f.ext === 'pdf') await copyFile(sourcePath(id), pdfPath(id))
    else await officeToPdf(id, f.ext)
    ;({ pages, ratio } = await pdfInfo(pdfPath(id)))
    if (!pages) throw new Error('Sahifalar topilmadi')
    if (pages > MAX_PAGES) throw new Error(`Hujjatda ${pages} sahifa bor, ko‘pi bilan ${MAX_PAGES} ta`)
    await ensurePage(id, 1)
  }
  await query(`UPDATE material_files SET status = 'ready', pages = $2, ratio = $3, error = NULL WHERE id = $1`, [id, pages, ratio])
  // Material allaqachon saqlangan bo'lsa, betlar soni kartada ham ko'rinsin
  await query(`UPDATE records SET data = jsonb_set(data, '{pages}', to_jsonb($2::int)) WHERE collection = 'library' AND data->>'fileId' = $1`, [id, pages])
}

async function pump() {
  if (jobs.busy) return
  jobs.busy = true
  while (jobs.queue.length) {
    const id = jobs.queue.shift()
    try { await convert(id) } catch (e) {
      console.error('[material]', id, e.message)
      await query(`UPDATE material_files SET status = 'failed', error = $2 WHERE id = $1`, [id, 'Faylni ochib bo‘lmadi: shikastlangan yoki parol bilan himoyalangan bo‘lishi mumkin']).catch(() => {})
    } finally { jobs.known.delete(id) }
  }
  jobs.busy = false
}
export function enqueue(id) {
  if (jobs.known.has(id)) return
  jobs.known.add(id)
  jobs.queue.push(id)
  pump()
}

// ---- Ruxsatlar ----
export async function loadFile(id) {
  if (!isFileId(id)) fail(404, 'Fayl topilmadi')
  const f = await one('SELECT * FROM material_files WHERE id = $1', [id])
  if (!f) fail(404, 'Fayl topilmadi')
  return f
}
const isAdminOf = (u, orgId) => u.role === 'superadmin' || (u.role === 'org_admin' && u.org_id === orgId)
// Asl faylni va jurnalni faqat yuklagan ustoz yoki administrator ko'radi
export const canManageFile = (u, f) => isAdminOf(u, f.org_id) || f.owner_id === u.id
export async function canViewFile(u, f) {
  if (canManageFile(u, f)) return true
  if (u.org_id !== f.org_id) return false
  const recs = await many(`SELECT data->'groupIds' AS groups FROM records WHERE collection = 'library' AND org_id = $1 AND data->>'fileId' = $2`, [f.org_id, f.id])
  if (!recs.length) return false
  if (u.role !== 'student') return true
  const ids = recs.map((r) => r.groups || [])
  if (ids.some((g) => !g.length)) return true // bo'sh ro'yxat — butun tashkilot uchun
  return !!(await one('SELECT 1 FROM group_members WHERE user_id = $1 AND group_id = ANY($2) LIMIT 1', [u.id, ids.flat()]))
}
export async function requireView(u, id) {
  const f = await loadFile(id)
  if (!(await canViewFile(u, f))) fail(403, 'Bu materialni ko‘rishga ruxsatingiz yo‘q')
  return f
}
export const fileOut = (f, u) => ({
  id: f.id, name: f.name, ext: f.ext, size: Number(f.size), kind: f.kind, status: f.status, pages: f.pages, ratio: f.ratio, error: f.error,
  canManage: canManageFile(u, f),
})

// ---- Suv belgisi ----
const esc = (s) => String(s).replace(/[<>&"']/g, (c) => `&#${c.charCodeAt(0)};`)
const stamp = () => new Intl.DateTimeFormat('uz-UZ', { timeZone: 'Asia/Tashkent', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date()).replace(',', '')
export const watermarkText = (u) => `${u.name} · +${u.phone || ''} · ${stamp()}`

// Rasmning o'zigaga yoziladi: brauzer vositalari bilan olib tashlab bo'lmaydi, skrinshotda ham qoladi.
// Qora va oq nusxasi birga: yorug' sahifada ham, qorong'i slaydda ham ko'rinadi.
export async function watermarkedPage(path, text) {
  const img = sharp(await readFile(path))
  const { width, height } = await img.metadata()
  const fs = Math.max(14, Math.round(Math.min(width, 1600) * 0.019))
  const tw = Math.round(text.length * fs * 0.56 + fs * 6), th = fs * 11
  const label = (x, y) => `<text x="${x}" y="${y}" font-family="DejaVu Sans, Liberation Sans, Arial, sans-serif" font-size="${fs}" font-weight="600">${esc(text)}</text>`
  const row = label(0, fs * 2.5) + label(-tw / 2, fs * 8) + label(tw / 2, fs * 8)
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><defs>
    <pattern id="w" width="${tw}" height="${th}" patternUnits="userSpaceOnUse" patternTransform="rotate(-27)">
      <g fill="#ffffff" fill-opacity=".13" transform="translate(1.2 1.2)">${row}</g><g fill="#16233b" fill-opacity=".13">${row}</g>
    </pattern></defs><rect width="100%" height="100%" fill="url(#w)"/></svg>`
  return img.composite([{ input: Buffer.from(svg) }]).webp({ quality: 82 }).toBuffer()
}
