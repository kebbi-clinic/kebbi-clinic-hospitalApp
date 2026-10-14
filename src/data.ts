/* Types shared across the hospital app. All data now lives in the backend (backend/src/db.ts). */
export type Role = 'Records Officer' | 'Doctor' | 'Nurse' | 'Laboratory Scientist' | 'Pharmacist' | 'Accountant' | 'Radiologist'

export interface Patient {
  id: string; firstName: string; surname: string; otherName?: string;
  dob: string; gender: 'Male' | 'Female'; phone: string; address: string;
  nextOfKin: { name: string; relationship: string; phone: string; address: string };
  status: 'Active' | 'Inactive'; registered: string; registeredAt: string;
  wallet: number; bloodGroup?: string
  /* Set when the Records Officer activated the patient. */
  activatedAt?: string; activatedBy?: string
  /* Procedures / services performed on this patient. */
  procedures?: Procedure[]
}

export interface Consultation { complaint: string; history: string; exam: string; diagnosis: string; doctor: string; at: string }

export interface Visit { id: string; patientId: string; date: string; createdAt: string; type: 'Outpatient' | 'Admission'; status: string; diagnosis?: string; consultation?: Consultation }

export interface Investigation {
  id: string; patientId: string; visitId: string; dept: 'Lab' | 'Radiology'; test: string;
  doctor: string; createdAt: string; status: 'Pending' | 'In Progress' | 'Completed';
  price: number; result?: { image: string; values: string; at: string; by: string }
}

/* ---------- Prescriptions ----------
 * A prescription line is: drug + route (IV/IM/Oral/Rectal) + frequency
 * (Daily/BD/TDS/noctal/PRN/4hrly…24hrly) + duration in days + quantity. */
export interface RxItem {
  drugId: string; drug: string
  route: 'IV' | 'IM' | 'Oral' | 'Rectal'
  frequency: 'Daily' | 'BD' | 'TDS' | 'Noctal' | 'PRN' | '4hrly' | '6hrly' | '8hrly' | '12hrly' | '24hrly'
  duration: number
  qty: number
  price: number
}
export interface Prescription {
  id: string; patientId: string; patientName: string; doctor: string; visitId: string
  createdAt: string; items: RxItem[]; status: 'Pending' | 'Dispensed' | 'Cancelled'
  dispensedBy?: string; dispensedAt?: string
}

export interface Vital { id: string; patientId: string; visitId: string; staff: string; temp: string; bp: string; pulse: string; resp: string; spo2: string; weight: string; at: string }

export interface Payment { id: string; ref: string; patientId: string; patientName: string; amount: number; method: string; service: string; staff: string; at: string; status: 'Paid' | 'Pending' }

export interface WalletTx { id: string; patientId: string; type: 'Credit' | 'Debit'; amount: number; reason: string; method: string; staff: string; at: string; balanceAfter: number }

/* An admission carries the length of stay and the nightly bed charge, so the
 * total billed is days × cost per night. */
export interface Admission {
  id: string; patientId: string; patientName: string; visitId: string
  ward: string; bed: string; doctor: string; at: string; reason: string
  status: 'Admitted' | 'Discharged'
  days: number; costPerNight: number; totalCost: number; chargedToWallet: boolean
  discharge?: { date: string; diagnosis: string; summary: string; notes: string; staff: string }
}

/* ---------- Procedures / services ---------- */
export interface Service {
  id: string; name: string; category: string; amount: number
  department: string; notes?: string; active: boolean
  createdBy?: string; createdAt?: string; updatedAt?: string
}

/* One procedure performed on a patient, billed to their wallet. */
export interface Procedure {
  id: string; serviceId: string; name: string; amount: number
  performedBy: string; role: string; at: string; notes?: string
  chargedToWallet: boolean; paymentStatus: 'Paid' | 'Pending'
}

export interface Drug { id: string; name: string; category: string; unit: string; stock: number; minStock: number; price: number; expiry: string }

/* A laboratory / radiology test in the catalogue ("inventory") — the admin
 * maintains these with their prices, e.g. PCV = ₦2,000. */
export interface TestItem {
  id: string; name: string; dept: 'Lab' | 'Radiology'
  category: string; unit: string; price: number
  stock: number; minStock: number; active: boolean
  createdBy?: string; createdAt?: string; updatedAt?: string
}

export interface Activity { patientId: string; time: string; what: string; meta: string; dept: string; green?: boolean }

export interface Settings {
  hospital: Record<string, string>
  investigationTypes: string[]; drugCategories: string[]; paymentMethods: string[]
  /* Fixed clinical vocabulary served by the API so both apps always offer the
     same prescription options. */
  rxRoutes: string[]; rxFrequencies: string[]
  /* Charged to the wallet when a Records Officer activates a patient. */
  activationFee: number
  /* Default nightly bed charge pre-filled on a new admission. */
  defaultNightlyRate: number
}

/* The route/frequency lists, used as a safe fallback before settings load. */
export const RX_ROUTES = ['IV', 'IM', 'Oral', 'Rectal']
export const RX_FREQUENCIES = ['Daily', 'BD', 'TDS', 'Noctal', 'PRN', '4hrly', '6hrly', '8hrly', '12hrly', '24hrly']

/* Parse the API's display timestamp ("14 Sept 2026 · 10:20 am") into epoch ms
 * so lists can be sorted LATEST FIRST by real time — a plain string compare
 * puts "02:30 pm" before "10:20 am". Unparseable values sort last (0). */
export function whenMs(s?: string): number {
  const m = String(s || '').match(/^(\d{1,2})\s+(\w+)\s+(\d{4})(?:\s*·\s*(\d{1,2}):(\d{2})\s*(am|pm))?/i)
  if (!m) return 0
  const months: Record<string, number> = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 }
  const mon = months[m[2].slice(0, 3)]
  if (mon === undefined) return 0
  let h = m[4] !== undefined ? Number(m[4]) : 0
  const min = m[5] !== undefined ? Number(m[5]) : 0
  if (m[6]) {
    const pm = m[6].toLowerCase() === 'pm'
    if (h === 12) h = 0
    if (pm) h += 12
  }
  return new Date(Number(m[3]), mon, Number(m[1]), h, min).getTime()
}

