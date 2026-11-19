// Bosh sahifadagi «O'quvchilar statistikasi»: ustoz (yoki admin) o'z o'quvchilari qancha vaqt o'qigani,
// qaysi bo'limlarda o'tirgani va kim faol/faol emasligini bir qarashda ko'radi. O'quvchi qatoriga bosilsa — to'liq kartasi.
import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../store/auth.jsx'
import { Card, Badge, Empty, Icon, UAvatar, Table, cx } from '../ui/kit.jsx'
import { Donut } from '../ui/charts.jsx'
import { fmtAgo, pct } from '../ui/format.js'
import { studyApi } from '../api/study.js'
import { KINDS, fmtSpent, StackedDays } from './StudentProfile.jsx'
import '../../styles/student-profile.css'

const ORDER = Object.keys(KINDS)
const PERIODS = [{ value: 7, label: '7 kun' }, { value: 30, label: '30 kun' }]
const TOP = 8
const dayKey = (ts) => { const d = new Date(ts); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }
const keyToTs = (k) => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d).getTime() }
const rangeDays = (today, n) => Array.from({ length: n }, (_, i) => dayKey(keyToTs(today) - (n - 1 - i) * 864e5))
// Kuniga o'rtacha vaqt bo'yicha faollik darajasi (o'quvchi kartasidagi bilan bir xil)
const level = (avg) => (avg >= 30 * 60 ? ['Yuqori', 'green'] : avg >= 10 * 60 ? ['O‘rtacha', 'amber'] : avg > 0 ? ['Past', 'red'] : ['Faol emas', 'gray'])

const readDays = () => { try { return Number(localStorage.getItem('ii_cs_days')) || 7 } catch { return 7 } }

export default function ClassStats() {
  const { user, db, scope } = useAuth()
  const [days, setDays] = useState(readDays)
  const [groupId, setGroupId] = useState('')
  const [ov, setOv] = useState(null)
  const [err, setErr] = useState(false)
  const orgId = user.role === 'superadmin' ? scope.orgId : null
  const pickDays = (d) => { setDays(d); try { localStorage.setItem('ii_cs_days', String(d)) } catch { /* xotira */ } }

  useEffect(() => {
    let alive = true
    const load = () => studyApi.overview(days, orgId).then((d) => { if (alive) { setOv(d); setErr(false) } }).catch(() => { if (alive) setErr(true) })
    load()
    const t = setInterval(() => { if (document.visibilityState === 'visible') load() }, 60e3)
    return () => { alive = false; clearInterval(t) }
  }, [days, orgId])

  const groups = scope.groups
  const all = user.role === 'teacher' ? scope.myStudents : scope.students
  const d = useMemo(() => build({ db, groups, all, groupId, ov, days }), [db, groups, all, groupId, ov, days])
  const [showAll, setShowAll] = useState(false)

  if (!all.length) return null
  const rows = showAll ? d.rows : d.rows.slice(0, TOP)
  return (
    <Card className="pcs" title={<span className="pdt"><i className="pdt__ico"><Icon name="chart" size={17} /></i>O‘quvchilar statistikasi</span>}
      sub={`Kim, qayerda va qancha vaqt o‘qigani · oxirgi ${days} kun`}
      action={
        <div className="pcs__ctl">
          {groups.length > 1 && (
            <label className="pdsel pcs__grp"><Icon name="layers" size={16} /><span>{groups.find((x) => x.id === groupId)?.name || 'Barcha guruhlar'}</span>
              <select value={groupId} onChange={(e) => setGroupId(e.target.value)} aria-label="Guruh">
                <option value="">Barcha guruhlar</option>
                {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
              <Icon name="chevDown" size={15} />
            </label>
          )}
          <div className="sp-period" role="group" aria-label="Davr">
            {PERIODS.map((p) => <button key={p.value} type="button" className={cx(days === p.value && 'is-on')} aria-pressed={days === p.value} onClick={() => pickDays(p.value)}>{p.label}</button>)}
          </div>
        </div>
      }>
      {err && !ov && <p className="sp-err"><Icon name="alertCircle" size={16} />Vaqt statistikasini yuklab bo‘lmadi. Birozdan so‘ng yangilanadi.</p>}

      <div className="pcs__kpis">
        <Tile icon="clock" color="#2a78d6" value={ov ? fmtSpent(d.total) : '…'} label="Jami o‘qish vaqti" sub={ov ? `O‘quvchiga o‘rtacha ${fmtSpent(d.students.length ? d.total / d.students.length : 0)}` : null} />
        <Tile icon="users" color="#1baf7a" value={ov ? `${d.active} / ${d.students.length}` : '…'} label="Faol o‘quvchilar" sub={ov ? (d.idle ? `${d.idle} nafari umuman kirmagan` : 'Hammasi faol') : null} bar={pct(d.active, d.students.length)} />
        <Tile icon="clipboard" color="#6250d6" value={d.tests.n} label="Topshirilgan testlar" sub={d.tests.avg === null ? 'Bu davrda topshirilmagan' : `O‘rtacha natija ${d.tests.avg}%`} bar={d.tests.avg ?? undefined} />
        <Tile icon="fileText" color="#eb6834" value={d.hw.n} label="Topshirilgan vazifalar" sub={d.hw.pending ? `${d.hw.pending} tasi baholanmagan` : d.hw.n ? 'Hammasi baholangan' : 'Bu davrda topshirilmagan'} />
      </div>

      <div className="pcs__charts">
        <div className="pcs__daily">
          <h4 className="pcs__h">Kunlik faollik <span>barcha o‘quvchilar bo‘yicha</span></h4>
          {!ov ? <div className="sp-skel" /> : <StackedDays rows={d.dayRows} />}
        </div>
        <div className="pcs__split sp-split">
          <h4 className="pcs__h">Vaqt taqsimoti</h4>
          {!ov ? <div className="sp-skel sp-skel--round" /> : d.total ? (
            <>
              <Donut parts={ORDER.map((k) => ({ key: k, value: d.byKind[k] || 0, color: KINDS[k].color }))} center={fmtSpent(d.total)} sub="jami" />
              <ul className="sp-split__list">
                {ORDER.filter((k) => d.byKind[k]).sort((a, b) => d.byKind[b] - d.byKind[a]).map((k) => (
                  <li key={k}><i style={{ background: KINDS[k].color }} /><span>{KINDS[k].label}</span><b>{fmtSpent(d.byKind[k])}</b><em>{pct(d.byKind[k], d.total)}%</em></li>
                ))}
              </ul>
            </>
          ) : <Empty icon="clock" title="Bu davrda faollik yo‘q" text="O‘quvchilar material ochganda vaqt avtomatik hisoblanadi." />}
        </div>
      </div>

      <h4 className="pcs__h pcs__h--t">O‘quvchilar reytingi <span>sarflangan vaqt bo‘yicha · batafsil ko‘rish uchun bosing</span></h4>
      <Table rows={rows} onRow={(r) => { window.location.hash = `#/platform/users/${r.s.id}` }}
        empty={<Empty icon="users" title="Bu guruhda o‘quvchi yo‘q" />}
        cols={[
          { key: 'n', label: '#', render: (r) => <span className={cx('pcs__rank', r.rank <= 3 && r.seconds && `is-${r.rank}`)}>{r.rank}</span> },
          { key: 'name', label: 'O‘quvchi', render: (r) => <div className="pcell-user"><UAvatar user={r.s} size={34} /><div><b>{r.s.name}</b><span>{r.groups || '—'}</span></div></div> },
          { key: 'act', label: `Faollik · ${days} kun`, render: (r) => (
            <div className="sp-mini" title="Kunlik o‘qish vaqti">
              <span className="sp-mini__bars" aria-hidden>{r.bars.map((v, i) => <i key={i} className={v ? undefined : 'is-zero'} style={{ height: `${Math.max(8, (v / r.barMax) * 100)}%`, width: days > 7 ? 3 : 6 }} />)}</span>
              <b>{r.seconds ? fmtSpent(r.seconds) : '—'}<span>{r.seconds ? `${r.activeDays} kun faol` : 'Faollik yo‘q'}</span></b>
            </div>
          ) },
          { key: 'top', label: 'Ko‘p o‘qigani', render: (r) => (r.topKind ? <span className="pcs__kind"><i style={{ background: KINDS[r.topKind].color }} />{KINDS[r.topKind].label}</span> : <span className="pmuted">—</span>) },
          { key: 'tests', label: 'Testlar', render: (r) => (r.tests.n ? <span><b>{r.tests.n} ta</b> <span className={cx('pcs__score', r.tests.avg >= 80 ? 'is-good' : r.tests.avg >= 60 ? 'is-mid' : 'is-low')}>{r.tests.avg}%</span></span> : <span className="pmuted">—</span>) },
          { key: 'lvl', label: 'Daraja', render: (r) => <Badge tone={r.level[1]} dot>{r.level[0]}</Badge> },
          { key: 'last', label: 'Oxirgi faollik', render: (r) => <span className="pmuted">{r.lastAt ? fmtAgo(r.lastAt) : 'Hech qachon'}</span> },
        ]} />
      {d.rows.length > TOP && (
        <button type="button" className="pcs__more" onClick={() => setShowAll((x) => !x)}>
          {showAll ? 'Qisqartirish' : `Yana ${d.rows.length - TOP} nafar o‘quvchini ko‘rsatish`}<Icon name={showAll ? 'chevUp' : 'chevDown'} size={15} />
        </button>
      )}
    </Card>
  )
}

function Tile({ icon, color, value, label, sub, bar }) {
  return (
    <div className="pcs__kpi" style={{ '--kc': color }}>
      <span className="pcs__kpi-ico"><Icon name={icon} size={18} /></span>
      <div>
        <b>{value}</b>
        <span>{label}</span>
        {sub && <em>{sub}</em>}
        {bar !== undefined && <i className="pcs__kpi-bar"><i style={{ width: `${Math.min(100, bar)}%` }} /></i>}
      </div>
    </div>
  )
}

function build({ db, groups, all, groupId, ov, days }) {
  const g = groupId && groups.find((x) => x.id === groupId)
  const students = g ? all.filter((s) => g.studentIds.includes(s.id)) : all
  const ids = new Set(students.map((s) => s.id))
  const since = Date.now() - days * 864e5
  const keys = rangeDays(ov?.today || dayKey(Date.now()), days)
  const by = new Map((ov?.students || []).map((x) => [x.userId, x]))

  // Barcha o'quvchilar bo'yicha kunlik va bo'limlar kesimidagi vaqt
  const byKind = {}
  const dayRows = keys.map((k) => {
    const parts = {}
    for (const s of students) {
      const dk = by.get(s.id)?.dailyKinds?.[k]
      if (!dk) continue
      for (const [kind, sec] of Object.entries(dk)) { parts[kind] = (parts[kind] || 0) + sec; byKind[kind] = (byKind[kind] || 0) + sec }
    }
    return { key: k, ts: keyToTs(k), parts, total: Object.values(parts).reduce((a, b) => a + b, 0) }
  })
  const total = dayRows.reduce((a, r) => a + r.total, 0)

  const attempts = db.testAttempts.filter((a) => ids.has(a.studentId) && a.finishedAt && a.finishedAt >= since && a.total)
  const subs = db.submissions.filter((x) => ids.has(x.studentId) && (x.submittedAt || x.createdAt || 0) >= since)
  const avgOf = (list) => (list.length ? Math.round(list.reduce((a, x) => a + pct(x.score, x.total), 0) / list.length) : null)

  const rows = students.map((s) => {
    const o = by.get(s.id)
    const seconds = o?.seconds || 0
    const bars = keys.map((k) => o?.daily?.[k] || 0)
    const mine = attempts.filter((a) => a.studentId === s.id)
    const topKind = o ? Object.entries(o.kinds).sort((a, b) => b[1] - a[1])[0]?.[0] : null
    return {
      id: s.id, s, seconds, bars, barMax: Math.max(...bars, 1), activeDays: bars.filter(Boolean).length,
      groups: groups.filter((x) => x.studentIds.includes(s.id)).map((x) => x.name).join(', '),
      topKind: KINDS[topKind] ? topKind : null,
      tests: { n: mine.length, avg: avgOf(mine) },
      level: level(seconds / days),
      lastAt: Math.max(s.lastSeen || 0, o?.lastAt || 0, ...mine.map((a) => a.finishedAt)) || null,
    }
  }).sort((a, b) => b.seconds - a.seconds || (b.lastAt || 0) - (a.lastAt || 0) || a.s.name.localeCompare(b.s.name))
  rows.forEach((r, i) => { r.rank = i + 1 })

  const active = rows.filter((r) => r.seconds > 0).length
  return {
    students, total, byKind, dayRows, rows, active, idle: students.length - active,
    tests: { n: attempts.length, avg: avgOf(attempts) },
    hw: { n: subs.length, pending: subs.filter((x) => x.status !== 'graded').length },
  }
}
