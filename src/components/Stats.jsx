const STATS = [
  { value: '50 000+', label: "Jami tahsil olayotgan o‘quvchilarimiz" },
  { value: '50+', label: 'Platformamizda mavjud kurslar soni' },
  { value: '30+', label: 'Uzoq yillik tajribaga ega ustozlarimiz' },
]

export default function Stats() {
  return (
    <section className="stats">
      <h2 className="stats__title">
        Istalgan joyda, o‘zingizga qulay vaqtda o‘qish imkoniyati
      </h2>
      <ul className="stats__list">
        {STATS.map((s) => (
          <li key={s.value} className="stat">
            <span className="stat__value">{s.value}</span>
            <span className="stat__label">{s.label}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}
