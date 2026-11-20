// O'zlashtirish ko'rsatkichi: serverda xom ma'lumotdan hisoblanadi (backend/lib/mastery.js)
import { useCallback, useEffect, useState } from 'react'
import { api } from './client.js'

export const masteryApi = {
  group: (groupId) => api(`/api/mastery?groupId=${encodeURIComponent(groupId)}`),
  gate: (testId) => api(`/api/mastery/gate?testId=${encodeURIComponent(testId)}`),
}

// Metodika bo'yicha baholash shkalasi va rang belgilari
export const GRADES = [
  { key: 'a', min: 86, range: '86–100', label: 'A’lo', mark: 5, tone: 'green', color: '#10b981', name: 'Yashil' },
  { key: 'b', min: 71, range: '71–85', label: 'Yaxshi', mark: 4, tone: 'blue', color: '#3b8ef0', name: 'Ko‘k' },
  { key: 'c', min: 55, range: '55–70', label: 'Qoniqarli', mark: 3, tone: 'amber', color: '#f59e0b', name: 'Sariq' },
  { key: 'd', min: 0, range: '0–54', label: 'Qoniqarsiz', mark: 2, tone: 'red', color: '#ef4444', name: 'Qizil' },
]
export const gradeOf = (o) => (o === null || o === undefined ? null : GRADES.find((g) => Math.round(o * 10) / 10 >= g.min) || GRADES[3])
export const fmtBall = (v) => (v === null || v === undefined ? '—' : String(Math.round(v * 10) / 10).replace('.', ','))
export const DEFAULT_CFG = { w: { D: 60, T: 20, S: 10, L: 10 }, minT: 0, alerts: true, cert: { u: 70, att: 80, final: 56 } }
export const cfgOfOrg = (org) => {
  const m = org?.mastery
  return { ...DEFAULT_CFG, ...(m || {}), w: { ...DEFAULT_CFG.w, ...(m?.w || {}) }, cert: { ...DEFAULT_CFG.cert, ...(m?.cert || {}) } }
}

// Guruh natijalari: ochilganda, oyna qayta faollashganda va har daqiqada yangilanadi
export function useMastery(groupId) {
  const [state, setState] = useState({ data: null, error: null, loading: !!groupId })
  const load = useCallback(() => {
    if (!groupId) return Promise.resolve()
    return masteryApi.group(groupId)
      .then((data) => setState({ data, error: null, loading: false }))
      .catch((error) => setState((s) => ({ ...s, error, loading: false })))
  }, [groupId])
  useEffect(() => {
    if (!groupId) { setState({ data: null, error: null, loading: false }); return undefined }
    setState({ data: null, error: null, loading: true })
    load()
    const run = () => { if (document.visibilityState === 'visible') load() }
    const t = setInterval(run, 60e3)
    document.addEventListener('visibilitychange', run)
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', run) }
  }, [groupId, load])
  return { ...state, reload: load }
}
