import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Layout } from '../components/Layout'
import { Card, PageHead, Field, StatCard, naira } from '../components/ui'
import { useFetch } from '../api'
import { paths, serviceApi } from '../endpoints'
import type { Patient, Service } from '../data'

/**
 * Procedures / Services.
 *
 * The catalogue is created and priced by an administrator. Nurses and doctors
 * open this page from their dashboard to record a procedure that was actually
 * performed — which bills the patient's wallet straight away and writes the
 * entry onto the patient's permanent record.
 */
export default function Services() {
  const [params] = useSearchParams()
  const { data: patients = [] } = useFetch<Patient[]>(paths.patients)
  const { data: services = [] } = useFetch<Service[]>(paths.services)

  const [patientId, setPatientId] = useState(params.get('patient') || '')
  const [serviceId, setServiceId] = useState('')
  const [notes, setNotes] = useState('')
  const [err, setErr] = useState('')
  const [ok, setOk] = useState('')
  const [busy, setBusy] = useState(false)

  const patient = patients.find((p) => p.id === patientId)
  const chosen = services.find((s) => s.id === serviceId)
  const affordable = !patient || !chosen || Number(patient.wallet) >= Number(chosen.amount)
  const catalogueValue = services.reduce((t, s) => t + Number(s.amount), 0)

  const record = async () => {
    if (!patientId || !serviceId) { setErr('Choose a patient and the procedure/service performed.'); return }
    setBusy(true); setErr(''); setOk('')
    try {
      const r = await serviceApi.perform({ patientId, serviceId, notes, settle: 'Wallet' })
      setOk(`Recorded. ₦${Number(chosen?.amount).toLocaleString()} taken from the wallet — new balance ₦${Number(r.walletBalance).toLocaleString()}.`)
      setServiceId(''); setNotes('')
    } catch (e) { setErr((e as Error).message) } finally { setBusy(false) }
  }

  return (
    <Layout title="Procedures & Services">
      <PageHead title="Procedures & Services" sub="Record a procedure or service performed on a patient. The price comes from the catalogue the administrator set, and is billed to the patient's wallet." />
      {err && <div className="demo-note mb" style={{ background: 'var(--red-100)', color: 'var(--red-600)' }}>{err}</div>}
      {ok && <div className="demo-note mb" style={{ background: 'var(--green-100)', color: 'var(--green-600)' }}>{ok}</div>}

      <div className="grid cols-3 mb">
        <StatCard icon="clipboard" value={services.length} label="Active Procedures / Services" />
        <StatCard icon="money" value={naira(catalogueValue)} label="Combined Catalogue Value" />
        <StatCard icon="wallet" value={patient ? naira(patient.wallet) : '—'} label={patient ? `${patient.firstName}'s Wallet` : 'Select a patient'} tone="green" />
      </div>

      <Card title="Record a procedure or service" className="mb">
        <div className="form-grid">
          <Field label="Patient" full>
            <select className="input" value={patientId} onChange={(e) => { setPatientId(e.target.value); setErr('') }}>
              <option value="">Select patient…</option>
              {patients.map((p) => <option key={p.id} value={p.id}>{p.firstName} {p.surname} — {p.id} (wallet {naira(p.wallet)})</option>)}
            </select>
          </Field>
          <Field label="Procedure / Service" full>
            <select className="input" value={serviceId} onChange={(e) => { setServiceId(e.target.value); setErr('') }}>
              <option value="">Select procedure or service…</option>
              {services.map((s) => <option key={s.id} value={s.id}>{s.name} — {naira(s.amount)}{s.department ? ` (${s.department})` : ''}</option>)}
            </select>
          </Field>
          <Field label="Notes" full>
            <textarea className="input" rows={2} placeholder="Findings, site, dressing used…" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Field>
        </div>
        {chosen && (
          <div className="demo-note">
            <b>{chosen.name}</b> costs <b>{naira(chosen.amount)}</b> and will be taken from the patient's wallet.
            {!affordable && <span style={{ color: 'var(--red-600)' }}>
              {' '}The wallet only holds {naira(Number(patient?.wallet))} — the accountant must fund it first.
            </span>}
          </div>
        )}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 12 }}>
          <button className="btn green" disabled={busy || !patientId || !serviceId} onClick={record}>
            {busy ? 'Recording…' : 'Record & Bill to Wallet'}
          </button>
        </div>
      </Card>


      <Card title="Catalogue">
        <div className="tbl-wrap"><table className="tbl">
          <thead><tr><th>ID</th><th>Procedure / Service</th><th>Category</th><th>Department</th><th>Amount</th><th></th></tr></thead>
          <tbody>
            {services.length === 0 && (
              <tr><td colSpan={6} className="muted">No procedures or services configured yet — an administrator adds them in the admin console.</td></tr>
            )}
            {services.map((s) => (
              <tr key={s.id}>
                <td>{s.id}</td>
                <td><b>{s.name}</b>{s.notes ? <div className="muted">{s.notes}</div> : null}</td>
                <td>{s.category}</td>
                <td>{s.department}</td>
                <td className="money">{naira(s.amount)}</td>
                <td className="right">
                  <button className="btn primary sm" disabled={!patientId} onClick={() => { setServiceId(s.id); setErr('') }}>Select</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table></div>
        <div className="muted" style={{ padding: '12px 14px' }}>
          Pick a patient above first — every entry is written to that patient's permanent record, activity timeline and billing history.
        </div>
      </Card>
    </Layout>
  )
}
