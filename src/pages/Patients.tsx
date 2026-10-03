import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Layout } from '../components/Layout'
import { Card, PageHead, Badge, statusTone, Modal, Tabs, naira } from '../components/ui'
import { useAuth } from '../auth'
import { api, useFetch } from '../api'
import { paths, patientApi } from '../endpoints'
import { PatientSearch, filterPatients } from '../components/PatientSearch'
import type { Patient, Settings, Visit } from '../data'

/** Roles allowed to see (and activate) inactive patients. Mirrors the server,
 *  which is the real authority — this only shapes the UI. */
const SEES_INACTIVE = ['Records Officer', 'Accountant']

export default function Patients() {
  const [q, setQ] = useState('')
  const [visitFor, setVisitFor] = useState<Patient | null>(null)
  const [activateFor, setActivateFor] = useState<Patient | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [okMsg, setOkMsg] = useState('')
  const [nav] = useSearchParams()
  const [tab, setTab] = useState(nav.get('show') === 'inactive' ? 'Inactive' : 'All')
  const nav2 = useNavigate()
  const { user } = useAuth()
  const { data: list = [], refetch } = useFetch<Patient[]>(paths.patients)
  const { data: settings } = useFetch<Settings>(paths.settings)
  const role = user?.role || ''
  const canStartVisit = role === 'Records Officer' || role === 'Doctor'
  const seesInactive = SEES_INACTIVE.includes(role)
  /* Only the Records Officer may activate; the server enforces it too. */
  const canActivate = role === 'Records Officer'
  const activationFee = Number(settings?.activationFee) || 0

  const shown = list.filter((p) => (tab === 'Inactive' ? p.status === 'Inactive' : true))
  const filtered = filterPatients(shown, q)

  const startVisit = async () => {
    if (!visitFor) return
    setBusy(true); setErr('')
    try {
      await patientApi.startVisit(visitFor.id)
      setVisitFor(null)
      refetch()
      nav2(`/patients/${visitFor.id}`)
    } catch (e) { setErr((e as Error).message) } finally { setBusy(false) }
  }

  const activate = async () => {
    if (!activateFor) return
    setBusy(true); setErr(''); setOkMsg('')
    const who = `${activateFor.firstName} ${activateFor.surname}`
    try {
      const r = await patientApi.activate(activateFor.id)
      setActivateFor(null)
      refetch()
      setTab('All')
      setOkMsg(`${who} activated.`
        + (r.activationFee > 0
          ? ` Activation fee ₦${Number(r.activationFee).toLocaleString()} taken from the wallet — new balance ₦${Number(r.wallet).toLocaleString()}.`
          : ' (no activation fee configured)'))
    } catch (e) { setErr((e as Error).message) } finally { setBusy(false) }
  }

  return (
    <Layout title="Patients">
      <PageHead title="Patients" sub="One permanent record per patient — search before registering. Returning patients start a NEW VISIT, not a new patient.">
        {role === 'Records Officer' && <Link to="/register" className="btn primary">+ Register New Patient</Link>}
      </PageHead>
      {okMsg && <div className="demo-note mb" style={{ background: 'var(--green-100)', color: 'var(--green-600)' }}>{okMsg}</div>}
      <Card title="Search patients" className="mb">
        <PatientSearch
          patients={shown}
          value={q}
          onChange={setQ}
          hint={<>Patient IDs look like <b>KBC-000245</b> — press <b>Enter</b> to open a record</>}
          onPick={(p) => nav2(`/patients/${p.id}`)}
        />
        {seesInactive && (
          <div style={{ marginTop: 12 }}>
            <Tabs tabs={['All', 'Inactive']} active={tab} onChange={setTab} />
            <div className="muted" style={{ marginTop: 8 }}>
              Inactive patients are visible to the Records Officer and the Accountant only — clinical staff work from the active list.
            </div>
          </div>
        )}
      </Card>
      <Card>
        <div className="tbl-wrap"><table className="tbl">
          <thead><tr><th>Patient ID</th><th>Name</th><th>Gender</th><th>Phone</th><th>Wallet</th><th>Status</th><th></th></tr></thead>
          <tbody>{filtered.map((p) => (
            <tr key={p.id}>
              <td><b>{p.id}</b></td>
              <td><Link to={`/patients/${p.id}`}>{p.firstName} {p.surname}</Link></td>
              <td>{p.gender}</td>
              <td>{p.phone}</td>
              <td className="money">{naira(p.wallet)}</td>
              <td><Badge tone={statusTone(p.status)}>{p.status}</Badge></td>
              <td className="right">
                <Link to={`/patients/${p.id}`} className="btn ghost sm">View</Link>{' '}
                {canActivate && p.status === 'Inactive' && (
                  <button className="btn green sm" onClick={() => { setActivateFor(p); setErr(''); setOkMsg('') }}>Activate</button>
                )}{' '}
                {canStartVisit && p.status === 'Active' && <button className="btn primary sm" onClick={() => setVisitFor(p)}>Start New Visit</button>}
              </td>
            </tr>
          ))}{filtered.length === 0 && (
            <tr><td colSpan={7} className="muted" style={{ textAlign: 'center', padding: '22px 14px' }}>
              {q.trim() ? <>No patient matches <b>{q}</b> in {tab === 'Inactive' ? 'the inactive list' : 'the list'}.</> : 'No patients here yet.'}
            </td></tr>
          )}</tbody>
        </table></div>
      </Card>
      {activateFor && (
        <Modal title={`Activate ${activateFor.firstName} ${activateFor.surname}`} onClose={() => setActivateFor(null)}
          footer={<><button className="btn ghost" onClick={() => setActivateFor(null)}>Cancel</button>
            <button className="btn green" disabled={busy} onClick={activate}>{busy ? 'Activating…' : 'Activate Patient'}</button></>}>
          {err && <div className="demo-note" style={{ background: 'var(--red-100)', color: 'var(--red-600)' }}>{err}</div>}
          <p>Only the Records Officer can activate a patient. Once activated they appear in the nurses' <b>new patients</b> queue for vitals.</p>
          <div className="kv">
            <div className="k">Patient</div><div className="v">{activateFor.id}</div>
            <div className="k">Current status</div><div className="v"><Badge tone="gray">Inactive</Badge></div>
            <div className="k">Wallet balance</div><div className="v money">{naira(activateFor.wallet)}</div>
            <div className="k">Activation fee</div><div className="v money">{naira(activationFee)}</div>
            <div className="k">Balance after activation</div>
            <div className="v money">{naira(Math.max(0, Number(activateFor.wallet) - activationFee))}</div>
          </div>
          {activationFee > Number(activateFor.wallet) && (
            <div className="demo-note" style={{ background: 'var(--red-100)', color: 'var(--red-600)' }}>
              The wallet does not cover the activation fee. The accountant must fund it before activation can go ahead.
            </div>
          )}
        </Modal>
      )}
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
