// Onlayn darslar — backend manbasi. Ro'yxat serverdan olinadi va mahalliy store'ga (db.meetings)
// sinxronlanadi, shunda Dashboard, Jadval, Guruhlar kabi sahifalar ham bir xil ma'lumotni ko'radi.
import { useEffect, useSyncExternalStore } from 'react'
import { api } from './client.js'
import { setDB, getDB } from '../store/db.js'

export const meetingsApi = {
  list: () => api('/api/meetings'),
  get: (id) => api(`/api/meetings/${id}`),
  create: (data) => api('/api/meetings', { method: 'POST', body: data }),
  update: (id, data) => api(`/api/meetings/${id}`, { method: 'PATCH', body: data }),
  remove: (id) => api(`/api/meetings/${id}`, { method: 'DELETE' }),
  start: (id) => api(`/api/meetings/${id}/start`, { method: 'POST' }),
  end: (id) => api(`/api/meetings/${id}/end`, { method: 'POST' }),
  attendance: (id) => api(`/api/meetings/${id}/attendance`),
  recordings: (id) => api(`/api/meetings/${id}/recordings`),
  joinInfo: (code) => api(`/api/join/${code}`),
  ticket: (code, body = {}) => api(`/api/join/${code}`, { method: 'POST', body }),
  uploadRecording: (id, blob, durationSec) => api(`/api/meetings/${id}/recordings?duration=${Math.round(durationSec)}`, {
    method: 'POST', raw: true, body: blob, headers: { 'Content-Type': blob.type.split(';')[0] || 'video/webm' },
  }),
}

export const recordingUrl = (id, download) => `/api/recordings/${id}${download ? '?download=1' : ''}`
export const joinLink = (code) => `${window.location.origin}${window.location.pathname}#/join/${code}`

// ---- Server holati (banner va bo'sh holatlar uchun) ----
let status = 'idle' // idle | ok | auth | offline
const subs = new Set()
const setStatus = (s) => { if (s !== status) { status = s; subs.forEach((f) => f()) } }
export const useServerStatus = () => useSyncExternalStore((f) => { subs.add(f); return () => subs.delete(f) }, () => status)

// Serverdagi darslarni mahalliy store'ga yozish. Mahalliy "videos" yozuviga bog'lanish (recordingId) saqlanadi.
export async function syncMeetings() {
  try {
    const { meetings } = await meetingsApi.list()
    const local = new Map(getDB().meetings.map((m) => [m.id, m]))
    setDB((s) => ({
      ...s,
      meetings: meetings.map((m) => ({ ...m, recordingId: local.get(m.id)?.recordingId ?? null, serverRecordingId: m.recordingId })),
    }))
    setStatus('ok')
    return meetings
  } catch (e) {
    setStatus(e.status === 401 ? 'auth' : e.status === 0 ? 'offline' : 'ok')
    throw e
  }
}

// Platformada bir marta ulanadi: kirishda, har 20 soniyada va oyna qayta faollashganda yangilaydi
export function useMeetingsSync(enabled) {
  useEffect(() => {
    if (!enabled) return
    const run = () => { if (document.visibilityState === 'visible') syncMeetings().catch(() => {}) }
    run()
    const t = setInterval(run, 20_000)
    document.addEventListener('visibilitychange', run)
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', run) }
  }, [enabled])
}
