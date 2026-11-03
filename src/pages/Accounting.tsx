import { useEffect, useMemo, useState } from 'react'
import { Layout } from '../components/Layout'
import { Card, PageHead, Tabs, Badge, StatCard, Modal, Field, naira, AlertCard, isTopUpError } from '../components/ui'
import { ReceiptModal, receiptFromTx, receiptFromPayment, receiptFromOTC, type ReceiptData } from '../components/Receipt'
import { useFetch } from '../api'
import { paths, walletApi, otcApi } from '../endpoints'
import { PatientSearch, SearchBox, filterPatients, matchesFields } from '../components/PatientSearch'
import type { Patient, Payment, WalletTx, OTCSale } from '../data'

/** Coerce any unknown payload into a real array so `.map`/`.filter` never crash
 *  the error boundary. Handles bare arrays and common wrappers. */
function asArray<T>(v: unknown): T[] {
  if (Array.isArray(v)) return v as T[]
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>
    for (const k of ['data', 'list', 'rows', 'items', 'results']) {
      if (Array.isArray(o[k])) return o[k] as T[]
    }
  }
  return []
}

export default function Accounting() {
  const [tab, setTab] = useState('Payments')
  const [fund, setFund] = useState<Patient | null>(null)
  const [q, setQ] = useState('')
  const [payQ, setPayQ] = useState('')
  const [txQ, setTxQ] = useState('')
  const [form, setForm] = useState({ amount: '20000', method: 'Transfer', reference: '' })
  const [err, setErr] = useState('')
  const [ok, setOk] = useState('')
  const [busy, setBusy] = useState(false)
  /* The receipt for the last funding / the row whose Receipt button was hit —
     opens the view-before-print modal. `lastReceipt` keeps the last successful
     transaction's receipt reachable from the success card after it is closed. */
  const [receipt, setReceipt] = useState<ReceiptData | null>(null)
  const [lastReceipt, setLastReceipt] = useState<ReceiptData | null>(null)
  /* OTC (walk-in) cash sales: the accountant lists pending sales and marks
   * them Paid with a payment method, releasing the drugs and the receipt. */
  const [otcQ, setOtcQ] = useState('')
  const [otcErr, setOtcErr] = useState('')
  const [otcOk, setOtcOk] = useState('')
  const [paySale, setPaySale] = useState<OTCSale | null>(null)
  const [payMethod, setPayMethod] = useState('Cash')
  const [payBusy, setPayBusy] = useState(false)

  const { data: paymentsRaw } = useFetch<unknown>(paths.payments)
  const { data: txsRaw } = useFetch<unknown>(paths.walletTxs)
  const { data: patientsRaw, refetch } = useFetch<unknown>(paths.patients)
  const { data: otcRaw, refetch: refetchOtc } = useFetch<OTCSale[]>(paths.otcSales)

  const payments = useMemo(() => asArray<Payment>(paymentsRaw), [paymentsRaw])
  const txs = useMemo(() => asArray<WalletTx>(txsRaw), [txsRaw])
  const patients = useMemo(() => asArray<Patient>(patientsRaw), [patientsRaw])
  const otcSales = useMemo(() => asArray<OTCSale>(otcRaw), [otcRaw])
  const shownOtc = useMemo(() => otcSales.filter((s) => {
    const q = otcQ.trim().toLowerCase()
    if (!q) return true
    return [s.id, s.customerName, s.customerPhone, s.status, s.paymentMethod, s.createdBy]
      .some((v) => String(v || '').toLowerCase().includes(q))
  }), [otcSales, otcQ])

  const paid = payments.filter((p) => p.status === 'Paid')
  const funding = paid.filter((p) => p.service === 'Wallet funding').reduce((s, p) => s + p.amount, 0)
  /* The wallet list can run to hundreds of rows — the accountant searches by
   * name or Patient ID instead of scrolling for the patient they owe. */
  const wallets = filterPatients(patients, q)

  /* Wallet transactions only carry the patient ID, so resolve the name from
   * the patient list — otherwise "search by name" cannot work on that tab. */
  const nameOf = useMemo(() => {
    const m = new Map(patients.map((p) => [p.id, `${p.firstName} ${p.surname}`]))
    return (id: string) => m.get(id) || ''
  }, [patients])

  /* Receipt helpers: patient record fills sex/name on legacy rows, and wallet
   * ledger rows are matched to their payment through `txId`. */
  const patientById = useMemo(() => new Map(patients.map((p) => [p.id, p])), [patients])
  const txById = useMemo(() => new Map(txs.map((t) => [t.id, t])), [txs])

  /* Stable so the SearchBox memo never re-filters on every render. */
  const payFields = useMemo(
    () => (p: Payment) => [p.ref, p.patientId, p.patientName, p.service, p.method, p.staff, p.status, p.amount],
    [],
  )
  const txFields = useMemo(
    () => (t: WalletTx) => [t.id, t.patientId, nameOf(t.patientId), t.reason, t.method, t.staff, t.type, t.amount],
    [nameOf],
  )

  /* One filter pass each, shared by the box's counter and the table below. */
  const shownPayments = useMemo(
    () => (payQ.trim() ? payments.filter((p) => matchesFields(payFields(p), payQ)) : payments),
    [payments, payQ, payFields],
  )
  const shownTxs = useMemo(
    () => (txQ.trim() ? txs.filter((t) => matchesFields(txFields(t), txQ)) : txs),
    [txs, txQ, txFields],
  )

  const openFund = (p: Patient) => {
    setFund(p)
    setForm({ amount: '20000', method: 'Transfer', reference: '' })
    setErr('')
    setQ('')
  }

  const doFund = async () => {
    if (!fund) return
    setBusy(true); setErr('')
    try {
      const r = await walletApi.fund({ patientId: fund.id, amount: Number(form.amount), method: form.method, reference: form.reference })
      setOk(`Wallet funded — new balance ₦${r.balance.toLocaleString()} (${fund.id}). A transaction record was created.`)
      /* Every transaction has a receipt: open it for review before printing. */
      if (r.tx) { const rc = receiptFromTx(r.tx, fund); setReceipt(rc); setLastReceipt(rc) }
      setFund(null); refetch()
    } catch (e) { setErr((e as Error).message) } finally { setBusy(false) }
  }

  const payOTC = async () => {
    if (!paySale) return
    setPayBusy(true); setOtcErr('')
    try {
      await otcApi.pay(paySale.id, { paymentMethod: payMethod })
      setOtcOk(`Sale ${paySale.id} marked Paid — ₦${paySale.total.toLocaleString()} received via ${payMethod}. Drugs and receipt released.`)
      setPaySale(null)
      refetchOtc()
    } catch (e) { setOtcErr((e as Error).message) } finally { setPayBusy(false) }
  }

  /* Re-fetch OTC sales whenever the accountant opens the OTC Sales tab to
   * search by a customer's reference id. The list is fetched once on mount
   * and refetchOtc() is otherwise only called after marking a sale Paid, so
   * a sale the pharmacist just rang up is missing from the list until a
   * reload — meaning a search by reference id would turn up nothing. */
  useEffect(() => {
    if (tab === 'OTC Sales') refetchOtc()
  }, [tab])

  return (
    <Layout title="Payments & Wallets">
      <PageHead title="Payments & Wallets" sub="Every balance change must create a transaction record — balances are never edited directly." />
      {ok && (
        <AlertCard tone="green" title="Transaction successful"
          actions={lastReceipt ? <button className="btn primary sm" onClick={() => setReceipt(lastReceipt)}>View Receipt</button> : undefined}>
          {ok}
        </AlertCard>
      )}
      <div className="grid cols-4 mb">
        <StatCard icon="money" value={naira(funding)} label="Revenue (wallet credits)" tone="green" />
        <StatCard icon="wallet" value={naira(funding)} label="Wallet Funding" tone="blue" />
        <StatCard icon="clock" value={payments.filter((p) => p.status === 'Pending').length} label="Pending Payments" tone="amber" />
        <StatCard icon="check" value={paid.length} label="Completed Payments" />
      </div>
      <Tabs tabs={['Payments', 'Patient Wallets', 'Transactions', 'OTC Sales']} active={tab} onChange={setTab} />

      {tab === 'Payments' && (
        <Card title="Payments">
          <SearchBox<Payment>
            items={payments}
            value={payQ}
            onChange={setPayQ}
            noun="payment"
            fieldsOf={payFields}
            keyOf={(p) => p.id}
            placeholder="Search by Patient Name, Patient ID or Reference…"
            hint={<>Type a patient's <b>name</b> or <b>KBC-… ID</b> — or a payment reference</>}
          />
          <div className="tbl-wrap"><table className="tbl">
            <thead><tr><th>Reference</th><th>Patient</th><th>Service</th><th>Method</th><th>Amount</th><th>Staff</th><th>Date/Time</th><th>Status</th><th></th></tr></thead>
            <tbody>{shownPayments.map((p) => (
              <tr key={p.id}><td>{p.ref}</td><td>{p.patientName}<div className="muted">{p.patientId}</div></td><td>{p.service}</td><td>{p.method}</td>
                <td className="money">{naira(p.amount)}</td><td>{p.staff}</td><td>{p.at}</td><td><Badge tone={p.status === 'Paid' ? 'green' : 'amber'}>{p.status}</Badge></td>
                <td className="right"><button className="btn ghost sm"
                  onClick={() => setReceipt(receiptFromPayment(p, p.txId ? txById.get(p.txId) : undefined, patientById.get(p.patientId)))}
                >Receipt</button></td></tr>
            ))}
            {shownPayments.length === 0 && (
              <tr><td colSpan={9} className="muted" style={{ textAlign: 'center', padding: '22px 14px' }}>
                {payQ.trim() ? <>No payment matches <b>{payQ}</b>.</> : 'No payments recorded yet.'}
              </td></tr>
            )}
            </tbody>
          </table></div>
        </Card>
      )}

      {tab === 'Patient Wallets' && (
        <Card title="Patient Wallets">
          <PatientSearch
            patients={patients}
            value={q}
            onChange={setQ}
            placeholder="Search a patient by Name or Patient ID…"
            hint={<>Patient IDs look like <b>KBC-000245</b> — press <b>Enter</b> to fund that wallet</>}
            onPick={openFund}
          />
          <div className="tbl-wrap"><table className="tbl">
            <thead><tr><th>Patient</th><th>Wallet Balance</th><th></th></tr></thead>
            <tbody>{wallets.map((p) => (
              <tr key={p.id}><td>{p.firstName} {p.surname}<div className="muted">{p.id}</div></td><td className="money">{naira(p.wallet)}</td>
                <td className="right"><button className="btn primary sm" onClick={() => openFund(p)}>Fund</button></td></tr>
            ))}
            {wallets.length === 0 && (
              <tr><td colSpan={3} className="muted" style={{ textAlign: 'center', padding: '22px 14px' }}>
                {q.trim() ? <>No patient matches <b>{q}</b>.</> : 'No patients to fund yet.'}
              </td></tr>
            )}
            </tbody>
          </table></div>
        </Card>
      )}

      {tab === 'Transactions' && (
        <Card title="Wallet Transactions">
          <SearchBox<WalletTx>
            items={txs}
            value={txQ}
            onChange={setTxQ}
            noun="transaction"
            fieldsOf={txFields}
            keyOf={(t) => t.id}
            placeholder="Search by Patient Name, Patient ID or TX…"
            hint={<>Every balance change for one patient — search their <b>name</b> or <b>KBC-… ID</b></>}
          />
          <div className="tbl-wrap"><table className="tbl">
            <thead><tr><th>TX</th><th>Patient</th><th>Date/Time</th><th>Type</th><th>Amount</th><th>Reason</th><th>Staff</th><th>Method</th><th>Balance After</th><th></th></tr></thead>
            <tbody>{shownTxs.map((t) => (
              <tr key={t.id}><td>{t.id}</td>
                <td>{nameOf(t.patientId) || t.patientName || '—'}<div className="muted">{t.patientId}</div></td><td>{t.at}</td>
                <td><Badge tone={t.type === 'Credit' ? 'green' : 'blue'}>{t.type}</Badge></td>
                <td className="money">{t.type === 'Credit' ? '+' : '−'}{naira(t.amount)}</td>
                <td>{t.reason}</td><td>{t.staff}{t.staffRole ? <div className="muted">{t.staffRole}</div> : null}</td><td>{t.method}</td><td className="money">{naira(t.balanceAfter)}</td>
                <td className="right"><button className="btn ghost sm"
                  onClick={() => setReceipt(receiptFromTx(t, patientById.get(t.patientId)))}
                >Receipt</button></td></tr>
            ))}
            {shownTxs.length === 0 && (
              <tr><td colSpan={10} className="muted" style={{ textAlign: 'center', padding: '22px 14px' }}>
                {txQ.trim() ? <>No transaction matches <b>{txQ}</b>.</> : 'No wallet transactions yet.'}
              </td></tr>
            )}
            </tbody>
          </table></div>
        </Card>
      )}

      {tab === 'OTC Sales' && (
        <Card title="Over-the-Counter Sales (Walk-in Customers)">
          <div className="muted mb">Cash sales to non-registered patients. A sale starts <b>Pending</b> — the customer pays you here, you choose the payment method and mark it <b>Paid</b>, which deducts stock, releases the drugs and prints the receipt.</div>
          <SearchBox<OTCSale>
            items={otcSales}
            value={otcQ}
            onChange={setOtcQ}
            noun="sale"
            fieldsOf={(s) => [s.id, s.customerName, s.customerPhone || '', s.status, s.paymentMethod || '', s.createdBy]}
            keyOf={(s) => s.id}
            placeholder="Search by sale reference, customer or status…"
            hint={<>Each sale has a reference id (e.g. OTC-000001) — give it to the customer so they can pay you.</>}
          />
          <div className="tbl-wrap"><table className="tbl">
            <thead><tr><th>Reference</th><th>Customer</th><th>Phone</th><th>Total</th><th>Status</th><th>Method</th><th>Created by</th><th></th></tr></thead>
            <tbody>{shownOtc.map((s) => (
              <tr key={s.id}>
                <td>{s.id}</td><td>{s.customerName}</td><td className="muted">{s.customerPhone || '—'}</td>
                <td className="money">{naira(s.total)}</td>
                <td><Badge tone={s.status === 'Paid' ? 'green' : s.status === 'Pending' ? 'blue' : 'red'}>{s.status}</Badge></td>
                <td>{s.paymentMethod || '—'}</td>
                <td>{s.createdBy}</td>
                <td className="right">
                  {s.status === 'Pending' && (
                    <button className="btn green sm" onClick={() => { setPaySale(s); setPayMethod('Cash'); setOtcErr(''); }}>Mark Paid</button>
                  )}
                  {s.status === 'Paid' && <button className="btn ghost sm" onClick={() => {
                    const rc = receiptFromOTC(s, { id: s.paymentId || '', ref: '', patientId: s.id, patientName: s.customerName, patientSex: '', amount: s.total, method: s.paymentMethod || '', service: 'Over-the-counter drug sale', staff: s.paidBy || '—', staffRole: s.paidByRole || '', at: s.paidAt || s.createdAt, status: 'Paid' })
                    setReceipt(rc)
                  }}>Receipt</button>}
                </td>
              </tr>
            ))}
            {shownOtc.length === 0 && (
              <tr><td colSpan={8} className="muted" style={{ textAlign: 'center', padding: '22px 14px' }}>
                {otcQ.trim() ? <>No sale matches <b>{otcQ}</b>.</> : 'No over-the-counter sales yet.'}
              </td></tr>
            )}
          </tbody></table></div>
        </Card>
      )}
      {fund && (
        <Modal title={`Fund Wallet — ${fund.firstName} ${fund.surname} (${fund.id})`} onClose={() => setFund(null)}
          footer={<><button className="btn ghost" onClick={() => setFund(null)}>Cancel</button><button className="btn green" disabled={busy} onClick={doFund}>{busy ? 'Saving…' : 'Fund Wallet'}</button></>}>
          {err && (
            <AlertCard tone="red" title={isTopUpError(err) ? 'Top up the patient’s wallet' : 'Funding failed'}>
              {err}
            </AlertCard>
          )}
          <div className="form-grid">
            <Field label="Amount (₦)"><input className="input" type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></Field>
            <Field label="Payment Method"><select className="input" value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })}><option>Transfer</option><option>Cash</option><option>POS</option></select></Field>
            <Field label="Reference No." full><input className="input" placeholder="TRX-12345" value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} /></Field>
          </div>
          <div className="kv"><div className="k">Current balance</div><div className="v money">{naira(fund.wallet)}</div></div>
        </Modal>
      )}

      {paySale && (
        <Modal title={`Mark Paid — ${paySale.id}`} onClose={() => setPaySale(null)}
          footer={<><button className="btn ghost" onClick={() => setPaySale(null)}>Cancel</button><button className="btn green" disabled={payBusy} onClick={payOTC}>{payBusy ? 'Marking Paid…' : 'Mark Paid'}</button></>}>
          {otcErr && <AlertCard tone="red">{otcErr}</AlertCard>}
          {otcOk && <AlertCard tone="green">{otcOk}</AlertCard>}
          <div className="kv">
            <div className="k">Reference</div><div className="v">{paySale.id}</div>
            <div className="k">Customer</div><div className="v">{paySale.customerName}</div>
            <div className="k">Phone</div><div className="v">{paySale.customerPhone || '—'}</div>
            <div className="k">Total</div><div className="v money">{naira(paySale.total)}</div>
            <div className="k">Items</div><div className="v">{paySale.items.map((i) => `${i.drug} ×${i.qty}`).join(', ')}</div>
          </div>
          <div className="field"><label>Payment Method</label>
            <select className="input" value={payMethod} onChange={(e) => setPayMethod(e.target.value)}>
              <option>Cash</option><option>Transfer</option><option>POS</option>
            </select>
          </div>
          <div className="muted mt">Marking Paid records the customer's payment, deducts stock and releases the receipt — only then can the customer collect the drugs.</div>
        </Modal>
      )}
      {receipt && <ReceiptModal receipt={receipt} onClose={() => setReceipt(null)} />}
    </Layout>
  )
}