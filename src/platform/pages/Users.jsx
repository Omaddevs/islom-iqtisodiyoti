import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../store/auth.jsx'
import { add, patch, remove, setDB, logActivity, notify } from '../store/db.js'
import { PageHead, Card, Btn, Badge, Tabs, Modal, FField, Input, Select, ChipSelect, Empty, Icon, UAvatar, Confirm, Menu, useToast, Table, Credentials, Search } from '../ui/kit.jsx'
import { fmtAgo, fmtDate } from '../ui/format.js'
import { ROLES } from '../store/seed.js'
import { genPassword, genPhone, prettyPhone, digits } from '../store/ids.js'
import { formatPhone, isFullPhone } from '../../utils/phone.js'
import { hashQuery } from './Meetings.jsx'

export default function Users() {
  const { user, db, scope, can } = useAuth()
  const toast = useToast()
  const isTeacher = user.role === 'teacher'
  const [role, setRole] = useState(isTeacher ? 'student' : hashQuery().get('role') || 'student')
  const [q, setQ] = useState('')
  const [groupF, setGroupF] = useState('')
  const [creating, setCreating] = useState(null) // role
  const [editing, setEditing] = useState(null)
  const [creds, setCreds] = useState(null)
  const [del, setDel] = useState(null)

  useEffect(() => { if (hashQuery().get('new')) setCreating('student') }, [])

  const base = isTeacher ? scope.myStudents : scope.users.filter((u) => u.role === role)
  const rows = useMemo(() => base.filter((u) => (u.name + u.phone).toLowerCase().includes(q.toLowerCase()))
    .filter((u) => !groupF || db.groups.some((g) => g.id === groupF && (g.studentIds.includes(u.id) || g.teacherId === u.id)))
    .map((u) => ({ ...u, groups: db.groups.filter((g) => g.studentIds.includes(u.id) || g.teacherId === u.id) })), [base, q, groupF, db.groups])

  const resetPass = (u) => { const p = genPassword(); patch('users', u.id, { password: p }); setCreds({ ...u, password: p, _note: 'Parol yangilandi. Yangi parolni foydalanuvchiga yetkazing.' }) }
  const toggleBlock = (u) => { patch('users', u.id, { status: u.status === 'blocked' ? 'active' : 'blocked' }); toast(u.status === 'blocked' ? 'Hisob faollashtirildi' : 'Hisob bloklandi') }
  const doDelete = (u) => {
    setDB((s) => ({ ...s, users: s.users.filter((x) => x.id !== u.id), groups: s.groups.map((g) => ({ ...g, studentIds: g.studentIds.filter((id) => id !== u.id), teacherId: g.teacherId === u.id ? null : g.teacherId })) }))
    toast('Foydalanuvchi o‘chirildi')
  }

  const title = isTeacher ? 'O‘quvchilarim' : 'Foydalanuvchilar'
  return (
    <>
      <PageHead icon="users" title={title} sub={isTeacher ? `${scope.myStudents.length} nafar o‘quvchi guruhlaringizda` : `${scope.students.length} o‘quvchi · ${scope.teachers.length} ustoz${scope.users.filter((u) => u.role === 'org_admin').length ? ` · ${scope.users.filter((u) => u.role === 'org_admin').length} admin` : ''}`}
        actions={<>
          {can('students.create') || can('users.create') ? <Btn variant="primary" icon="userPlus" onClick={() => setCreating('student')}>O‘quvchi qo‘shish</Btn> : null}
          {can('teachers.create') && <Btn icon="userPlus" onClick={() => setCreating('teacher')}>Ustoz qo‘shish</Btn>}
          {user.role === 'superadmin' && scope.orgId && <Btn icon="userPlus" onClick={() => setCreating('org_admin')}>Admin qo‘shish</Btn>}
        </>} />
      <div className="prow prow--between">
        {!isTeacher ? <Tabs value={role} onChange={setRole} items={[{ value: 'student', label: 'O‘quvchilar', icon: 'users', count: scope.students.length }, { value: 'teacher', label: 'Ustozlar', icon: 'user', count: scope.teachers.length }, { value: 'org_admin', label: 'Adminlar', icon: 'shield', count: scope.users.filter((u) => u.role === 'org_admin').length }]} /> : <span />}
        <div className="prow">
          <Select value={groupF} onChange={setGroupF} placeholder="Barcha guruhlar" options={scope.groups.map((g) => ({ value: g.id, label: g.name }))} style={{ height: 42, width: 180 }} />
          <Search value={q} onChange={setQ} placeholder="Ism yoki telefon…" />
        </div>
      </div>
      <Card pad={false}>
        <Table rows={rows} empty={<Empty icon="users" title="Foydalanuvchi topilmadi" text="Yangi foydalanuvchi qo‘shing — login va parol avtomatik yaratiladi." action={<Btn variant="primary" onClick={() => setCreating(isTeacher ? 'student' : role)}>Qo‘shish</Btn>} />} cols={[
          { key: 'name', label: 'Foydalanuvchi', render: (u) => <div className="pcell-user"><UAvatar user={u} size={38} /><div><b>{u.name}</b><span>{u.title || ROLES[u.role].label}</span></div></div> },
          { key: 'phone', label: 'Telefon (login)', render: (u) => <span className="mono" style={{ fontSize: 13.5 }}>{u.phone}</span> },
          { key: 'groups', label: 'Guruhlar', render: (u) => u.groups.length ? <div className="prow" style={{ gap: 4 }}>{u.groups.map((g) => <a key={g.id} href={`#/platform/groups/${g.id}`}><Badge tone="gray"><i style={{ width: 7, height: 7, borderRadius: 4, background: g.color, display: 'inline-block' }} /> {g.name}</Badge></a>)}</div> : <span className="pmuted" style={{ fontSize: 13 }}>Biriktirilmagan</span> },
          { key: 'status', label: 'Holat', render: (u) => u.status === 'blocked' ? <Badge tone="red" dot>Bloklangan</Badge> : <Badge tone="green" dot>Faol</Badge> },
          { key: 'lastSeen', label: 'Oxirgi faollik', render: (u) => <span className="pmuted" style={{ fontSize: 13 }}>{u.lastSeen ? fmtAgo(u.lastSeen) : '—'}</span> },
          { key: 'act', label: '', align: 'right', render: (u) => (
            <Menu items={[
              { label: 'Tahrirlash', icon: 'edit', onClick: () => setEditing(u) },
              { label: 'Parolni yangilash', icon: 'key', onClick: () => resetPass(u) },
              { label: 'Kirish ma’lumotlari', icon: 'copy', onClick: () => setCreds({ ...u, _note: 'Joriy kirish ma’lumotlari.' }) },
              !isTeacher && 'sep',
              !isTeacher && { label: u.status === 'blocked' ? 'Blokdan chiqarish' : 'Bloklash', icon: u.status === 'blocked' ? 'lockOpen' : 'block', onClick: () => toggleBlock(u) },
              !isTeacher && { label: 'O‘chirish', icon: 'trash', danger: true, onClick: () => setDel(u) },
            ]} />
          ) },
        ]} />
      </Card>

      <UserForm open={!!creating} role={creating} onClose={() => setCreating(null)} onCreated={(u) => setCreds({ ...u, _note: undefined })} />
      <UserForm open={!!editing} user={editing} onClose={() => setEditing(null)} />
      <Modal open={!!creds} onClose={() => setCreds(null)} title="Kirish ma’lumotlari" width={480} footer={<Btn variant="primary" onClick={() => setCreds(null)}>Tayyor</Btn>}>
        <Credentials user={creds} note={creds?._note} />
      </Modal>
      <Confirm open={!!del} onClose={() => setDel(null)} danger title="Foydalanuvchini o‘chirish" text={`${del?.name} hisobi va guruhlardagi a’zoligi o‘chiriladi.`} confirmLabel="O‘chirish" onConfirm={() => doDelete(del)} />
    </>
  )
}

// Foydalanuvchi yaratish / tahrirlash. Yaratishda telefon va parol avtomatik taklif qilinadi.
export function UserForm({ open, onClose, role, user: editUser, defaultGroupId, onCreated }) {
  const { user: me, db, scope } = useAuth()
  const toast = useToast()
  const isNew = !editUser
  const r = editUser?.role || role || 'student'
  const [f, setF] = useState({})
  const [err, setErr] = useState({})
  useEffect(() => {
    if (!open) return
    setErr({})
    const taken = new Set(db.users.map((u) => digits(u.phone)))
    setF(isNew
      ? { name: '', phone: genPhone(taken), password: genPassword(), title: '', groupIds: defaultGroupId ? [defaultGroupId] : [] }
      : { name: editUser.name, phone: editUser.phone, password: editUser.password, title: editUser.title || '', groupIds: db.groups.filter((g) => g.studentIds.includes(editUser.id) || g.teacherId === editUser.id).map((g) => g.id) })
  }, [open, editUser, isNew, defaultGroupId, db.users, db.groups])
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }))

  const submit = () => {
    const er = {}
    if (!f.name?.trim() || f.name.trim().split(' ').length < 2) er.name = 'Ism va familiyani kiriting'
    if (!isFullPhone(f.phone)) er.phone = 'Telefon raqamini to‘liq kiriting'
    else if (db.users.some((u) => digits(u.phone) === digits(f.phone) && u.id !== editUser?.id)) er.phone = 'Bu raqam allaqachon ro‘yxatdan o‘tgan'
    if (!f.password || f.password.length < 6) er.password = 'Parol kamida 6 belgi'
    setErr(er); if (Object.keys(er).length) return
    const orgId = scope.orgId || scope.groups[0]?.orgId || me.orgId
    if (isNew) {
      const colors = ['#4aa3f8', '#6366f1', '#14b8a6', '#f59e0b', '#10b981', '#f43f5e', '#8b5cf6', '#0ea5e9']
      const u = add('users', { orgId, role: r, name: f.name.trim(), phone: prettyPhone(f.phone), password: f.password, title: f.title?.trim(), avatarColor: colors[Math.floor(Math.random() * colors.length)], status: 'active', createdBy: me.id, lastSeen: null })
      applyGroups(u.id, r, f.groupIds)
      logActivity(orgId, me.id, r === 'student' ? 'o‘quvchi qo‘shdi' : r === 'teacher' ? 'ustoz qo‘shdi' : 'admin qo‘shdi', u.name)
      if (r === 'student') { const gs = db.groups.filter((g) => f.groupIds.includes(g.id)); notify([...new Set(gs.map((g) => g.teacherId).filter((id) => id && id !== me.id))], `${u.name} guruhingizga qo‘shildi (${gs.map((g) => g.name).join(', ')})`, '#/platform/groups') }
      toast(`${ROLES[r].label} yaratildi`)
      onClose(); onCreated?.(u)
    } else {
      patch('users', editUser.id, { name: f.name.trim(), phone: prettyPhone(f.phone), password: f.password, title: f.title?.trim() })
      applyGroups(editUser.id, r, f.groupIds)
      toast('Saqlandi'); onClose()
    }
  }
  // Guruhlarga biriktirish: o'quvchi -> studentIds, ustoz -> teacherId
  const applyGroups = (uid, role, ids) => setDB((s) => ({
    ...s,
    groups: s.groups.map((g) => {
      if (role === 'student') { const has = g.studentIds.includes(uid); const want = ids.includes(g.id); return has === want ? g : { ...g, studentIds: want ? [...g.studentIds, uid] : g.studentIds.filter((x) => x !== uid) } }
      if (role === 'teacher') { if (ids.includes(g.id)) return { ...g, teacherId: uid }; if (g.teacherId === uid) return { ...g, teacherId: null }; return g }
      return g
    }),
  }))

  const groupOpts = (me.role === 'teacher' ? scope.groups : db.groups.filter((g) => g.orgId === (scope.orgId || me.orgId))).map((g) => ({ value: g.id, label: g.name, color: g.color }))
  return (
    <Modal open={open} onClose={onClose} title={isNew ? `${ROLES[r].label} qo‘shish` : 'Tahrirlash'} sub={isNew ? 'Login (telefon) va parol avtomatik yaratildi — o‘zgartirishingiz mumkin' : undefined}
      footer={<><Btn onClick={onClose}>Bekor</Btn><Btn variant="primary" onClick={submit}>{isNew ? 'Yaratish' : 'Saqlash'}</Btn></>}>
      <div className="pform">
        <FField label="Ism familiya" error={err.name}><Input value={f.name || ''} onChange={(e) => set('name', e.target.value)} placeholder="Jasur Aliyev" autoFocus /></FField>
        <div className="pform__row">
          <FField label="Telefon (login)" error={err.phone}><div className="prow" style={{ flexWrap: 'nowrap' }}><Input className="pinput mono" value={f.phone || ''} onChange={(e) => set('phone', formatPhone(e.target.value))} inputMode="tel" /><Btn icon="refresh" title="Yangi raqam" onClick={() => set('phone', genPhone(new Set(db.users.map((u) => digits(u.phone)))))} /></div></FField>
          <FField label="Parol" error={err.password}><div className="prow" style={{ flexWrap: 'nowrap' }}><Input className="pinput mono" value={f.password || ''} onChange={(e) => set('password', e.target.value)} /><Btn icon="refresh" title="Yangi parol" onClick={() => set('password', genPassword())} /></div></FField>
        </div>
        {r !== 'student' && <FField label="Lavozim / mutaxassislik"><Input value={f.title || ''} onChange={(e) => set('title', e.target.value)} placeholder="Islom moliyasi ustozi" /></FField>}
        {r !== 'org_admin' && <FField label={r === 'student' ? 'Guruhlarga biriktirish' : 'Qaysi guruhlarga ustoz'}>{groupOpts.length ? <ChipSelect value={f.groupIds || []} onChange={(v) => set('groupIds', v)} options={groupOpts} /> : <span className="pmuted">Avval guruh yarating</span>}</FField>}
      </div>
    </Modal>
  )
}
