import { json, route } from '@/lib/http.js'
import { requireUser, publicUser } from '@/lib/auth.js'

export const GET = route(async () => json({ user: publicUser(await requireUser()) }))
