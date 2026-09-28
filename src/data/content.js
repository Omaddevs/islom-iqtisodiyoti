// Sayt kontenti. Hozircha namunaviy ma'lumotlar — keyinchalik API/CMS bilan almashtiriladi.

export const DIRECTIONS = [
  {
    id: 'asoslar',
    title: 'Islom moliyasi asoslari',
    desc: 'Riba, g‘arar va maysir taqiqlari, shariat tamoyillari va islomiy shartnomalar nazariyasi.',
    courses: 8, duration: '2 oy', icon: 'book', color: '#4aa3f8',
  },
  {
    id: 'bank',
    title: 'Islom banki',
    desc: 'Murabaha, mudaraba, musharaka va ijara asosida ishlovchi bank mahsulotlari va amaliyoti.',
    courses: 12, duration: '3 oy', icon: 'bank', color: '#6366f1',
  },
  {
    id: 'sukuk',
    title: 'Sukuk va kapital bozori',
    desc: 'Sukuk turlari, emissiya jarayoni, islomiy fondlar va shariatga mos investitsiya.',
    courses: 7, duration: '2.5 oy', icon: 'chart', color: '#14b8a6',
  },
  {
    id: 'takaful',
    title: 'Takaful',
    desc: 'Islomiy sug‘urta modellari: vakala, mudaraba va gibrid takaful tizimlari.',
    courses: 5, duration: '1.5 oy', icon: 'shield', color: '#f59e0b',
  },
  {
    id: 'biznes',
    title: 'Halol biznes va tadbirkorlik',
    desc: 'Shariatga mos biznes modeli, sheriklik shartnomalari va halol daromad strategiyalari.',
    courses: 10, duration: '2 oy', icon: 'briefcase', color: '#10b981',
  },
  {
    id: 'zakot',
    title: 'Zakot va vaqf',
    desc: 'Zakotni hisoblash, vaqf institutlari va ijtimoiy moliya boshqaruvi.',
    courses: 6, duration: '1 oy', icon: 'heart', color: '#f43f5e',
  },
]

export const LEVELS = ['Boshlang‘ich', 'O‘rta', 'Yuqori']

export const COURSES = [
  { id: 1, title: 'Islom moliyasiga kirish', dir: 'asoslar', level: 'Boshlang‘ich', teacher: 'Abdulloh Karimov', lessons: 24, hours: 8, rating: 4.9, students: 12480, price: 0 },
  { id: 2, title: 'Murabaha: nazariya va amaliyot', dir: 'bank', level: 'O‘rta', teacher: 'Dilshod Rahimov', lessons: 32, hours: 12, rating: 4.8, students: 5210, price: 349000 },
  { id: 3, title: 'Mudaraba va musharaka shartnomalari', dir: 'bank', level: 'O‘rta', teacher: 'Muhammad Aliyev', lessons: 28, hours: 10, rating: 4.9, students: 4870, price: 349000 },
  { id: 4, title: 'Sukuk: emissiyadan investitsiyagacha', dir: 'sukuk', level: 'Yuqori', teacher: 'Jasur Sobirov', lessons: 36, hours: 14, rating: 4.8, students: 2940, price: 499000 },
  { id: 5, title: 'Takaful asoslari', dir: 'takaful', level: 'Boshlang‘ich', teacher: 'Nodira Qosimova', lessons: 18, hours: 6, rating: 4.7, students: 3150, price: 199000 },
  { id: 6, title: 'Halol biznes qurish', dir: 'biznes', level: 'Boshlang‘ich', teacher: 'Sardor Yusupov', lessons: 22, hours: 9, rating: 4.9, students: 6720, price: 249000 },
  { id: 7, title: 'Zakot hisob-kitobi amaliyoti', dir: 'zakot', level: 'Boshlang‘ich', teacher: 'Abdulloh Karimov', lessons: 12, hours: 4, rating: 4.9, students: 8300, price: 0 },
  { id: 8, title: 'Ijara va islomiy lizing', dir: 'bank', level: 'O‘rta', teacher: 'Dilshod Rahimov', lessons: 20, hours: 7, rating: 4.7, students: 2480, price: 299000 },
  { id: 9, title: 'Islomiy investitsiya fondlari', dir: 'sukuk', level: 'Yuqori', teacher: 'Jasur Sobirov', lessons: 26, hours: 11, rating: 4.8, students: 1960, price: 449000 },
  { id: 10, title: 'AAOIFI shariat standartlari', dir: 'asoslar', level: 'Yuqori', teacher: 'Muhammad Aliyev', lessons: 30, hours: 13, rating: 4.9, students: 1740, price: 549000 },
  { id: 11, title: 'Vaqf boshqaruvi', dir: 'zakot', level: 'O‘rta', teacher: 'Nodira Qosimova', lessons: 16, hours: 6, rating: 4.6, students: 1120, price: 199000 },
  { id: 12, title: 'Salam va istisna shartnomalari', dir: 'biznes', level: 'O‘rta', teacher: 'Sardor Yusupov', lessons: 19, hours: 7, rating: 4.8, students: 2210, price: 299000 },
]

export const TESTIMONIALS = [
  { name: 'Shaxzod Ergashev', role: 'Bank xodimi', course: 'Murabaha: nazariya va amaliyot', icon: 'bank', color: '#6366f1', rating: 5,
    text: 'Ishimda murabaha mahsulotlarini tushuntirishga qiynalardim. Kursdan so‘ng mijozlarga shartnoma tuzilishini aniq misollar bilan tushuntira oladigan bo‘ldim.' },
  { name: 'Madina Tojiyeva', role: 'Talaba, TDIU', course: 'Islom moliyasiga kirish', icon: 'book', color: '#4aa3f8', rating: 5,
    text: 'Bepul kurs bo‘lsa ham sifati juda yuqori. Riba va g‘arar tushunchalarini hayotiy misollar orqali o‘rgandim, diplom ishimga ham asos bo‘ldi.' },
  { name: 'Bekzod Nurmatov', role: 'Tadbirkor', course: 'Halol biznes qurish', icon: 'briefcase', color: '#10b981', rating: 5,
    text: 'Sheriklik shartnomalarini qanday tuzish kerakligini bilib oldim. Endi hamkorim bilan mudaraba asosida ishlayapmiz — hammasi shaffof.' },
  { name: 'Gulnoza Hamidova', role: 'Moliyaviy tahlilchi', course: 'Sukuk: emissiyadan investitsiyagacha', icon: 'chart', color: '#14b8a6', rating: 5,
    text: 'Sukuk bo‘yicha o‘zbek tilida bunday chuqur materialni boshqa joyda uchratmadim. Keyslar real bozor ma’lumotlariga asoslangan.' },
  { name: 'Otabek Salimov', role: 'Buxgalter', course: 'Zakot hisob-kitobi amaliyoti', icon: 'heart', color: '#f43f5e', rating: 5,
    text: 'Zakotni to‘g‘ri hisoblash uchun tayyor jadval va formulalar berildi. Oilamiz va kompaniyamiz uchun hisob-kitobni o‘zim qilyapman.' },
  { name: 'Dilnoza Karimova', role: 'Sug‘urta agenti', course: 'Takaful asoslari', icon: 'shield', color: '#f59e0b', rating: 4,
    text: 'Takaful modellarining farqini nihoyat tushundim. Ustoz savollarga tez va batafsil javob beradi, AI Ustoz ham juda qulay.' },
]

// Hamkorlar — namunaviy nomlar. Haqiqiy logolar tayyor bo‘lsa, `logo: '/partners/xxx.svg'` qo‘shing.
// mark: logo belgisi shakli (Partners.jsx dagi MARKS), color: brend rangi
export const PARTNERS = [
  { name: 'Amanah Bank', type: 'Islom banki', mark: 'ring', color: '#0f9d58' },
  { name: 'Barakat Finance', type: 'Moliya kompaniyasi', mark: 'star', color: '#4aa3f8' },
  { name: 'Sukuk Invest', type: 'Investitsiya fondi', mark: 'bars', color: '#14b8a6' },
  { name: 'Takaful Plus', type: 'Takaful', mark: 'shield', color: '#f59e0b' },
  { name: 'Nur Leasing', type: 'Ijara / lizing', mark: 'arc', color: '#6366f1' },
  { name: 'Halal Trade', type: 'Savdo platformasi', mark: 'leaf', color: '#10b981' },
  { name: 'Vaqf Fondi', type: 'Xayriya fondi', mark: 'drop', color: '#f43f5e' },
  { name: 'Ummah Pay', type: 'Fintech', mark: 'crescent', color: '#0ea5e9' },
  { name: 'Mudaraba Partners', type: 'Investitsiya', mark: 'hex', color: '#8b5cf6' },
  { name: 'Sahih Audit', type: 'Shariat auditi', mark: 'check', color: '#1d4ed8' },
  { name: 'Ilm Akademiyasi', type: 'Ta’lim', mark: 'book', color: '#ea580c' },
  { name: 'Al-Furqon Capital', type: 'Kapital bozori', mark: 'diamond', color: '#0891b2' },
  { name: 'Ijara Group', type: 'Ijara', mark: 'arc', color: '#e11d48' },
  { name: 'Zakot Markazi', type: 'Zakot', mark: 'drop', color: '#16a34a' },
  { name: 'Salam Agro', type: 'Salam moliyalash', mark: 'leaf', color: '#65a30d' },
  { name: 'Istisna Build', type: 'Istisna', mark: 'bars', color: '#d97706' },
  { name: 'Rahma Insurance', type: 'Takaful', mark: 'shield', color: '#7c3aed' },
  { name: 'Tijorat Hub', type: 'Biznes inkubator', mark: 'hex', color: '#0284c7' },
  { name: 'Iqtisod Media', type: 'Media hamkor', mark: 'ring', color: '#db2777' },
  { name: 'Amin Fintech', type: 'Fintech', mark: 'star', color: '#059669' },
]

export const CONTACTS = {
  phone: '+998 71 200 00 00',
  email: 'info@islomiqtisod.uz',
  address: 'Toshkent sh., Yunusobod tumani, Amir Temur ko‘chasi, 108',
  hours: 'Du–Ju, 09:00–18:00',
  telegram: 'https://t.me/islomiqtisod',
  instagram: 'https://instagram.com/islomiqtisod',
  youtube: 'https://youtube.com/@islomiqtisod',
  facebook: 'https://facebook.com/islomiqtisod',
}

export const dirById = (id) => DIRECTIONS.find((d) => d.id === id)

export const formatPrice = (n) =>
  n === 0 ? 'Bepul' : `${String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} so‘m`

export const formatNum = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
