import { useState } from 'react'
import { Layout } from '../components/Layout'
import { Card, PageHead, StatCard, Badge, Modal, Field, naira } from '../components/ui'
import { useFetch } from '../api'
import { drugApi, paths } from '../endpoints'
import type { Drug, Settings } from '../data'

const stockStatus = (d: Drug) => d.stock === 0 ? 'Out of Stock' : d.stock <= d.minStock ? 'Low Stock' : 'In Stock'

export default function Inventory() {
  const { data: drugs = [], refetch } = useFetch<Drug[]>(paths.drugs)
  const { data: settings } = useFetch<Settings>(paths.settings)
  const [add, setAdd] = useState(false)
  const [edit, setEdit] = useState<Drug | null>(null)
  const [form, setForm] = useState<Record<string, string>>({})
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  const low = drugs.filter((d) => stockStatus(d) === 'Low Stock').length
  const out = drugs.filter((d) => stockStatus(d) === 'Out of Stock').length
  const value = drugs.reduce((s, d) => s + d.stock * d.price, 0)
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm({ ...form, [k]: e.target.value })

  const saveAdd = async () => {
    setBusy(true); setErr('')
    try { await drugApi.create(form); setAdd(false); setForm({}); refetch() }
    catch (e) { setErr((e as Error).message) } finally { setBusy(false) }
  }
  const saveEdit = async () => {
    if (!edit) return
    setBusy(true); setErr('')
    try { await drugApi.update(edit.id, form); setEdit(null); setForm({}); refetch() }
    catch (e) { setErr((e as Error).message) } finally { setBusy(false) }
  }

  const openEdit = (d: Drug) => { setEdit(d); setForm({ name: d.name, category: d.category, unit: d.unit, stock: String(d.stock), minStock: String(d.minStock), price: String(d.price), expiry: d.expiry }); setErr('') }

  return (
    <Layout title="Pharmacy Inventory">
      <PageHead title="Pharmacy Inventory" sub="Drug prices set here drive all future prescriptions. Existing transactions keep their historical price.">
        <button className="btn primary" onClick={() => { setAdd(true); setForm({}); setErr('') }}>+ Add Drug</button>
      </PageHead>
      {err && <div className="demo-note mb" style={{ background: 'var(--red-100)', color: 'var(--red-600)' }}>{err}</div>}
      <div className="grid cols-4 mb">
        <StatCard icon="pill" value={drugs.length} label="Total Drugs" />
        <StatCard icon="clipboard" value={drugs.reduce((s, d) => s + d.stock, 0)} label="Total Stock" tone="blue" />
        <StatCard icon="report" value={low + out} label="Low / Out of Stock" tone="amber" />
        <StatCard icon="money" value={naira(value)} label="Total Stock Value" tone="green" />
      </div>
      <Card title="Drug Summary">
        <div className="tbl-wrap"><table className="tbl">
          <thead><tr><th>Drug</th><th>Category</th><th>Unit</th><th>Stock</th><th>Min Level</th><th>Price</th><th>Expiry</th><th>Status</th><th></th></tr></thead>
          <tbody>{drugs.map((d) => (
            <tr key={d.id}>
              <td><b>{d.name}</b><div className="muted">{d.id}</div></td><td>{d.category}</td><td>{d.unit}</td><td>{d.stock}</td><td>{d.minStock}</td>
              <td className="money">{naira(d.price)}</td><td>{d.expiry}</td>
              <td><Badge tone={stockStatus(d) === 'Out of Stock' ? 'red' : stockStatus(d) === 'Low Stock' ? 'amber' : 'green'}>{stockStatus(d)}</Badge></td>
              <td className="right"><button className="btn ghost sm" onClick={() => openEdit(d)}>Edit</button></td>
            </tr>
          ))}</tbody>
        </table></div>
      </Card>
      {(add || edit) && (
        <Modal title={add ? 'Add Drug' : `Edit — ${edit!.name}`} onClose={() => { setAdd(false); setEdit(null) }}
          footer={<><button className="btn ghost" onClick={() => { setAdd(false); setEdit(null) }}>Cancel</button><button className="btn green" disabled={busy} onClick={add ? saveAdd : saveEdit}>{busy ? 'Saving…' : 'Save Drug'}</button></>}>
          <div className="form-grid">
            <Field label="Drug Name"><input className="input" value={form.name || ''} onChange={set('name')} placeholder="e.g. Malaria Test Kit" /></Field>
            <Field label="Category"><select className="input" value={form.category || ''} onChange={set('category')}>{(settings?.drugCategories || []).map((c) => <option key={c}>{c}</option>)}</select></Field>
            <Field label="Unit"><select className="input" value={form.unit || ''} onChange={set('unit')}><option>Tablet</option><option>Capsule</option><option>Pack</option><option>Sachet</option><option>Vial</option></select></Field>
            <Field label="Quantity"><input className="input" type="number" value={form.stock || ''} onChange={set('stock')} /></Field>
            <Field label="Price (₦)"><input className="input" type="number" value={form.price || ''} onChange={set('price')} /></Field>
            <Field label="Expiry Date"><input className="input" placeholder="MM/YYYY" value={form.expiry || ''} onChange={set('expiry')} /></Field>
            <Field label="Minimum Stock Level"><input className="input" type="number" value={form.minStock || ''} onChange={set('minStock')} /></Field>
          </div>
        </Modal>
      )}
    </Layout>
  )
}

