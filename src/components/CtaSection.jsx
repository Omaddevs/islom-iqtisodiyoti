const Svg = ({ children }) => (
  <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="2.6"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>
)

// Duotone uchun yengil to‘ldirish
const tint = { fill: 'currentColor', fillOpacity: 0.18 }

// Yon tugmalardagi ikonkalar
// Moliya — tangalar to‘plami
const CoinsIcon = () => (
  <Svg>
    <ellipse cx="24" cy="12" rx="13" ry="5" {...tint} />
    <path d="M11 12v8c0 2.8 5.8 5 13 5s13-2.2 13-5v-8" />
    <path d="M11 20v8c0 2.8 5.8 5 13 5s13-2.2 13-5v-8" />
    <path d="M11 28v8c0 2.8 5.8 5 13 5s13-2.2 13-5v-8" />
  </Svg>
)
// Iqtisodiyot — o‘sish grafigi
const EconomyIcon = () => (
  <Svg>
    <path d="M8 8v32h32" />
    <rect x="14" y="30" width="5" height="6" rx="1.5" {...tint} />
    <rect x="22" y="26" width="5" height="10" rx="1.5" {...tint} />
    <rect x="30" y="22" width="5" height="14" rx="1.5" {...tint} />
    <path d="M13 23l8-7 6 4 11-10M32 10h6v6" />
  </Svg>
)
// AI — protsessor ichida uchqun
const AiIcon = () => (
  <Svg>
    <rect x="12" y="12" width="24" height="24" rx="6" {...tint} />
    <path d="M19 6v6M29 6v6M19 36v6M29 36v6M6 19h6M6 29h6M36 19h6M36 29h6" />
    <path d="M24 16.5c.7 3.8 3.7 6.8 7.5 7.5-3.8.7-6.8 3.7-7.5 7.5-.7-3.8-3.7-6.8-7.5-7.5 3.8-.7 6.8-3.7 7.5-7.5z"
      fill="currentColor" strokeWidth="1.6" />
  </Svg>
)
// Halol moliya — adolat tarozisi
const ScaleIcon = () => (
  <Svg>
    <circle cx="24" cy="9" r="2.2" />
    <path d="M24 11.2V39M16 39h16M11 15h26" />
    <path d="M11 15 6 27M11 15l5 12M37 15l-5 12M37 15l5 12" />
    <path d="M5 27h12a6 6 0 0 1-12 0zM31 27h12a6 6 0 0 1-12 0z" {...tint} />
  </Svg>
)

const KEYS = [
  { key: 'k-2', cls: 'ck--far', Icon: CoinsIcon },
  { key: 'k-1', cls: 'ck--side', Icon: EconomyIcon },
  { key: 'k0', cls: 'ck--main', Icon: null },
  { key: 'k1', cls: 'ck--side', Icon: AiIcon },
  { key: 'k2', cls: 'ck--far', Icon: ScaleIcon },
]

export default function CtaSection() {
  return (
    <section className="cta" id="boshlash">
      <div className="cta__glow" aria-hidden="true" />

      <div className="cta__keys" aria-hidden="true">
        {KEYS.map(({ key, cls, Icon }) => (
          <div key={key} className={`ck ${cls}`}>
            {Icon ? <Icon /> : (
              <>
                <span className="ck__ripple" />
                <span className="ck__ripple ck__ripple--2" />
                <img src="/logo/logo-mark.png" alt="" className="ck__logo" />
              </>
            )}
          </div>
        ))}
      </div>

      <div className="cta__content">
        <h2 className="cta__title">
          Kelajak iqtisodiyotiga <br />
          qadam qo‘ying
        </h2>
        <p className="cta__sub">
          Minglab o‘quvchi va mutaxassislar Islom Iqtisodiyoti bilan halol moliya
          bilimlarini amaliy ko‘nikmaga aylantirmoqda.
        </p>
        <div className="cta__actions">
          <a href="#royxat" className="cbtn cbtn--light">Bepul boshlash</a>
          <a href="#ai-ustoz" className="cbtn cbtn--dark">AI Ustoz bilan boshlash</a>
        </div>
      </div>
    </section>
  )
}
