/* Types shared across the hospital app. All data now lives in the backend (backend/src/db.ts). */
export type Role = 'Records Officer' | 'Doctor' | 'Nurse' | 'Laboratory Scientist' | 'Pharmacist' | 'Accountant' | 'Radiologist'

export interface Patient {
  id: string; firstName: string; surname: string; otherName?: string;
  dob: string; gender: 'Male' | 'Female'; phone: string; address: string;
  nextOfKin: { name: string; relationship: string; phone: string; address: string };
  status: 'Active' | 'Inactive'; registered: string; registeredAt: string;
  wallet: number; bloodGroup?: string
}

export interface Consultation { complaint: string; history: string; exam: string; diagnosis: string; doctor: string; at: string }

export interface Visit { id: string; patientId: string; date: string; createdAt: string; type: 'Outpatient' | 'Admission'; status: string; diagnosis?: string; consultation?: Consultation }

export interface Investigation {
  id: string; patientId: string; visitId: string; dept: 'Lab' | 'Radiology'; test: string;
  doctor: string; createdAt: string; status: 'Pending' | 'In Progress' | 'Completed';
  price: number; result?: { image: string; values: string; at: string; by: string }
}

export interface RxItem { drugId: string; drug: string; qty: number; price: number }
export interface Prescription { id: string; patientId: string; patientName: string; doctor: string; visitId: string; createdAt: string; items: RxItem[]; status: 'Pending' | 'Dispensed' | 'Cancelled' }

export interface Vital { id: string; patientId: string; visitId: string; staff: string; temp: string; bp: string; pulse: string; resp: string; spo2: string; weight: string; at: string }

export interface Payment { id: string; ref: string; patientId: string; patientName: string; amount: number; method: string; service: string; staff: string; at: string; status: 'Paid' | 'Pending' }

export interface WalletTx { id: string; patientId: string; type: 'Credit' | 'Debit'; amount: number; reason: string; method: string; staff: string; at: string; balanceAfter: number }

export interface Admission { id: string; patientId: string; patientName: string; visitId: string; ward: string; bed: string; doctor: string; at: string; reason: string; status: 'Admitted' | 'Discharged'; discharge?: { date: string; diagnosis: string; summary: string; notes: string; staff: string } }

export interface Drug { id: string; name: string; category: string; unit: string; stock: number; minStock: number; price: number; expiry: string }

export interface Activity { patientId: string; time: string; what: string; meta: string; dept: string; green?: boolean }

export interface Settings { hospital: Record<string, string>; investigationTypes: string[]; drugCategories: string[]; paymentMethods: string[] }

