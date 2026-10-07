import { useMemo, useState } from 'react'
import { Layout } from '../components/Layout'
import { Card, PageHead, Tabs, Badge, StatCard, Modal, Field, naira } from '../components/ui'
import { useFetch } from '../api'
import { paths, walletApi } from '../endpoints'
import { PatientSearch, SearchBox, filterPatients, matchesFields } from '../components/PatientSearch'
import type { Patient, Payment, WalletTx } from '../data'

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

  const { data: paymentsRaw } = useFetch<unknown>(paths.payments)
  const { data: txsRaw } = useFetch<unknown>(paths.walletTxs)
  const { data: patientsRaw, refetch } = useFetch<unknown>(paths.patients)

  const payments = useMemo(() => asArray<Payment>(paymentsRaw), [paymentsRaw])
  const txs = useMemo(() => asArray<WalletTx>(txsRaw), [txsRaw])
  const patients = useMemo(() => asArray<Patient>(patientsRaw), [patientsRaw])

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
      setFund(null); refetch()
    } catch (e) { setErr((e as Error).message) } finally { setBusy(false) }
  }

  return (
    <Layout title="Payments & Wallets">
      <PageHead title="Payments & Wallets" sub="Every balance change must create a transaction record — balances are never edited directly.">
        {ok && <Badge tone="green">{ok}</Badge>}
      </PageHead>
      <div className="grid cols-4 mb">
        <StatCard icon="money" value={naira(paid.reduce((s, p) => s + p.amount, 0))} label="Revenue (paid)" tone="green" />
        <StatCard icon="wallet" value={naira(funding)} label="Wallet Funding" tone="blue" />
        <StatCard icon="clock" value={payments.filter((p) => p.status === 'Pending').length} label="Pending Payments" tone="amber" />
        <StatCard icon="check" value={paid.length} label="Completed Payments" />
      </div>
      <Tabs tabs={['Payments', 'Patient Wallets', 'Transactions']} active={tab} onChange={setTab} />

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
            <thead><tr><th>Reference</th><th>Patient</th><th>Service</th><th>Method</th><th>Amount</th><th>Staff</th><th>Date/Time</th><th>Status</th></tr></thead>
            <tbody>{shownPayments.map((p) => (
              <tr key={p.id}><td>{p.ref}</td><td>{p.patientName}<div className="muted">{p.patientId}</div></td><td>{p.service}</td><td>{p.method}</td>
                <td className="money">{naira(p.amount)}</td><td>{p.staff}</td><td>{p.at}</td><td><Badge tone={p.status === 'Paid' ? 'green' : 'amber'}>{p.status}</Badge></td></tr>
            ))}
            {shownPayments.length === 0 && (
              <tr><td colSpan={8} className="muted" style={{ textAlign: 'center', padding: '22px 14px' }}>
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
            <thead><tr><th>TX</th><th>Patient</th><th>Date/Time</th><th>Type</th><th>Amount</th><th>Reason</th><th>Staff</th><th>Method</th><th>Balance After</th></tr></thead>
            <tbody>{shownTxs.map((t) => (
              <tr key={t.id}><td>{t.id}</td>
                <td>{nameOf(t.patientId) || '—'}<div className="muted">{t.patientId}</div></td><td>{t.at}</td>
                <td><Badge tone={t.type === 'Credit' ? 'green' : 'blue'}>{t.type}</Badge></td>
                <td className="money">{t.type === 'Credit' ? '+' : '−'}{naira(t.amount)}</td>
                <td>{t.reason}</td><td>{t.staff}</td><td>{t.method}</td><td className="money">{naira(t.balanceAfter)}</td></tr>
            ))}
            {shownTxs.length === 0 && (
              <tr><td colSpan={9} className="muted" style={{ textAlign: 'center', padding: '22px 14px' }}>
                {txQ.trim() ? <>No transaction matches <b>{txQ}</b>.</> : 'No wallet transactions yet.'}
              </td></tr>
            )}
            </tbody>
          </table></div>
        </Card>
      )}

      {fund && (
        <Modal title={`Fund Wallet — ${fund.firstName} ${fund.surname} (${fund.id})`} onClose={() => setFund(null)}
          footer={<><button className="btn ghost" onClick={() => setFund(null)}>Cancel</button><button className="btn green" disabled={busy} onClick={doFund}>{busy ? 'Saving…' : 'Fund Wallet'}</button></>}>
          {err && <div className="demo-note" style={{ background: 'var(--red-100)', color: 'var(--red-600)' }}>{err}</div>}
          <div className="form-grid">
            <Field label="Amount (₦)"><input className="input" type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></Field>
            <Field label="Payment Method"><select className="input" value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })}><option>Transfer</option><option>Cash</option><option>POS</option></select></Field>
            <Field label="Reference No." full><input className="input" placeholder="TRX-12345" value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} /></Field>
          </div>
          <div className="kv"><div className="k">Current balance</div><div className="v money">{naira(fund.wallet)}</div></div>
        </Modal>
      )}
    </Layout>
  )
}