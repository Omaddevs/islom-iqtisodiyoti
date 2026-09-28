// Blog maqolalari. Hozircha namunaviy ma'lumotlar — keyinchalik API/CMS bilan almashtiriladi.
// Matn bloklari: ['h2', matn] | ['p', matn] | ['ul', [..]] | ['ol', [..]] | ['quote', matn, manba] | ['note', matn]
import { DIRECTIONS } from './content.js'

const RAW = [
  {
    slug: 'riba-nima-va-nega-taqiqlangan',
    title: 'Riba nima va nega u islom moliyasida taqiqlangan?',
    dir: 'asoslar', date: '2026-09-24', read: 7, views: 4820, featured: true,
    author: 'Abdulloh Karimov', tags: ['riba', 'foiz', 'asoslar'],
    excerpt: 'Foizli qarz va savdo o‘rtasidagi farq, ribaning turlari hamda zamonaviy bank amaliyotidagi muqobil yechimlar haqida batafsil.',
    body: [
      ['p', 'Islom moliyasining butun tizimi bitta asosiy tamoyil atrofida quriladi: pul o‘z-o‘zidan pul tug‘dirmasligi kerak. Aynan shu tamoyil riba — ya’ni oldindan belgilangan, kafolatlangan ortiqcha to‘lov taqiqida o‘z ifodasini topadi.'],
      ['h2', 'Riba tushunchasi'],
      ['p', 'Arab tilida “riba” so‘zi “ortish, ko‘payish” degan ma’noni anglatadi. Shariat istilohida esa bu — qarz yoki bir jinsli mollarni almashtirishda hech qanday real qiymat yoki xizmat evaziga bo‘lmagan qo‘shimcha to‘lovdir.'],
      ['quote', 'Alloh savdoni halol, ribani esa harom qildi.', 'Baqara surasi, 275-oyat'],
      ['h2', 'Ribaning ikki asosiy turi'],
      ['ul', [
        'Riba an-nasi’a — qarz muddatini uzaytirish evaziga olinadigan ortiqcha to‘lov. Zamonaviy bank foizi aynan shu turga kiradi.',
        'Riba al-fadl — bir jinsli ribaviy mollarni (oltin, kumush, bug‘doy va h.k.) teng bo‘lmagan miqdorda almashtirish.',
      ]],
      ['h2', 'Nega riba taqiqlangan?'],
      ['p', 'Ribaning taqiqlanishi faqat diniy ko‘rsatma emas, balki chuqur iqtisodiy mantiqqa ega. Foizli tizimda barcha risk qarz oluvchi zimmasida qoladi, qarz beruvchi esa natijadan qat’i nazar daromad oladi. Bu adolatsizlik va boylikning tor doirada to‘planishiga olib keladi.'],
      ['ol', [
        'Risk va foyda adolatli taqsimlanmaydi.',
        'Real iqtisodiyot bilan bog‘liq bo‘lmagan “havo” pul yaratiladi.',
        'Qarz yuki inflyatsiya va moliyaviy inqirozlarni kuchaytiradi.',
      ]],
      ['h2', 'Zamonaviy muqobillar'],
      ['p', 'Islom banklari foiz o‘rniga savdo, ijara va sheriklik shartnomalaridan foydalanadi: murabaha (ustama bilan sotish), ijara (lizing), mudaraba va musharaka (foyda-zararni bo‘lishish). Har birida bank real aktiv yoki biznes riskini o‘z zimmasiga oladi.'],
      ['note', 'Muhim: savdodagi ustama foyda riba hisoblanmaydi, chunki sotuvchi mulkka egalik qiladi va u bilan bog‘liq riskni ko‘taradi.'],
    ],
  },
  {
    slug: 'takaful-va-ananaviy-sugurta',
    title: 'Takaful va an’anaviy sug‘urta: nimasi bilan farq qiladi?',
    dir: 'takaful', date: '2026-09-18', read: 6, views: 2140, featured: true,
    author: 'Nodira Qosimova', tags: ['takaful', 'sug‘urta', 'vakala'],
    excerpt: 'O‘zaro yordamga asoslangan takaful modeli qanday ishlaydi va nega u an’anaviy sug‘urtaga halol muqobil hisoblanadi.',
    body: [
      ['p', 'An’anaviy sug‘urtada mijoz o‘z riskini sug‘urta kompaniyasiga “sotadi”. Bu shartnomada g‘arar (noaniqlik), maysir (tavakkal) va ko‘pincha riba elementlari mavjud. Takaful esa butunlay boshqa mantiqqa asoslanadi.'],
      ['h2', 'Takaful — o‘zaro kafolat'],
      ['p', 'Takaful ishtirokchilari umumiy fondga xayriya (tabarru’) sifatida badal kiritadi. Ulardan biriga zarar yetganda, shu fonddan yordam beriladi. Operator kompaniya esa fondni boshqaradi, lekin uning egasi emas.'],
      ['h2', 'Asosiy modellar'],
      ['ul', [
        'Vakala — operator belgilangan haq (vakolat to‘lovi) evaziga fondni boshqaradi.',
        'Mudaraba — operator investitsiya foydasidan ulush oladi.',
        'Gibrid model — boshqaruv uchun vakala, investitsiya uchun mudaraba qo‘llanadi.',
      ]],
      ['h2', 'Ortiqcha mablag‘ kimga qaytadi?'],
      ['p', 'Yil yakunida fondda ortiqcha mablag‘ (surplus) qolsa, u ishtirokchilarga qaytariladi yoki keyingi davrga o‘tkaziladi. An’anaviy sug‘urtada esa bu mablag‘ kompaniya foydasi hisoblanadi.'],
      ['note', 'Takaful fondi mablag‘lari faqat shariatga mos aktivlarga — sukuk, halol aksiyalar va real sektor loyihalariga investitsiya qilinadi.'],
    ],
  },
  {
    slug: 'murabaha-va-oddiy-kredit',
    title: 'Murabaha va oddiy kredit: 5 ta asosiy farq',
    dir: 'bank', date: '2026-09-12', read: 5, views: 3910, featured: true,
    author: 'Dilshod Rahimov', tags: ['murabaha', 'islom banki', 'kredit'],
    excerpt: 'Narx, mulk huquqi va risk taqsimoti nuqtai nazaridan ikki mahsulotni solishtiramiz.',
    body: [
      ['p', 'Tashqi ko‘rinishdan murabaha oddiy kreditga o‘xshaydi: mijoz tovarni oladi va uning pulini bo‘lib-bo‘lib to‘laydi. Ammo huquqiy va iqtisodiy mohiyati butunlay boshqacha.'],
      ['h2', '1. Shartnoma turi'],
      ['p', 'Kredit — pul qarzi, murabaha esa savdo shartnomasi. Bank avval tovarni o‘z mulkiga sotib oladi, so‘ng uni mijozga ma’lum ustama bilan sotadi.'],
      ['h2', '2. Mulk huquqi va risk'],
      ['p', 'Murabahada tovar mijozga o‘tgunga qadar bank mulki hisoblanadi va uning yo‘qolishi yoki shikastlanish riski bankda bo‘ladi. Kreditda bank hech qanday tovar riskini ko‘tarmaydi.'],
      ['h2', '3. Narxning qat’iyligi'],
      ['p', 'Murabaha narxi shartnoma tuzilgan paytda qat’iy belgilanadi va keyin o‘zgarmaydi. Kreditda esa foiz stavkasi o‘zgaruvchan bo‘lishi mumkin.'],
      ['h2', '4. Kechikish uchun jarima'],
      ['p', 'To‘lov kechiktirilsa, murabahada qarz summasi oshirilmaydi. Belgilangan jarima bo‘lsa ham, u bank daromadi hisoblanmay, xayriyaga yo‘naltiriladi.'],
      ['h2', '5. Maqsad shaffofligi'],
      ['p', 'Murabaha faqat aniq, halol tovar uchun tuziladi. Naqd pul olish yoki harom maqsadlar uchun murabaha qo‘llanmaydi.'],
      ['note', 'Xulosa: farq nomda emas, balki shartnoma tuzilmasi va riskning kim zimmasida ekanida.'],
    ],
  },
  {
    slug: 'mudaraba-va-musharaka',
    title: 'Mudaraba va musharaka: sheriklik shartnomalarini tushunish',
    dir: 'bank', date: '2026-09-06', read: 8, views: 1870,
    author: 'Muhammad Aliyev', tags: ['mudaraba', 'musharaka', 'sheriklik'],
    excerpt: 'Foyda va zararni bo‘lishishga asoslangan ikki asosiy modelning ishlash mexanizmi va amaliy misollar.',
    body: [
      ['p', 'Islom moliyasining “yuragi” — bu sheriklik. Mudaraba va musharaka shartnomalari kapital egasi va tadbirkorni natijaga birgalikda javobgar qiladi.'],
      ['h2', 'Mudaraba'],
      ['p', 'Bir tomon (rabbul-mol) kapital beradi, ikkinchi tomon (mudarib) mehnat va tajribasini qo‘shadi. Foyda oldindan kelishilgan ulushda bo‘linadi, moliyaviy zararni esa kapital egasi ko‘taradi.'],
      ['h2', 'Musharaka'],
      ['p', 'Bu yerda har ikki tomon ham kapital kiritadi. Foyda kelishilgan nisbatda, zarar esa kiritilgan kapital ulushiga mutanosib bo‘linadi.'],
      ['ul', [
        'Doimiy musharaka — sheriklik loyiha oxirigacha davom etadi.',
        'Kamayib boruvchi musharaka — mijoz bank ulushini bosqichma-bosqich sotib oladi (uy-joy moliyalashtirishda keng qo‘llanadi).',
      ]],
      ['quote', 'Foyda risk bilan birga keladi.', 'Fiqh qoidasi'],
      ['note', 'Oldindan kafolatlangan foyda summasi belgilangan sheriklik shartnomasi shariatga zid hisoblanadi.'],
    ],
  },
  {
    slug: 'sukuk-bozori-2026',
    title: 'Sukuk bozori 2026: O‘zbekiston uchun imkoniyatlar',
    dir: 'sukuk', date: '2026-08-28', read: 9, views: 2650,
    author: 'Jasur Sobirov', tags: ['sukuk', 'kapital bozori', 'investitsiya'],
    excerpt: 'Global sukuk emissiyasi tendensiyalari va mahalliy bozorga kirib kelish istiqbollari.',
    body: [
      ['p', 'Sukuk — bu real aktivlarga egalik ulushini ifodalovchi islomiy qimmatli qog‘oz. Obligatsiyadan farqli ravishda, sukuk egasi qarz beruvchi emas, balki aktiv sherigi hisoblanadi.'],
      ['h2', 'Global tendensiyalar'],
      ['p', 'So‘nggi yillarda global sukuk emissiyasi yiliga yuz milliardlab dollarni tashkil etmoqda. Asosiy emitentlar — Malayziya, Saudiya Arabistoni, Indoneziya va BAA. “Yashil sukuk” ham tez o‘sayotgan segmentga aylandi.'],
      ['h2', 'Asosiy sukuk turlari'],
      ['ul', [
        'Sukuk al-ijara — ijaraga berilgan aktivdan tushgan daromadga asoslanadi.',
        'Sukuk al-musharaka — qo‘shma loyiha foydasidan ulush beradi.',
        'Sukuk al-vakala — aktivlar portfelini boshqarishga asoslanadi.',
      ]],
      ['h2', 'O‘zbekiston uchun imkoniyatlar'],
      ['p', 'Infratuzilma, energetika va uy-joy qurilishi loyihalarini moliyalashtirish uchun sukuk yangi manba bo‘lishi mumkin. Bu, ayniqsa, foizli mahsulotlardan foydalanmaydigan aholi jamg‘armalarini iqtisodiyotga jalb qilishda muhim.'],
      ['note', 'Sukuk chiqarish uchun aniq aktiv, shariat kengashi xulosasi va mos huquqiy baza talab etiladi.'],
    ],
  },
  {
    slug: 'zakotni-qanday-hisoblash-kerak',
    title: 'Zakotni qanday hisoblash kerak: amaliy qo‘llanma',
    dir: 'zakot', date: '2026-08-19', read: 6, views: 5230,
    author: 'Abdulloh Karimov', tags: ['zakot', 'nisob', 'hisob-kitob'],
    excerpt: 'Nisob, zakot beriladigan mol-mulk turlari va hisob-kitob misollari bitta maqolada.',
    body: [
      ['p', 'Zakot — Islomning besh ruknidan biri va eng muhim ijtimoiy moliya instrumenti. Uni to‘g‘ri hisoblash uchun uchta tushunchani bilish kifoya: nisob, havl va stavka.'],
      ['h2', 'Nisob'],
      ['p', 'Nisob — zakot farz bo‘lishi uchun zarur minimal boylik miqdori. U 85 gramm oltin yoki 595 gramm kumush qiymatiga teng deb olinadi.'],
      ['h2', 'Havl — bir yil sharti'],
      ['p', 'Mol-mulk nisob miqdorida bir qamariy yil davomida egalikda bo‘lishi kerak. Yil davomida kamayib, yana tiklangan bo‘lsa ham, yil boshi va oxiridagi holat asos qilinadi.'],
      ['h2', 'Zakot beriladigan mulk'],
      ['ul', [
        'Naqd pul va bank hisobidagi mablag‘lar',
        'Oltin va kumush',
        'Savdo uchun mo‘ljallangan tovarlar',
        'Aksiyalar va investitsiyalar (savdo maqsadidagi)',
      ]],
      ['h2', 'Hisob-kitob misoli'],
      ['p', 'Aytaylik, sizda 60 mln so‘m naqd pul, 20 mln so‘mlik savdo tovari bor va 10 mln so‘m qisqa muddatli qarzingiz mavjud. Zakot bazasi: 60 + 20 − 10 = 70 mln so‘m. Zakot miqdori: 70 mln × 2,5% = 1 750 000 so‘m.'],
      ['note', 'Shaxsiy uy, avtomobil va kundalik foydalanishdagi buyumlarga zakot hisoblanmaydi.'],
    ],
  },
  {
    slug: 'halol-startap-qurish',
    title: 'Halol startap: shariatga mos biznes modelini qanday qurish mumkin',
    dir: 'biznes', date: '2026-08-11', read: 7, views: 1640,
    author: 'Sardor Yusupov', tags: ['startap', 'halol biznes', 'investitsiya'],
    excerpt: 'Investor jalb qilishdan tortib daromad modeligacha — halol startap asoschisi bilishi kerak bo‘lgan asosiy qadamlar.',
    body: [
      ['p', 'Halol biznes faqat mahsulotning halolligi bilan cheklanmaydi. Moliyalashtirish, sheriklik va daromad olish usullari ham shariat talablariga mos bo‘lishi kerak.'],
      ['h2', 'Faoliyat sohasini tekshirish'],
      ['p', 'Avvalo biznes sohasi harom faoliyat (alkogol, qimor, foizli moliya va h.k.) bilan bog‘liq emasligiga ishonch hosil qiling.'],
      ['h2', 'Moliyalashtirish'],
      ['ul', [
        'Foizli kredit o‘rniga musharaka yoki mudaraba asosida investor jalb qiling.',
        'Uskunalar uchun ijara (islomiy lizing) dan foydalaning.',
        'Aylanma mablag‘ uchun murabaha yoki salam shartnomalarini ko‘rib chiqing.',
      ]],
      ['h2', 'Sheriklik shartnomasi'],
      ['p', 'Foyda taqsimoti summa emas, balki foiz ulushida belgilanishi kerak. Zarar kapital ulushiga mutanosib taqsimlanadi. Barcha shartlar yozma shaklda aniq ko‘rsatilsin.'],
      ['note', 'Maslahat: shartnomalaringizni shariat bo‘yicha mutaxassisga ko‘rsatib olish kelajakdagi nizolarning oldini oladi.'],
    ],
  },
  {
    slug: 'garar-va-maysir',
    title: 'G‘arar va maysir: noaniqlik va tavakkal nega taqiqlangan?',
    dir: 'asoslar', date: '2026-08-02', read: 5, views: 1390,
    author: 'Muhammad Aliyev', tags: ['g‘arar', 'maysir', 'asoslar'],
    excerpt: 'Shartnomalardagi haddan tashqari noaniqlik va qimorga o‘xshash tavakkalning islom moliyasidagi o‘rni.',
    body: [
      ['p', 'Ribadan tashqari, islom moliyasida yana ikki muhim taqiq bor: g‘arar va maysir. Ular shartnomalarning adolatli va shaffof bo‘lishini ta’minlaydi.'],
      ['h2', 'G‘arar — noaniqlik'],
      ['p', 'G‘arar — shartnoma predmeti, narxi yoki muddatidagi jiddiy noaniqlik. Masalan, hali tutilmagan baliqni yoki mavjudligi noma’lum tovarni sotish.'],
      ['h2', 'Maysir — tavakkal va qimor'],
      ['p', 'Maysir — bir tomonning yutug‘i to‘liq boshqa tomonning yutqazig‘iga bog‘liq bo‘lgan o‘yinlar. Spekulyativ derivativlar ko‘pincha shu toifaga kiradi.'],
      ['note', 'Oz miqdordagi, oldini olib bo‘lmaydigan noaniqlik (g‘arar yasir) shartnomani bekor qilmaydi.'],
    ],
  },
  {
    slug: 'ijara-islomiy-lizing',
    title: 'Ijara: islomiy lizing qanday ishlaydi?',
    dir: 'bank', date: '2026-07-25', read: 6, views: 1210,
    author: 'Dilshod Rahimov', tags: ['ijara', 'lizing', 'islom banki'],
    excerpt: 'Ijara va ijara muntahiya bittamlik shartnomalari, bank va mijoz majburiyatlari.',
    body: [
      ['p', 'Ijara — bu aktivdan foydalanish huquqini belgilangan haq evaziga berish shartnomasi. U islom banklarida uskunalar, transport va ko‘chmas mulkni moliyalashtirishda keng qo‘llanadi.'],
      ['h2', 'Asosiy shartlar'],
      ['ul', [
        'Aktiv ijara davomida bank mulki bo‘lib qoladi.',
        'Asosiy ta’mirlash va sug‘urta xarajatlari mulk egasi zimmasida.',
        'Ijara haqi oldindan kelishiladi.',
      ]],
      ['h2', 'Ijara muntahiya bittamlik'],
      ['p', 'Bu ijaraning mulkka aylanishi bilan yakunlanuvchi turi. Muddat oxirida aktiv mijozga ramziy narxda sotiladi yoki hadya qilinadi — alohida shartnoma asosida.'],
    ],
  },
  {
    slug: 'vaqf-zamonaviy-institut',
    title: 'Vaqf: qadimiy institutning zamonaviy imkoniyatlari',
    dir: 'zakot', date: '2026-07-16', read: 7, views: 980,
    author: 'Nodira Qosimova', tags: ['vaqf', 'ijtimoiy moliya'],
    excerpt: 'Ta’lim, sog‘liqni saqlash va ijtimoiy loyihalarni barqaror moliyalashtirishda vaqfning roli.',
    body: [
      ['p', 'Vaqf — mulkni abadiy xayriya maqsadlariga ajratish. Asosiy mulk saqlanib qoladi, undan olingan daromad esa belgilangan maqsadlarga sarflanadi.'],
      ['h2', 'Tarixiy ahamiyati'],
      ['p', 'Asrlar davomida madrasalar, shifoxonalar, karvonsaroylar va suv inshootlari vaqf hisobidan qurilgan va saqlangan. Movarounnahrda ham vaqf mulklari keng tarqalgan edi.'],
      ['h2', 'Zamonaviy shakllari'],
      ['ul', [
        'Naqd vaqf — pul mablag‘larini investitsiya qilib, daromadini xayriyaga yo‘naltirish.',
        'Korporativ vaqf — kompaniya aksiyalarining bir qismini vaqfga ajratish.',
        'Vaqf-sukuk — vaqf yerlarida loyihalarni moliyalashtirish.',
      ]],
    ],
  },
  {
    slug: 'halol-aksiyalarga-investitsiya',
    title: 'Halol aksiyalarga investitsiya: skrining qanday amalga oshiriladi?',
    dir: 'sukuk', date: '2026-07-08', read: 8, views: 2980,
    author: 'Jasur Sobirov', tags: ['aksiyalar', 'skrining', 'investitsiya'],
    excerpt: 'Kompaniya faoliyati va moliyaviy ko‘rsatkichlariga asoslangan shariat skriningi mezonlari.',
    body: [
      ['p', 'Fond bozorida investitsiya qilish islomda ruxsat etilgan, ammo har bir kompaniya aksiyasi ham halol emas. Buni aniqlash uchun shariat skriningi qo‘llanadi.'],
      ['h2', 'Faoliyat bo‘yicha skrining'],
      ['p', 'Kompaniyaning asosiy faoliyati harom sohalar bilan bog‘liq bo‘lmasligi kerak: an’anaviy bank, alkogol, tamaki, qimor va h.k.'],
      ['h2', 'Moliyaviy skrining'],
      ['ul', [
        'Foizli qarzlar umumiy aktivlarning (yoki bozor kapitalizatsiyasining) 30–33% dan oshmasligi.',
        'Foizli depozitlar va qimmatli qog‘ozlar ham shu chegaradan oshmasligi.',
        'Harom manbalardan daromad umumiy daromadning 5% dan kam bo‘lishi.',
      ]],
      ['h2', 'Tozalash (purifikatsiya)'],
      ['p', 'Agar kompaniya daromadining kichik qismi harom manbadan bo‘lsa, investor dividendning mos ulushini xayriyaga berishi kerak.'],
      ['note', 'Aniq chegaralar standartga qarab farqlanadi (AAOIFI, S&P, MSCI va h.k.).'],
    ],
  },
  {
    slug: 'salam-va-istisno',
    title: 'Salam va istisno: oldindan to‘lovli savdo shartnomalari',
    dir: 'biznes', date: '2026-06-30', read: 6, views: 870,
    author: 'Sardor Yusupov', tags: ['salam', 'istisno', 'savdo'],
    excerpt: 'Qishloq xo‘jaligi va ishlab chiqarishni moliyalashtirishda qo‘llanadigan ikki muhim shartnoma.',
    body: [
      ['p', 'Odatda savdoda tovar mavjud bo‘lishi shart. Ammo salam va istisno bu qoidadan istisno sifatida ruxsat etilgan va real sektorni moliyalashtirishda muhim rol o‘ynaydi.'],
      ['h2', 'Salam'],
      ['p', 'Xaridor tovar narxini to‘liq oldindan to‘laydi, sotuvchi esa tovarni kelishilgan muddatda yetkazib beradi. Fermerlar uchun ekin mavsumidan oldin mablag‘ olish imkonini beradi.'],
      ['h2', 'Istisno'],
      ['p', 'Buyurtma asosida ishlab chiqarish yoki qurilish shartnomasi. To‘lov bosqichma-bosqich amalga oshirilishi mumkin. Uy-joy va infratuzilma qurilishida keng qo‘llanadi.'],
    ],
  },
  {
    slug: 'shariat-kengashi-roli',
    title: 'Shariat kengashi: islomiy moliya institutining “vijdoni”',
    dir: 'asoslar', date: '2026-06-21', read: 5, views: 760,
    author: 'Muhammad Aliyev', tags: ['shariat kengashi', 'AAOIFI', 'boshqaruv'],
    excerpt: 'Shariat kengashi kimlardan iborat, qanday vakolatlarga ega va mahsulotlarni qanday tasdiqlaydi.',
    body: [
      ['p', 'Har bir islomiy moliya institutida mustaqil shariat kengashi faoliyat yuritadi. U mahsulotlar va operatsiyalarning shariatga mosligini nazorat qiladi.'],
      ['h2', 'Asosiy vazifalari'],
      ['ul', [
        'Yangi mahsulotlar va shartnomalarni ko‘rib chiqish va fatvo berish.',
        'Operatsiyalarning shariat auditini o‘tkazish.',
        'Yillik hisobotda shariatga muvofiqlik xulosasini e’lon qilish.',
      ]],
      ['p', 'Xalqaro darajada AAOIFI va IFSB standartlari shariat boshqaruvi uchun asosiy yo‘riqnoma bo‘lib xizmat qiladi.'],
    ],
  },
  {
    slug: 'islomiy-uy-joy-moliyalashtirish',
    title: 'Islomiy uy-joy moliyalashtirish: ipotekaga halol muqobil',
    dir: 'bank', date: '2026-06-12', read: 7, views: 3340,
    author: 'Dilshod Rahimov', tags: ['uy-joy', 'musharaka', 'ijara'],
    excerpt: 'Kamayib boruvchi musharaka va ijara modellari yordamida foizsiz uy-joy xarid qilish.',
    body: [
      ['p', 'Uy-joy — ko‘pchilik oilalar uchun eng katta xarid. Islom moliyasi bu ehtiyojni foizli ipotekasiz qondirishning bir necha usulini taklif etadi.'],
      ['h2', 'Kamayib boruvchi musharaka'],
      ['p', 'Bank va mijoz uyni birgalikda sotib oladi. Mijoz bank ulushidan foydalangani uchun ijara haqi to‘laydi va har oy bank ulushining bir qismini sotib oladi. Oxir-oqibat uy to‘liq mijoz mulkiga aylanadi.'],
      ['h2', 'Murabaha asosida'],
      ['p', 'Bank uyni sotib olib, mijozga ustama narxda muddatli to‘lov bilan sotadi. Narx boshidan qat’iy belgilanadi.'],
      ['note', 'Qaysi model qulayligi to‘lov muddati, boshlang‘ich badal va mahalliy qonunchilikka bog‘liq.'],
    ],
  },
]

const MONTHS = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr']
export const formatDate = (iso) => {
  const [y, m, d] = iso.split('-').map(Number)
  return `${d} ${MONTHS[m - 1]}, ${y}`
}

// Yo'nalish ma'lumotlari (rang, ikonka, nom) bilan boyitilgan, yangi → eski tartibda
export const POSTS = RAW
  .map((p, i) => {
    const d = DIRECTIONS.find((x) => x.id === p.dir)
    return { ...p, id: i + 1, cat: d.title, color: d.color, icon: d.icon, iso: p.date, date: formatDate(p.date) }
  })
  .sort((a, b) => b.iso.localeCompare(a.iso))

export const postBySlug = (slug) => POSTS.find((p) => p.slug === slug)

export const BLOG_CATEGORIES = DIRECTIONS.filter((d) => POSTS.some((p) => p.dir === d.id))
