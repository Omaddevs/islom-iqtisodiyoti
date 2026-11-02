// Route handler yordamchilari: JSON javob, xatolar, validatsiya
import { NextResponse } from 'next/server'

export class HttpError extends Error {
  constructor(status, message, extra) { super(message); this.status = status; this.extra = extra }
}
export const fail = (status, message, extra) => { throw new HttpError(status, message, extra) }

export const json = (data, init) => NextResponse.json(data, init)

// Barcha handler'larni o'rab, xatoni bir xil formatda qaytaradi
export const route = (fn) => async (req, ctx) => {
  try {
    const params = ctx?.params ? await ctx.params : {}
    return await fn(req, params)
  } catch (e) {
    if (e instanceof HttpError) return NextResponse.json({ error: e.message, ...e.extra }, { status: e.status })
    if (e?.name === 'ZodError') {
      const first = e.issues?.[0]
      return NextResponse.json({ error: first?.message || 'Ma’lumotlar noto‘g‘ri', field: first?.path?.join('.') }, { status: 422 })
    }
    console.error('[api]', req.method, req.nextUrl?.pathname, e)
    return NextResponse.json({ error: 'Serverda kutilmagan xatolik' }, { status: 500 })
  }
}

export async function body(req, schema) {
  let data
  try { data = await req.json() } catch { fail(400, 'So‘rov tanasi JSON bo‘lishi kerak') }
  return schema ? schema.parse(data) : data
}
