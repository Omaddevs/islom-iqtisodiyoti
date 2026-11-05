import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../store/auth.jsx'
import { partnersApi } from '../api/client.js'
import { PageHead, Card, Btn, Badge, Empty, Menu, Confirm, Modal, FField, Input, Icon, useToast, useFormInit, Table, cx } from '../ui/kit.jsx'
import { IMAGE_TYPES, checkImage, readImage } from '../ui/media.jsx'
import { fmtDateTime } from '../ui/format.js'

// Saytdagi «Hamkorlar» bo'limi: ro'yxat bo'sh bo'lsa bo'lim saytda ko'rinmaydi
const COLORS = ['#4aa3f8', '#14b8a6', '#8b5cf6', '#f59e0b', '#10b981', '#f43f5e', '#0ea5e9', '#6366f1']

const Mark = ({ p, size = 44 }) => (
  <span className="ppartner" style={{ width: size, height: size, '--pc': p.color }}>
    {p.logo ? <img src={p.logo} alt="" /> : <b style={{ fontSize: size * 0.45 }}>{(p.name || '?').trim()[0]?.toUpperCase()}</b>}
  </span>
)

export default function Partners() {
  const { user } = useAuth()
  const toast = useToast()
  const [list, setList] = useState(null)
  const [edit, setEdit] = useState(null) // null | 'new' | hamkor
  const [del, setDel] = useState(null)

  const load = () => partnersApi.list().then((r) => setList(r.partners)).catch((e) => { setList([]); toast(e.message, 'err') })
  useEffect(() => { if (user.role === 'superadmin') load() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  if (user.role !== 'superadmin') return <Card><Empty icon="shield" title="Ruxsat yo‘q" text="Bu bo‘lim faqat bosh administrator uchun." /></Card>

  const saved = (p, isNew) => {
    setList((xs) => (isNew ? [...xs, p] : xs.map((x) => (x.id === p.id ? p : x))))
    toast(isNew ? 'Hamkor qo‘shildi' : 'Saqlandi')
  }
  const doDelete = async (p) => {
    try { await partnersApi.remove(p.id); setList((xs) => xs.filter((x) => x.id !== p.id)); toast('Hamkor o‘chirildi') } catch (e) { toast(e.message, 'err') }
  }
  const shown = list?.length > 0

  return (
    <>
      <PageHead icon="briefcase" title="Hamkorlar" sub="Bosh sahifadagi «Hamkorlar» bo‘limi shu ro‘yxatdan olinadi"
        actions={<Btn variant="primary" icon="plus" onClick={() => setEdit('new')}>Hamkor qo‘shish</Btn>} />

      {list && (
        <div className="pvtool">
          <Badge tone={shown ? 'green' : 'gray'} dot>{shown ? 'Saytda ko‘rinmoqda' : 'Saytda yashirin'}</Badge>
        </div>
      )}

      <Card pad={false}>
        <Table rows={list || []} empty={
          <Empty icon="briefcase" title={list ? 'Hamkorlar hali yo‘q' : 'Yuklanmoqda…'}
            text={list ? 'Bo‘lim saytda yashirin. Birinchi hamkorni qo‘shsangiz, bosh sahifada ko‘rinadi.' : undefined}
            action={list && <Btn variant="primary" icon="plus" onClick={() => setEdit('new')}>Hamkor qo‘shish</Btn>} />
        } cols={[
          { key: 'name', label: 'Hamkor', render: (p) => <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}><Mark p={p} /><b>{p.name}</b></div> },
          { key: 'type', label: 'Faoliyat turi', render: (p) => p.type || <span className="pmuted">—</span> },
          { key: 'at', label: 'Qo‘shilgan', render: (p) => <span className="pmuted" style={{ fontSize: 13 }}>{fmtDateTime(p.createdAt)}</span> },
          { key: 'act', label: '', align: 'right', render: (p) => (
            <Menu items={[
              { label: 'Tahrirlash', icon: 'edit', onClick: () => setEdit(p) },
              'sep',
              { label: 'O‘chirish', icon: 'trash', danger: true, onClick: () => setDel(p) },
            ]} />
          ) },
        ]} />
      </Card>

      <PartnerForm partner={edit} nextColor={COLORS[(list?.length || 0) % COLORS.length]} onClose={() => setEdit(null)} onSaved={saved} />
      <Confirm open={!!del} onClose={() => setDel(null)} danger title="Hamkorni o‘chirish"
        text={list?.length === 1 ? `${del?.name} o‘chiriladi. Bu oxirgi hamkor — bo‘lim saytdan yashiriladi.` : `${del?.name} saytdan olib tashlanadi.`}
        confirmLabel="O‘chirish" onConfirm={() => doDelete(del)} />
    </>
  )
}

function PartnerForm({ partner, nextColor, onClose, onSaved }) {
  const open = !!partner
  const isNew = partner === 'new'
  const [f, setF] = useState({})
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [uploading, setUploading] = useState(false)
  const input = useRef(null)
  useFormInit(open, isNew ? 'new' : partner?.id, () => {
    setErr('')
    setF(isNew ? { name: '', type: '', logo: null, color: nextColor } : { name: partner.name, type: partner.type || '', logo: partner.logo, color: partner.color })
  })
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }))

  const pick = async (file) => {
    if (!file) return
    const bad = checkImage(file)
    if (bad) return setErr(bad)
    setErr(''); setUploading(true)
    try { set('logo', (await readImage(file, { maxW: 400, maxH: 400 })).src) } catch (e) { setErr(e.message || 'Rasmni yuklab bo‘lmadi') } finally { setUploading(false) }
  }
  const save = async () => {
    if (f.name.trim().length < 2) return setErr('Hamkor nomini kiriting')
    setErr(''); setBusy(true)
    const data = { name: f.name.trim(), type: f.type.trim(), logo: f.logo || null, color: f.color }
    try {
      const { partner: p } = isNew ? await partnersApi.create(data) : await partnersApi.update(partner.id, data)
      onSaved(p, isNew); onClose()
    } catch (e) { setErr(e.message) } finally { setBusy(false) }
  }

  return (
    <Modal open={open} onClose={onClose} title={isNew ? 'Yangi hamkor' : 'Hamkorni tahrirlash'} width={480}
      footer={<>
        <Btn onClick={onClose}>Bekor qilish</Btn>
        <Btn variant="primary" onClick={save} disabled={busy || uploading}>{busy ? 'Saqlanmoqda…' : isNew ? 'Qo‘shish' : 'Saqlash'}</Btn>
      </>}>
      <div className="pform">
        <div className="ppartner-pick">
          <Mark p={{ name: f.name, logo: f.logo, color: f.color }} size={72} />
          <div>
            <b>Logotip</b>
            <small>JPG, PNG yoki WEBP. Bo‘lmasa, nomning birinchi harfi ko‘rsatiladi.</small>
            <div className="ppartner-pick__acts">
              <Btn size="sm" icon="upload" disabled={uploading} onClick={() => input.current?.click()}>{uploading ? 'Yuklanmoqda…' : f.logo ? 'Almashtirish' : 'Yuklash'}</Btn>
              {f.logo && <Btn size="sm" icon="trash" onClick={() => set('logo', null)}>Olib tashlash</Btn>}
            </div>
          </div>
          <input ref={input} type="file" accept={IMAGE_TYPES} hidden onChange={(e) => { pick(e.target.files?.[0]); e.target.value = '' }} />
        </div>
        <FField label="Hamkor nomi"><Input value={f.name || ''} maxLength={80} placeholder="Masalan, Amanah Bank" onChange={(e) => set('name', e.target.value)} /></FField>
        <FField label="Faoliyat turi" hint="Logo ustiga kelganda ko‘rinadi (ixtiyoriy)"><Input value={f.type || ''} maxLength={80} placeholder="Masalan, Islom banki" onChange={(e) => set('type', e.target.value)} /></FField>
        <div className="pfield">
          <span className="pfield__label">Rang</span>
          <div className="pswatches">
            {COLORS.map((c) => <button key={c} type="button" className={cx(f.color === c && 'is-on')} style={{ background: c }} onClick={() => set('color', c)} aria-label={c} />)}
          </div>
        </div>
        {err && <p className="ppartner-err" role="alert"><Icon name="alertCircle" size={15} /> {err}</p>}
      </div>
    </Modal>
  )
}
