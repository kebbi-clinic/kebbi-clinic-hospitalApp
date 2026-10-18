/* ============================================================================
 * RECEIPT — view → download → print for EVERY patient transaction.
 *
 * Every money movement (wallet funding, procedures, prescription dispensing,
 * lab/radiology charges, admission bed charges, patient activation) writes a
 * wallet-ledger row carrying the receipt facts: hospital name (from settings),
 * patient name & sex, date, amount, debit/credit, reason and the staff member
 * who initiated it (name + position).
 *
 * `ReceiptModal` previews the receipt BEFORE printing, downloads it as a
 * standalone HTML file, and prints it sized for a 58 mm mini/thermal printer
 * (`@page { size: 58mm auto }` — pick the mini printer in the print dialog).
 * ========================================================================== */
import { Modal } from './ui'
import { useFetch } from '../api'
import { paths } from '../endpoints'
import type { Payment, WalletTx } from '../data'

export interface ReceiptData {
  no: string
  patientId?: string
  patientName: string
  patientSex: string
  date: string
  amount: number
  direction: 'Credit' | 'Debit'
  reason: string
  method?: string
  balanceAfter?: number | null
  staff: string
  staffRole: string
}

type PatientLike = { firstName?: string; surname?: string; gender?: string } | null | undefined

const naira2 = (n: number | null | undefined) =>
  '₦' + Number(n || 0).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const esc = (v: unknown) =>
  String(v ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string)

/* ---- Builders ----------------------------------------------------------
 * Row data is preferred; the patient record fills any gaps on legacy rows. */
export function receiptFromTx(t: WalletTx, patient?: PatientLike): ReceiptData {
  return {
    no: t.id,
    patientId: t.patientId,
    patientName: t.patientName || (patient ? `${patient.firstName || ''} ${patient.surname || ''}`.trim() : '') || '—',
    patientSex: t.patientSex || patient?.gender || '—',
    date: t.at,
    amount: Number(t.amount) || 0,
    direction: t.type === 'Credit' ? 'Credit' : 'Debit',
    reason: t.reason || '—',
    method: t.method,
    balanceAfter: t.balanceAfter,
    staff: t.staff || '—',
    staffRole: t.staffRole || '',
  }
}

export function receiptFromPayment(p: Payment, tx?: WalletTx | null, patient?: PatientLike): ReceiptData {
  /* The wallet ledger row is the canonical receipt when we can link it. */
  if (tx) return receiptFromTx(tx, patient)
  return {
    no: p.ref || p.id,
    patientId: p.patientId,
    patientName: p.patientName || (patient ? `${patient.firstName || ''} ${patient.surname || ''}`.trim() : '') || '—',
    patientSex: p.patientSex || patient?.gender || '—',
    date: p.at,
    amount: Number(p.amount) || 0,
    direction: /wallet funding/i.test(p.service || '') ? 'Credit' : 'Debit',
    reason: p.service || '—',
    method: p.method,
    balanceAfter: null,
    staff: p.staff || '—',
    staffRole: p.staffRole || '',
  }
}

interface HospitalInfo { name?: string; address?: string; phone?: string }

/* The receipt body: one HTML string used for the on-screen preview, the
 * download and the print — so what you see is exactly what lands on paper. */
export function receiptInnerHtml(r: ReceiptData, hospital: HospitalInfo): string {
  const name = hospital.name || 'Kebbi Clinic'
  const sub = [hospital.address, hospital.phone].filter(Boolean).join(' · ')
  const credit = r.direction === 'Credit'
  const rows: [string, string][] = [
    ['Receipt No', r.no],
    ['Date', r.date || '—'],
    ['Patient', r.patientName],
    ['Sex', r.patientSex || '—'],
  ]
  if (r.patientId) rows.push(['Patient ID', r.patientId])
  if (r.method) rows.push(['Method', r.method])
  if (r.balanceAfter !== null && r.balanceAfter !== undefined) rows.push(['Balance After', naira2(r.balanceAfter)])
  return `<style>
.rcpt{font-family:'Courier New',ui-monospace,monospace;font-size:13px;color:#111;background:#fff;max-width:320px;margin:0 auto;padding:14px;border:1px dashed #9ca3af}
.rcpt *{box-sizing:border-box}
.rcpt .rcpt-h{text-align:center}
.rcpt .rcpt-name{font-size:17px;font-weight:800;letter-spacing:.02em;text-transform:uppercase}
.rcpt .rcpt-sub{font-size:11px;color:#444;margin-top:2px}
.rcpt hr{border:none;border-top:1px dashed #9ca3af;margin:8px 0}
.rcpt .rcpt-row{display:flex;justify-content:space-between;gap:10px;margin:3px 0}
.rcpt .rcpt-row .rcpt-k{color:#333}
.rcpt .rcpt-row .rcpt-v{font-weight:700;text-align:right}
.rcpt .rcpt-dir{text-align:center;font-size:15px;font-weight:800;letter-spacing:.1em;padding:4px 0}
.rcpt .rcpt-dir.credit{color:#15803d}
.rcpt .rcpt-dir.debit{color:#b91c1c}
.rcpt .rcpt-amt{text-align:center;font-size:22px;font-weight:800;margin:4px 0}
.rcpt .rcpt-amt-label{text-align:center;font-size:11px;color:#444}
.rcpt .rcpt-reason{text-align:center;font-weight:700;font-size:12.5px;margin-top:2px}
.rcpt .rcpt-who{text-align:center}
.rcpt .rcpt-who .rcpt-nm{font-weight:800}
.rcpt .rcpt-who .rcpt-rl{font-size:11.5px;color:#333}
.rcpt .rcpt-foot{text-align:center;font-size:10.5px;color:#444;margin-top:6px}
@media print{
  .rcpt{max-width:none;width:auto;border:none;padding:0;font-size:11px}
}
</style>
<div class="rcpt">
  <div class="rcpt-h">
    <div class="rcpt-name">${esc(name)}</div>
    ${sub ? `<div class="rcpt-sub">${esc(sub)}</div>` : ''}
  </div>
  <div class="rcpt-sub" style="text-align:center;margin-top:2px">— TRANSACTION RECEIPT —</div>
  <hr/>
  ${rows.map(([k, v]) => `<div class="rcpt-row"><span class="rcpt-k">${esc(k)}</span><span class="rcpt-v">${esc(v)}</span></div>`).join('')}
  <hr/>
  <div class="rcpt-dir ${credit ? 'credit' : 'debit'}">${credit ? 'CREDIT (+)' : 'DEBIT (−)'}</div>
  <div class="rcpt-amt">${esc(naira2(r.amount))}</div>
  <div class="rcpt-amt-label">Amount Paid</div>
  <div class="rcpt-reason">${esc(r.reason)}</div>
  <hr/>
  <div class="rcpt-who">
    <div class="rcpt-sub">Initiated by</div>
    <div class="rcpt-nm">${esc(r.staff)}</div>
    ${r.staffRole ? `<div class="rcpt-rl">${esc(r.staffRole)}</div>` : ''}
  </div>
  <hr/>
  <div class="rcpt-foot">Keep this receipt — it is the official record of this transaction.<br/>${esc(name)}</div>
</div>`
}

/* Standalone document (download / print). The @page rule sizes the paper for
 * a 58 mm mini printer; regular A4/letter printers still work. */
function receiptDocumentHtml(r: ReceiptData, hospital: HospitalInfo): string {
  return `<!doctype html><html><head><meta charset="utf-8"/><title>Receipt ${esc(r.no)}</title><style>@page{size:58mm auto;margin:2mm}body{margin:0;background:#fff}</style></head><body>${receiptInnerHtml(r, hospital)}</body></html>`
}

/** Render through a hidden iframe — no popup blockers, and the browser print
 *  dialog opens straight away so the user can pick the mini printer. */
function printHtml(html: string) {
  const frame = document.createElement('iframe')
  frame.setAttribute('aria-hidden', 'true')
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0'
  document.body.appendChild(frame)
  const win = frame.contentWindow
  const doc = frame.contentDocument || win?.document
  if (!win || !doc) {
    frame.remove()
    const w = window.open('', '_blank')
    if (w) { w.document.write(html); w.document.close(); w.focus(); w.print() }
    return
  }
  doc.open(); doc.write(html); doc.close()
  let done = false
  const cleanup = () => {
    if (done) return
    done = true
    window.removeEventListener('afterprint', cleanup)
    setTimeout(() => frame.remove(), 500)
  }
  window.addEventListener('afterprint', cleanup)
  setTimeout(cleanup, 60_000)
  win.focus()
  win.print()
}

export function ReceiptModal({ receipt, onClose }: { receipt: ReceiptData; onClose: () => void }) {
  const { data: settings } = useFetch<{ hospital?: HospitalInfo }>(paths.settings)
  const hospital = settings?.hospital || {}

  const download = () => {
    const blob = new Blob([receiptDocumentHtml(receipt, hospital)], { type: 'text/html;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `receipt-${String(receipt.no || 'tx').replace(/[^\w-]+/g, '_')}.html`
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 4000)
  }

  return (
    <Modal title={`Receipt — ${receipt.no}`} onClose={onClose} wide
      footer={<>
        <button className="btn ghost" onClick={onClose}>Close</button>
        <button className="btn primary" onClick={download}>⬇ Download Receipt</button>
        <button className="btn green" onClick={() => printHtml(receiptDocumentHtml(receipt, hospital))}>🖨 Print Receipt</button>
      </>}>
      <div className="receipt-preview" dangerouslySetInnerHTML={{ __html: receiptInnerHtml(receipt, hospital) }} />
      <div className="receipt-hint">
        Review the receipt above before printing. <b>Print</b> opens the print dialog —
        choose your <b>58 mm mini printer</b> (Bluetooth/USB thermal printer) for a paper copy,
        or any regular printer / “Save as PDF”. <b>Download</b> saves a copy to this device.
      </div>
    </Modal>
  )
}
