// Backend (Next.js) bilan aloqa. Dev rejimda Vite /api va /ws ni backend'ga proksi qiladi,
// shuning uchun cookie bir xil origin'da ishlaydi. Productionda VITE_API_URL berilishi mumkin.
const BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '')

export class ApiError extends Error {
  constructor(status, data) {
    super(data?.error || (status === 0 ? 'Server bilan aloqa yo‘q. Internetni tekshiring' : 'Xatolik yuz berdi'))
    this.status = status
    this.data = data || {}
  }
}

export async function api(path, { method = 'GET', body, headers, signal, raw } = {}) {
  let res
  try {
    res = await fetch(BASE + path, {
      method,
      signal,
      credentials: 'include',
      headers: raw ? headers : { 'Content-Type': 'application/json', ...headers },
      body: raw ? body : body !== undefined ? JSON.stringify(body) : undefined,
    })
  } catch (e) {
    if (e.name === 'AbortError') throw e
    throw new ApiError(0)
  }
  const data = res.status === 204 ? null : await res.json().catch(() => null)
  if (!res.ok) throw new ApiError(res.status, data)
  return data
}

export const wsUrl = (path) => {
  const u = new URL(BASE || window.location.origin)
  u.protocol = u.protocol === 'https:' ? 'wss:' : 'ws:'
  return u.origin + path
}

export const authApi = {
  login: (phone, password) => api('/api/auth/login', { method: 'POST', body: { phone, password } }),
  telegram: (initData) => api('/api/auth/telegram', { method: 'POST', body: { initData } }),
  logout: () => api('/api/auth/logout', { method: 'POST' }),
  me: () => api('/api/auth/me'),
}

// Saytdagi formalar (kurs arizasi, aloqa, obuna) va ularni ko'rish (bosh admin)
export const partnersApi = {
  list: () => api('/api/partners'),
  create: (partner) => api('/api/partners', { method: 'POST', body: partner }),
  update: (id, partner) => api(`/api/partners/${id}`, { method: 'PATCH', body: partner }),
  remove: (id) => api(`/api/partners/${id}`, { method: 'DELETE' }),
}

// Himoyalangan materiallar. Yuklash XHR orqali: fetch yuklash jarayonini ko'rsata olmaydi
export const materialsApi = {
  get: (id) => api(`/api/materials/${id}`),
  pageUrl: (id, n) => `${BASE}/api/materials/${id}/pages/${n}`,
  mediaUrl: (id) => `${BASE}/api/materials/${id}/media`,
  sourceUrl: (id) => `${BASE}/api/materials/${id}/source`,
  event: (id, type, detail) => api(`/api/materials/${id}/events`, { method: 'POST', body: { type, detail } }).catch(() => {}),
  viewers: (id) => api(`/api/materials/${id}/events`),
  upload(file, { orgId, onProgress } = {}) {
    const xhr = new XMLHttpRequest()
    const promise = new Promise((ok, no) => {
      xhr.open('POST', `${BASE}/api/materials`)
      xhr.withCredentials = true
      xhr.setRequestHeader('Content-Type', 'application/octet-stream')
      xhr.setRequestHeader('X-File-Name', encodeURIComponent(file.name))
      if (orgId) xhr.setRequestHeader('X-Org-Id', orgId)
      xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgress?.(e.loaded / e.total) }
      xhr.onload = () => {
        let data = null
        try { data = JSON.parse(xhr.responseText) } catch { /* JSON emas */ }
        if (xhr.status >= 200 && xhr.status < 300) ok(data)
        else no(new ApiError(xhr.status, data))
      }
      xhr.onerror = () => no(new ApiError(0))
      xhr.onabort = () => no(Object.assign(new Error('Bekor qilindi'), { name: 'AbortError' }))
      xhr.send(file)
    })
    return { promise, abort: () => xhr.abort() }
  },
}

export const leadsApi = {
  send: (lead) => api('/api/leads', { method: 'POST', body: lead }),
  list: () => api('/api/leads'),
  setStatus: (id, status) => api(`/api/leads/${id}`, { method: 'PATCH', body: { status } }),
  remove: (id) => api(`/api/leads/${id}`, { method: 'DELETE' }),
}
