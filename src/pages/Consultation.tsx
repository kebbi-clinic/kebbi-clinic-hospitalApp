import { useState, useEffect } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Layout } from '../components/Layout'
import { Card, PageHead, Field, Badge, naira } from '../components/ui'
import { api, useFetch } from '../api'
import { paths, patientApi, visitApi } from '../endpoints'
import { RX_ROUTES, RX_FREQUENCIES, type Drug, type Patient, type Settings, type Visit } from '../data'

/* One prescription line being drafted: drug, route, frequency, duration, qty. */
interface Row { drugId: string; qty: number; route: string; frequency: string; duration: number }

const newRow = (): Row => ({ drugId: '', qty: 10, route: 'Oral', frequency: 'Daily', duration: 5 })

const plural = (n: number) => (n === 1 ? '' : 's')

export default function Consultation() {
  const nav = useNavigate()
  const [params] = useSearchParams()
  const { data: patients = [] } = useFetch<Patient[]>(paths.patients)
  const { data: drugs = [] } = useFetch<Drug[]>(paths.drugs)
  const { data: settings } = useFetch<Settings>(paths.settings)

  const [patientId, setPatientId] = useState(params.get('patient') || '')
  const [visitId, setVisitId] = useState(params.get('visit') || '')
  const { data: bundle } = useFetch<Record<string, any>>(patientId ? paths.patient(patientId) : '', [patientId])
  const patient = bundle?.patient || (bundle?.id ? bundle : undefined)
  const openVisits: Visit[] = (bundle?.visits || []).filter((v: Visit) => v.status === 'Active' || v.status === 'Waiting')
  const lastVitals = (bundle?.vitals || []).slice(-1)[0]
  const prevVisits: Visit[] = (bundle?.visits || []).filter((v: Visit) => v.consultation).slice(1, 4)

  const [form, setForm] = useState({ complaint: '', history: '', exam: '', diagnosis: '' })
  const [tests, setTests] = useState<string[]>([])
  const [radTests, setRadTests] = useState<string[]>([])
  const [rows, setRows] = useState<Row[]>([])
  const [outcome, setOutcome] = useState<'Outpatient' | 'Admission'>('Outpatient')
  const [ward, setWard] = useState('Male Ward')
  const [bed, setBed] = useState('M-012')
  /* Bed booking: how many nights, and what each night costs. */
  const [days, setDays] = useState('1')
  const [costPerNight, setCostPerNight] = useState(String(settings?.defaultNightlyRate ?? 0))
  const [err, setErr] = useState('')
  const [ok, setOk] = useState('')
  const [busy, setBusy] = useState(false)

  /* Pre-fill the nightly rate from settings as soon as they arrive. */
  useEffect(() => {
    if (settings?.defaultNightlyRate !== undefined) setCostPerNight(String(settings.defaultNightlyRate))
  }, [settings?.defaultNightlyRate]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!visitId && openVisits.length) setVisitId(openVisits[0].id)
  }, [patientId]) // eslint-disable-line react-hooks/exhaustive-deps

  const price = (id: string) => drugs.find((d) => d.id === id)?.price || 0
  const total = rows.reduce((s, r) => s + price(r.drugId) * (Number(r.qty) || 0), 0)
  const nights = Math.max(1, Number(days) || 1)
  const bedTotal = nights * (Number(costPerNight) || 0)
  const routes = settings?.rxRoutes?.length ? settings.rxRoutes : RX_ROUTES
  const frequencies = settings?.rxFrequencies?.length ? settings.rxFrequencies : RX_FREQUENCIES

  const toggle = (arr: string[], setArr: (v: string[]) => void, t: string) =>
    setArr(arr.includes(t) ? arr.filter((x) => x !== t) : [...arr, t])

  const save = async () => {
    if (!patientId || !visitId) { setErr('Select a patient and an active visit first.'); return }
    setBusy(true); setErr(''); setOk('')
    try {
      const r = await visitApi.consultation(visitId, {
        ...form,
        investigations: [...tests, ...radTests],
        invDept: Object.fromEntries(radTests.map((t) => [t, 'Radiology'])),
        /* Each line: drug + route + frequency + duration (days) + quantity. */
        items: rows
          .filter((r) => r.drugId && Number(r.qty) > 0)
          .map((r) => ({
            drugId: r.drugId, qty: Number(r.qty) || 0,
            route: r.route, frequency: r.frequency,
            duration: Math.max(1, Number(r.duration) || 1),
          })),
        outcome,
        ward, bed,
        /* Only send the bed charge when actually admitting. */
        ...(outcome === 'Admission' ? { days: nights, costPerNight: Number(costPerNight) || 0 } : {}),
      })
      const adm = (r as { admission?: { id: string; totalCost: number; ward: string; bed: string } }).admission
      setOk(adm
        ? `Consultation saved. Patient admitted to ${adm.ward} bed ${adm.bed} (${adm.id}) — bed charge ${naira(adm.totalCost)} taken from the wallet.`
        : 'Consultation saved — lab/radiology requests and prescription delivered to the right queues.')
    } catch (e) { setErr((e as Error).message) } finally { setBusy(false) }
  }

  return (
    <Layout title="Consultation">
      <PageHead title="New Consultation" sub="Prices come from pharmacy inventory — doctors cannot edit prices. Requests go straight to lab/radiology queues.">
        <select className="input" style={{ maxWidth: 340 }} value={patientId} onChange={(e) => { setPatientId(e.target.value); setVisitId('') }}>
          <option value="">Select patient…</option>
          {patients.map((p) => <option key={p.id} value={p.id}>{p.firstName} {p.surname} — {p.id} ({p.status})</option>)}
        </select>
      </PageHead>
      {!patientId && <Card><div className="muted" style={{ padding: 16 }}>Select a patient above, or open one from the dashboard's "Consult" button.</div></Card>}
      {patient && (
        <>
          {openVisits.length === 0 && <div className="demo-note mb">No active visit for this patient. Ask the Records Officer to start a new visit first.</div>}
          {openVisits.length > 0 && (
            <div className="field" style={{ maxWidth: 340 }}>
              <label>Active visit</label>
              <select className="input" value={visitId} onChange={(e) => setVisitId(e.target.value)}>
                {openVisits.map((v) => <option key={v.id} value={v.id}>{v.id} — {v.createdAt}</option>)}
              </select>
            </div>
          )}
          {lastVitals && <div className="demo-note mb">Last vitals ({lastVitals.at}, {lastVitals.staff}): T {lastVitals.temp} · BP {lastVitals.bp} · P {lastVitals.pulse} · SpO₂ {lastVitals.spo2} · Wt {lastVitals.weight}</div>}
          {err && <div className="demo-note mb" style={{ background: 'var(--red-100)', color: 'var(--red-600)' }}>{err}</div>}
          {ok && <div className="demo-note mb" style={{ background: 'var(--green-100)', color: 'var(--green-600)' }}>{ok} <Link to="/dashboard">Back to dashboard</Link></div>}
          <div className="grid cols-2">
            <Card title="Clinical Notes">
              <Field label="Presenting Complaint"><textarea className="input" rows={2} value={form.complaint} onChange={(e) => setForm({ ...form, complaint: e.target.value })} /></Field>
              <Field label="History of Presenting Complaint"><textarea className="input" rows={3} value={form.history} onChange={(e) => setForm({ ...form, history: e.target.value })} /></Field>
              <Field label="Examination Findings"><textarea className="input" rows={3} value={form.exam} onChange={(e) => setForm({ ...form, exam: e.target.value })} /></Field>
              <Field label="Diagnosis"><input className="input" value={form.diagnosis} onChange={(e) => setForm({ ...form, diagnosis: e.target.value })} /></Field>
            </Card>
            <Card title="Investigations Requested">
              <div className="muted mb" style={{ fontWeight: 700 }}>Laboratory</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {(settings?.investigationTypes || []).map((t) => (
                  <button key={t} type="button" className={`btn sm ${tests.includes(t) ? 'green' : 'ghost'}`} onClick={() => toggle(tests, setTests, t)}>{t}</button>
                ))}
              </div>
              <div className="muted mt mb" style={{ fontWeight: 700 }}>Radiology (type + Enter to add)</div>
              <input className="input" placeholder="e.g. Chest X-ray" onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); const v = (e.target as HTMLInputElement).value.trim(); if (v) { toggle(radTests, setRadTests, v); (e.target as HTMLInputElement).value = '' } } }} />
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }} className="mt">
                {radTests.map((t) => <Badge key={t} tone="blue">{t} <button className="x" onClick={() => toggle(radTests, setRadTests, t)}>×</button></Badge>)}
              </div>
              <div className="muted mt">The laboratory / radiology dashboards receive these requests instantly.</div>
            </Card>
          </div>
          <Card title="Prescription" className="mt" actions={<span className="muted">Drug · Route · Frequency · Duration · Qty — prices from pharmacy inventory</span>}>
            <div className="tbl-wrap"><table className="tbl">
              <thead><tr><th>Drug</th><th>Route</th><th>Frequency</th><th>Duration (days)</th><th>Qty</th><th>Unit Price</th><th>Total</th><th></th></tr></thead>
              <tbody>
                {rows.map((r, idx) => (
                  <tr key={idx}>
                    <td><select className="input" style={{ width: 220 }} value={r.drugId} onChange={(e) => setRows(rows.map((x, i) => i === idx ? { ...x, drugId: e.target.value } : x))}>
                      <option value="">Select drug…</option>{drugs.map((d) => <option key={d.id} value={d.id} disabled={d.stock === 0}>{d.name} (stock {d.stock})</option>)}
                    </select></td>
                    <td><select className="input" style={{ width: 96 }} value={r.route} onChange={(e) => setRows(rows.map((x, i) => i === idx ? { ...x, route: e.target.value } : x))}>
                      {routes.map((o) => <option key={o}>{o}</option>)}
                    </select></td>
                    <td><select className="input" style={{ width: 110 }} value={r.frequency} onChange={(e) => setRows(rows.map((x, i) => i === idx ? { ...x, frequency: e.target.value } : x))}>
                      {frequencies.map((o) => <option key={o}>{o}</option>)}
                    </select></td>
                    <td><input className="input" style={{ width: 78 }} type="number" min={1} max={365} value={r.duration}
                      onChange={(e) => setRows(rows.map((x, i) => i === idx ? { ...x, duration: Number(e.target.value) } : x))} /></td>
                    <td><input className="input" style={{ width: 78 }} type="number" min={1} value={r.qty} onChange={(e) => setRows(rows.map((x, i) => i === idx ? { ...x, qty: Number(e.target.value) } : x))} /></td>
                    <td className="money">{naira(price(r.drugId))}</td>
                    <td className="money">{naira(price(r.drugId) * (Number(r.qty) || 0))}</td>
                    <td><button className="btn danger sm" type="button" onClick={() => setRows(rows.filter((_, i) => i !== idx))}>Remove</button></td>
                  </tr>
                ))}
                <tr><td colSpan={6} className="right"><b>Prescription total</b></td><td className="money">{naira(total)}</td><td /></tr>
              </tbody>
            </table></div>
            <button className="btn ghost sm mt" type="button" onClick={() => setRows([...rows, newRow()])}>+ Add Drug</button>
          </Card>
          <Card className="mt">
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', alignItems: 'center', flexWrap: 'wrap' }}>
              <Badge tone="gray">Outcome:</Badge>
              <button className={`btn ${outcome === 'Outpatient' ? 'green' : 'ghost'}`} onClick={() => setOutcome('Outpatient')}>Outpatient</button>
              <button className={`btn ${outcome === 'Admission' ? 'primary' : 'ghost'}`} onClick={() => setOutcome('Admission')}>Admit Patient</button>
              {outcome === 'Admission' && (<>
                <select className="input" style={{ width: 150 }} value={ward} onChange={(e) => setWard(e.target.value)}><option>Male Ward</option><option>Female Ward</option><option>Paediatric Ward</option><option>Private Ward</option></select>
                <input className="input" style={{ width: 90 }} value={bed} onChange={(e) => setBed(e.target.value)} placeholder="Bed" />
                <label className="muted">Nights</label>
                <input className="input" style={{ width: 80 }} type="number" min={1} max={365} value={days} onChange={(e) => setDays(e.target.value)} />
                <label className="muted">Cost / night (₦)</label>
                <input className="input" style={{ width: 110 }} type="number" min={0} value={costPerNight} onChange={(e) => setCostPerNight(e.target.value)} />
                <Badge tone={bedTotal > 0 ? 'blue' : 'gray'}>Bed total: <span className="money">{naira(bedTotal)}</span></Badge>
              </>)}
              <button className="btn primary" disabled={busy || !visitId} onClick={save}>{busy ? 'Saving…' : 'Save Consultation'}</button>
            </div>
            {outcome === 'Admission' && (
              <div className="muted mt">
                {nights} night{plural(nights)} × {naira(Number(costPerNight) || 0)} = <b>{naira(bedTotal)}</b>, taken from the patient's wallet on admission
                (a pending payment is raised if the balance is short).
              </div>
            )}
          </Card>

        </>
      )}
    </Layout>
  )
}

