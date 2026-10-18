import { useState } from 'react'
import { Layout } from '../components/Layout'
import { Card, PageHead, Badge, statusTone, Modal, naira, AlertCard, isTopUpError } from '../components/ui'
import { ReceiptModal, receiptFromTx, type ReceiptData } from '../components/Receipt'
import { useFetch } from '../api'
import { paths, prescriptionApi } from '../endpoints'
import type { Prescription } from '../data'

export default function Pharmacy() {
  const [dispense, setDispense] = useState<Prescription | null>(null)
  const [sel, setSel] = useState<Record<string, boolean>>({})
  const [method, setMethod] = useState('Wallet')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [ok, setOk] = useState('')
  /* Receipt for the last dispense — review before printing. */
  const [receipt, setReceipt] = useState<ReceiptData | null>(null)
  const [lastReceipt, setLastReceipt] = useState<ReceiptData | null>(null)
  const { data: rxs = [], refetch } = useFetch<Prescription[]>(paths.prescriptions)

  const total = (r: Prescription, onlySel = false) =>
    r.items.filter((i) => !onlySel || sel[i.drugId] !== false).reduce((s, i) => s + i.qty * i.price, 0)

  const open = (r: Prescription) => { setDispense(r); setSel(Object.fromEntries(r.items.map((i) => [i.drugId, true]))); setErr(''); setOk('') }

  const dispenseNow = async () => {
    if (!dispense) return
    setBusy(true); setErr('')
    try {
      const items = dispense.items.filter((i) => sel[i.drugId]).map((i) => ({ drugId: i.drugId, qty: i.qty }))
      if (!items.length) { setErr('Select at least one drug to dispense.'); setBusy(false); return }
      const res = await prescriptionApi.dispense(dispense.id, { method, items })
      /* The whole cost comes off the wallet (the API refuses the dispense with
         a bold "top up" error when the wallet cannot cover it). */
      const parts = [`Dispensed — ₦${res.total.toLocaleString()} recorded.`]
      parts.push(`₦${res.debitedFromWallet.toLocaleString()} taken from the wallet — balance ₦${res.walletBalance.toLocaleString()}.`)
      if (res.shortages?.length) parts.push(`Short stock: ${res.shortages.join('; ')}.`)
      setOk(parts.join(' '))
      /* Every transaction has a receipt: open it for review before printing. */
      if (res.walletTx) { const rc = receiptFromTx(res.walletTx); setReceipt(rc); setLastReceipt(rc) }
      setDispense(null)
      refetch()
    } catch (e) { setErr((e as Error).message) } finally { setBusy(false) }
  }

  return (
    <Layout title="Pharmacy">
      <PageHead title="Prescriptions & Dispensing" sub="Select items, take payment (wallet), then dispense — inventory, wallet and history update automatically. If the wallet cannot cover the cost the dispense is refused until the patient tops up." />
      {ok && (
        <AlertCard tone="green" title="Prescription dispensed"
          actions={lastReceipt ? <button className="btn primary sm" onClick={() => setReceipt(lastReceipt)}>View Receipt</button> : undefined}>
          {ok}
        </AlertCard>
      )}
      <Card title="Prescriptions">
        <div className="tbl-wrap"><table className="tbl">
          <thead><tr><th>RX</th><th>Patient</th><th>Doctor</th><th>Visit</th><th>Items</th><th>Total</th><th>Status</th><th></th></tr></thead>
          <tbody>{rxs.map((p) => (
            <tr key={p.id}>
              <td>{p.id}</td><td>{p.patientName}<div className="muted">{p.patientId}</div></td><td>{p.doctor}</td><td>{p.visitId}</td>
              <td>
                  {p.items.map((i) => (
                    <div key={i.drugId}>
                      <b>{i.drug}</b>{i.dose ? <> <b>({i.dose})</b></> : null} ×{i.qty}
                      <span className="muted"> — {i.route || 'Oral'} · {i.frequency || 'Daily'} · {i.duration || 1}d</span>
                    </div>
                  ))}
                </td>
              <td className="money">{naira(p.items.reduce((s, i) => s + i.qty * i.price, 0))}</td>
              <td><Badge tone={statusTone(p.status)}>{p.status}</Badge></td>
              <td className="right">{p.status === 'Pending' && <button className="btn green sm" onClick={() => open(p)}>Dispense</button>}</td>
            </tr>
          ))}</tbody>
        </table></div>
      </Card>
      {dispense && (
        <Modal title={`Dispense ${dispense.id} — ${dispense.patientName}`} onClose={() => setDispense(null)}
          footer={<><button className="btn ghost" onClick={() => setDispense(null)}>Cancel</button><button className="btn green" disabled={busy} onClick={dispenseNow}>{busy ? 'Dispensing…' : 'Dispense & Record Payment'}</button></>}>
          {err && (
            <AlertCard tone="red" title={isTopUpError(err) ? 'Top up the patient’s wallet' : 'Could not dispense'}>
              {err}
            </AlertCard>
          )}
          <div className="tbl-wrap"><table className="tbl">
            <thead><tr><th></th><th>Drug</th><th>Dose</th><th>Route</th><th>Frequency</th><th>Duration</th><th>Qty</th><th>Price</th><th>Total</th></tr></thead>
            <tbody>{dispense.items.map((i) => (
              <tr key={i.drugId}>
                <td><input type="checkbox" checked={sel[i.drugId] !== false} onChange={(e) => setSel({ ...sel, [i.drugId]: e.target.checked })} /></td>
                <td>{i.drug}</td>
                <td><b>{i.dose || '—'}</b></td>
                <td>{i.route || 'Oral'}</td>
                <td>{i.frequency || 'Daily'}</td>
                <td>{i.duration || 1}d</td>
                <td>{i.qty}</td>
                <td>{naira(i.price)}</td>
                <td className="money">{naira(i.qty * i.price)}</td>
              </tr>
            ))}
            </tbody>
          </table></div>
          <div className="right mt" style={{ fontSize: 16 }}><b>Total: <span className="money">{naira(total(dispense, true))}</span></b></div>
          <div className="field mt"><label>Payment Method</label>
            <select className="input" value={method} onChange={(e) => setMethod(e.target.value)}>
              <option>Wallet</option><option>Cash</option><option>Transfer</option><option>POS</option>
            </select>
          </div>
        </Modal>
      )}
      {receipt && <ReceiptModal receipt={receipt} onClose={() => setReceipt(null)} />}
    </Layout>
  )
}

