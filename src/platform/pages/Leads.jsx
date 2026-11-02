import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../store/auth.jsx'
import { leadsApi } from '../api/client.js'
import { PageHead, Card, Btn, Badge, Tabs, Empty, Menu, Confirm, useToast, Table, Search } from '../ui/kit.jsx'
import { fmtAgo, fmtDateTime } from '../ui/format.js'

// Saytdagi formalardan kelgan arizalar: kursga yozilish, bepul boshlash, aloqa, obuna
const KIND = {
  course: { label: 'Kursga yozilish', tone: 'blue' },
  start: { label: 'Bepul boshlash', tone: 'green' },
  partner: { label: 'Hamkorlik', tone: 'violet' },
  contact: { label: 'Aloqa formasi', tone: 'amber' },
  subscribe: { label: 'Obuna', tone: 'gray' },
}

export default function Leads() {
  const { user } = useAuth()
  const toast = useToast()
  const [list, setList] = useState(null)
  const [tab, setTab] = useState('new')
  const [q, setQ] = useState('')
  const [del, setDel] = useState(null)

  const load = () => leadsApi.list().then((r) => setList(r.leads)).catch((e) => { setList([]); toast(e.message, 'err') })
  useEffect(() => { if (user.role === 'superadmin') load() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const rows = useMemo(() => (list || [])
    .filter((l) => tab === 'all' || l.status === tab)
    .filter((l) => !q || [l.name, l.phone, l.email, l.course, l.message].join(' ').toLowerCase().includes(q.toLowerCase())), [list, tab, q])

  if (user.role !== 'superadmin') return <Card><Empty icon="shield" title="Ruxsat yo‘q" text="Bu bo‘lim faqat bosh administrator uchun." /></Card>

  const setStatus = async (l, status) => {
    setList((xs) => xs.map((x) => (x.id === l.id ? { ...x, status } : x)))
    try { await leadsApi.setStatus(l.id, status) } catch (e) { toast(e.message, 'err'); load() }
  }
  const doDelete = async (l) => {
    try { await leadsApi.remove(l.id); setList((xs) => xs.filter((x) => x.id !== l.id)); toast('Ariza o‘chirildi') } catch (e) { toast(e.message, 'err') }
  }
  const count = (s) => (list || []).filter((l) => l.status === s).length

  return (
    <>
      <PageHead icon="mail" title="Arizalar" sub="Saytdagi formalardan kelgan so‘rovlar — qo‘ng‘iroq qilib, kerak bo‘lsa foydalanuvchi yarating"
        actions={<Btn icon="refresh" onClick={load}>Yangilash</Btn>} />
      <div className="pvtool">
        <Tabs value={tab} onChange={setTab} items={[{ value: 'new', label: 'Yangi', count: count('new') }, { value: 'done', label: 'Ko‘rib chiqilgan', count: count('done') }, { value: 'all', label: 'Barchasi', count: list?.length || 0 }]} />
        <div className="pvtool__right"><Search value={q} onChange={setQ} placeholder="Ism, telefon, kurs…" /></div>
      </div>
      <Card pad={false}>
        <Table rows={rows} empty={<Empty icon="mail" title={list ? 'Arizalar yo‘q' : 'Yuklanmoqda…'} text={list ? 'Saytdagi formalar orqali yuborilgan arizalar shu yerda paydo bo‘ladi.' : undefined} />} cols={[
          { key: 'name', label: 'Kimdan', render: (l) => <div><b>{l.name || '—'}</b><div className="mono pmuted" style={{ fontSize: 13 }}>{l.phone ? <a href={`tel:${l.phone.replace(/\s/g, '')}`}>{l.phone}</a> : l.email}</div></div> },
          { key: 'kind', label: 'Turi', render: (l) => <Badge tone={KIND[l.kind]?.tone || 'gray'}>{KIND[l.kind]?.label || l.kind}</Badge> },
          { key: 'msg', label: 'Tafsilot', render: (l) => <div style={{ maxWidth: 420, fontSize: 13.5 }}>{l.course && <b style={{ display: 'block' }}>{l.course}</b>}{l.topic && <span className="pmuted">{l.topic}{l.message ? ': ' : ''}</span>}{l.message}{!l.course && !l.topic && !l.message && <span className="pmuted">—</span>}</div> },
          { key: 'at', label: 'Vaqt', render: (l) => <span className="pmuted" style={{ fontSize: 13 }} title={fmtDateTime(l.createdAt)}>{fmtAgo(l.createdAt)}</span> },
          { key: 'status', label: 'Holat', render: (l) => l.status === 'new' ? <Badge tone="blue" dot>Yangi</Badge> : <Badge tone="green" dot>Ko‘rib chiqildi</Badge> },
          { key: 'act', label: '', align: 'right', render: (l) => (
            <Menu items={[
              l.status === 'new'
                ? { label: 'Ko‘rib chiqildi', icon: 'check', onClick: () => setStatus(l, 'done') }
                : { label: 'Yangi deb belgilash', icon: 'refresh', onClick: () => setStatus(l, 'new') },
              'sep',
              { label: 'O‘chirish', icon: 'trash', danger: true, onClick: () => setDel(l) },
            ]} />
          ) },
        ]} />
      </Card>
      <Confirm open={!!del} onClose={() => setDel(null)} danger title="Arizani o‘chirish" text={`${del?.name || del?.email || 'Ariza'} o‘chiriladi.`} confirmLabel="O‘chirish" onConfirm={() => doDelete(del)} />
    </>
  )
}
