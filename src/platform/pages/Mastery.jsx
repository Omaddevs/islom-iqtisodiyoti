// O'zlashtirish ko'rsatkichi (metodika: O = D + T + S + L, Ujoriy, Ukurs, baholash shkalasi, xavf signali, sertifikat sharti).
//   #/platform/mastery                 — ustoz/admin: birinchi guruh; o'quvchi: o'z hisoboti
//   #/platform/mastery/<guruh>         — guruh jadvali
//   #/platform/mastery/<guruh>.<o'quvchi> — bitta o'quvchining darslar bo'yicha hisoboti
import { useMemo, useState } from 'react'
import { useAuth } from '../store/auth.jsx'
import { patch } from '../store/db.js'
import { PageHead, Card, Btn, Badge, Modal, FField, Input, Select, Empty, Icon, UAvatar, useToast, cx, useFormInit } from '../ui/kit.jsx'
import { fmtDate } from '../ui/format.js'
import { useMastery, GRADES, gradeOf, fmtBall, cfgOfOrg, DEFAULT_CFG } from '../api/mastery.js'
import '../../styles/mastery.css'

const PRESETS = [
  { key: 'base', label: 'Metodika bo‘yicha', w: { D: 60, T: 20, S: 10, L: 10 }, note: 'Davomatga katta urg‘u' },
  { key: 'know', label: 'Bilimga urg‘u (tavsiya)', w: { D: 50, T: 30, S: 10, L: 10 }, note: 'Test ulushi oshiriladi' },
]
const COMP = {
  D: { label: 'Davomat', short: 'D', icon: 'users' },
  T: { label: 'Test', short: 'T', icon: 'clipboard' },
  S: { label: 'Standart', short: 'S', icon: 'scale' },
  L: { label: 'Lug‘at', short: 'L', icon: 'translate' },
}
const VIA = { offline: 'Offline', live: 'Jonli efir', rec: 'Yozuv', print: 'Chop etgan', online: 'Onlayn o‘qigan' }
const dateOf = (ds) => { const [y, m, d] = ds.split('-').map(Number); return new Date(y, m - 1, d).getTime() }

export default function Mastery({ param }) {
  const { user, scope } = useAuth()
  const staff = user.role !== 'student'
  const [gidParam, sidParam] = (param || '').split('.')
  const groups = scope.groups
  const gid = groups.some((g) => g.id === gidParam) ? gidParam : groups[0]?.id || ''
  const sid = staff ? sidParam || null : user.id
  const { data, error, loading, reload } = useMastery(gid)
  const [modal, setModal] = useState(null) // method | cfg | course
  const cfg = data?.cfg || cfgOfOrg(scope.org)
  const go = (g, s) => { window.location.hash = `#/platform/mastery/${g}${s ? `.${s}` : ''}` }

  const head = (
    <PageHead icon="trending" title={sid && staff ? 'O‘quvchi hisoboti' : 'O‘zlashtirish ko‘rsatkichi'}
      crumbs={sid && staff ? [{ label: 'O‘zlashtirish', href: `#/platform/mastery/${gid}` }, { label: scope.users.find((u) => u.id === sid)?.name || 'O‘quvchi' }] : null}
      sub={staff ? 'Har bir o‘quvchining darslar bo‘yicha progressi: davomat, test, standart va lug‘at' : 'Darslar bo‘yicha natijangiz va kurs progressi'}
      actions={<>
        {groups.length > 1 && (
          <label className="pdsel"><Icon name="layers" size={16} /><span>{groups.find((g) => g.id === gid)?.name}</span>
            <select value={gid} onChange={(e) => go(e.target.value, staff ? null : null)} aria-label="Guruh">
              {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
            <Icon name="chevDown" size={15} />
          </label>
        )}
        <Btn icon="info" onClick={() => setModal('method')}>Metodika</Btn>
        {staff && <Btn icon="settings" onClick={() => setModal('course')}>Kurs sozlamalari</Btn>}
        {(user.role === 'org_admin' || user.role === 'superadmin') && scope.org && <Btn variant="primary" icon="sliders" onClick={() => setModal('cfg')}>Vaznlar</Btn>}
      </>} />
  )

  let body
  if (!groups.length) {
    body = <Card><Empty icon="layers" title={staff ? 'Guruh yo‘q' : 'Siz hali guruhga qo‘shilmagansiz'} text={staff ? 'O‘zlashtirish guruh bo‘yicha hisoblanadi — avval guruh yarating.' : 'Ustozingiz sizni guruhga qo‘shgach, natijalaringiz shu yerda ko‘rinadi.'} /></Card>
  } else if (loading && !data) {
    body = <Card><div className="pms-loading"><span className="spinner" /> Hisoblanmoqda…</div></Card>
  } else if (error && !data) {
    body = <Card><Empty icon="alertCircle" title="Natijalarni yuklab bo‘lmadi" text={error.message} action={<Btn icon="refresh" onClick={reload}>Qayta urinish</Btn>} /></Card>
  } else if (!data.lessons.length) {
    body = (
      <Card>
        <Empty icon="book" title="Hali dars yo‘q"
          text={staff ? 'O‘zlashtirish Kutubxona → Darslar bo‘limidagi dars kartalari bo‘yicha hisoblanadi. Dars yarating va unga test, standart, lug‘at, onlayn dars yoki yozuvni bog‘lang.' : 'Ustoz darslarni joylagach, har bir dars bo‘yicha natijangiz shu yerda ko‘rinadi.'}
          action={staff && <Btn variant="primary" as="a" href="#/platform/library" icon="bookOpen">Darslarga o‘tish</Btn>} />
      </Card>
    )
  } else if (sid) {
    const s = data.students.find((x) => x.id === sid)
    body = s ? <StudentReport data={data} s={s} staff={staff} /> : <Card><Empty icon="user" title="O‘quvchi bu guruhda emas" action={<Btn onClick={() => go(gid)}>Guruhga qaytish</Btn>} /></Card>
  } else {
    body = <GroupBoard data={data} onOpen={(s) => go(gid, s)} />
  }

  return (
    <>
      {head}
      {body}
      <MethodModal open={modal === 'method'} cfg={cfg} onClose={() => setModal(null)} />
      {staff && <CourseModal open={modal === 'course'} group={groups.find((g) => g.id === gid)} data={data} onClose={() => setModal(null)} onSaved={reload} />}
      {scope.org && <CfgModal open={modal === 'cfg'} org={scope.org} onClose={() => setModal(null)} onSaved={() => setTimeout(reload, 600)} />}
    </>
  )
}

/* ---------- Kichik bo'laklar ---------- */

export function GradePill({ o, failed, size }) {
  const g = gradeOf(o)
  if (!g) return <span className="pms-pill pms-pill--none">—</span>
  return (
    <span className={cx('pms-pill', `pms-pill--${g.key}`, size === 'lg' && 'pms-pill--lg')} title={`${g.label} (${g.mark})${failed ? ' · test chegarasidan past' : ''}`}>
      {fmtBall(o)}{failed && <Icon name="alertCircle" size={12} />}
    </span>
  )
}
function Ring({ value, label, sub }) {
  const g = gradeOf(value)
  const v = value === null ? 0 : Math.max(0, Math.min(100, value))
  return (
    <div className="pms-ring" style={{ '--v': v, '--c': g?.color || '#cbd5e1' }} role="img" aria-label={`${label}: ${fmtBall(value)}`}>
      <span><b>{fmtBall(value)}</b><small>{sub}</small></span>
    </div>
  )
}
const Bar = ({ value, tone }) => <span className={cx('pms-bar', tone && `pms-bar--${tone}`)}><i style={{ width: `${Math.max(0, Math.min(100, value || 0))}%` }} /></span>

/* ---------- Guruh jadvali ---------- */

function GroupBoard({ data, onOpen }) {
  const { scope } = useAuth()
  const [sort, setSort] = useState('name')
  const [only, setOnly] = useState('all')
  const people = useMemo(() => new Map(scope.users.map((u) => [u.id, u])), [scope.users])
  const rows = useMemo(() => {
    const list = data.students.map((s) => ({ ...s, user: people.get(s.id) })).filter((s) => s.user)
      .filter((s) => only === 'all' || (only === 'risk' ? !!s.risk : only === 'cert' ? s.cert.ok : true))
    const by = {
      name: (a, b) => a.user.name.localeCompare(b.user.name),
      now: (a, b) => (b.uNow ?? -1) - (a.uNow ?? -1),
      course: (a, b) => b.uCourse - a.uCourse,
      att: (a, b) => (b.att ?? -1) - (a.att ?? -1),
    }
    return list.sort(by[sort])
  }, [data.students, people, sort, only])

  const st = data.students
  const withNow = st.filter((s) => s.uNow !== null)
  const avgNow = withNow.length ? withNow.reduce((a, s) => a + s.uNow, 0) / withNow.length : null
  const avgCourse = st.length ? st.reduce((a, s) => a + s.uCourse, 0) / st.length : 0
  const risk = st.filter((s) => s.risk).length
  const cert = st.filter((s) => s.cert.ok).length
  const passed = data.lessons.filter((l) => l.passed).length
  const dist = GRADES.map((g) => ({ ...g, n: withNow.filter((s) => gradeOf(s.uNow).key === g.key).length }))

  return (
    <>
      <div className="pms-stats">
        <div className="pms-stat">
          <Ring value={avgNow} label="O‘rtacha joriy o‘zlashtirish" sub="o‘rtacha" />
          <div><b>{avgNow === null ? '—' : gradeOf(avgNow).label}</b><span>Joriy o‘zlashtirish (o‘rtacha) · {passed} ta o‘tilgan dars</span></div>
        </div>
        <div className="pms-stat">
          <span className="pms-stat__ico pms-stat__ico--blue"><Icon name="trending" size={22} /></span>
          <div><b>{fmtBall(avgCourse)}%</b><span>Kurs progressi (o‘rtacha) · {data.N} ta darsdan {passed} tasi o‘tildi</span><Bar value={avgCourse} /></div>
        </div>
        <button type="button" className={cx('pms-stat pms-stat--btn', only === 'risk' && 'is-on')} onClick={() => setOnly(only === 'risk' ? 'all' : 'risk')}>
          <span className="pms-stat__ico pms-stat__ico--red"><Icon name="alertCircle" size={22} /></span>
          <div><b>{risk}</b><span>Xavf ostida: 2 darsda O &lt; 55 yoki davomat &lt; 70%</span></div>
        </button>
        <button type="button" className={cx('pms-stat pms-stat--btn', only === 'cert' && 'is-on')} onClick={() => setOnly(only === 'cert' ? 'all' : 'cert')}>
          <span className="pms-stat__ico pms-stat__ico--green"><Icon name="award" size={22} /></span>
          <div><b>{cert}</b><span>Sertifikat shartini bajarmoqda</span></div>
        </button>
      </div>

      <Card className="pms-board" title={<span className="pdt"><i className="pdt__ico"><Icon name="grid" size={17} /></i>{data.group.name}: darslar bo‘yicha natijalar</span>}
        sub={`${st.length} o‘quvchi · ${data.lessons.length} ta dars${data.N > data.lessons.length ? ` (kursda ${data.N} ta)` : ''} · har bir katakda O = D + T + S + L`}
        action={
          <div className="pms-ctl">
            <div className="pms-dist" aria-label="Baholar taqsimoti">
              {dist.map((g) => <span key={g.key} title={`${g.label}: ${g.n} ta`}><i style={{ background: g.color }} />{g.n}</span>)}
            </div>
            <Select value={sort} onChange={setSort} aria-label="Saralash" options={[{ value: 'name', label: 'Ism bo‘yicha' }, { value: 'now', label: 'Joriy o‘zlashtirish' }, { value: 'course', label: 'Kurs progressi' }, { value: 'att', label: 'Davomat' }]} />
          </div>}>
        {!rows.length ? <Empty icon="users" title={only === 'all' ? 'Guruhda o‘quvchi yo‘q' : 'Bunday o‘quvchi yo‘q'} /> : (
          <div className="pms-scroll">
            <table className="pms-table">
              <thead>
                <tr>
                  <th className="pms-sticky">O‘quvchi</th>
                  {data.lessons.map((l) => (
                    <th key={l.id} className={cx('pms-lcol', !l.passed && 'is-future')} title={`${l.title} · ${fmtDate(dateOf(l.date))}${l.passed ? '' : l.held === false ? ' (hali o‘tilmagan)' : ' (topshiriq bog‘lanmagan va davomat belgilanmagan — hisobga olinmaydi)'}`}>
                      <a href={`#/platform/library/unit.${l.id}`}>D{l.num || ''}</a><small>{fmtDate(dateOf(l.date)).replace(/ \d{4}$/, '')}</small>
                    </th>
                  ))}
                  <th>U<sub>joriy</sub></th>
                  <th>U<sub>kurs</sub></th>
                  <th>Davomat</th>
                  <th>Holat</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((s) => (
                  <tr key={s.id} onClick={() => onOpen(s.id)} tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter') onOpen(s.id) }}>
                    <td className="pms-sticky"><span className="pms-who"><UAvatar user={s.user} size={30} /><b>{s.user.name}</b></span></td>
                    {s.lessons.map((l) => <td key={l.id} className={cx(!l.passed && 'is-future')}>{l.passed || l.O > 0 ? <GradePill o={l.O} failed={l.failed} /> : <span className="pms-dash">·</span>}</td>)}
                    <td><GradePill o={s.uNow} /></td>
                    <td><span className="pms-num">{fmtBall(s.uCourse)}%</span><Bar value={s.uCourse} /></td>
                    <td><span className={cx('pms-num', s.att !== null && s.att < 70 && 'is-bad')}>{s.att === null ? '—' : `${Math.round(s.att)}%`}</span></td>
                    <td>
                      {s.risk ? <Badge tone="red" dot>Xavf</Badge> : s.cert.ok ? <Badge tone="green" dot>Sertifikat</Badge> : <Badge tone="gray">Jarayonda</Badge>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="pms-legend">
          {GRADES.map((g) => <span key={g.key}><i style={{ background: g.color }} />{g.range} · {g.label} ({g.mark})</span>)}
          <span><Icon name="alertCircle" size={13} />test chegarasidan past</span>
        </div>
      </Card>
    </>
  )
}

/* ---------- Bitta o'quvchi ---------- */

function StudentReport({ data, s, staff }) {
  const { scope, db } = useAuth()
  const u = scope.users.find((x) => x.id === s.id) || db.users.find((x) => x.id === s.id)
  const [open, setOpen] = useState(null)
  const { cfg } = data
  const g = gradeOf(s.uNow)
  const lessons = data.lessons.map((l, i) => ({ ...l, r: s.lessons[i] }))
  const certItems = [
    { ok: s.cert.u, label: `Kurs progressi ≥ ${cfg.cert.u}%`, value: `${fmtBall(s.uCourse)}%` },
    { ok: s.cert.att, label: `Darslarda qatnashish ≥ ${cfg.cert.att}%`, value: s.att === null ? '—' : `${Math.round(s.att)}%` },
    { ok: s.cert.final, label: `Yakuniy test ≥ ${cfg.cert.final}%`, value: s.cert.final === null ? 'belgilanmagan' : s.cert.finalPct === null ? 'topshirilmagan' : `${s.cert.finalPct}%` },
  ]

  return (
    <>
      <div className="pms-hero">
        <div className="pms-hero__who">
          {u && <UAvatar user={u} size={56} />}
          <div>
            <h2>{u?.name || 'O‘quvchi'}</h2>
            <span>{data.group.name} · {s.passed} ta o‘tilgan dars, kursda {data.N} ta</span>
            {s.risk && (
              <p className="pms-risk"><Icon name="alertCircle" size={16} />
                {[s.risk.low2 && 'Ketma-ket 2 ta darsda o‘zlashtirish 55 balldan past', s.risk.lowAtt && `Davomat ${Math.round(s.att)}% — 70% dan past`].filter(Boolean).join(' · ')}
              </p>
            )}
          </div>
        </div>
        <div className="pms-hero__kpis">
          <div className="pms-kpi">
            <Ring value={s.uNow} label="Joriy o‘zlashtirish" sub={g ? g.label : 'hali yo‘q'} />
            <span>Joriy o‘zlashtirish<small>qanchalik yaxshi o‘zlashtiryapti</small></span>
          </div>
          <div className="pms-kpi pms-kpi--bar">
            <b>{fmtBall(s.uCourse)}%</b>
            <Bar value={s.uCourse} tone="blue" />
            <span>Kurs progressi<small>kursning qancha qismi bosib o‘tildi</small></span>
          </div>
          <div className="pms-kpi pms-kpi--bar">
            <b>{s.att === null ? '—' : `${Math.round(s.att)}%`}</b>
            <Bar value={s.att || 0} tone={s.att !== null && s.att < 70 ? 'red' : 'green'} />
            <span>Davomat<small>o‘tilgan darslar bo‘yicha</small></span>
          </div>
        </div>
      </div>

      <div className="pms-grid">
        <Card className="pms-lessons" title={<span className="pdt"><i className="pdt__ico"><Icon name="list" size={17} /></i>Darslar bo‘yicha</span>}
          sub={`O = D (${cfg.w.D}) + T (${cfg.w.T}) + S (${cfg.w.S}) + L (${cfg.w.L}) · qatorni bosing — tafsilotlar`}>
          <div className="pms-scroll">
            <table className="pms-table pms-table--lessons">
              <thead><tr><th>Dars</th><th>D</th><th>T</th><th>S</th><th>L</th><th>O</th></tr></thead>
              <tbody>
                {lessons.map((l) => {
                  const r = l.r
                  const on = open === l.id
                  return [
                    <tr key={l.id} className={cx(!l.passed && 'is-future', on && 'is-open')} onClick={() => setOpen(on ? null : l.id)} tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter') setOpen(on ? null : l.id) }}>
                      <td><span className="pms-lname"><b>{l.title}</b><small>{fmtDate(dateOf(l.date))}{l.held === false ? ' · hali o‘tilmagan' : !l.passed ? ' · topshiriq bog‘lanmagan va davomat belgilanmagan — hisobga olinmaydi' : l.closed ? '' : ` · muddat ${fmtDate(dateOf(l.due))}`}</small></span></td>
                      <td><Cell v={r.D} max={cfg.w.D} sub={VIA[r.via?.D]} /></td>
                      <td><Cell v={r.T} max={cfg.w.T} sub={r.T !== null && r.attempts ? `${r.attempts} urinish` : null} /></td>
                      <td><Cell v={r.S} max={cfg.w.S} sub={VIA[r.via?.S]} /></td>
                      <td><Cell v={r.L} max={cfg.w.L} /></td>
                      <td>{l.passed || r.O > 0 ? <GradePill o={r.O} failed={r.failed} /> : <span className="pms-dash">·</span>}</td>
                    </tr>,
                    on && <tr key={`${l.id}-d`} className="pms-detail"><td colSpan={6}><LessonDetail l={l} r={r} cfg={cfg} staff={staff} /></td></tr>,
                  ]
                })}
              </tbody>
            </table>
          </div>
        </Card>

        <div className="pms-side">
          <Card title={<span className="pdt"><i className="pdt__ico"><Icon name="award" size={17} /></i>Sertifikat sharti</span>}>
            <ul className="pms-cert">
              {certItems.map((c) => (
                <li key={c.label} className={cx(c.ok === true ? 'is-ok' : c.ok === null ? 'is-na' : 'is-no')}>
                  <Icon name={c.ok === true ? 'checkCircle' : c.ok === null ? 'minus' : 'x'} size={17} />
                  <span>{c.label}</span><b>{c.value}</b>
                </li>
              ))}
            </ul>
            <p className={cx('pms-cert__sum', s.cert.ok && 'is-ok')}>{s.cert.ok ? 'Barcha shartlar bajarilgan — sertifikat olishga loyiq.' : 'Sertifikat uchun barcha shartlar bajarilishi kerak.'}</p>
          </Card>
          <Card title={<span className="pdt"><i className="pdt__ico"><Icon name="chart" size={17} /></i>Dinamika</span>} sub="Har bir o‘tilgan dars bo‘yicha O">
            <Spark lessons={lessons.filter((l) => l.passed)} />
          </Card>
        </div>
      </div>
    </>
  )
}

function Cell({ v, max, sub }) {
  if (v === null) return <span className="pms-cell is-na" title="Bu darsga bog‘lanmagan">—</span>
  return <span className="pms-cell"><b>{fmtBall(v)}</b><small>/{max}</small>{sub && <em>{sub}</em>}</span>
}

function LessonDetail({ l, r, cfg, staff }) {
  const d = r.detail
  const items = [
    { k: 'D', text: d.offline ? 'Offline darsda qatnashgan (ustoz belgilagan)' : d.live ? `Jonli efirda ${fmtBall(d.live)}% vaqt qatnashgan` : d.rec ? `Dars yozuvining ${fmtBall(d.rec)}% i ko‘rilgan (×${String(cfg.recFactor ?? 0.8).replace('.', ',')})` : 'Qatnashish qayd etilmagan',
      hint: [l.links.meeting && 'onlayn dars', 'offline', l.links.video && 'yozuv'].filter(Boolean).join(' / ') },
    r.T !== null && { k: 'T', text: d.test.attempts.length ? d.test.attempts.map((a) => `${a.n}-urinish: ${a.score}/${a.total}${a.late ? ' (muddatdan keyin)' : ''}`).join(' · ') : 'Test hali topshirilmagan', link: l.links.test && `#/platform/tests/${l.links.test.id}`, title: l.links.test?.title },
    r.S !== null && { k: 'S', text: d.std.printed ? `Chop etilgan${d.std.printedLate ? ' (muddatdan keyin)' : ''}` : d.std.read ? `Onlayn o‘qilgan: ${fmtBall(d.std.read)}% · ${d.std.minutes} daqiqa faol` : 'Standart hali ochilmagan', link: l.links.standard && `#/platform/library/item.${l.links.standard.id}`, title: l.links.standard?.title },
    r.L !== null && { k: 'L', text: `${d.vocab.learned} / ${d.vocab.total} atama o‘rganilgan`, link: l.links.vocab && `#/platform/vocabulary/${l.links.vocab.id}`, title: l.links.vocab?.title },
  ].filter(Boolean)
  return (
    <div className="pms-ld">
      {items.map((x) => (
        <div key={x.k} className="pms-ld__row">
          <span className="pms-ld__k"><Icon name={COMP[x.k].icon} size={15} />{COMP[x.k].label}</span>
          <span className="pms-ld__t">{x.text}{x.hint && <small> · manbalar: {x.hint}</small>}</span>
          {x.link && <a href={x.link} className="pms-ld__a">{x.title || 'Ochish'}<Icon name="arrowUpRight" size={14} /></a>}
        </div>
      ))}
      {r.failed && <p className="pms-ld__warn"><Icon name="alertCircle" size={15} />Test bali {cfg.minT} dan past — dars o‘zlashtirilmagan hisoblanadi.</p>}
      {r.scaled && <p className="pms-ld__note">Bu darsga barcha komponentlar bog‘lanmagan — bog‘lanmaganlarining vazni qolganlariga mutanosib taqsimlangan.</p>}
      <p className="pms-ld__note">Dars sanasi: {fmtDate(dateOf(l.date))} · T, S, L muddati: {fmtDate(dateOf(l.due))}{staff ? <> · <a href={`#/platform/library/unit.${l.id}`}>Darsni ochish</a></> : null}</p>
    </div>
  )
}

function Spark({ lessons }) {
  if (!lessons.length) return <p className="pmuted">O‘tilgan dars hali yo‘q.</p>
  const W = 300, H = 120, P = 10
  const xs = (i) => P + (lessons.length === 1 ? (W - 2 * P) / 2 : (i * (W - 2 * P)) / (lessons.length - 1))
  const ys = (v) => H - P - (v / 100) * (H - 2 * P)
  const pts = lessons.map((l, i) => [xs(i), ys(l.r.O)])
  return (
    <svg className="pms-spark" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Darslar bo‘yicha O dinamikasi">
      {[55, 71, 86].map((t) => <line key={t} x1={P} x2={W - P} y1={ys(t)} y2={ys(t)} className="pms-spark__grid" />)}
      {pts.length > 1 && <polyline points={pts.map((p) => p.join(',')).join(' ')} className="pms-spark__line" />}
      {pts.map(([x, y], i) => <circle key={lessons[i].id} cx={x} cy={y} r="4.5" fill={gradeOf(lessons[i].r.O).color}><title>{`${lessons[i].title}: ${fmtBall(lessons[i].r.O)}`}</title></circle>)}
    </svg>
  )
}

/* ---------- Metodika ---------- */

function MethodModal({ open, cfg, onClose }) {
  const w = cfg.w
  return (
    <Modal open={open} onClose={onClose} width={760} title="O‘zlashtirish ko‘rsatkichini hisoblash metodikasi" sub="Ballar har safar xom ma’lumotdan qayta hisoblanadi — vaznlar o‘zgarsa, barcha natijalar avtomatik yangilanadi">
      <div className="pms-method">
        <h4>1. Bitta dars bo‘yicha ko‘rsatkich (0–100 ball)</h4>
        <p className="pms-formula">O = D + T + S + L</p>
        <table className="pms-mtable">
          <thead><tr><th>Komponent</th><th>Vazni</th><th>Qanday hisoblanadi</th></tr></thead>
          <tbody>
            <tr><td>D: Davomat</td><td>{w.D}</td><td>Offline qatnashish (ustoz belgilaydi): {w.D}. Onlayn jonli efir: {w.D} × (efirda bo‘lgan vaqt / dars davomiyligi). Dars yozuvini keyin ko‘rish: {w.D} × ko‘rilgan ulush × 0,8.</td></tr>
            <tr><td>T: Test</td><td>{w.T}</td><td>{w.T} × (to‘g‘ri javoblar / jami savollar). 3 tagacha urinish, eng yaxshisi olinadi; 2- va 3-urinishga −10% jarima.</td></tr>
            <tr><td>S: Standart</td><td>{w.S}</td><td>Chop etgan bo‘lsa: {w.S} (ustoz belgilaydi yoki platformada «Chop etish»). Onlayn o‘qigan bo‘lsa: {w.S} × o‘qilgan ulush — oxirigacha ko‘rilgan sahifalar va eng kam {cfg.readMin ?? 10} daqiqa faol vaqt bilan. Qaysi biri yuqori bo‘lsa, o‘shanisi olinadi.</td></tr>
            <tr><td>L: Lug‘at</td><td>{w.L}</td><td>{w.L} × (o‘rganilgan atamalar / to‘plamdagi jami atamalar).</td></tr>
          </tbody>
        </table>
        <p className="pmuted">Darsga biror komponent (test, standart, lug‘at) bog‘lanmagan bo‘lsa, uning vazni qolganlariga mutanosib taqsimlanadi. Hech qanday topshiriq bog‘lanmagan va davomat belgilanmagan dars hisobga olinmaydi.{cfg.minT > 0 && ` Test bali ${cfg.minT} dan past bo‘lsa, dars o‘zlashtirilmagan hisoblanadi (O ko‘pi bilan 54).`}</p>

        <h4>Firibgarlikning oldini olish</h4>
        <ul>
          <li>Darsga bog‘langan test faqat davomat qayd etilgandan yoki standart ochilgandan keyin ochiladi.</li>
          <li>Test savollari va javob variantlari tasodifiy tartibda chiqadi, vaqt cheklovi qo‘yiladi.</li>
          <li>Onlayn o‘qishda faqat faol vaqt hisoblanadi: sahifa ko‘rinmasa yoki bir necha daqiqa harakatsiz qolsa, vaqt hisobga olinmaydi.</li>
          <li>Muddati o‘tgandan keyin bajarilgan T, S va L topshiriqlari × 0,8 koeffitsiyent bilan hisoblanadi.</li>
        </ul>

        <h4>2. Umumiy o‘zlashtirish ko‘rsatkichi</h4>
        <p><b>a) Joriy o‘zlashtirish</b> (shu kungacha o‘tilgan n ta dars): <span className="pms-formula pms-formula--in">U<sub>joriy</sub> = Σ(w<sub>i</sub> × O<sub>i</sub>) / Σw<sub>i</sub></span>. w<sub>i</sub> — darsning vazni (soatlari); barcha darslar teng bo‘lsa w = 1.</p>
        <p><b>b) Kurs bo‘yicha progress</b> (kursdagi barcha N ta dars, o‘tilmaganlar 0 ball): <span className="pms-formula pms-formula--in">U<sub>kurs</sub> = ΣO<sub>i</sub> / N</span>.</p>
        <p className="pmuted">Birinchisi o‘quvchi qanchalik yaxshi o‘zlashtirayotganini, ikkinchisi kursning qancha qismini bosib o‘tganini ko‘rsatadi.</p>

        <h4>3. Baholash shkalasi</h4>
        <div className="pms-scale">
          {GRADES.map((g) => <span key={g.key} style={{ '--c': g.color }}><b>{g.range}</b>{g.label} ({g.mark})<i>{g.name}</i></span>)}
        </div>
        <p><b>Xavf signali:</b> ketma-ket 2 ta darsda O &lt; 55 bo‘lsa yoki davomat 70% dan pastga tushsa, o‘qituvchi va o‘quvchiga avtomatik ogohlantirish yuboriladi{cfg.alerts === false ? ' (hozir o‘chirilgan)' : ''}.</p>
        <p><b>Sertifikat sharti:</b> U<sub>kurs</sub> ≥ {cfg.cert.u}, darslarda qatnashish ≥ {cfg.cert.att}% va yakuniy test ≥ {cfg.cert.final}%.</p>
      </div>
    </Modal>
  )
}

/* ---------- Tashkilot: vaznlar va chegaralar ---------- */

function CfgModal({ open, org, onClose, onSaved }) {
  const toast = useToast()
  const [f, setF] = useState(DEFAULT_CFG)
  const [err, setErr] = useState('')
  useFormInit(open, org.id, () => { setErr(''); setF(cfgOfOrg(org)) })
  const setW = (k, v) => setF((x) => ({ ...x, w: { ...x.w, [k]: v } }))
  const setC = (k, v) => setF((x) => ({ ...x, cert: { ...x.cert, [k]: v } }))
  const sum = ['D', 'T', 'S', 'L'].reduce((s, k) => s + (Number(f.w[k]) || 0), 0)
  const submit = () => {
    const w = Object.fromEntries(Object.entries(f.w).map(([k, v]) => [k, Number(v)]))
    if (Object.values(w).some((v) => !Number.isInteger(v) || v < 0 || v > 100)) return setErr('Vaznlar 0 dan 100 gacha butun son bo‘lsin')
    if (sum !== 100) return setErr(`Vaznlar yig‘indisi 100 bo‘lishi kerak (hozir ${sum})`)
    const minT = Number(f.minT) || 0
    if (minT < 0 || minT > w.T) return setErr(`Test chegarasi 0 dan ${w.T} gacha bo‘lsin`)
    patch('organizations', org.id, { mastery: { w, minT, alerts: f.alerts !== false, cert: Object.fromEntries(Object.entries(f.cert).map(([k, v]) => [k, Number(v)])) } })
    toast('Metodika sozlamalari saqlandi — natijalar qayta hisoblanadi')
    onSaved?.()
    onClose()
  }
  return (
    <Modal open={open} onClose={onClose} width={640} title="Metodika sozlamalari" sub={`${org.name} uchun: komponentlar vazni va chegaralar`}
      footer={<>{err && <span className="pms-err">{err}</span>}<Btn onClick={onClose}>Bekor</Btn><Btn variant="primary" icon="check" onClick={submit}>Saqlash</Btn></>}>
      <div className="pform">
        <div className="pms-presets">
          {PRESETS.map((p) => {
            const on = ['D', 'T', 'S', 'L'].every((k) => Number(f.w[k]) === p.w[k])
            return (
              <button key={p.key} type="button" className={cx('pms-preset', on && 'is-on')} onClick={() => setF((x) => ({ ...x, w: { ...p.w } }))}>
                <b>{p.w.D}/{p.w.T}/{p.w.S}/{p.w.L}</b><span>{p.label}</span><small>{p.note}</small>
              </button>
            )
          })}
        </div>
        <div className="pms-weights">
          {['D', 'T', 'S', 'L'].map((k) => (
            <FField key={k} label={`${COMP[k].short} · ${COMP[k].label}`}><Input type="number" min="0" max="100" value={f.w[k]} onChange={(e) => setW(k, e.target.value)} /></FField>
          ))}
        </div>
        <p className={cx('pms-sum', sum === 100 ? 'is-ok' : 'is-bad')}><Icon name={sum === 100 ? 'checkCircle' : 'alertCircle'} size={15} />Yig‘indi: {sum} / 100</p>
        <p className="pmuted">Davomatga 60% juda katta vazn: o‘quvchi testni yomon yechsa ham, faqat qatnashgani uchun «qoniqarli» olishi mumkin. Maqsad bilimni o‘lchash bo‘lsa, 50/30/10/10 nisbatini yoki test uchun eng kam chegarani tanlang.</p>
        <FField label="Test uchun eng kam chegara (ball)" hint={`T shu balldan past bo‘lsa, dars o‘zlashtirilmagan hisoblanadi. 0 — o‘chiq. Masalan: 10 (${f.w.T} dan)`}>
          <Input type="number" min="0" max={f.w.T} value={f.minT ?? 0} onChange={(e) => setF((x) => ({ ...x, minT: e.target.value }))} />
        </FField>
        <div className="pms-weights pms-weights--3">
          <FField label="Sertifikat: Ukurs ≥"><Input type="number" min="0" max="100" value={f.cert.u} onChange={(e) => setC('u', e.target.value)} /></FField>
          <FField label="Qatnashish ≥ (%)"><Input type="number" min="0" max="100" value={f.cert.att} onChange={(e) => setC('att', e.target.value)} /></FField>
          <FField label="Yakuniy test ≥ (%)"><Input type="number" min="0" max="100" value={f.cert.final} onChange={(e) => setC('final', e.target.value)} /></FField>
        </div>
        <label className="pms-check"><input type="checkbox" checked={f.alerts !== false} onChange={(e) => setF((x) => ({ ...x, alerts: e.target.checked }))} />
          <span><b>Xavf signali</b> — ketma-ket 2 ta darsda O &lt; 55 yoki davomat &lt; 70% bo‘lsa, ustoz va o‘quvchiga avtomatik xabar</span></label>
      </div>
    </Modal>
  )
}

/* ---------- Guruh: kursdagi darslar soni va yakuniy test ---------- */

function CourseModal({ open, group, data, onClose, onSaved }) {
  const { scope } = useAuth()
  const toast = useToast()
  const [f, setF] = useState({})
  useFormInit(open, group?.id, () => setF({ plannedLessons: group?.plannedLessons || '', finalTestId: group?.finalTestId || '' }))
  if (!group) return null
  const tests = scope.tests.filter((t) => !(t.groupIds || []).length || t.groupIds.includes(group.id))
  const created = data?.lessons.length || 0
  const submit = () => {
    const n = Number(f.plannedLessons) || 0
    if (!Number.isInteger(n) || n < 0 || n > 500) return toast('Darslar soni 0 dan 500 gacha bo‘lsin', 'err')
    patch('groups', group.id, { plannedLessons: n, finalTestId: f.finalTestId || null })
    toast('Kurs sozlamalari saqlandi')
    setTimeout(() => onSaved?.(), 600)
    onClose()
  }
  return (
    <Modal open={open} onClose={onClose} width={540} title="Kurs sozlamalari" sub={`${group.name} guruhi`}
      footer={<><Btn onClick={onClose}>Bekor</Btn><Btn variant="primary" icon="check" onClick={submit}>Saqlash</Btn></>}>
      <div className="pform">
        <FField label="Kursdagi jami darslar soni (N)" hint={`Ukurs = ΣO / N. Hozir ${created} ta dars yaratilgan; bo‘sh qoldirilsa N = ${created}.`}>
          <Input type="number" min="0" max="500" value={f.plannedLessons ?? ''} onChange={(e) => setF((x) => ({ ...x, plannedLessons: e.target.value }))} placeholder={String(created)} />
        </FField>
        <FField label="Yakuniy test" hint="Sertifikat sharti uchun: shu testdagi eng yaxshi natija">
          <Select value={f.finalTestId || ''} onChange={(v) => setF((x) => ({ ...x, finalTestId: v }))} placeholder="Belgilanmagan" options={tests.map((t) => ({ value: t.id, label: t.title }))} />
        </FField>
      </div>
    </Modal>
  )
}
