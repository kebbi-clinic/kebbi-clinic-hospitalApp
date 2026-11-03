import { useState } from 'react'
import { Layout } from '../components/Layout'
import { Card, PageHead, Badge, statusTone, Modal, Field, naira, AlertCard, isTopUpError } from '../components/ui'
import { ReceiptModal, receiptFromTx, receiptFromOTC, type ReceiptData } from '../components/Receipt'
import { useFetch } from '../api'
import { paths, prescriptionApi, otcApi } from '../endpoints'
import type { Prescription, Drug, OTCSale, OTCItem } from '../data'
import { DrugPicker } from '../components/DrugPicker'

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

  /* ---------- NEW: over-the-counter cash sale to a non-patient ---------- */
  const { data: catalogue = [] } = useFetch<Drug[]>(paths.drugs)
  const inStock = catalogue.filter((d) => (d.stock || 0) > 0)
  const [otcSale, setOtcSale] = useState<OTCSale | null>(null)   // the pending sale just created (show customer the id)
  const [otcCart, setOtcCart] = useState<OTCItem[]>([])
  const [otcDrugId, setOtcDrugId] = useState('')
  const [otcQty, setOtcQty] = useState('1')
  const [otcCustomer, setOtcCustomer] = useState({ name: '', phone: '' })
  const [otcBusy, setOtcBusy] = useState(false)
  const [otcErr, setOtcErr] = useState('')
  const [otcOk, setOtcOk] = useState('')

  /* Look up a sale by its reference id — pharmacist verifies it is Paid
   * before releasing the drugs and printing the receipt. */
  const [checkId, setCheckId] = useState('')
  const [checkedSale, setCheckedSale] = useState<OTCSale | null>(null)
  const [checkBusy, setCheckBusy] = useState(false)
  const [releaseErr, setReleaseErr] = useState('')

  const otcTotal = otcCart.reduce((s, i) => s + i.price * i.qty, 0)

  const otcAdd = () => {
    const drug = catalogue.find((d) => d.id === otcDrugId)
    const qty = Math.max(1, Number(otcQty) || 1)
    if (!drug) { setOtcErr('Pick a drug first.'); return }
    if ((drug.stock || 0) < qty) { setOtcErr(`Only ${drug.stock} ${drug.name}(s) left in stock.`); return }
    setOtcErr('')
    setOtcCart(cur => {
      const existing = cur.find((i) => i.drugId === otcDrugId)
      if (existing) {
        if ((existing.qty + qty) > (drug.stock || 0)) { setOtcErr(`Only ${drug.stock} ${drug.name}(s) left in stock.`); return cur }
        return cur.map((i) => i.drugId === otcDrugId ? { ...i, qty: i.qty + qty } : i)
      }
      return [...cur, { drugId: drug.id, drug: drug.name, qty, price: Number(drug.price) || 0 }]
    })
    setOtcDrugId('')
  }

  const otcRemove = (idx: number) => setOtcCart(cur => cur.filter((_, i) => i !== idx))

  const otcSetQty = (idx: number, v: string) => {
    const qty = Math.max(1, Number(v) || 1)
    const drug = catalogue.find((d) => d.id === otcCart[idx].drugId)
    if (drug && (drug.stock || 0) < qty) { setOtcErr(`Only ${drug.stock} left in stock.`); return }
    setOtcErr('')
    setOtcCart(cur => cur.map((i, i2) => i2 === idx ? { ...i, qty } : i))
  }

  const createOTCSale = async () => {
    if (!otcCustomer.name) { setOtcErr('Enter the customer\'s name.'); return }
    if (!otcCart.length) { setOtcErr('Add at least one drug to the sale.'); return }
    setOtcBusy(true); setOtcErr('')
    try {
      const sale = await otcApi.create({
        customerName: otcCustomer.name,
        customerPhone: otcCustomer.phone,
        items: otcCart.map((i) => ({ drugId: i.drugId, qty: i.qty })),
      })
      setOtcSale(sale)
      setOtcCart([])
      setOtcCustomer({ name: '', phone: '' })
      setOtcOk(`Sale created — give the customer this reference: <b>${sale.id}</b>. They pay the accountant, who marks it Paid before drugs are released.`)
    } catch (e) { setOtcErr((e as Error).message) } finally { setOtcBusy(false) }
  }

  const checkSale = async () => {
    if (!checkId) return
    setCheckBusy(true); setReleaseErr('')
    try {
      const sale = await otcApi.get(checkId)
      setCheckedSale(sale)
      if (sale.status !== 'Paid') setReleaseErr(`Sale ${sale.id} is ${sale.status} — not yet paid. The accountant must mark it Paid first.`)
    } catch (e) { setReleaseErr((e as Error).message) } finally { setCheckBusy(false) }
  }

  return (
    <Layout title="Pharmacy">
      <PageHead title="Pharmacy" sub="Dispense prescriptions (wallet-billed) and ring up over-the-counter cash sales for walk-in customers — pending until the accountant marks them Paid." />
      {ok && (
        <AlertCard tone="green" title="Prescription dispensed"
          actions={lastReceipt ? <button className="btn primary sm" onClick={() => setReceipt(lastReceipt)}>View Receipt</button> : undefined}>
          {ok}
        </AlertCard>
      )}
      {otcOk && (
        <AlertCard tone="green" title="Over-the-counter sale created">
          {otcOk}
        </AlertCard>
      )}
      {otcErr && <AlertCard tone="red" title="Could not create sale">{otcErr}</AlertCard>}
      <div className="grid cols-2">
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
        <Card title="Over-the-Counter Sale (Walk-in / Non-Patient)">
          <div className="muted mb">Ring up drugs for a customer who is not a registered patient. The sale starts <b>Pending</b> — the customer pays the accountant, who marks it Paid, before you release the drugs.</div>
          <div className="field mb"><label>Customer name <span className="muted">(required)</span></label>
            <input className="input" value={otcCustomer.name} onChange={(e) => setOtcCustomer({ ...otcCustomer, name: e.target.value })} /></div>
          <div className="field mb"><label>Customer phone</label>
            <input className="input" placeholder="080…" value={otcCustomer.phone} onChange={(e) => setOtcCustomer({ ...otcCustomer, phone: e.target.value })} /></div>
          <div className="field mb" style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div style={{ minWidth: 220, flex: 1 }}>
              <label className="muted" style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>Drug</label>
              <DrugPicker drugs={inStock} value={otcDrugId} onChange={setOtcDrugId} placeholder="Select drug…" />
            </div>
            <div style={{ minWidth: 90 }}>
              <label className="muted" style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>Qty</label>
              <input className="input" type="number" min={1} value={otcQty} onChange={(e) => setOtcQty(e.target.value)} />
            </div>
            <button className="btn green sm" onClick={otcAdd} disabled={otcBusy}>Add</button>
          </div>
          {otcCart.length && (
            <div className="tbl-wrap mb"><table className="tbl">
              <thead><tr><th>Drug</th><th>Unit</th><th>Qty</th><th>Total</th><th></th></tr></thead>
              <tbody>{otcCart.map((i, idx) => (
                <tr key={idx}>
                  <td>{i.drug}</td><td className="money">{naira(i.price)}</td>
                  <td><input className="input" type="number" min={1} style={{ width: 70 }} value={i.qty} onChange={(e) => otcSetQty(idx, e.target.value)} /></td>
                  <td className="money">{naira(i.price * i.qty)}</td>
                  <td className="right"><button className="btn danger sm" onClick={() => otcRemove(idx)}>Remove</button></td>
                </tr>
              ))}</tbody>
              <tfoot><tr><td colSpan={3} className="right"><b>Total</b></td><td className="money"><b>{naira(otcTotal)}</b></td><td /></tr></tfoot>
            </table></div>
          )}
          <div className="right mt">
            <button className="btn primary" disabled={otcBusy || !otcCustomer.name || !otcCart.length} onClick={createOTCSale}>
              Create Pending Sale
            </button>
          </div>
        </Card>
      </div>
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
      {otcSale && (
        <Modal title="Pending over-the-counter sale created" onClose={() => setOtcSale(null)} wide
          footer={<button className="btn ghost" onClick={() => setOtcSale(null)}>Close</button>}>
          <div className="kv">
            <div className="k">Reference (give this to the customer)</div>
            <div className="v" style={{ fontSize: 22, letterSpacing: '2px', fontWeight: 700 }}>{otcSale.id}</div>
            <div className="k">Customer</div><div className="v">{otcSale.customerName}</div>
            <div className="k">Phone</div><div className="v">{otcSale.customerPhone || '—'}</div>
            <div className="k">Total</div><div className="v money">{naira(otcSale.total)}</div>
            <div className="k">Status</div><div className="v"><Badge tone="blue">Pending</Badge></div>
            <div className="k">Created by</div><div className="v">{otcSale.createdBy}</div>
          </div>
          <div className="alert muted mt" style={{ background: '#fff8e1', border: '1px solid #ffe082', color: '#8a6d1b', padding: 12, borderRadius: 8 }}>
            Hand the customer the reference <b>{otcSale.id}</b>. They take it to the accountant, pay, and the accountant marks the sale <b>Paid</b> — only then are the drugs released and the receipt printed.
          </div>
        </Modal>
      )}
      <Card title="Check & Release a Paid Sale">
        <div className="muted mb">After the customer pays the accountant, enter the sale reference they were given to confirm it is Paid before releasing the drugs.</div>
        <div className="field mb" style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <input className="input" placeholder="OTC-000001" value={checkId} onChange={(e) => setCheckId(e.target.value)} />
          <button className="btn primary sm" disabled={checkBusy || !checkId} onClick={checkSale}>{checkBusy ? 'Checking…' : 'Check Sale'}</button>
        </div>
        {releaseErr && <AlertCard tone="red">{releaseErr}</AlertCard>}
        {checkedSale && (
          <div className="tbl-wrap"><table className="tbl">
            <thead><tr><th>Reference</th><th>Customer</th><th>Total</th><th>Status</th><th>Method</th><th>Paid by</th><th></th></tr></thead>
            <tbody><tr>
              <td>{checkedSale.id}</td><td>{checkedSale.customerName}</td><td className="money">{naira(checkedSale.total)}</td>
              <td><Badge tone={checkedSale.status === 'Paid' ? 'green' : 'blue'}>{checkedSale.status}</Badge></td>
              <td>{checkedSale.paymentMethod || '—'}</td><td>{checkedSale.paidBy || '—'}</td>
              <td className="right">
                {checkedSale.status === 'Paid' && (
                  <>
                    <button className="btn green sm" onClick={() => {
                      const rc = receiptFromOTC(checkedSale, {
                        id: checkedSale.paymentId || '',
                        ref: '',
                        patientId: checkedSale.id,
                        patientName: checkedSale.customerName,
                        patientSex: '',
                        amount: checkedSale.total,
                        method: checkedSale.paymentMethod || '',
                        service: 'Over-the-counter drug sale',
                        staff: checkedSale.paidBy || '—',
                        staffRole: checkedSale.paidByRole || '',
                        at: checkedSale.paidAt || checkedSale.createdAt,
                        status: 'Paid',
                      })
                      setReceipt(rc)
                    }}>Print Receipt</button>
                    <button className="btn primary sm" onClick={() => setReleaseErr('Drugs released for ' + checkedSale.id)}>Release Drugs</button>
                  </>
                )}
              </td>
            </tr></tbody>
          </table></div>
        )}
      </Card>
      {receipt && <ReceiptModal receipt={receipt} onClose={() => setReceipt(null)} />}
    </Layout>
  )
}

