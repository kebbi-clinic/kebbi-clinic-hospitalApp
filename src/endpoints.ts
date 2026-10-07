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
  /** GET /api/patients — all patients. The API hides Inactive patients from
      every role except the Records Officer, the Accountant and administrators. */
  patients: '/api/patients',
  /** GET /api/patients?status=Active|Inactive — force a status (records/accountant only for Inactive) */
  patientsByStatus: (status: 'Active' | 'Inactive') => `/api/patients?status=${status}`,
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
  /** GET /api/services — the priced procedure/service catalogue */
  services: '/api/services',
  /** GET /api/services/inventory — catalogue + how often each procedure has been
      performed (procedure / amount / quantity) for the accountant's inventory. */
  servicesInventory: '/api/services/inventory',
  /** GET /api/services/patient/:id — procedures performed on one patient */
  patientServices: (id: string) => `/api/services/patient/${id}`,
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
  /** Records Officer only. The API deducts the configured activation fee from
      the patient's wallet and returns the new balance. */
  activate: (patientId: string) =>
    api.post<{ activationFee: number; wallet: number; status: string }>(
      `/api/patients/${patientId}/activate`, {}),
}

/* ---------- PROCEDURES / SERVICES ---------- */
export interface RxDraftLine {
  drugId: string; qty: number
  route: string; frequency: string; duration: number
}
export const serviceApi = {
  /** Record a procedure/service performed on a patient (bills their wallet). */
  perform: (body: { patientId: string; serviceId: string; notes?: string; settle?: 'Wallet' | 'Cash' | 'Transfer' | 'POS' }) =>
    api.post<{ walletBalance: number }>('/api/services/perform', body),
}

/* ---------- PROCEDURE INVENTORY (procedure / amount / quantity) ---------- */
export interface InventoryRow {
  id: string
  procedure: string
  name: string
  category: string
  department: string
  active: boolean
  /** Catalogue price (₦). */
  amount: number
  /** How many times the procedure has been performed. */
  quantity: number
  /** amount × quantity. */
  total: number
  /** What was actually billed (differs from `total` after price changes). */
  billed: number
}
export interface Inventory {
  items: InventoryRow[]
  totals: { procedures: number; quantity: number; amount: number; total: number; billed: number }
}
export const inventoryApi = {
  /** Read-only for every authenticated role: the accountant reads revenue from
      it, doctors and nurses read it to see what they are allowed to record. */
  list: () => api.get<Inventory>(paths.servicesInventory),
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
/** The money the laboratory moved when a result was submitted. `walletBalance`
 *  is null when the patient had no wallet entry for this test. */
export interface InvestigationResult {
  price: number
  debitedFromWallet: number
  outstanding: number
  walletBalance: number | null
  status: string
}
export const investigationApi = {
  /** Submitting a result charges the test's price to the patient's wallet. */
  saveResult: (investigationId: string, form: FormData) =>
    api.post<InvestigationResult>(`/api/investigations/${investigationId}/result`, form, true),
}

/* ---------- PHARMACY ---------- */
export const prescriptionApi = {
  /** Dispensing always takes the cost from the wallet first; any shortfall is
      raised as a pending payment for the accountant. */
  dispense: (prescriptionId: string, body: { method: string; items: { drugId: string; qty: number }[] }) =>
    api.post<{
      total: number; debitedFromWallet: number; outstanding: number
      walletBalance: number; shortages?: string[]
    }>(`/api/prescriptions/${prescriptionId}/dispense`, body),
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
