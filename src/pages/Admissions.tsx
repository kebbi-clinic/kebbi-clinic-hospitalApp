import { useState } from 'react'
import { Layout } from '../components/Layout'
import { Card, PageHead, Badge, statusTone, Modal, Field } from '../components/ui'
import { useFetch } from '../api'
import { admissionApi, paths } from '../endpoints'
import type { Admission } from '../data'

export default function Admissions() {
  const [dis, setDis] = useState<Admission | null>(null)
  const [form, setForm] = useState({ diagnosis: '', summary: '', notes: '' })
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const { data: list = [], refetch } = useFetch<Admission[]>(paths.admissions)

  const discharge = async () => {
    if (!dis) return
    setBusy(true); setErr('')
    try {
      await admissionApi.discharge(dis.id, form)
      setDis(null); refetch()
    } catch (e) { setErr((e as Error).message) } finally { setBusy(false) }
  }

  return (
    <Layout title="Admissions">
      <PageHead title="Admissions" sub="Patients admitted by doctors — ward, bed and responsible staff are tracked here." />
      <Card title="Admitted Patients">
        <div className="tbl-wrap"><table className="tbl">
          <thead><tr><th>Admission</th><th>Patient</th><th>Ward</th><th>Bed</th><th>Doctor</th><th>Admitted</th><th>Reason</th><th>Status</th><th></th></tr></thead>
          <tbody>{list.map((a) => (
            <tr key={a.id}>
              <td>{a.id}</td><td>{a.patientName}<div className="muted">{a.patientId}</div></td><td>{a.ward}</td><td>{a.bed}</td><td>{a.doctor}</td><td>{a.at}</td><td>{a.reason}</td>
              <td><Badge tone={statusTone(a.status)}>{a.status}</Badge></td>
              <td className="right">{a.status === 'Admitted' && <button className="btn primary sm" onClick={() => { setDis(a); setForm({ diagnosis: a.reason, summary: '', notes: '' }); setErr('') }}>Discharge</button>}</td>
            </tr>
          ))}</tbody>
        </table></div>
      </Card>
      {dis && (
        <Modal title={`Discharge — ${dis.patientName} (${dis.id})`} onClose={() => setDis(null)}
          footer={<><button className="btn ghost" onClick={() => setDis(null)}>Cancel</button><button className="btn green" disabled={busy} onClick={discharge}>{busy ? 'Saving…' : 'Complete Discharge'}</button></>}>
          {err && <div className="demo-note" style={{ background: 'var(--red-100)', color: 'var(--red-600)' }}>{err}</div>}
          <div className="form-grid">
            <Field label="Diagnosis"><input className="input" value={form.diagnosis} onChange={(e) => setForm({ ...form, diagnosis: e.target.value })} /></Field>
            <Field label="Discharge Date/Time"><input className="input" disabled value="Recorded automatically on save" /></Field>
            <Field label="Treatment Summary" full><textarea className="input" rows={3} value={form.summary} onChange={(e) => setForm({ ...form, summary: e.target.value })} /></Field>
            <Field label="Discharge Notes" full><textarea className="input" rows={2} placeholder="Follow-up in 7 days at outpatient clinic…" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
          </div>
          <div className="muted">Visit {dis.visitId} is completed automatically. The Records Officer can then mark the patient INACTIVE — history is preserved.</div>
        </Modal>
      )}
    </Layout>
  )
}

