import { useState } from 'react'
import { Layout } from '../components/Layout'
import { Card, PageHead, StatCard, Badge, Modal, Field, naira } from '../components/ui'
import { useAuth } from '../auth'
import { useFetch } from '../api'
import { testApi, paths } from '../endpoints'
import type { TestItem } from '../data'

const stockStatus = (t: TestItem) => t.stock === 0 ? 'In Stock' : t.stock <= t.minStock ? 'Low Stock' : 'In Stock'

/**
 * Laboratory & radiology inventory — tests and their prices, just like the
 * pharmacy drug list. Prices set here are what the laboratory/radiology is
 * paid from the patient's wallet when a result is uploaded. The role decides
 * the department: lab scientists manage Lab, radiologists manage Radiology.
 */
export default function TestInventory() {
  const { user } = useAuth()
  const role = user?.role || ''
  const myDept: 'Lab' | 'Radiology' | null = role === 'Laboratory Scientist' ? 'Lab' : role === 'Radiologist' ? 'Radiology' : null
  const { data: all = [], refetch } = useFetch<TestItem[]>(paths.tests())
  const tests = myDept ? all.filter((t) => t.dept === myDept) : all

  const [add, setAdd] = useState(false)
  const [edit, setEdit] = useState<TestItem | null>(null)
  const [form, setForm] = useState<Record<string, string>>({})
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  const lowOut = tests.filter((t) => t.stock > 0 && t.stock <= t.minStock).length
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm({ ...form, [k]: e.target.value })

  const saveAdd = async () => {
    setBusy(true); setErr('')
    try {
      await testApi.create({ ...form, dept: form.dept || myDept || 'Lab' })
      setAdd(false); setForm({}); refetch()
    } catch (e) { setErr((e as Error).message) } finally { setBusy(false) }
  }
  const saveEdit = async () => {
    if (!edit) return
    setBusy(true); setErr('')
    try { await testApi.update(edit.id, form); setEdit(null); setForm({}); refetch() }
    catch (e) { setErr((e as Error).message) } finally { setBusy(false) }
  }

  const openEdit = (t: TestItem) => {
    setEdit(t)
    setForm({ name: t.name, dept: t.dept, category: t.category, unit: t.unit, price: String(t.price), stock: String(t.stock), minStock: String(t.minStock) })
    setErr('')
  }
  const openAdd = () => {
    setAdd(true)
    setForm({ dept: myDept || 'Lab', category: 'General', unit: 'Test', stock: '0', minStock: '0' })
    setErr('')
  }

  const title = myDept === 'Radiology' ? 'Radiology Inventory' : myDept === 'Lab' ? 'Laboratory Inventory' : 'Laboratory & Radiology Inventory'

  return (
    <Layout title={title}>
      <PageHead title={title} sub="Test prices set here are billed from the patient's wallet when the result is uploaded. Existing results keep their historical price.">
        <button className="btn primary" onClick={openAdd}>+ Add Test</button>
      </PageHead>
      {err && <div className="demo-note mb" style={{ background: 'var(--red-100)', color: 'var(--red-600)' }}>{err}</div>}
      <div className="grid cols-4 mb">
        <StatCard icon="lab" value={tests.length} label="Total Tests" />
        <StatCard icon="clipboard" value={tests.filter((t) => t.dept === 'Lab').length} label="Laboratory Tests" tone="blue" />
        <StatCard icon="report" value={tests.filter((t) => t.dept === 'Radiology').length} label="Radiology Tests" tone="amber" />
        <StatCard icon="money" value={naira(tests.reduce((s, t) => s + (Number(t.price) || 0), 0))} label="Combined Test Value" tone="green" />
      </div>
      <Card title="Test Summary">
        <div className="tbl-wrap"><table className="tbl">
          <thead><tr><th>Test</th><th>Department</th><th>Category</th><th>Price</th><th>Stock</th><th>Min Level</th><th>Status</th><th></th></tr></thead>
          <tbody>{tests.map((t) => (
            <tr key={t.id}>
              <td><b>{t.name}</b><div className="muted">{t.id}</div></td>
              <td>{t.dept === 'Radiology' ? 'Radiology' : 'Laboratory'}</td>
              <td>{t.category}</td>
              <td className="money">{naira(t.price)}</td>
              <td>{t.stock || '—'}</td>
              <td>{t.minStock || '—'}</td>
              <td><Badge tone={t.stock > 0 && t.stock <= t.minStock ? 'amber' : 'green'}>{stockStatus(t)}</Badge></td>
              <td className="right"><button className="btn ghost sm" onClick={() => openEdit(t)}>Edit</button></td>
            </tr>
          ))}
          {tests.length === 0 && <tr><td colSpan={8} className="muted" style={{ textAlign: 'center', padding: '18px' }}>No tests in the catalogue yet — add one to start billing.</td></tr>}
          </tbody>
        </table></div>
        <div className="muted" style={{ padding: '12px 14px' }}>
          {lowOut > 0 ? `${lowOut} test(s) are low on consumable stock. ` : ''}
          The price is charged to the patient's wallet when a result for this test is uploaded.
        </div>
      </Card>
      {(add || edit) && (
        <Modal title={add ? 'Add Test' : `Edit — ${edit!.name}`} onClose={() => { setAdd(false); setEdit(null) }}
          footer={<><button className="btn ghost" onClick={() => { setAdd(false); setEdit(null) }}>Cancel</button><button className="btn green" disabled={busy} onClick={add ? saveAdd : saveEdit}>{busy ? 'Saving…' : 'Save Test'}</button></>}>
          <div className="form-grid">
            <Field label="Test Name"><input className="input" value={form.name || ''} onChange={set('name')} placeholder="e.g. PCV" /></Field>
            <Field label="Department">
              <select className="input" value={form.dept || 'Lab'} onChange={set('dept')} disabled={!!myDept}>
                <option value="Lab">Laboratory</option><option value="Radiology">Radiology</option>
              </select>
            </Field>
            <Field label="Category"><input className="input" value={form.category || ''} onChange={set('category')} placeholder="e.g. Haematology" /></Field>
            <Field label="Unit"><input className="input" value={form.unit || ''} onChange={set('unit')} placeholder="Test" /></Field>
            <Field label="Price (₦)"><input className="input" type="number" min={0} value={form.price || ''} onChange={set('price')} placeholder="e.g. 2000" /></Field>
            <Field label="Consumable Stock"><input className="input" type="number" min={0} value={form.stock || ''} onChange={set('stock')} /></Field>
            <Field label="Minimum Stock Level"><input className="input" type="number" min={0} value={form.minStock || ''} onChange={set('minStock')} /></Field>
          </div>
        </Modal>
      )}
    </Layout>
  )
}
