// Telegram Mini App ichida avtomatik kirish: bot orqali telefon raqami tasdiqlangan
// (bot_users.user_id bog'langan) foydalanuvchi parolsiz kiradi. initData imzosi bot tokeni bilan tekshiriladi.
import { z } from 'zod'
import { one, query } from '@/lib/db.js'
import { json, route, body, fail } from '@/lib/http.js'
import { signSession, sessionCookie, publicUser } from '@/lib/auth.js'
import { verifyInitData } from '@/lib/telegram.js'

const Schema = z.object({ initData: z.string().min(10).max(4096) })

export const POST = route(async (req) => {
  const { initData } = await body(req, Schema)
  const data = verifyInitData(initData)
  if (!data?.user?.id) fail(401, 'Telegram ma’lumotlari tasdiqlanmadi')
  const u = await one(`SELECT u.* FROM bot_users b JOIN users u ON u.id = b.user_id
    LEFT JOIN organizations o ON o.id = u.org_id
    WHERE b.tg_id = $1 AND u.status = 'active' AND (u.role = 'superadmin' OR o.status = 'active')`, [data.user.id])
  if (!u) fail(404, 'Telegram akkaunt platformaga bog‘lanmagan')
  await query('UPDATE users SET last_seen_at = now() WHERE id = $1', [u.id])
  const res = json({ user: publicUser(u) })
  res.cookies.set(sessionCookie(await signSession(u)))
  return res
})
