// Sayt kontenti. Hozircha namunaviy ma'lumotlar — keyinchalik API/CMS bilan almashtiriladi.

export const DIRECTIONS = [
  {
    id: 'asoslar',
    title: 'Islom moliyasi asoslari',
    desc: 'Riba, g‘arar va maysir taqiqlari, shariat tamoyillari va islomiy shartnomalar nazariyasi.',
    icon: 'book', color: '#4aa3f8',
  },
  {
    id: 'bank',
    title: 'Islom banki',
    desc: 'Murabaha, mudaraba, musharaka va ijara asosida ishlovchi bank mahsulotlari va amaliyoti.',
    icon: 'bank', color: '#6366f1',
  },
  {
    id: 'sukuk',
    title: 'Sukuk va kapital bozori',
    desc: 'Sukuk turlari, emissiya jarayoni, islomiy fondlar va shariatga mos investitsiya.',
    icon: 'chart', color: '#14b8a6',
  },
  {
    id: 'takaful',
    title: 'Takaful',
    desc: 'Islomiy sug‘urta modellari: vakala, mudaraba va gibrid takaful tizimlari.',
    icon: 'shield', color: '#f59e0b',
  },
  {
    id: 'biznes',
    title: 'Halol biznes va tadbirkorlik',
    desc: 'Shariatga mos biznes modeli, sheriklik shartnomalari va halol daromad strategiyalari.',
    icon: 'briefcase', color: '#10b981',
  },
  {
    id: 'zakot',
    title: 'Zakot va vaqf',
    desc: 'Zakotni hisoblash, vaqf institutlari va ijtimoiy moliya boshqaruvi.',
    icon: 'heart', color: '#f43f5e',
  },
]

// «Fundamental» — platformaning kirish kursi (Auditorlar palatasi ma'lumotnomasida yo'q, matni loyiha uchun yozilgan).
// Qolgan to'rttasi — Auditorlar palatasining malaka sertifikatlari; matn 2026-yil 5-noyabrdagi ma'lumotnomadan.
// Narx, muddat va imtihon tartibi Nizom tasdiqlangach qo'shiladi.
export const COURSES = [
  {
    id: 'fundamental',
    kind: 'Kurs',
    title: 'Islom moliyasi bo‘yicha fundamental kurs',
    stage: 'Boshlang‘ich kurs',
    prereq: 'Talab etilmaydi',
    field: 'Islom moliyasi asoslari',
    dir: 'asoslar', icon: 'book', color: '#4aa3f8',
    goal: 'Islom moliyasining asosiy tushunchalari — riba, g‘arar va maysir taqiqlari, shariat tamoyillari va islomiy shartnomalar nazariyasi bo‘yicha mustahkam poydevor yaratish.',
    audience: [
      'islom moliyasi bilan endi tanishayotganlar;',
      'moliya sohasi talabalari va mutaxassislari;',
      'sertifikat dasturini tanlashdan oldin asosiy bilimlarni mustahkamlamoqchi bo‘lganlar.',
    ],
    requirements: [
      'boshlang‘ich kurs — boshqa kurs yoki sertifikat talab etilmaydi.',
    ],
  },
  {
    id: 'buxgalter',
    kind: 'Sertifikat',
    title: 'Islom moliyasi bo‘yicha buxgalter',
    stage: '1-bosqich (bazaviy)',
    prereq: 'Talab etilmaydi',
    field: 'Islomiy moliyaviy operatsiyalar hisobi va moliyaviy hisobot',
    icon: 'chart', color: '#14b8a6',
    goal: 'Islomiy moliyaviy shartnomalar (murobaha, ijara, mushoraka, muzoraba, salam, istisno va boshqalar) bo‘yicha operatsiyalarni AAOIFI moliyaviy hisob standartlari asosida hisobga olish, islomiy moliya institutining moliyaviy hisobotini tuzish va oshkor qilish ko‘nikmalarini shakllantirish.',
    audience: [
      'islomiy banklar va an’anaviy banklarning islomiy oynalari buxgalterlari va bosh buxgalterlari;',
      'islomiy mikromoliya, lizing, investitsiya va takaful tashkilotlarining moliya-buxgalteriya xodimlari;',
      'moliyaviy hisobot tayyorlovchi va uni tahlil qiluvchi mutaxassislar;',
      'tizimning keyingi bosqichi — auditor yoki ichki auditor sertifikatini olishni rejalashtirgan shaxslar.',
    ],
    requirements: [
      'birinchi (bazaviy) bosqich sertifikati; boshqa sertifikat talab etilmaydi;',
      'Palata tomonidan tasdiqlangan o‘quv dasturini o‘zlashtirish va sertifikatlash imtihonini topshirish;',
      'ushbu sertifikat «Auditor» va «Ichki auditor» sertifikatlarini olish uchun majburiy asos hisoblanadi.',
    ],
  },
  {
    id: 'auditor',
    kind: 'Sertifikat',
    title: 'Islom moliyasi bo‘yicha auditor',
    stage: '2-bosqich',
    prereq: '«Buxgalter» sertifikati',
    field: 'Tashqi audit va tashqi shariat auditi',
    icon: 'shield', color: '#d97706',
    goal: 'Islomiy moliya institutlari moliyaviy hisobotining tashqi auditini hamda shariat tamoyillari va qoidalariga muvofiqlikning mustaqil tashqi auditini (tashqi shariat auditi) AAOIFI audit va boshqaruv standartlari asosida o‘tkaza oladigan auditorlarni tayyorlash.',
    audience: [
      'auditorlik tashkilotlarining auditorlari va audit guruhi rahbarlari;',
      'islomiy moliya institutlariga audit xizmati ko‘rsatishni rejalashtirgan auditorlik tashkilotlari mutaxassislari;',
      'tashqi shariat auditi va ishonch (assurance) topshiriqlari bilan shug‘ullanuvchi ekspertlar.',
    ],
    requirements: [
      'ikkinchi bosqich sertifikati;',
      '«Islom moliyasi bo‘yicha buxgalter» sertifikatiga ega bo‘lish talab etiladi;',
      'buxgalter bosqichi bilimlariga qo‘shimcha ravishda audit standartlari, shariat boshqaruvi va tashqi shariat auditi modullarini o‘zlashtirish hamda imtihon topshirish.',
    ],
  },
  {
    id: 'ichki-auditor',
    kind: 'Sertifikat',
    title: 'Islom moliyasi bo‘yicha ichki auditor',
    stage: '2-bosqich',
    prereq: '«Buxgalter» sertifikati',
    field: 'Ichki audit, ichki shariat auditi va shariatga muvofiqlik nazorati',
    icon: 'briefcase', color: '#10b981',
    goal: 'Islomiy moliya institutida ichki audit, ichki shariat auditi va shariatga muvofiqlik funksiyasini tashkil etish, ichki nazorat tizimining samaradorligini baholash hamda shariat kengashi qarorlari ijrosini nazorat qilish ko‘nikmalarini shakllantirish.',
    audience: [
      'islomiy banklar va islomiy oynalarning ichki audit xizmati xodimlari;',
      'shariatga muvofiqlik (Shariah compliance), risk-menejment va ichki nazorat bo‘linmalari xodimlari;',
      'shariat kengashi kotibiyati va shariat nazorati bo‘limlari mutaxassislari.',
    ],
    requirements: [
      'ikkinchi bosqich sertifikati;',
      '«Islom moliyasi bo‘yicha buxgalter» sertifikatiga ega bo‘lish talab etiladi;',
      'buxgalter bosqichi bilimlariga qo‘shimcha ravishda boshqaruv standartlari, ichki shariat auditi va ichki nazorat modullarini o‘zlashtirish hamda imtihon topshirish.',
    ],
  },
  {
    id: 'mutaxassis',
    kind: 'Sertifikat',
    title: 'Islom moliyasi va banki bo‘yicha mutaxassis',
    stage: 'Mustaqil yo‘nalish',
    prereq: 'Talab etilmaydi',
    field: 'Islomiy bank mahsulotlari va operatsiyalari',
    volume: '48 soat auditoriya + 48 soat mustaqil ta’lim',
    dir: 'bank', icon: 'bank', color: '#6366f1',
    goal: 'Islomiy bank mahsulotlari va operatsiyalarining shariat asoslari, ularni tuzish, mijozlarga taklif etish va amalga oshirish bo‘yicha amaliy bilimlarni shakllantirish; islomiy oyna faoliyatini yuritish uchun bank xodimlarini tayyorlash.',
    audience: [
      'islomiy banklar va islomiy oynalarning front-ofis, mahsulot ishlab chiqish, moliyalashtirish va filial xodimlari;',
      'bank va nobank moliya tashkilotlarining islomiy mahsulotlar bilan ishlovchi mutaxassislari;',
      'regulyator va davlat organlarining islom moliyasi masalalari bilan shug‘ullanuvchi xodimlari;',
      'islom moliyasi sohasida faoliyat boshlamoqchi bo‘lgan mutaxassislar.',
    ],
    requirements: [
      'mustaqil yo‘nalish — boshqa sertifikat talab etilmaydi;',
      'namunaviy o‘quv dasturi hajmi: 48 soat auditoriya va 48 soat mustaqil ta’lim;',
      'o‘quv dasturini o‘zlashtirish va sertifikatlash imtihonini topshirish.',
    ],
  },
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

export const formatNum = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
