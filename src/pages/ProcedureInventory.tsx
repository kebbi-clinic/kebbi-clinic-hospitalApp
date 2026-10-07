import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Layout } from '../components/Layout'
import { Card, PageHead, StatCard, Badge, naira } from '../components/ui'
import { useFetch, useRealtime } from '../api'
import { paths } from '../endpoints'
import type { Inventory } from '../endpoints'

/**
 * Procedure / service inventory — procedure, amount, quantity.
 *
 * Read-only for every role that can open it: the Accountant uses it to see what
 * has been billed, Doctors and Nurses use it to see what they can record. The
 * catalogue itself is maintained in the admin console, so this screen never
 * edits a price — it only reports.
 */
export default function ProcedureInventory() {
  const { data, loading, error, refetch } = useFetch<Inventory>(paths.servicesInventory)
  const [q, setQ] = useState('')
  useRealtime(() => refetch(), ['data.changed'])

  const rows = (data?.items || []).filter((r) => {
    const needle = q.trim().toLowerCase()
    if (!needle) return true
    return [r.procedure, r.category, r.department].some((f) => String(f || '').toLowerCase().includes(needle))
  })
  const t = data?.totals

  return (
    <Layout title="Inventory">
      <PageHead title="Procedures Inventory" sub="Every procedure the hospital offers, its amount and how many times it has been performed.">
        <Link to="/services" className="btn primary">Record a Procedure</Link>
      </PageHead>

      {loading && <div className="muted">Loading inventory…</div>}
      {error && <div className="demo-note mb" style={{ background: 'var(--red-100)', color: 'var(--red-600)' }}>{error}</div>}

      <div className="grid cols-4 mb">
        <StatCard icon="clipboard" value={t?.procedures ?? 0} label="Procedures" />
        <StatCard icon="report" value={t?.quantity ?? 0} label="Quantity Performed" tone="blue" />
        <StatCard icon="money" value={naira(t?.total)} label="Value (Amount × Quantity)" tone="green" />
        <StatCard icon="wallet" value={naira(t?.billed)} label="Actually Billed" tone="amber" />
      </div>

      <Card title="Procedure / Amount / Quantity">
        <div className="field" style={{ maxWidth: 340 }}>
          <label>Search</label>
          <input className="input" placeholder="Search procedure, category or department…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="tbl-wrap"><table className="tbl">
          <thead><tr>
            <th>Procedure</th><th>Category</th><th>Department</th>
            <th>Amount</th><th>Quantity</th><th>Total</th><th>Status</th>
          </tr></thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={7} className="muted" style={{ textAlign: 'center', padding: '22px 14px' }}>
                {q.trim() ? <>No procedure matches <b>{q}</b>.</> : 'No procedures configured yet — an administrator adds them in the admin console.'}
              </td></tr>
            )}
            {rows.map((r) => (
              <tr key={r.id}>
                <td><b>{r.procedure}</b><div className="muted">{r.id}</div></td>
                <td>{r.category}</td>
                <td>{r.department}</td>
                <td className="money">{naira(r.amount)}</td>
                <td className="money">{r.quantity}</td>
                <td className="money">{naira(r.total)}</td>
                <td><Badge tone={r.active ? 'green' : 'gray'}>{r.active ? 'Active' : 'Retired'}</Badge></td>
              </tr>
            ))}
          </tbody>
        </table></div>
        <div className="muted" style={{ padding: '12px 14px' }}>
          <b>Quantity</b> counts how often each procedure appears on a patient's permanent record.
          <b> Total</b> is amount × quantity; <b>actually billed</b> is what was charged at the time, which
          can differ after an administrator changes a price.
        </div>
      </Card>
    </Layout>
  )
}