import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Layout } from '../components/Layout'
import { Card, PageHead, Tabs, Badge, statusTone, Field, naira } from '../components/ui'
import { useFetch } from '../api'
import { paths, activityApi, admissionApi, patientApi, vitalsApi, serviceApi } from '../endpoints'
import type { Admission, Patient, Service, Visit, Vital } from '../data'

/** Visit states a nurse can act on — see the note in the component below. */
const OPEN_VISIT_STATUSES = ['Open', 'Waiting', 'Active']

export default function Nursing() {
  const [tab, setTab] = useState('Vitals')
  /* The nurses' dashboard links here with ?patient=KBC-… so a new patient can
     have their vitals recorded straight away. */
  const [q] = useSearchParams()
  const { data: patients = [] } = useFetch<Patient[]>(paths.patients)
  const { data: admissions = [], refetch: refetchAdm } = useFetch<Admission[]>(paths.admissions)
  const active = admissions.filter((a) => a.status === 'Admitted')
  const [pid, setPid] = useState(q.get('patient') || '')
  const [vid, setVid] = useState('')
  const [err, setErr] = useState('')
  const [ok, setOk] = useState('')
  const [busy, setBusy] = useState(false)
  const { data: bundle, refetch: refetchBundle } = useFetch<Record<string, any>>(pid ? paths.patient(pid) : '', [pid])
  /* Server-side visit states: "Open" straight after the Records Officer starts a
     visit, "Waiting" once vitals are in. The old `Active | Waiting` filter hid a
     brand-new visit, so no visit could be picked and vitals never saved — which
     in turn meant the patient never reached the doctor's queue. */
  const visits = (bundle?.visits || []).filter((v: any) => OPEN_VISIT_STATUSES.includes(v.status)) as any[]

  const call = async (fn: () => Promise<unknown>, okMsg: string) => {
    setBusy(true); setErr(''); setOk('')
    try { await fn(); setOk(okMsg); refetchBundle() } catch (e) { setErr((e as Error).message) } finally { setBusy(false) }
  }

  const [vit, setVit] = useState({ temp: '', bp: '', pulse: '', resp: '', spo2: '', weight: '' })
  const [wr, setWr] = useState({ obs: '', action: '' })
  const [proc, setProc] = useState({ serviceId: '', notes: '' })
  const [dis, setDis] = useState({ diagnosis: '', summary: '', notes: '' })

  /* The priced catalogue. Procedures are picked from it rather than typed in,
     so the amount is always the administrator's price and always lands on the
     patient's wallet instead of vanishing into a free-text activity line. */
  const { data: services = [], refetch: refetchServices } = useFetch<Service[]>(paths.services)
  const chosenService = services.find((s) => s.id === proc.serviceId)
  const patient = patients.find((p) => p.id === pid)
  const walletShort = !!patient && !!chosenService && Number(patient.wallet) < Number(chosenService.amount)

  /* Default to the first open visit so vitals/procedures are one click away. */
  useEffect(() => {
    if (!vid && visits.length) setVid(visits[0].id)
  }, [pid, visits.length]) // eslint-disable-line react-hooks/exhaustive-deps

  const saveVitals = () => call(() => vitalsApi.create({ patientId: pid, visitId: vid, ...vit }), 'Vitals saved to the patient history.')
  const saveWardRound = () => call(() => activityApi.create({ patientId: pid, what: `Ward round — ${wr.obs} (Action: ${wr.action})`, dept: 'Nursing' }), 'Ward round recorded.')

  /* Submit a procedure: bills the wallet straight away (settle: 'Wallet') and
     writes the entry onto the patient's permanent record. The success message
     uses the balance the API returns, never one computed here. */
  const submitProcedure = async () => {
    if (!pid || !proc.serviceId) { setErr('Choose the patient and the procedure performed.'); return }
    if (!chosenService) { setErr('That procedure is no longer in the catalogue.'); return }
    setBusy(true); setErr(''); setOk('')
    try {
      const r = await serviceApi.perform({ patientId: pid, serviceId: proc.serviceId, notes: proc.notes, settle: 'Wallet' })
      setOk(`${chosenService.name} submitted — ${naira(chosenService.amount)} taken from the wallet. New balance ${naira(r.walletBalance)}.`)
      setProc({ serviceId: '', notes: '' })
      refetchBundle(); refetchServices()
    } catch (e) { setErr((e as Error).message) } finally { setBusy(false) }
  }

  const giveMed = (a: Admission, m: string) => call(() => activityApi.create({ patientId: a.patientId, what: `Medication administered — ${m}`, dept: 'Nursing', green: true }), 'Medication administration recorded.')
  const doDischarge = (a: Admission) => call(() => admissionApi.discharge(a.id, dis), 'Patient discharged.').then(refetchAdm)

  return (
    <Layout title="Ward & Nursing">
      <PageHead title="Ward & Nursing Care" sub="Vitals, ward rounds, medication administration, procedures and discharge — every entry joins the patient history." />
      {err && <div className="demo-note mb" style={{ background: 'var(--red-100)', color: 'var(--red-600)' }}>{err}</div>}
      {ok && <div className="demo-note mb" style={{ background: 'var(--green-100)', color: 'var(--green-600)' }}>{ok}</div>}
      <Card title="Select patient" className="mb">
        <div className="search-row">
          <select className="input" style={{ maxWidth: 340 }} value={pid} onChange={(e) => { setPid(e.target.value); setVid('') }}>
            <option value="">Select patient…</option>
            {patients.map((p) => <option key={p.id} value={p.id}>{p.firstName} {p.surname} — {p.id} ({p.status})</option>)}
          </select>
          {pid && (
            <select className="input" style={{ maxWidth: 300 }} value={vid} onChange={(e) => setVid(e.target.value)}>
              <option value="">{visits.length ? 'Select visit…' : 'No open visit'}</option>
              {visits.map((v) => <option key={v.id} value={v.id}>{v.id} — {v.createdAt} ({v.status})</option>)}
            </select>
          )}
        </div>
      </Card>
      <Tabs tabs={['Vitals', 'Ward Round', 'Medications', 'Procedures', 'Discharge']} active={tab} onChange={setTab} />
      {tab === 'Vitals' && (
        <Card title={`Record Vitals${pid ? ` — ${pid}` : ''}${vid ? ` · ${vid}` : ''}`}>
          <div className="form-grid">
            <Field label="Temperature (°C)"><input className="input" value={vit.temp} onChange={(e) => setVit({ ...vit, temp: e.target.value })} placeholder="38.1" /></Field>
            <Field label="Blood Pressure (mmHg)"><input className="input" value={vit.bp} onChange={(e) => setVit({ ...vit, bp: e.target.value })} placeholder="130/85" /></Field>
            <Field label="Pulse (bpm)"><input className="input" value={vit.pulse} onChange={(e) => setVit({ ...vit, pulse: e.target.value })} placeholder="92" /></Field>
            <Field label="Respiratory Rate"><input className="input" value={vit.resp} onChange={(e) => setVit({ ...vit, resp: e.target.value })} placeholder="20" /></Field>
            <Field label="Oxygen Saturation (%)"><input className="input" value={vit.spo2} onChange={(e) => setVit({ ...vit, spo2: e.target.value })} placeholder="97" /></Field>
            <Field label="Weight (kg)"><input className="input" value={vit.weight} onChange={(e) => setVit({ ...vit, weight: e.target.value })} placeholder="72" /></Field>
          </div>
          <button className="btn green" disabled={busy || !pid || !vid} onClick={saveVitals}>Save Vitals</button>
          <span className="muted" style={{ marginLeft: 12 }}>Saves with patient, visit, nurse name and timestamp automatically.</span>
        </Card>
      )}

      {tab === 'Ward Round' && (
        <Card title="Ward Round Entry">
          <Field label="Observations"><textarea className="input" rows={3} placeholder="Patient alert, tolerating oral fluids…" value={wr.obs} onChange={(e) => setWr({ ...wr, obs: e.target.value })} /></Field>
          <Field label="Action Required"><input className="input" placeholder="Continue IV fluids, review in 8 hours" value={wr.action} onChange={(e) => setWr({ ...wr, action: e.target.value })} /></Field>
          <button className="btn green" disabled={busy || !pid} onClick={saveWardRound}>Save Ward Round</button>
        </Card>
      )}

      {tab === 'Medications' && (
        <Card title="Medication Administration">
          <div className="tbl-wrap"><table className="tbl">
            <thead><tr><th>Patient</th><th>Ward / Bed</th><th>Reason</th><th>Actions</th></tr></thead>
            <tbody>
              {active.length === 0 && <tr><td colSpan={4} className="muted">No admitted patients.</td></tr>}
              {active.map((a) => (
                <tr key={a.id}>
                  <td>{a.patientName}<div className="muted">{a.patientId}</div></td>
                  <td>{a.ward} · {a.bed}</td>
                  <td>{a.reason}</td>
                  <td className="right" style={{ whiteSpace: 'nowrap' }}>
                    {['Morning dose', 'Afternoon dose', 'Evening dose'].map((m) => (
                      <button key={m} className="btn green sm" disabled={busy} onClick={() => giveMed(a, m)} style={{ marginLeft: 6 }}>{m}</button>
                    ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table></div>
          <div className="muted" style={{ padding: '10px 14px' }}>Distinct from pharmacy dispensing — this records that the drug was actually administered to the patient.</div>
        </Card>
      )}

      {tab === 'Procedures' && (
        <Card title="Submit Procedure"
          actions={<span className="muted">Amounts come from the administrator's catalogue and are debited from the patient's wallet on submit</span>}>
          {!pid && <div className="demo-note mb">Choose a patient above first — a procedure can only be billed to a patient on the books.</div>}
          <div className="form-grid">
            <Field label="Procedure / Service" full>
              <select className="input" value={proc.serviceId} onChange={(e) => { setProc({ ...proc, serviceId: e.target.value }); setErr('') }}>
                <option value="">Select procedure or service…</option>
                {services.map((s) => <option key={s.id} value={s.id}>{s.name} — {naira(s.amount)}{s.department ? ` (${s.department})` : ''}</option>)}
              </select>
            </Field>
            <Field label="Description / Notes" full>
              <textarea className="input" rows={3} placeholder="Site, dressing used, findings…" value={proc.notes} onChange={(e) => setProc({ ...proc, notes: e.target.value })} />
            </Field>
          </div>
          {chosenService && (
            <div className="demo-note">
              <b>{chosenService.name}</b> costs <b>{naira(chosenService.amount)}</b>{patient ? <> — {patient.firstName}'s wallet holds <b>{naira(patient.wallet)}</b></> : null}.
              {walletShort && <span style={{ color: 'var(--red-600)' }}> The balance is short, so the accountant must fund the wallet before this can be submitted.</span>}
            </div>
          )}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 12 }}>
            <button className="btn green" disabled={busy || !pid || !proc.serviceId || walletShort} onClick={submitProcedure}>
              {busy ? 'Submitting…' : 'Submit Procedure'}
            </button>
          </div>
          {services.length === 0 && <div className="muted mt">No procedures configured yet — an administrator adds them (with their prices) in the admin console.</div>}
        </Card>
      )}

      {tab === 'Discharge' && (
        <Card title="Discharge Patient">
          {active.length === 0 ? <div className="muted">No admitted patients to discharge.</div> : (
            <div className="form-grid">
              <Field label="Admitted patient" full><select className="input" onChange={(e) => setDis({ ...dis, diagnosis: active.find((a) => a.id === e.target.value)?.reason || dis.diagnosis })}>
                {active.map((a) => <option key={a.id} value={a.id}>{a.patientName} — {a.ward} · {a.bed} ({a.id})</option>)}
              </select></Field>
              <Field label="Diagnosis" full><input className="input" value={dis.diagnosis} onChange={(e) => setDis({ ...dis, diagnosis: e.target.value })} /></Field>
              <Field label="Treatment Summary" full><textarea className="input" rows={3} value={dis.summary} onChange={(e) => setDis({ ...dis, summary: e.target.value })} /></Field>
              <Field label="Discharge Notes" full><textarea className="input" rows={2} placeholder="Follow-up in 7 days at outpatient clinic…" value={dis.notes} onChange={(e) => setDis({ ...dis, notes: e.target.value })} /></Field>
              <div className="full"><button className="btn primary" disabled={busy || !dis.diagnosis} onClick={() => doDischarge(active[0])}>Complete Discharge (first listed patient)</button></div>
            </div>
          )}
          <div className="muted mt">Records Officer then marks the patient INACTIVE — history is preserved.</div>
        </Card>
      )}

    </Layout>
  )
}

