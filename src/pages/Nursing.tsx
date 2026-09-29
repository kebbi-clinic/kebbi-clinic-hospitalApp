import { useState } from 'react'
import { Layout } from '../components/Layout'
import { Card, PageHead, Tabs, Badge, statusTone, Field } from '../components/ui'
import { useFetch } from '../api'
import { paths, activityApi, admissionApi, patientApi, vitalsApi } from '../endpoints'
import type { Admission, Patient, Vital } from '../data'

export default function Nursing() {
  const [tab, setTab] = useState('Vitals')
  const { data: patients = [] } = useFetch<Patient[]>(paths.patients)
  const { data: admissions = [], refetch: refetchAdm } = useFetch<Admission[]>(paths.admissions)
  const active = admissions.filter((a) => a.status === 'Admitted')
  const [pid, setPid] = useState('')
  const [vid, setVid] = useState('')
  const [err, setErr] = useState('')
  const [ok, setOk] = useState('')
  const [busy, setBusy] = useState(false)
  const { data: bundle, refetch: refetchBundle } = useFetch<Record<string, any>>(pid ? paths.patient(pid) : '', [pid])
  const visits = (bundle?.visits || []).filter((v: any) => v.status === 'Active' || v.status === 'Waiting') as any[]

  const call = async (fn: () => Promise<unknown>, okMsg: string) => {
    setBusy(true); setErr(''); setOk('')
    try { await fn(); setOk(okMsg); refetchBundle() } catch (e) { setErr((e as Error).message) } finally { setBusy(false) }
  }

  const [vit, setVit] = useState({ temp: '', bp: '', pulse: '', resp: '', spo2: '', weight: '' })
  const [wr, setWr] = useState({ obs: '', action: '' })
  const [proc, setProc] = useState({ name: '', notes: '' })
  const [dis, setDis] = useState({ diagnosis: '', summary: '', notes: '' })

  const saveVitals = () => call(() => vitalsApi.create({ patientId: pid, visitId: vid, ...vit }), 'Vitals saved to the patient history.')
  const saveWardRound = () => call(() => activityApi.create({ patientId: pid, what: `Ward round — ${wr.obs} (Action: ${wr.action})`, dept: 'Nursing' }), 'Ward round recorded.')
  const saveProcedure = () => call(() => activityApi.create({ patientId: pid, what: `Procedure performed — ${proc.name} (${proc.notes})`, dept: 'Nursing', green: true }), 'Procedure recorded.')
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
              <option value="">Select active visit…</option>
              {visits.map((v) => <option key={v.id} value={v.id}>{v.id} — {v.createdAt}</option>)}
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
        <Card title="Record Procedure">
          <Field label="Procedure"><input className="input" placeholder="e.g. Wound dressing" value={proc.name} onChange={(e) => setProc({ ...proc, name: e.target.value })} /></Field>
          <Field label="Description / Notes"><textarea className="input" rows={3} value={proc.notes} onChange={(e) => setProc({ ...proc, notes: e.target.value })} /></Field>
          <button className="btn green" disabled={busy || !pid} onClick={saveProcedure}>Save Procedure</button>
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

