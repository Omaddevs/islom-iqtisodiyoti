import { useRef, useState } from 'react'
import { Btn, Icon, cx } from './kit.jsx'
import { api } from '../api/client.js'

// Rasm yuklash va ko'rsatish uchun umumiy yordamchilar (video muqovasi, maqola muqovasi va rasmlari).
// Rasm brauzerda siqiladi va serverga fayl sifatida yuklanadi; bazaga faqat havolasi (/api/files/…) yoziladi.

export const IMAGE_TYPES = 'image/jpeg,image/png,image/webp'
const MAX_FILE = 10 * 1024 * 1024

// Faylni tekshiradi; xato bo'lsa matnini qaytaradi
export function checkImage(file) {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return 'Faqat JPG, PNG yoki WEBP rasm yuklash mumkin'
  if (file.size > MAX_FILE) return 'Rasm hajmi 10 MB dan oshmasligi kerak'
  return ''
}

// Rasmni maxW×maxH dan oshmaydigan JPEG'ga siqib, serverga yuklaydi. PNG shaffofligi oq fonga tushadi.
// Natija: { src: '/api/files/…', w, h }
export async function readImage(file, opts) {
  const { blob, w, h } = await compress(file, opts)
  const { url } = await api('/api/uploads', { method: 'POST', raw: true, body: blob, headers: { 'Content-Type': 'image/jpeg' } })
  return { src: url, w, h }
}

const toBlob = (c, q) => new Promise((res) => c.toBlob(res, 'image/jpeg', q))
function compress(file, { maxW = 1280, maxH = 720, budget = 350_000 } = {}) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = async () => {
      const k = Math.min(1, maxW / img.width, maxH / img.height)
      const c = document.createElement('canvas')
      c.width = Math.round(img.width * k); c.height = Math.round(img.height * k)
      const ctx = c.getContext('2d')
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height)
      ctx.drawImage(img, 0, 0, c.width, c.height)
      URL.revokeObjectURL(url)
      let blob = await toBlob(c, 0.82)
      if (blob && blob.size > budget) blob = await toBlob(c, 0.65)
      if (!blob) return reject(new Error('Rasmni o‘qib bo‘lmadi, boshqa fayl tanlang'))
      resolve({ blob, w: c.width, h: c.height })
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Rasmni o‘qib bo‘lmadi, boshqa fayl tanlang')) }
    img.src = url
  })
}

// Muqova rasmi — konteyner fonining ustiga yotadi; yuklanmasa fon ko'rinib qoladi
export const Cover = ({ src }) => (src ? <img className="pvcover" src={src} alt="" loading="lazy" draggable={false} onError={(e) => { e.currentTarget.hidden = true }} /> : null)

// Muqova tanlash maydoni: bosish, sudrab tashlash, almashtirish, olib tashlash.
// `className`/`style` — rasm yo'qdagi fon; `left` — pastki chap qism (masalan rang tanlash); `extra` — qo'shimcha tugmalar
export function CoverPicker({ value, onChange, onError, className, style, left, extra, title = 'Muqova rasmini yuklang' }) {
  const input = useRef(null)
  const [drag, setDrag] = useState(false)
  const [busy, setBusy] = useState(false)
  const pick = async (file) => {
    if (!file) return
    const bad = checkImage(file)
    if (bad) return onError(bad)
    onError(''); setBusy(true)
    try { onChange((await readImage(file)).src) } catch (e) { onError(e.message || 'Rasmni yuklab bo‘lmadi') } finally { setBusy(false) }
  }
  const browse = () => input.current?.click()
  return (
    <div className="pvcpick">
      <div className={cx('pvcpick__drop', className, drag && 'is-drag', value && 'has-cover', busy && 'is-busy')} style={style}
        role="button" tabIndex={0} aria-label={value ? 'Muqovani almashtirish' : title}
        onClick={browse} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); browse() } }}
        onDragOver={(e) => { e.preventDefault(); setDrag(true) }} onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); pick(e.dataTransfer.files?.[0]) }}>
        <Cover src={value} />
        {value
          ? <span className="pvcpick__over"><Icon name="upload" size={16} /> Almashtirish</span>
          : <span className="pvcpick__empty"><span className="pvcpick__ic"><Icon name="image" size={22} /></span><b>{drag ? 'Rasmni qo‘yib yuboring' : title}</b><small>Bosing yoki rasmni shu yerga torting</small></span>}
      </div>
      <input ref={input} type="file" accept={IMAGE_TYPES} hidden onChange={(e) => { pick(e.target.files?.[0]); e.target.value = '' }} />
      {(value || left || extra) && <div className="pvcpick__bar">
        {value ? <span className="pvcpick__note"><Icon name="checkCircle" size={15} /> Muqova o‘rnatildi</span> : left}
        <div className="pvcpick__acts">
          {extra}
          {value && <Btn size="sm" icon="trash" onClick={() => onChange('')}>Olib tashlash</Btn>}
        </div>
      </div>}
    </div>
  )
}
