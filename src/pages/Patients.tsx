import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Layout } from '../components/Layout'
import { Card, PageHead, Badge, statusTone, Modal, naira } from '../components/ui'
import { useAuth } from '../auth'
import { api, useFetch } from '../api'
import { paths, patientApi } from '../endpoints'
import type { Patient, Visit } from '../data'

export default function Patients() {
  const [q, setQ] = useState('')
  const [visitFor, setVisitFor] = useState<Patient | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const nav = useNavigate()
  const { user } = useAuth()
  const { data: list = [], refetch } = useFetch<Patient[]>(paths.patients)
  const canStartVisit = user.role === 'Records Officer' || user.role === 'Doctor'

  const startVisit = async () => {
    if (!visitFor) return
    setBusy(true); setErr('')
    try {
      const v = await patientApi.startVisit(visitFor.id)
      setVisitFor(null)
      refetch()
      nav(`/patients/${visitFor.id}`)
    } catch (e) { setErr((e as Error).message) } finally { setBusy(false) }
  }

  return (
    <Layout title="Patients">
      <PageHead title="Patients" sub="One permanent record per patient — search before registering. Returning patients start a NEW VISIT, not a new patient.">
        {user.role === 'Records Officer' && <Link to="/register" className="btn primary">+ Register New Patient</Link>}
      </PageHead>
      <Card title="Search patients" className="mb">
        <div className="search-row">
          <input className="input" placeholder="Search by Patient ID, Name or Phone…" value={q} onChange={(e) => setQ(e.target.value)} />
          <span className="muted">Patient IDs look like <b>KBC-000245</b></span>
        </div>
      </Card>
      <Card>
        <div className="tbl-wrap"><table className="tbl">
          <thead><tr><th>Patient ID</th><th>Name</th><th>Gender</th><th>Phone</th><th>Wallet</th><th>Status</th><th></th></tr></thead>
          <tbody>{list.filter((p) => [p.id, p.firstName, p.surname, p.phone].join(' ').toLowerCase().includes(q.toLowerCase())).map((p) => (
            <tr key={p.id}>
              <td><b>{p.id}</b></td>
              <td><Link to={`/patients/${p.id}`}>{p.firstName} {p.surname}</Link></td>
              <td>{p.gender}</td>
              <td>{p.phone}</td>
              <td className="money">{naira(p.wallet)}</td>
              <td><Badge tone={statusTone(p.status)}>{p.status}</Badge></td>
              <td className="right">
                <Link to={`/patients/${p.id}`} className="btn ghost sm">View</Link>{' '}
                {canStartVisit && <button className="btn primary sm" onClick={() => setVisitFor(p)}>Start New Visit</button>}
              </td>
            </tr>
          ))}</tbody>
        </table></div>
      </Card>
      {visitFor && (
        <Modal title="Start New Visit" onClose={() => setVisitFor(null)}
          footer={<><button className="btn ghost" onClick={() => setVisitFor(null)}>Cancel</button>
            <button className="btn green" disabled={busy} onClick={startVisit}>{busy ? 'Creating…' : 'Create Visit'}</button></>}>
          {err && <div className="demo-note" style={{ background: 'var(--red-100)', color: 'var(--red-600)' }}>{err}</div>}
          <p>The existing patient <b>{visitFor.firstName} {visitFor.surname} ({visitFor.id})</b> will get a new visit record. The patient record is <b>not</b> duplicated.</p>
          <div className="kv">
            <div className="k">Patient</div><div className="v">{visitFor.id}</div>
            <div className="k">Patient becomes</div><div className="v"><Badge tone="green">Active</Badge></div>
          </div>
        </Modal>
      )}
    </Layout>
  )
}
