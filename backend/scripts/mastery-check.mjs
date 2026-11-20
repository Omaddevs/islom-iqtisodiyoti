// O'zlashtirish formulalarini metodikadagi «Hisoblash misoli» bilan tekshiradi (bazasiz).
// Ishga tushirish: node scripts/mastery-check.mjs
import assert from 'node:assert/strict'

process.env.DATABASE_URL ||= 'postgres://check@127.0.0.1:1/none' // bazaga ulanilmaydi: faqat sof funksiyalar
const { DEFAULT_CFG, lessonScore, totals, gradeOf, cleanCfg, cfgOf } = await import('../lib/mastery.js')

const cfg = cfgOf({})
const full = { std: { printed: false, printedLate: false, onTime: 0, all: 0 }, vocab: { onTime: 0, all: 0 } }
// 1-dars: offline 60, test 8/10 → 16, chop etgan 10, lug'at 7/10 → 7 ⇒ 93
const l1 = lessonScore(cfg, { ...full, offline: true, live: null, rec: null, test: [{ share: 0.8, n: 1, late: false }], std: { ...full.std, printed: true }, vocab: { onTime: 0.7, all: 0.7 } })
// 2-dars: yozuvning 90% i ⇒ 60×0,9×0,8 = 43,2; test 6/10 → 12; onlayn 100% → 10; lug'at 0 ⇒ 65,2
const l2 = lessonScore(cfg, { ...full, offline: false, live: null, rec: 0.9, test: [{ share: 0.6, n: 1, late: false }], std: { ...full.std, onTime: 1, all: 1 } })
// 3-dars: qatnashmagan; test 7/10 → 14; lug'at 10/10 → 10 ⇒ 24
const l3 = lessonScore(cfg, { ...full, offline: false, live: null, rec: null, test: [{ share: 0.7, n: 1, late: false }], vocab: { onTime: 1, all: 1 } })
assert.equal(l1.O, 93); assert.equal(l1.D, 60); assert.equal(l1.T, 16); assert.equal(l1.S, 10); assert.equal(l1.L, 7)
assert.equal(l2.O, 65.2); assert.equal(l2.D, 43.2); assert.equal(l2.via.D, 'rec')
assert.equal(l3.O, 24)
const rows = [l1, l2, l3].map((l, i) => ({ ...l, id: `u${i}`, weight: 1, passed: true, closed: true }))
const t = totals(cfg, rows, 3)
assert.equal(t.uNow, 60.7)
assert.equal(gradeOf(t.uNow).label, 'Qoniqarli')
assert.equal(totals(cfg, rows, 12).uCourse, 15.2)
// Xavf signali: 2- va 3-darslar 55 dan past emas (65,2), lekin davomat (60+43,2+0)/180 = 57% < 70%
assert.equal(t.risk.lowAtt, true)
assert.equal(t.risk.low2, false)
// Urinishlar: 2-urinish 100% ⇒ 90%, muddatdan keyin ⇒ ×0,8; eng yaxshisi olinadi
const tt = lessonScore(cfg, { ...full, offline: true, test: [{ share: 0.5, n: 1, late: false }, { share: 1, n: 2, late: false }, { share: 1, n: 3, late: true }] })
assert.equal(tt.T, 18)
// Bog'lanmagan komponentlar: faqat davomat va test ⇒ (60+20)/80·100
const only = lessonScore(cfg, { offline: true, test: [{ share: 1, n: 1 }], std: null, vocab: null })
assert.equal(only.O, 100)
// Test uchun eng kam chegara: T < 10 ⇒ dars o'zlashtirilmagan (O ≤ 54)
const strict = { ...cfg, minT: 10 }
const f = lessonScore(strict, { ...full, offline: true, test: [{ share: 0.4, n: 1 }], std: { ...full.std, printed: true }, vocab: { onTime: 1, all: 1 } })
assert.equal(f.failed, true); assert.equal(f.O, 54)
// Sozlamalar
assert.equal(typeof cleanCfg({ w: { D: 50, T: 30, S: 10, L: 10 } }), 'object')
assert.equal(typeof cleanCfg({ w: { D: 50, T: 30, S: 10, L: 20 } }), 'string')
assert.deepEqual(cfgOf({ mastery: { w: { D: 50, T: 30, S: 10, L: 10 } } }).w, { D: 50, T: 30, S: 10, L: 10 })
assert.equal(DEFAULT_CFG.w.D, 60)
console.log('✓ metodika misoli: 93 / 65,2 / 24 → Ujoriy 60,7 (qoniqarli), Ukurs 15,2% · urinishlar, chegaralar va sozlamalar to‘g‘ri')
