import { useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Layout } from '../components/Layout'
import { Card, PageHead, Field, StatCard, naira } from '../components/ui'
import { useFetch } from '../api'
import { paths, serviceApi } from '../endpoints'
import { PatientPicker } from '../components/PatientSearch'
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
  const { data: servicesRaw } = useFetch<unknown>(paths.services)
  const services: Service[] = Array.isArray(servicesRaw)
    ? (servicesRaw as Service[])
    : Array.isArray((servicesRaw as any)?.data) ? ((servicesRaw as any).data as Service[])
    : Array.isArray((servicesRaw as any)?.list) ? ((servicesRaw as any).list as Service[])
    : []

  const [patientId, setPatientId] = useState(params.get('patient') || '')
  const [picked, setPicked] = useState<Patient | null>(null)
  const [serviceId, setServiceId] = useState('')
  const [qty, setQty] = useState('1')
  const [notes, setNotes] = useState('')
  const [err, setErr] = useState('')
  const [ok, setOk] = useState('')
  const [busy, setBusy] = useState(false)

  const recordRef = useRef<HTMLDivElement | null>(null)

  /* Wallet details come from the picker (or one lookup for dashboard links),
     never from a downloaded register. */
  const [linkedWallet, setLinkedWallet] = useState<number | null>(null)
  const linkedId = params.get('patient') || ''
  const [linkQ] = useState(linkedId)
  const { data: linkedBundle } = useFetch<{ wallet?: number; firstName?: string }>(
    linkQ ? paths.patient(linkQ) : '', [linkQ],
  )
  const patient = picked && picked.id === patientId ? picked : null
  const patientWallet: number | null | undefined = patient
    ? Number(patient.wallet)
    : (patientId === linkedId ? (linkedBundle && typeof linkedBundle.wallet === 'number' ? linkedBundle.wallet : linkedWallet) : undefined)
  const patientName = patient ? patient.firstName : (linkedBundle?.firstName || '')
  const chosen = services.find((s) => s.id === serviceId)
  const quantity = Math.max(1, Number(qty) || 1)
  const unit = chosen ? Number(chosen.amount) : 0
  const total = unit * quantity
  const affordable = patientWallet == null || !chosen || patientWallet >= total
  const catalogueValue = services.reduce((t, s) => t + Number(s.amount), 0)

  /* Selecting from the catalogue table: set the dropdown, drop any old error,
     then scroll to the record card so the change is visible. */
  const selectFromCatalogue = (id: string) => {
    setServiceId(id)
    setErr('')
    setOk('')
    requestAnimationFrame(() => {
      recordRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }

  const record = async () => {
    if (!patientId || !serviceId) { setErr('Choose a patient and the procedure/service performed.'); return }
    if (!Number.isFinite(quantity) || quantity < 1) { setErr('Quantity must be at least 1.'); return }
    setBusy(true); setErr(''); setOk('')
    try {
      const r = await serviceApi.perform({ patientId, serviceId, qty: quantity, notes, settle: 'Wallet' })
      setOk(`Recorded ${quantity} × ${chosen?.name} — ₦${total.toLocaleString()} taken from the wallet. New balance ₦${Number(r.walletBalance).toLocaleString()}.`)
      setServiceId(''); setQty('1'); setNotes('')
      setLinkedWallet(Number(r.walletBalance))
      if (picked && picked.id === patientId) setPicked({ ...picked, wallet: Number(r.walletBalance) })
    } catch (e) { setErr((e as Error).message) } finally { setBusy(false) }
  }

  return (
    <Layout title="Procedures & Services">
      <PageHead title="Procedures & Services" sub="Record a procedure or service performed on a patient. The unit price comes from the catalogue; the total is unit price × quantity and is billed to the patient's wallet." />
      {err && <div className="demo-note mb" style={{ background: 'var(--red-100)', color: 'var(--red-600)' }}>{err}</div>}
      {ok && <div className="demo-note mb" style={{ background: 'var(--green-100)', color: 'var(--green-600)' }}>{ok}</div>}

      <div className="grid cols-3 mb">
        <StatCard icon="clipboard" value={services.length} label="Active Procedures / Services" />
        <StatCard icon="money" value={naira(catalogueValue)} label="Combined Catalogue Value" />
        <StatCard icon="wallet" value={patientWallet == null ? '—' : naira(patientWallet)} label={patientName ? `${patientName}'s Wallet` : 'Select a patient'} tone="green" />
      </div>

      <div ref={recordRef}>
        <Card title="Record a procedure or service" className="mb">
          <div className="form-grid">
            <Field label="Patient" full>
              <PatientPicker
                value={patientId}
                initialId={params.get('patient') || undefined}
                label="Patient"
                onPick={(p) => { setPatientId(p?.id || ''); setPicked(p); setLinkedWallet(null) }}
              />
            </Field>

            <Field label="Procedure / Service" full>
              <select className="input" value={serviceId} onChange={(e) => { setServiceId(e.target.value); setErr('') }}>
                <option value="">Select procedure or service…</option>
                {services.map((s) => <option key={s.id} value={s.id}>{s.name} — {naira(s.amount)}</option>)}
              </select>
            </Field>

            <Field label="Quantity">
              <input
                className="input"
                type="number"
                min={1}
                step={1}
                value={qty}
                onChange={(e) => { setQty(e.target.value); setErr('') }}
              />
            </Field>

            <Field label="Total (₦)">
              <input
                className="input"
                value={naira(total)}
                readOnly
                tabIndex={-1}
                style={{ background: '#f1f5f9', fontWeight: 600 }}
              />
            </Field>

            <Field label="Notes" full>
              <textarea className="input" rows={2} placeholder="Findings, site, dressing used…" value={notes} onChange={(e) => setNotes(e.target.value)} />
            </Field>
          </div>

          {chosen && (
            <div className="demo-note">
              <b>{quantity} × {chosen.name}</b> at <b>{naira(unit)}</b> each = <b>{naira(total)}</b>, taken from the patient's wallet.
              {patientWallet == null && <span style={{ color: 'var(--muted)' }}> The wallet balance is only shown once the patient is picked.</span>}
              {patientWallet != null && !affordable && <span style={{ color: 'var(--red-600)' }}>{' '}The wallet only holds {naira(patientWallet)} — the accountant must fund it first.</span>}
            </div>
          )}

          {chosen && (
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 12 }}>
              <button className="btn green" disabled={busy || !patientId || !serviceId || !affordable} onClick={record}>
                {busy ? 'Recording…' : 'Record & Bill to Wallet'}
              </button>
            </div>
          )}
        </Card>
      </div>

      <Card title="Catalogue">
        <div className="tbl-wrap"><table className="tbl">
          <thead><tr><th>ID</th><th>Procedure / Service</th><th>Amount</th><th>Quantity</th><th>Total</th><th></th></tr></thead>
          <tbody>
            {services.length === 0 && (
              <tr><td colSpan={6} className="muted">No procedures or services configured yet — an administrator adds them in the admin console.</td></tr>
            )}
            {services.map((s) => {
              const sQty = Math.max(1, Number((s as any).quantity) || 1)
              const sTotal = Number(s.amount) * sQty
              return (
                <tr key={s.id}>
                  <td>{s.id}</td>
                  <td><b>{s.name}</b>{s.notes ? <div className="muted">{s.notes}</div> : null}</td>
                  <td className="money">{naira(s.amount)}</td>
                  <td>{sQty}</td>
                  <td className="money">{naira(sTotal)}</td>
                  <td className="right">
                    <button
                      className="btn primary sm"
                      disabled={!patientId}
                      title={!patientId ? 'Pick a patient first' : 'Use this procedure'}
                      onClick={() => selectFromCatalogue(s.id)}
                    >
                      Select
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table></div>
        <div className="muted" style={{ padding: '12px 14px' }}>
          Pick a patient above first — every entry is written to that patient's permanent record, activity timeline and billing history.
        </div>
      </Card>
    </Layout>
  )
}