import { useState } from 'react'
import { Layout } from '../components/Layout'
import { Card, PageHead, Badge, statusTone, Modal, naira } from '../components/ui'
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
      /* The cost is always taken from the wallet first; any shortfall is raised
         as a pending payment for the accountant. */
      const parts = [`Dispensed — ₦${res.total.toLocaleString()} recorded.`]
      parts.push(`₦${res.debitedFromWallet.toLocaleString()} taken from the wallet — balance ₦${res.walletBalance.toLocaleString()}.`)
      if (res.outstanding > 0) parts.push(`₦${res.outstanding.toLocaleString()} is still outstanding — the accountant has been notified.`)
      if (res.shortages?.length) parts.push(`Short stock: ${res.shortages.join('; ')}.`)
      setOk(parts.join(' '))
      setDispense(null)
      refetch()
    } catch (e) { setErr((e as Error).message) } finally { setBusy(false) }
  }

  return (
    <Layout title="Pharmacy">
      <PageHead title="Prescriptions & Dispensing" sub="Select items, take payment (wallet / cash / transfer / POS), then dispense — inventory, wallet and history update automatically.">
        {ok && <Badge tone="green">{ok}</Badge>}
      </PageHead>
      <Card title="Prescriptions">
        <div className="tbl-wrap"><table className="tbl">
          <thead><tr><th>RX</th><th>Patient</th><th>Doctor</th><th>Visit</th><th>Items</th><th>Total</th><th>Status</th><th></th></tr></thead>
          <tbody>{rxs.map((p) => (
            <tr key={p.id}>
              <td>{p.id}</td><td>{p.patientName}<div className="muted">{p.patientId}</div></td><td>{p.doctor}</td><td>{p.visitId}</td>
              <td>
                  {p.items.map((i) => (
                    <div key={i.drugId}>
                      <b>{i.drug}</b> ×{i.qty}
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
          {err && <div className="demo-note" style={{ background: 'var(--red-100)', color: 'var(--red-600)' }}>{err}</div>}
          <div className="tbl-wrap"><table className="tbl">
            <thead><tr><th></th><th>Drug</th><th>Route</th><th>Frequency</th><th>Duration</th><th>Qty</th><th>Price</th><th>Total</th></tr></thead>
            <tbody>{dispense.items.map((i) => (
              <tr key={i.drugId}>
                <td><input type="checkbox" checked={sel[i.drugId] !== false} onChange={(e) => setSel({ ...sel, [i.drugId]: e.target.checked })} /></td>
                <td>{i.drug}</td>
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
    </Layout>
  )
}

