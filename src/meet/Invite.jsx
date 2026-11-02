// Darsga taklif qilish: havola, kod, parol va tayyor taklif matni
import { useState } from 'react'
import { Modal, Btn, Icon, cx } from '../platform/ui/kit.jsx'
import { joinLink } from '../platform/api/meetings.js'
import { fmtDateTime } from '../platform/ui/format.js'

export const inviteText = (m) => [
  `«${m.title}» onlayn darsiga taklif qilinasiz`,
  m.startsAt ? `Vaqt: ${fmtDateTime(m.startsAt)} (${m.durationMin} daqiqa)` : null,
  m.hostName ? `Ustoz: ${m.hostName}` : null,
  '',
  `Qo‘shilish: ${joinLink(m.code)}`,
  `Dars kodi: ${m.code}`,
  m.passcode ? `Parol: ${m.passcode}` : null,
].filter((x) => x !== null).join('\n')

export async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true } catch {
    // Eski brauzerlar / http: vaqtinchalik textarea orqali
    const ta = Object.assign(document.createElement('textarea'), { value: text, style: 'position:fixed;opacity:0' })
    document.body.appendChild(ta); ta.select()
    const ok = document.execCommand('copy'); ta.remove()
    return ok
  }
}

function CopyField({ label, value, mono }) {
  const [done, setDone] = useState(false)
  const copy = async () => { if (await copyText(value)) { setDone(true); setTimeout(() => setDone(false), 1600) } }
  return (
    <div className="minv__field">
      <span>{label}</span>
      <div>
        <code className={cx(mono && 'is-mono')}>{value}</code>
        <button type="button" className={cx('minv__copy', done && 'is-done')} onClick={copy} aria-label={`${label}ni nusxalash`}>
          <Icon name={done ? 'check' : 'copy'} size={16} />{done ? 'Nusxalandi' : 'Nusxalash'}
        </button>
      </div>
    </div>
  )
}

export default function InviteModal({ open, onClose, meeting }) {
  const [copied, setCopied] = useState(false)
  if (!meeting) return null
  const link = joinLink(meeting.code)
  const text = inviteText(meeting)
  const copyAll = async () => { if (await copyText(text)) { setCopied(true); setTimeout(() => setCopied(false), 1800) } }
  const tg = `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(text.replace(`\nQo‘shilish: ${link}`, ''))}`
  const share = () => navigator.share?.({ title: meeting.title, text, url: link }).catch(() => {})

  return (
    <Modal open={open} onClose={onClose} width={520} title="Darsga taklif qilish"
      sub="Havolani yuboring — qabul qiluvchi bir bosishda darsga qo‘shiladi"
      footer={<>
        {navigator.share && <Btn icon="externalLink" onClick={share}>Ulashish</Btn>}
        <Btn as="a" href={tg} target="_blank" rel="noreferrer" icon="send">Telegram</Btn>
        <Btn variant={copied ? 'success' : 'primary'} icon={copied ? 'check' : 'copy'} onClick={copyAll}>{copied ? 'Nusxalandi' : 'Taklif matnini nusxalash'}</Btn>
      </>}>
      <div className="minv">
        <CopyField label="Havola" value={link} />
        <div className="minv__row">
          <CopyField label="Dars kodi" value={meeting.code} mono />
          {meeting.passcode && <CopyField label="Parol" value={meeting.passcode} mono />}
        </div>
        <ul className="minv__notes">
          <li><Icon name={meeting.allowGuests ? 'globe' : 'lock'} size={16} />
            {meeting.allowGuests ? 'Akkauntsiz mehmonlar ham ism yozib qo‘shila oladi' : 'Faqat platforma foydalanuvchilari qo‘shila oladi'}</li>
          <li><Icon name="shield" size={16} />
            {meeting.waitingRoom ? 'Guruhdan tashqaridagilar kutish zalida sizning ruxsatingizni kutadi' : 'Havolaga ega hamma to‘g‘ridan-to‘g‘ri kiradi'}</li>
          {meeting.hasPasscode && !meeting.passcode && <li><Icon name="key" size={16} />Mehmonlar uchun parol talab qilinadi</li>}
        </ul>
      </div>
    </Modal>
  )
}
