// Demo ma'lumotlar. Backend ulanganda shu tuzilma API javoblari bilan almashtiriladi.
const H = 3600e3, D = 24 * H
const now = Date.now()
const today = new Date(); today.setHours(0, 0, 0, 0)
const at = (dayOffset, hour, min = 0) => today.getTime() + dayOffset * D + hour * H + min * 60e3

export const ROLES = {
  superadmin: { label: 'Bosh administrator', short: 'Admin', color: '#6366f1' },
  org_admin: { label: 'Tashkilot admini', short: 'Tashkilot', color: '#f59e0b' },
  teacher: { label: 'O‘qituvchi', short: 'Ustoz', color: '#14b8a6' },
  student: { label: 'O‘quvchi', short: 'Talaba', color: '#4aa3f8' },
}

const AV = ['#4aa3f8', '#6366f1', '#14b8a6', '#f59e0b', '#10b981', '#f43f5e', '#8b5cf6', '#0ea5e9']
const color = (i) => AV[i % AV.length]
let seq = 0
const sid = (p) => `${p}${(seq++).toString(36)}`

export function makeSeed() {
  const organizations = [
    { id: 'org1', name: 'Islom Iqtisodiyoti', slug: 'islom-iqtisodiyoti', plan: 'pro', color: '#4aa3f8', phone: '+998 71 200 00 00', email: 'info@islomiqtisod.uz', createdAt: now - 400 * D, status: 'active', description: 'Islom moliyasi va iqtisodiyoti bo‘yicha bosh ta’lim markazi' },
    { id: 'org2', name: 'Zamonaviy Ta’lim Markazi', slug: 'zamonaviy-talim', plan: 'basic', color: '#14b8a6', phone: '+998 90 555 11 22', email: 'info@zamonaviy.uz', createdAt: now - 60 * D, status: 'active', description: 'Samarqand shahridagi hamkor o‘quv markazi' },
  ]

  const u = (id, orgId, role, name, phone, password, i, extra = {}) => ({
    id, orgId, role, name, phone, password, avatarColor: color(i), status: 'active',
    createdAt: now - (300 - i * 5) * D, lastSeen: now - i * 3 * H, ...extra,
  })

  const users = [
    u('u_admin', null, 'superadmin', 'Anvar Tursunov', '+998 90 000 00 01', 'admin123', 1, { title: 'Platforma egasi' }),
    u('u_oa1', 'org1', 'org_admin', 'Dilnoza Karimova', '+998 90 000 00 02', 'admin123', 2, { title: 'O‘quv bo‘limi boshlig‘i' }),
    u('u_t1', 'org1', 'teacher', 'Abdulaziz Yusupov', '+998 90 000 00 03', 'ustoz123', 3, { title: 'Islom moliyasi ustozi', bio: 'IIUM bitiruvchisi, 8 yillik tajriba' }),
    u('u_t2', 'org1', 'teacher', 'Muhammadali Rahimov', '+998 90 000 00 05', 'ustoz123', 4, { title: 'Fiqh muomalot ustozi' }),
    u('u_t3', 'org1', 'teacher', 'Nilufar Sodiqova', '+998 90 000 00 06', 'ustoz123', 5, { title: 'Arab tili ustozi' }),
    u('u_s1', 'org1', 'student', 'Jasur Aliyev', '+998 90 000 00 04', 'talaba123', 6),
    u('u_s2', 'org1', 'student', 'Madina Tosheva', '+998 90 111 22 33', 'talaba123', 7),
    u('u_s3', 'org1', 'student', 'Bekzod Nazarov', '+998 90 111 22 34', 'talaba123', 8),
    u('u_s4', 'org1', 'student', 'Sevara Qodirova', '+998 90 111 22 35', 'talaba123', 9),
    u('u_s5', 'org1', 'student', 'Otabek Islomov', '+998 90 111 22 36', 'talaba123', 10),
    u('u_s6', 'org1', 'student', 'Zilola Ergasheva', '+998 90 111 22 37', 'talaba123', 11),
    u('u_s7', 'org1', 'student', 'Sardor Xolmatov', '+998 90 111 22 38', 'talaba123', 12),
    u('u_s8', 'org1', 'student', 'Gulnora Mirzayeva', '+998 90 111 22 39', 'talaba123', 13),
    u('u_s9', 'org1', 'student', 'Umid Raxmonov', '+998 90 111 22 40', 'talaba123', 14),
    u('u_s10', 'org1', 'student', 'Kamola Yo‘ldosheva', '+998 90 111 22 41', 'talaba123', 15),
    u('u_s11', 'org1', 'student', 'Doston Berdiyev', '+998 90 111 22 42', 'talaba123', 16),
    u('u_s12', 'org1', 'student', 'Laylo Hamidova', '+998 90 111 22 43', 'talaba123', 17),
    u('u_oa2', 'org2', 'org_admin', 'Sherzod Umarov', '+998 90 555 11 22', 'admin123', 18, { title: 'Direktor' }),
    u('u_t4', 'org2', 'teacher', 'Feruza Abdullayeva', '+998 90 555 11 23', 'ustoz123', 19, { title: 'Iqtisodiyot ustozi' }),
    u('u_s13', 'org2', 'student', 'Aziz Karimov', '+998 90 555 11 24', 'talaba123', 20),
    u('u_s14', 'org2', 'student', 'Nigora Saidova', '+998 90 555 11 25', 'talaba123', 21),
    u('u_s15', 'org2', 'student', 'Rustam Toshev', '+998 90 555 11 26', 'talaba123', 22),
  ]

  const groups = [
    { id: 'g1', orgId: 'org1', name: 'IM-101', course: 'Islom moliyasi asoslari', level: 'Boshlang‘ich', teacherId: 'u_t1', studentIds: ['u_s1', 'u_s2', 'u_s3', 'u_s4', 'u_s5', 'u_s6'], schedule: [{ day: 1, time: '19:00' }, { day: 3, time: '19:00' }, { day: 5, time: '19:00' }], color: '#4aa3f8', createdAt: now - 45 * D, room: 'Onlayn' },
    { id: 'g2', orgId: 'org1', name: 'FM-204', course: 'Fiqh al-muomalot', level: 'O‘rta', teacherId: 'u_t2', studentIds: ['u_s1', 'u_s7', 'u_s8', 'u_s9'], schedule: [{ day: 2, time: '18:00' }, { day: 4, time: '18:00' }], color: '#8b5cf6', createdAt: now - 30 * D, room: 'Onlayn' },
    { id: 'g3', orgId: 'org1', name: 'AR-A1', course: 'Iqtisodiy arab tili', level: 'Boshlang‘ich', teacherId: 'u_t3', studentIds: ['u_s10', 'u_s11', 'u_s12', 'u_s2'], schedule: [{ day: 1, time: '10:00' }, { day: 3, time: '10:00' }, { day: 5, time: '10:00' }], color: '#14b8a6', createdAt: now - 20 * D, room: '2-xona' },
    { id: 'g4', orgId: 'org2', name: 'IQ-1', course: 'Iqtisodiyot nazariyasi', level: 'Boshlang‘ich', teacherId: 'u_t4', studentIds: ['u_s13', 'u_s14', 'u_s15'], schedule: [{ day: 2, time: '15:00' }, { day: 4, time: '15:00' }], color: '#f59e0b', createdAt: now - 10 * D, room: 'Onlayn' },
  ]

  const meetings = [
    { id: 'm1', orgId: 'org1', groupId: 'g1', hostId: 'u_t1', title: 'Riba va uning turlari', topic: '4-dars', startsAt: now + 25 * 60e3, durationMin: 90, status: 'scheduled', description: 'Riba an-nasiya va riba al-fadl. Zamonaviy bank amaliyotidagi misollar.' },
    { id: 'm2', orgId: 'org1', groupId: 'g2', hostId: 'u_t2', title: 'Murobaha shartnomasi', topic: '7-dars', startsAt: now - 20 * 60e3, durationMin: 80, status: 'live', description: 'Murobaha shartlari, narx belgilash, kafolatlar.' },
    { id: 'm3', orgId: 'org1', groupId: 'g3', hostId: 'u_t3', title: 'Bozor va savdo lug‘ati', topic: '5-dars', startsAt: at(1, 10), durationMin: 60, status: 'scheduled', description: 'Savdo-sotiq bilan bog‘liq 30 ta so‘z.' },
    { id: 'm4', orgId: 'org1', groupId: 'g1', hostId: 'u_t1', title: 'Islom moliyasiga kirish', topic: '1-dars', startsAt: at(-7, 19), durationMin: 90, status: 'ended', recordingId: 'v1', description: 'Kurs tanishuvi, asosiy tushunchalar.' },
    { id: 'm5', orgId: 'org1', groupId: 'g1', hostId: 'u_t1', title: 'Halol va harom daromad', topic: '2-dars', startsAt: at(-5, 19), durationMin: 90, status: 'ended', recordingId: 'v2' },
    { id: 'm6', orgId: 'org1', groupId: 'g1', hostId: 'u_t1', title: 'Zakot hisob-kitobi', topic: '3-dars', startsAt: at(-2, 19), durationMin: 90, status: 'ended', recordingId: 'v3' },
    { id: 'm7', orgId: 'org1', groupId: 'g2', hostId: 'u_t2', title: 'Ijara va istisna', topic: '8-dars', startsAt: at(2, 18), durationMin: 80, status: 'scheduled' },
    { id: 'm8', orgId: 'org2', groupId: 'g4', hostId: 'u_t4', title: 'Talab va taklif', topic: '2-dars', startsAt: at(1, 15), durationMin: 60, status: 'scheduled' },
  ]

  const videos = [
    { id: 'v1', orgId: 'org1', groupIds: ['g1'], authorId: 'u_t1', title: 'Islom moliyasiga kirish', module: '1-modul', duration: 5340, thumb: '#4aa3f8', description: 'Kurs tanishuvi: islom moliyasining maqsadlari, asosiy tamoyillari va tarixi.', createdAt: at(-7, 21), views: 41, kind: 'recording' },
    { id: 'v2', orgId: 'org1', groupIds: ['g1'], authorId: 'u_t1', title: 'Halol va harom daromad', module: '1-modul', duration: 4980, thumb: '#3b8ef0', description: 'Daromad manbalarini shariat nuqtai nazaridan tasniflash.', createdAt: at(-5, 21), views: 37, kind: 'recording' },
    { id: 'v3', orgId: 'org1', groupIds: ['g1'], authorId: 'u_t1', title: 'Zakot hisob-kitobi', module: '2-modul', duration: 5120, thumb: '#6366f1', description: 'Nisob, havl, zakot stavkalari va amaliy misollar.', createdAt: at(-2, 21), views: 22, kind: 'recording' },
    { id: 'v4', orgId: 'org1', groupIds: ['g1', 'g2'], authorId: 'u_t2', title: 'Shartnomalar tasnifi', module: 'Qo‘shimcha', duration: 2400, thumb: '#8b5cf6', description: 'Ayirboshlash, xayriya va sheriklik shartnomalari.', createdAt: at(-10, 12), views: 58, kind: 'lesson' },
    { id: 'v5', orgId: 'org1', groupIds: ['g2'], authorId: 'u_t2', title: 'Mudoraba va musharaka', module: '3-modul', duration: 3600, thumb: '#14b8a6', description: 'Sheriklik moliyalashtirish modellari.', createdAt: at(-4, 12), views: 19, kind: 'lesson' },
    { id: 'v6', orgId: 'org1', groupIds: ['g3'], authorId: 'u_t3', title: 'Arab alifbosi va talaffuz', module: '1-modul', duration: 1800, thumb: '#f59e0b', description: 'Harflar, harakatlar va o‘qish qoidalari.', createdAt: at(-15, 12), views: 64, kind: 'lesson' },
    { id: 'v7', orgId: 'org2', groupIds: ['g4'], authorId: 'u_t4', title: 'Iqtisodiyotga kirish', module: '1-modul', duration: 2700, thumb: '#f59e0b', description: 'Asosiy tushunchalar va muammolar.', createdAt: at(-3, 12), views: 9, kind: 'lesson' },
  ]

  const q = (text, options, correct) => ({ id: sid('q'), text, options, correct })
  const tests = [
    { id: 't1', orgId: 'org1', groupIds: ['g1'], authorId: 'u_t1', title: 'Islom moliyasi asoslari — 1-modul', description: 'Birinchi modul yakuni bo‘yicha nazorat testi.', timeLimit: 15, dueAt: at(3, 23, 59), createdAt: at(-3, 10), questions: [
      q('Riba so‘zining lug‘aviy ma’nosi nima?', ['Ortiqcha, ko‘payish', 'Savdo', 'Qarz', 'Foyda'], 0),
      q('Islom moliyasining asosiy manbai qaysi?', ['Konstitutsiya', 'Qur’on va Sunnat', 'Bank qonuni', 'Ijmo'], 1),
      q('G‘arar nima?', ['Noaniqlik, tavakkal', 'Ustama', 'Sadaqa', 'Ijara'], 0),
      q('Zakot nisobi oltin hisobida qancha?', ['42,5 g', '85 g', '100 g', '200 g'], 1),
      q('Qaysi shartnoma sheriklik turiga kiradi?', ['Murobaha', 'Ijara', 'Musharaka', 'Salam'], 2),
    ] },
    { id: 't2', orgId: 'org1', groupIds: ['g2'], authorId: 'u_t2', title: 'Murobaha bo‘yicha oraliq test', description: 'Murobaha shartnomasining shartlari.', timeLimit: 10, dueAt: at(5, 23, 59), createdAt: at(-1, 10), questions: [
      q('Murobahada foyda ulushi qachon belgilanadi?', ['Shartnoma tuzilganda', 'To‘lov paytida', 'Muddat oxirida', 'Belgilanmaydi'], 0),
      q('Murobaha qaysi shartnoma turiga kiradi?', ['Xayriya', 'Ayirboshlash (savdo)', 'Sheriklik', 'Kafolat'], 1),
      q('Kechikkan to‘lov uchun ustama olish…', ['Ruxsat', 'Man qilingan', 'Bank qaroriga bog‘liq', 'Faqat davlatga'], 1),
    ] },
    { id: 't3', orgId: 'org1', groupIds: ['g3'], authorId: 'u_t3', title: 'Arab tili: 1–4 darslar', description: 'Alifbo va asosiy so‘zlar.', timeLimit: 10, dueAt: at(-1, 23, 59), createdAt: at(-6, 10), questions: [
      q('«Bozor» arabchada qanday?', ['سوق', 'كتاب', 'مال', 'بيت'], 0),
      q('«Mol-mulk» arabchada qanday?', ['قلم', 'مال', 'باب', 'يد'], 1),
    ] },
  ]

  const testAttempts = [
    { id: 'ta1', testId: 't1', studentId: 'u_s2', answers: {}, score: 4, total: 5, startedAt: at(-2, 20), finishedAt: at(-2, 20, 11) },
    { id: 'ta2', testId: 't1', studentId: 'u_s3', answers: {}, score: 3, total: 5, startedAt: at(-2, 21), finishedAt: at(-2, 21, 9) },
    { id: 'ta3', testId: 't1', studentId: 'u_s4', answers: {}, score: 5, total: 5, startedAt: at(-1, 9), finishedAt: at(-1, 9, 8) },
    { id: 'ta4', testId: 't3', studentId: 'u_s10', answers: {}, score: 2, total: 2, startedAt: at(-3, 9), finishedAt: at(-3, 9, 4) },
    { id: 'ta5', testId: 't3', studentId: 'u_s2', answers: {}, score: 1, total: 2, startedAt: at(-3, 10), finishedAt: at(-3, 10, 5) },
  ]

  const term = (term, translation, definition, example) => ({ id: sid('w'), term, translation, definition, example })
  const vocabSets = [
    { id: 'vs1', orgId: 'org1', groupIds: ['g1', 'g2'], authorId: 'u_t1', title: 'Islom moliyasi atamalari', lang: 'ar → uz', createdAt: at(-12, 10), terms: [
      term('ربا', 'Riba', 'Qarz yoki ayirboshlashdagi shartlangan ustama.', 'Riba barcha ko‘rinishlarida harom.'),
      term('مرابحة', 'Murobaha', 'Xarid narxi va foydani oshkor qilib sotish.', 'Bank uy-joyni murobaha asosida sotdi.'),
      term('مضاربة', 'Mudoraba', 'Bir tomon mablag‘, ikkinchisi mehnat qo‘shadigan sheriklik.', 'Mudorabada zarar mablag‘ egasiga tushadi.'),
      term('مشاركة', 'Musharaka', 'Ikki tomon ham mablag‘ qo‘shadigan sheriklik.', 'Loyiha musharaka orqali moliyalashtirildi.'),
      term('إجارة', 'Ijara', 'Mulk yoki xizmatni haq evaziga vaqtincha berish.', 'Islomiy lizing ijaraga asoslanadi.'),
      term('غرر', 'G‘arar', 'Shartnomadagi haddan tashqari noaniqlik.', 'G‘arar tufayli shartnoma bekor bo‘ldi.'),
      term('زكاة', 'Zakot', 'Boylikdan farz bo‘lgan yillik ulush.', 'Zakot 2,5% miqdorida beriladi.'),
      term('سُكوك', 'Sukuk', 'Aktivlarga asoslangan islomiy qimmatli qog‘oz.', 'Davlat sukuk chiqardi.'),
      term('تكافل', 'Takoful', 'O‘zaro yordamga asoslangan islomiy sug‘urta.', 'Takoful jamg‘armasi zararni qopladi.'),
      term('قرض حسن', 'Qarzi hasana', 'Foizsiz, xayrli qarz.', 'Do‘stiga qarzi hasana berdi.'),
    ] },
    { id: 'vs2', orgId: 'org1', groupIds: ['g3'], authorId: 'u_t3', title: 'Bozor va savdo so‘zlari', lang: 'ar → uz', createdAt: at(-8, 10), terms: [
      term('سوق', 'Bozor', 'Savdo qilinadigan joy.', 'Bozor ertalab ochiladi.'),
      term('بيع', 'Sotish', 'Mulkni haq evaziga topshirish.', 'Sotish shartnomasi tuzildi.'),
      term('شراء', 'Sotib olish', 'Mulkni haq evaziga olish.', 'Kitob sotib oldim.'),
      term('ثمن', 'Narx', 'Tovarning qiymati.', 'Narx kelishildi.'),
      term('تاجر', 'Savdogar', 'Savdo bilan shug‘ullanuvchi.', 'Savdogar halol bo‘lsin.'),
      term('ربح', 'Foyda', 'Sarmoyadan ortiqcha daromad.', 'Foyda taqsimlandi.'),
    ] },
    { id: 'vs3', orgId: 'org2', groupIds: ['g4'], authorId: 'u_t4', title: 'Iqtisodiyot asoslari', lang: 'en → uz', createdAt: at(-2, 10), terms: [
      term('Demand', 'Talab', 'Xaridorlarning sotib olishga tayyorligi.', 'Demand increased.'),
      term('Supply', 'Taklif', 'Sotuvchilarning sotishga tayyorligi.', 'Supply is limited.'),
      term('Inflation', 'Inflyatsiya', 'Narxlarning umumiy o‘sishi.', 'Inflation rose to 10%.'),
    ] },
  ]
  const vocabProgress = [
    { id: 'vp1', setId: 'vs1', studentId: 'u_s1', learned: [vocabSets[0].terms[0].id, vocabSets[0].terms[1].id, vocabSets[0].terms[6].id] },
  ]

  const library = [
    { id: 'l1', orgId: 'org1', groupIds: [], authorId: 'u_oa1', title: 'Islom moliyasi: nazariya va amaliyot', author: 'M. Umar Chapra', type: 'book', pages: 320, year: 2019, cover: '#4aa3f8', description: 'Islom iqtisodiyoti tamoyillari va zamonaviy moliya tizimi tahlili.', createdAt: at(-40, 10) },
    { id: 'l2', orgId: 'org1', groupIds: [], authorId: 'u_oa1', title: 'AAOIFI shariat standartlari', author: 'AAOIFI', type: 'pdf', pages: 1200, year: 2022, cover: '#6366f1', description: 'Islomiy moliya institutlari uchun shariat standartlari to‘plami.', createdAt: at(-35, 10) },
    { id: 'l3', orgId: 'org1', groupIds: ['g2'], authorId: 'u_t2', title: 'Fiqh al-muomalot (qo‘llanma)', author: 'Vahba az-Zuhayliy', type: 'pdf', pages: 540, year: 2015, cover: '#8b5cf6', description: 'Muomalot fiqhi bo‘yicha fundamental asar.', createdAt: at(-20, 10) },
    { id: 'l4', orgId: 'org1', groupIds: [], authorId: 'u_t1', title: 'Zakot: savol-javoblar', author: 'A. Yusupov', type: 'audio', pages: 0, year: 2024, cover: '#10b981', description: '12 ta audio dars, har biri 15 daqiqa.', createdAt: at(-14, 10) },
    { id: 'l5', orgId: 'org1', groupIds: ['g3'], authorId: 'u_t3', title: 'Arab tili: iqtisodiy matnlar', author: 'N. Sodiqova', type: 'book', pages: 180, year: 2023, cover: '#f59e0b', description: 'Boshlang‘ich daraja uchun moslashtirilgan matnlar.', createdAt: at(-9, 10) },
    { id: 'l6', orgId: 'org1', groupIds: [], authorId: 'u_oa1', title: 'IFSB hisobotlari', author: 'IFSB', type: 'link', pages: 0, year: 2025, cover: '#0ea5e9', description: 'Islomiy moliya xizmatlari kengashining yillik hisobotlari.', url: 'https://www.ifsb.org', createdAt: at(-5, 10) },
    { id: 'l7', orgId: 'org2', groupIds: [], authorId: 'u_oa2', title: 'Iqtisodiyot nazariyasi', author: 'P. Samuelson', type: 'book', pages: 800, year: 2010, cover: '#f59e0b', description: 'Klassik darslik.', createdAt: at(-3, 10) },
  ]

  const articles = [
    { id: 'a1', orgId: 'org1', authorId: 'u_t1', groupIds: [], title: 'Nega islom moliyasi foizni rad etadi?', excerpt: 'Riba taqiqining iqtisodiy va axloqiy asoslari haqida qisqacha.', tags: ['Riba', 'Asoslar'], readTime: 6, published: true, createdAt: at(-9, 9), body: 'Islom moliyasining markaziy tamoyili — ribaning taqiqlanishi. Bu taqiq faqat diniy ko‘rsatma emas, balki adolatli taqsimot va real iqtisodiyot bilan bog‘liqlikni ta’minlovchi mexanizm hamdir.\n\nFoizli qarzda tavakkal to‘liq qarz oluvchiga yuklanadi, kreditor esa natijadan qat’i nazar daromad oladi. Islom moliyasi buning o‘rniga foyda va zararni taqsimlashni (mudoraba, musharaka) taklif qiladi.\n\nNatijada moliya real aktivlar va real faoliyatga bog‘lanadi, spekulyativ pufaklar ehtimoli kamayadi.' },
    { id: 'a2', orgId: 'org1', authorId: 'u_t2', groupIds: ['g2'], title: 'Murobaha: amaliy misollar', excerpt: 'Bank amaliyotida murobahaning to‘g‘ri va noto‘g‘ri qo‘llanilishi.', tags: ['Murobaha', 'Amaliyot'], readTime: 8, published: true, createdAt: at(-4, 9), body: 'Murobaha — xarid narxi va foyda ulushi oshkor qilingan savdo shartnomasi. Bankning o‘zi tovarni sotib olib, keyin mijozga qo‘shimcha foyda bilan sotishi shart.\n\nXato amaliyot: bank tovarni egallamasdan turib mijozga sotadi. Bu holda shartnoma aslida foizli qarzga aylanadi.\n\nTo‘g‘ri amaliyot: bank tovarni sotib oladi, egalik va tavakkalni o‘z zimmasiga oladi, keyin mijozga muddatli to‘lov bilan sotadi.' },
    { id: 'a3', orgId: 'org1', authorId: 'u_oa1', groupIds: [], title: 'Platformadan foydalanish bo‘yicha qo‘llanma', excerpt: 'Onlayn darslarga ulanish, test topshirish va uy vazifasini yuborish.', tags: ['Qo‘llanma'], readTime: 4, published: true, createdAt: at(-30, 9), body: 'Darslar bo‘limida jonli darsga «Qo‘shilish» tugmasi orqali kirasiz. Dars boshlanishidan 10 daqiqa oldin tugma faollashadi.\n\nTestlar bo‘limida muddat tugaguncha testni topshiring. Har bir testni faqat bir marta topshirish mumkin.\n\nUy vazifalarini matn ko‘rinishida yuboring; ustoz baholagach, sizga bildirishnoma keladi.' },
    { id: 'a4', orgId: 'org2', authorId: 'u_t4', groupIds: [], title: 'Bozor iqtisodiyoti nima?', excerpt: 'Bozor mexanizmi va narx shakllanishi.', tags: ['Asoslar'], readTime: 5, published: true, createdAt: at(-2, 9), body: 'Bozor iqtisodiyotida narxlar talab va taklif o‘zaro ta’siri natijasida shakllanadi.\n\nDavlatning roli — qoidalarni belgilash va bozor nosozliklarini tuzatish.' },
  ]

  const homework = [
    { id: 'h1', orgId: 'org1', groupId: 'g1', authorId: 'u_t1', title: 'Zakot hisob-kitobi (amaliy)', description: 'O‘z oilangiz (yoki shartli) mol-mulki bo‘yicha zakot nisobi va miqdorini hisoblang. Hisob-kitob bosqichlarini yozing.', dueAt: at(2, 23, 59), createdAt: at(-2, 21), maxGrade: 100 },
    { id: 'h2', orgId: 'org1', groupId: 'g1', authorId: 'u_t1', title: 'Halol daromad manbalari', description: '5 ta halol va 5 ta harom daromad manbasini dalillari bilan yozing.', dueAt: at(-3, 23, 59), createdAt: at(-5, 21), maxGrade: 100 },
    { id: 'h3', orgId: 'org1', groupId: 'g2', authorId: 'u_t2', title: 'Murobaha shartnomasi loyihasi', description: 'Avtomobil xaridi uchun murobaha shartnomasi loyihasini tuzing.', dueAt: at(4, 23, 59), createdAt: at(-1, 20), maxGrade: 100 },
    { id: 'h4', orgId: 'org1', groupId: 'g3', authorId: 'u_t3', title: 'Bozor dialogi', description: 'Sotuvchi va xaridor o‘rtasida 10 jumlali dialog yozing (arab tilida).', dueAt: at(1, 23, 59), createdAt: at(-2, 11), maxGrade: 10 },
    { id: 'h5', orgId: 'org2', groupId: 'g4', authorId: 'u_t4', title: 'Talab egri chizig‘i', description: 'Berilgan jadval asosida talab egri chizig‘ini chizing.', dueAt: at(3, 23, 59), createdAt: at(-1, 15), maxGrade: 100 },
  ]
  const submissions = [
    { id: 'sb1', homeworkId: 'h2', studentId: 'u_s1', text: 'Halol: savdo, ish haqi, ijara daromadi, sheriklik foydasi, meros. Harom: riba, qimor, o‘g‘irlik, pora, harom mahsulot savdosi. Dalillar: Baqara 275, Moida 90…', submittedAt: at(-4, 18), status: 'graded', grade: 92, feedback: 'Juda yaxshi. Dalillarni oyat raqamlari bilan keltirganingiz uchun rahmat.' },
    { id: 'sb2', homeworkId: 'h2', studentId: 'u_s2', text: 'Halol: savdo, mehnat, ijara… Harom: riba, qimor…', submittedAt: at(-3, 22), status: 'graded', grade: 78, feedback: 'Dalillar yetarli emas.' },
    { id: 'sb3', homeworkId: 'h2', studentId: 'u_s3', text: 'Halol daromadlar: savdo, hunarmandchilik, dehqonchilik, ijara, ish haqi. Harom: riba, qimor, pora, o‘g‘irlik, aldash.', submittedAt: at(-3, 23), status: 'submitted' },
    { id: 'sb4', homeworkId: 'h1', studentId: 'u_s4', text: 'Oltin 120 g × 1 000 000 = 120 mln. Nisob 85 g dan oshgan. Zakot: 120 mln × 2,5% = 3 mln so‘m.', submittedAt: at(-1, 14), status: 'submitted' },
    { id: 'sb5', homeworkId: 'h4', studentId: 'u_s10', text: 'البائع: أهلاً وسهلاً! المشتري: كم ثمن هذا الكتاب؟ …', submittedAt: at(-1, 12), status: 'graded', grade: 9, feedback: 'A’lo!' },
  ]

  const messages = [
    { id: 'c1', meetingId: 'm2', userId: 'u_t2', text: 'Assalomu alaykum! Darsni boshlaymiz, hamma eshityaptimi?', at: now - 19 * 60e3 },
    { id: 'c2', meetingId: 'm2', userId: 'u_s7', text: 'Va alaykum assalom, eshityapmiz ustoz 👍', at: now - 18 * 60e3 },
    { id: 'c3', meetingId: 'm2', userId: 'u_s8', text: 'Taqdimotni yuborib bera olasizmi?', at: now - 12 * 60e3 },
    { id: 'c4', meetingId: 'm2', userId: 'u_t2', text: 'Dars oxirida kutubxonaga joylayman.', at: now - 11 * 60e3 },
  ]

  const notifications = [
    { id: 'n1', userId: 'u_s1', text: 'Abdulaziz Yusupov «Halol daromad manbalari» vazifangizni baholadi: 92', at: at(-4, 19), read: false, href: '#/platform/homework' },
    { id: 'n2', userId: 'u_s1', text: 'Yangi test: «Islom moliyasi asoslari — 1-modul»', at: at(-3, 10), read: false, href: '#/platform/tests' },
    { id: 'n3', userId: 'u_s1', text: 'Bugun 19:00 da «Riba va uning turlari» darsi', at: at(0, 8), read: true, href: '#/platform/meetings' },
    { id: 'n4', userId: 'u_t1', text: 'Sevara Qodirova «Zakot hisob-kitobi» vazifasini yubordi', at: at(-1, 14), read: false, href: '#/platform/homework' },
    { id: 'n5', userId: 'u_t1', text: 'Bekzod Nazarov «Halol daromad manbalari» vazifasini yubordi', at: at(-3, 23), read: false, href: '#/platform/homework' },
    { id: 'n6', userId: 'u_oa1', text: 'Yangi guruh yaratildi: AR-A1', at: at(-20, 9), read: true, href: '#/platform/groups' },
    { id: 'n7', userId: 'u_admin', text: 'Yangi tashkilot qo‘shildi: Zamonaviy Ta’lim Markazi', at: at(-60, 9), read: true, href: '#/platform/organizations' },
  ]

  const activity = [
    { id: 'ac1', orgId: 'org1', userId: 'u_t1', text: 'yangi test yaratdi', target: 'Islom moliyasi asoslari — 1-modul', at: at(-3, 10) },
    { id: 'ac2', orgId: 'org1', userId: 'u_s4', text: 'uy vazifasini topshirdi', target: 'Zakot hisob-kitobi', at: at(-1, 14) },
    { id: 'ac3', orgId: 'org1', userId: 'u_oa1', text: 'o‘quvchi qo‘shdi', target: 'Laylo Hamidova → AR-A1', at: at(-2, 9) },
    { id: 'ac4', orgId: 'org1', userId: 'u_t2', text: 'maqola chop etdi', target: 'Murobaha: amaliy misollar', at: at(-4, 9) },
    { id: 'ac5', orgId: 'org1', userId: 'u_t3', text: 'lug‘at to‘plami qo‘shdi', target: 'Bozor va savdo so‘zlari', at: at(-8, 10) },
    { id: 'ac6', orgId: 'org2', userId: 'u_oa2', text: 'guruh yaratdi', target: 'IQ-1', at: at(-10, 9) },
  ]

  return { version: 1, organizations, users, groups, meetings, videos, tests, testAttempts, vocabSets, vocabProgress, library, articles, homework, submissions, messages, notifications, activity }
}
