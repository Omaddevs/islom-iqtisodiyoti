import { z } from 'zod'

const passcode = z.string().trim().max(20, 'Parol 20 belgidan oshmasin')
  .regex(/^[\p{L}\p{N}_-]*$/u, 'Parolda faqat harf, raqam, _ va - bo‘lishi mumkin')
  .transform((v) => v || null)

export const MeetingCreate = z.object({
  title: z.string().trim().min(2, 'Dars nomini kiriting').max(160),
  topic: z.string().trim().max(80).optional().nullable(),
  description: z.string().trim().max(2000).optional().nullable(),
  groupId: z.string().min(1, 'Guruhni tanlang'),
  startsAt: z.number({ message: 'Sana va vaqtni kiriting' }).int().positive(),
  durationMin: z.number().int().min(5, 'Kamida 5 daqiqa').max(600, 'Ko‘pi bilan 10 soat'),
  passcode: passcode.optional().nullable(),
  allowGuests: z.boolean().optional(),
  waitingRoom: z.boolean().optional(),
  muteOnEntry: z.boolean().optional(),
})

export const MeetingPatch = MeetingCreate.partial().extend({ locked: z.boolean().optional() })

// camelCase maydon → ustun
export const MEETING_COLUMNS = {
  title: 'title', topic: 'topic', description: 'description', groupId: 'group_id', startsAt: 'starts_at',
  durationMin: 'duration_min', passcode: 'passcode', allowGuests: 'allow_guests', waitingRoom: 'waiting_room',
  muteOnEntry: 'mute_on_entry', locked: 'locked',
}

// Saytdagi ochiq formalar (kurs arizasi, aloqa, obuna) — telefon yoki email shart
const opt = (max) => z.string().trim().max(max).optional().nullable().transform((v) => v || null)
export const LeadCreate = z.object({
  kind: z.string().trim().regex(/^[a-z_]{2,20}$/, 'Ariza turi noto‘g‘ri'),
  name: opt(100),
  phone: z.string().trim().regex(/^\+?998[\d\s]{9,14}$/, 'Telefon raqamini to‘liq kiriting').optional().nullable(),
  email: z.string().trim().email('Email noto‘g‘ri').max(120).optional().nullable(),
  course: opt(200),
  topic: opt(120),
  message: opt(2000),
  website: z.string().max(200).optional(), // bot tuzog'i: odam to'ldirmaydi
}).refine((d) => d.phone || d.email, { message: 'Telefon yoki email kiriting', path: ['phone'] })
