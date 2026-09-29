/* ============================================================================
 * API ENDPOINT CATALOGUE — Hospital Staff App
 * Every backend endpoint this app talks to, in one place:
 *   · `paths`  — URL builders for reads (use with useFetch)
 *   · `*Api`   — typed request functions for writes & auth
 * Mirror of backend/src/routes — keep the two in sync.
 * ========================================================================== */
import { api, type User } from './api'

/* ---------- READ PATHS (GET) ---------- */
export const paths = {
  /** POST /api/auth/login (called via authApi, listed for completeness) */
  login: '/api/auth/login',
  /** GET /api/dashboard — role-specific counters */
  dashboard: '/api/dashboard',
  /** GET /api/settings — investigation types, drug categories, payment methods */
  settings: '/api/settings',
  /** GET /api/patients — all patients */
  patients: '/api/patients',
  /** GET /api/patients/:id — patient + visits + vitals + investigations + … */
  patient: (id: string) => `/api/patients/${id}`,
  /** GET /api/admissions */
  admissions: '/api/admissions',
  /** GET /api/investigations?dept=Lab|Radiology */
  investigations: (dept: 'Lab' | 'Radiology') => `/api/investigations?dept=${dept}`,
  /** GET /api/prescriptions — all prescriptions */
  prescriptions: '/api/prescriptions',
  /** GET /api/drugs — pharmacy inventory */
  drugs: '/api/drugs',
  /** GET /api/payments */
  payments: '/api/payments',
  /** GET /api/wallettxs — wallet ledger */
  walletTxs: '/api/wallettxs',
  /** GET /api/notifications — role-targeted, live */
  notifications: '/api/notifications',
}

/* ---------- AUTH ---------- */
export const authApi = {
  login: (username: string, password: string, app: 'hospital' | 'admin') =>
    api.post<{ token: string; user: User }>(paths.login, { username, password, app }),
  /** Choose a new password (used when the account is flagged "must change at first login"). */
  changePassword: (currentPassword: string, newPassword: string) =>
    api.post<{ token: string; user: User }>('/api/auth/change-password', { currentPassword, newPassword }),
}

/* ---------- PATIENTS ---------- */
export const patientApi = {
  register: (body: Record<string, unknown>) => api.post(paths.patients, body),
  startVisit: (patientId: string) => api.post(`/api/patients/${patientId}/visits`, {}),
  setStatus: (patientId: string, status: 'Active' | 'Inactive') =>
    api.post(`/api/patients/${patientId}/status`, { status }),
}

/* ---------- VISITS & CONSULTATION ---------- */
export const visitApi = {
  consultation: (visitId: string, body: Record<string, unknown>) =>
    api.post(`/api/visits/${visitId}/consultation`, body),
}

/* ---------- NURSING ---------- */
export const vitalsApi = {
  create: (body: { patientId: string; visitId: string; temp?: string; bp?: string; pulse?: string; resp?: string; spo2?: string; weight?: string }) =>
    api.post('/api/vitals', body),
}

/* ---------- ACTIVITY FEED ---------- */
export const activityApi = {
  create: (body: { patientId: string; what: string; dept?: string; green?: boolean }) =>
    api.post('/api/activity', body),
}

/* ---------- ADMISSIONS ---------- */
export const admissionApi = {
  discharge: (admissionId: string, body: { diagnosis?: string; summary?: string; notes?: string }) =>
    api.post(`/api/admissions/${admissionId}/discharge`, body),
}

/* ---------- LAB & RADIOLOGY ---------- */
export const investigationApi = {
  saveResult: (investigationId: string, form: FormData) =>
    api.post(`/api/investigations/${investigationId}/result`, form, true),
}

/* ---------- PHARMACY ---------- */
export const prescriptionApi = {
  dispense: (prescriptionId: string, body: { method: string; items: { drugId: string; qty: number }[] }) =>
    api.post<{ total: number; walletBalance: number }>(`/api/prescriptions/${prescriptionId}/dispense`, body),
}

export const drugApi = {
  create: (body: Record<string, unknown>) => api.post(paths.drugs, body),
  update: (drugId: string, body: Record<string, unknown>) => api.put(`/api/drugs/${drugId}`, body),
}

/* ---------- FINANCE ---------- */
export const walletApi = {
  fund: (body: { patientId: string; amount: number; method: string; reference?: string }) =>
    api.post<{ balance: number }>('/api/wallet/fund', body),
}
