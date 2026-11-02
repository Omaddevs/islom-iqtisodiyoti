// Eski demo ma'lumotlarni (oldingi versiyadagi makeSeed) bazadan o'chiradi — haqiqiy ma'lumotlarga tegmaydi.
// Foydalanuvchi faqat demo ID'si VA demo telefoni bir vaqtda mos kelsa o'chiriladi.
// Standart holatda faqat ko'rsatadi; o'chirish uchun: npm run db:purge-demo -- --yes
import { pool, tx } from '../lib/db.js'

const DEMO_USERS = {
  u_admin: '998900000001', u_oa1: '998900000002', u_t1: '998900000003', u_s1: '998900000004',
  u_t2: '998900000005', u_t3: '998900000006', u_s2: '998901112233', u_s3: '998901112234',
  u_s4: '998901112235', u_s5: '998901112236', u_s6: '998901112237', u_s7: '998901112238',
  u_s8: '998901112239', u_s9: '998901112240', u_s10: '998901112241', u_s11: '998901112242',
  u_s12: '998901112243', u_oa2: '998905551122', u_t4: '998905551123', u_s13: '998905551124',
  u_s14: '998905551125', u_s15: '998905551126',
}
const DEMO_ORGS = { org1: 'Islom Iqtisodiyoti', org2: 'Zamonaviy Ta’lim Markazi' }
const run = process.argv.includes('--yes')

await tx(async (c) => {
  const users = (await c.query('SELECT id, name, phone, role FROM users WHERE id = ANY($1)', [Object.keys(DEMO_USERS)])).rows
    .filter((u) => DEMO_USERS[u.id] === u.phone)
  const orgs = (await c.query('SELECT id, name FROM organizations WHERE id = ANY($1)', [Object.keys(DEMO_ORGS)])).rows
    .filter((o) => DEMO_ORGS[o.id] === o.name)
  // Demo tashkilotga real foydalanuvchi qo'shilgan bo'lsa — tashkilot o'chirilmaydi
  const keepOrgs = new Set((await c.query('SELECT DISTINCT org_id FROM users WHERE org_id = ANY($1) AND NOT (id = ANY($2))',
    [orgs.map((o) => o.id), users.map((u) => u.id)])).rows.map((r) => r.org_id))
  const dropOrgs = orgs.filter((o) => !keepOrgs.has(o.id))

  console.log(`Demo foydalanuvchilar: ${users.length} ta${users.length ? ` (${users.map((u) => u.name).join(', ')})` : ''}`)
  console.log(`Demo tashkilotlar: ${dropOrgs.map((o) => o.name).join(', ') || 'yo‘q'}`)
  for (const id of keepOrgs) console.log(`! ${id} tashkilotida haqiqiy foydalanuvchilar bor — tashkilot saqlab qolindi`)
  if (!run) { console.log('\nHech narsa o‘chirilmadi. O‘chirish uchun: npm run db:purge-demo -- --yes'); return }

  await c.query('DELETE FROM organizations WHERE id = ANY($1)', [dropOrgs.map((o) => o.id)]) // guruh, dars, kontent — kaskad
  await c.query('DELETE FROM users WHERE id = ANY($1)', [users.map((u) => u.id)])
  console.log('✓ Demo ma’lumotlar o‘chirildi. Endi: npm run db:seed (bosh administrator yaratiladi)')
})
await pool.end()
