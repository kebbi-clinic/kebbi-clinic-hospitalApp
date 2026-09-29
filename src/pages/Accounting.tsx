import { useState } from 'react'
import { Layout } from '../components/Layout'
import { Card, PageHead, Tabs, Badge, StatCard, Modal, Field, naira } from '../components/ui'
import { useFetch } from '../api'
import { paths, walletApi } from '../endpoints'
import type { Patient, Payment, WalletTx } from '../data'

export default function Accounting() {
  const [tab, setTab] = useState('Payments')
  const [fund, setFund] = useState<Patient | null>(null)
  const [form, setForm] = useState({ amount: '20000', method: 'Transfer', reference: '' })
  const [err, setErr] = useState('')
  const [ok, setOk] = useState('')
  const [busy, setBusy] = useState(false)
  const { data: payments = [] } = useFetch<Payment[]>(paths.payments)
  const { data: txs = [] } = useFetch<WalletTx[]>(paths.walletTxs)
  const { data: patients = [], refetch } = useFetch<Patient[]>(paths.patients)

  const paid = payments.filter((p) => p.status === 'Paid')
  const funding = paid.filter((p) => p.service === 'Wallet funding').reduce((s, p) => s + p.amount, 0)

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
          <div className="tbl-wrap"><table className="tbl">
            <thead><tr><th>Reference</th><th>Patient</th><th>Service</th><th>Method</th><th>Amount</th><th>Staff</th><th>Date/Time</th><th>Status</th></tr></thead>
            <tbody>{payments.map((p) => (
              <tr key={p.id}><td>{p.ref}</td><td>{p.patientName}<div className="muted">{p.patientId}</div></td><td>{p.service}</td><td>{p.method}</td>
                <td className="money">{naira(p.amount)}</td><td>{p.staff}</td><td>{p.at}</td><td><Badge tone={p.status === 'Paid' ? 'green' : 'amber'}>{p.status}</Badge></td></tr>
            ))}</tbody>
          </table></div>
        </Card>
      )}

      {tab === 'Patient Wallets' && (
        <Card title="Patient Wallets">
          <div className="tbl-wrap"><table className="tbl">
            <thead><tr><th>Patient</th><th>Wallet Balance</th><th></th></tr></thead>
            <tbody>{patients.map((p) => (
              <tr key={p.id}><td>{p.firstName} {p.surname}<div className="muted">{p.id}</div></td><td className="money">{naira(p.wallet)}</td>
                <td className="right"><button className="btn primary sm" onClick={() => { setFund(p); setForm({ amount: '20000', method: 'Transfer', reference: '' }); setErr('') }}>Fund</button></td></tr>
            ))}</tbody>
          </table></div>
        </Card>
      )}

      {tab === 'Transactions' && (
        <Card title="Wallet Transactions">
          <div className="tbl-wrap"><table className="tbl">
            <thead><tr><th>TX</th><th>Patient</th><th>Date/Time</th><th>Type</th><th>Amount</th><th>Reason</th><th>Staff</th><th>Method</th><th>Balance After</th></tr></thead>
            <tbody>{txs.map((t) => (
              <tr key={t.id}><td>{t.id}</td><td>{t.patientId}</td><td>{t.at}</td>
                <td><Badge tone={t.type === 'Credit' ? 'green' : 'blue'}>{t.type}</Badge></td>
                <td className="money">{t.type === 'Credit' ? '+' : '−'}{naira(t.amount)}</td>
                <td>{t.reason}</td><td>{t.staff}</td><td>{t.method}</td><td className="money">{naira(t.balanceAfter)}</td></tr>
            ))}</tbody>
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

