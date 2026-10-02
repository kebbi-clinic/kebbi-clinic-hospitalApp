import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Layout } from '../components/Layout'
import { Card, Badge, statusTone, Tabs, Timeline, naira } from '../components/ui'
import { useAuth } from '../auth'
import { useFetch, fileUrl } from '../api'
import { paths, patientApi } from '../endpoints'
import type { Patient } from '../data'

const TABS = ['Overview', 'Visits', 'Medical History', 'Investigations', 'Prescriptions', 'Procedures', 'Pharmacy', 'Payments', 'Wallet', 'Activity']
type Any = Record<string, any>

export default function PatientProfile() {
  const { id } = useParams()
  const { user } = useAuth()
  const { data: b, error, loading, refetch } = useFetch<Any>(paths.patient(id || ''))
  const [tab, setTab] = useState('Overview')
  const [err, setErr] = useState('')
  const [note, setNote] = useState('')

  if (loading || !b) return <Layout title="Patient Profile"><div className="muted">Loading…</div></Layout>
  if (error) return <Layout title="Patient Profile"><div className="demo-note" style={{ background: 'var(--red-100)', color: 'var(--red-600)' }}>{error} — <Link to="/patients">← Back to patients</Link></div></Layout>
  /* Backend getBasic() returns a FLAT object ({...patient, visits, ...});
     older get360() returned { patient, visits, ... }. Accept both. */
  const p: Patient = (b.patient || b) as Patient
  if (!p || !p.id) return <Layout title="Patient Profile"><div className="muted">Patient not found. <Link to="/patients">← Back to patients</Link></div></Layout>
  const visits: Any[] = b.visits || []
  const investigations: Any[] = b.investigations || []
  const prescriptions: Any[] = b.prescriptions || []
  const payments: Any[] = b.payments || []
  const walletTxs: Any[] = b.walletTxs || []
  const activity: Any[] = b.activity || []
  const procedures: Any[] = p.procedures || []
  const age = p.dob ? new Date().getFullYear() - Number(p.dob.slice(0, 4)) : '—'
  const role = user?.role || ''
  const isRecords = role === 'Records Officer' || role.startsWith('Hospital') || role.startsWith('Super')
  /* Activation is a Records-Officer action; the server refuses anyone else. */
  const isRecordsOfficer = role === 'Records Officer'
  const [busy, setBusy] = useState(false)

  const setStatus = async (status: 'Active' | 'Inactive') => {
    try { await patientApi.setStatus(p.id, status); setErr(''); refetch() }
    catch (e) { setErr((e as Error).message) }
  }

  /* Activating charges the configured activation fee to the patient's wallet. */
  const activate = async () => {
    setBusy(true); setErr('')
    try {
      const r = await patientApi.activate(p.id)
      setErr('')
      refetch()
      setNote(r.activationFee > 0
        ? `Patient activated. Activation fee ₦${Number(r.activationFee).toLocaleString()} taken from the wallet — new balance ₦${Number(r.wallet).toLocaleString()}.`
        : 'Patient activated.')
    } catch (e) { setErr((e as Error).message) } finally { setBusy(false) }
  }

  return (
    <Layout title="Patient Profile">
      <Card className="mb">
        <div className="card-b" style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
          <div className="avatar" style={{ width: 54, height: 54, fontSize: 18, background: 'var(--blue-700)' }}>{(p.firstName || '?')[0]}{(p.surname || '?')[0]}</div>
          <div style={{ flex: 1, minWidth: 220 }}>
            <div style={{ fontSize: 17, fontWeight: 800 }}>{p.firstName} {p.otherName || ''} {p.surname} <Badge tone={statusTone(p.status)}>{p.status}</Badge></div>
            <div className="muted">Patient ID: <b>{p.id}</b> · Registered {p.registered}</div>
          </div>
          <div className="kv" style={{ gridTemplateColumns: 'auto auto', gap: '4px 26px' }}>
            <div className="k">Age / Gender</div><div className="v">{age} · {p.gender}</div>
            <div className="k">Phone</div><div className="v">{p.phone}</div>
            <div className="k">Blood Group</div><div className="v">{p.bloodGroup || '—'}</div>
            <div className="k">Wallet Balance</div><div className="v money">{naira(p.wallet || 0)}</div>
          </div>
          {isRecords && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {p.status === 'Active'
                ? <button className="btn ghost sm" onClick={() => setStatus('Inactive')}>Mark Inactive</button>
                : isRecordsOfficer && <button className="btn green sm" disabled={busy} onClick={activate}>{busy ? 'Activating…' : 'Activate Patient'}</button>}
              {err && <span className="muted" style={{ fontSize: 11, maxWidth: 200 }}>{err}</span>}
              <span className="muted" style={{ fontSize: 11, maxWidth: 200 }}>
                {isRecordsOfficer ? 'Only the Records Officer can activate. Status changes never delete history.' : 'Only the Records Officer can activate a patient.'}
              </span>
            </div>
          )}
        </div>
      </Card>
      {note && <div className="demo-note mb" style={{ background: 'var(--green-100)', color: 'var(--green-600)' }}>{note}</div>}
      <Tabs tabs={TABS} active={tab} onChange={setTab} />
      {tab === 'Overview' && (
        <div className="grid cols-2">
          <Card title="Demographics">
            <div className="kv">
              <div className="k">Full Name</div><div className="v">{p.firstName} {p.otherName || ''} {p.surname}</div>
              <div className="k">Date of Birth</div><div className="v">{p.dob}</div>
              <div className="k">Address</div><div className="v">{p.address}</div>
            </div>
          </Card>
          <Card title="Next of Kin">
            <div className="kv">
              <div className="k">Name</div><div className="v">{p.nextOfKin?.name || '—'}</div>
              <div className="k">Relationship</div><div className="v">{p.nextOfKin?.relationship || '—'}</div>
              <div className="k">Phone</div><div className="v">{p.nextOfKin?.phone || '—'}</div>
            </div>
          </Card>
        </div>
      )}

      {tab === 'Visits' && (
        <Card title="Visits">
          <div className="tbl-wrap"><table className="tbl">
            <thead><tr><th>Visit</th><th>Date</th><th>Type</th><th>Diagnosis</th><th>Status</th></tr></thead>
            <tbody>{visits.map((v: Any) => (
              <tr key={v.id}><td>{v.id}</td><td>{v.date}</td><td>{v.type}</td><td>{v.diagnosis || '—'}</td><td><Badge tone={statusTone(v.status || '')}>{v.status}</Badge></td></tr>
            ))}</tbody>
          </table></div>
        </Card>
      )}

      {tab === 'Medical History' && (
        <Card title="Consultation History">
          {visits.filter((v: Any) => v.consultation).length === 0 && <div className="muted" style={{ padding: 14 }}>No consultations recorded yet.</div>}
          {visits.filter((v: Any) => v.consultation).map((v: Any) => (
            <div key={v.id} style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)' }}>
              <b>{v.id}</b> · {v.date} <Badge tone="blue">{v.consultation.doctor}</Badge>
              <div className="kv" style={{ marginTop: 8 }}>
                <div className="k">Complaint</div><div className="v">{v.consultation.complaint}</div>
                <div className="k">Diagnosis</div><div className="v">{v.consultation.diagnosis}</div>
              </div>
            </div>
          ))}
        </Card>
      )}

      {tab === 'Investigations' && (
        <Card title="Investigations">
          <div className="tbl-wrap"><table className="tbl">
            <thead><tr><th>ID</th><th>Dept</th><th>Test</th><th>Requested By</th><th>Status</th><th>Result</th></tr></thead>
            <tbody>{investigations.map((i: Any) => (
              <tr key={i.id}><td>{i.id}</td><td><Badge tone={i.dept === 'Lab' ? 'blue' : 'amber'}>{i.dept}</Badge></td><td>{i.test}</td><td>{i.doctor}</td><td><Badge tone={statusTone(i.status || '')}>{i.status}</Badge></td>
                <td>{i.result ? (<span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>{i.result.image && !i.result.image.toLowerCase().endsWith('.pdf') && <a href={fileUrl(i.result.image)} target="_blank" rel="noreferrer"><img src={fileUrl(i.result.image)} width={34} height={34} style={{ borderRadius: 6, objectFit: 'cover' }} alt="result" title="Click to open full size" /></a>}{i.result.values || ''}{i.result.image && <a href={fileUrl(i.result.image)} target="_blank" rel="noreferrer">View file</a>}</span>) : '—'}</td></tr>
            ))}</tbody>
          </table></div>
        </Card>
      )}

      {tab === 'Prescriptions' && (
        <Card title="Prescriptions">
          <div className="tbl-wrap"><table className="tbl">
            <thead><tr><th>RX</th><th>Date</th><th>Drug</th><th>Route</th><th>Frequency</th><th>Duration</th><th>Qty</th><th>Total</th><th>Status</th></tr></thead>
            <tbody>
              {prescriptions.length === 0 && <tr><td colSpan={9} className="muted">No prescriptions yet.</td></tr>}
              {prescriptions.flatMap((r: Any) => ((r.items || []).length ? r.items : [{}]).map((i: Any, idx: number) => (
                <tr key={`${r.id}-${idx}`}>
                  <td>{idx === 0 ? r.id : ''}</td>
                  <td>{idx === 0 ? r.createdAt : ''}</td>
                  <td>{i.drug || '—'}</td>
                  <td>{i.route || '—'}</td>
                  <td>{i.frequency || '—'}</td>
                  <td>{i.duration ? `${i.duration} day${Number(i.duration) === 1 ? '' : 's'}` : '—'}</td>
                  <td>{i.qty ?? '—'}</td>
                  <td className="money">{i.qty ? naira(i.qty * i.price) : '—'}</td>
                  <td>{idx === 0 ? <Badge tone={statusTone(r.status || '')}>{r.status}</Badge> : null}</td>
                </tr>
              )))}
            </tbody>
          </table></div>
          <div className="muted" style={{ padding: '12px 14px' }}>Each line records the drug, route of administration, frequency, course length in days and quantity.</div>
        </Card>
      )}

      {tab === 'Procedures' && (
        <Card title="Procedures & Services Performed">
          <div className="tbl-wrap"><table className="tbl">
            <thead><tr><th>Ref</th><th>Procedure / Service</th><th>Amount</th><th>Performed By</th><th>Date/Time</th><th>Payment</th></tr></thead>
            <tbody>
              {procedures.length === 0 && <tr><td colSpan={6} className="muted">No procedures or services recorded for this patient yet.</td></tr>}
              {[...procedures].reverse().map((pr: Any) => (
                <tr key={pr.id}>
                  <td>{pr.id}</td>
                  <td><b>{pr.name}</b>{pr.notes ? <div className="muted">{pr.notes}</div> : null}</td>
                  <td className="money">{naira(pr.amount)}</td>
                  <td>{pr.performedBy}<div className="muted">{pr.role}</div></td>
                  <td>{pr.at}</td>
                  <td><Badge tone={pr.paymentStatus === 'Paid' ? 'green' : 'amber'}>{pr.paymentStatus}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table></div>
          <div className="muted" style={{ padding: '12px 14px' }}>Each procedure is billed to the patient's wallet and appears in their billing history.</div>
        </Card>
      )}

      {tab === 'Pharmacy' && (
        <Card title="Dispensing Record">
          <div className="tbl-wrap"><table className="tbl">
            <thead><tr><th>RX</th><th>Drug</th><th>Route</th><th>Frequency</th><th>Duration</th><th>Qty</th><th>Status</th></tr></thead>
            <tbody>
              {prescriptions.flatMap((r: Any) => (r.items || []).map((i: Any, idx: number) => (
                <tr key={r.id + idx}>
                  <td>{r.id}</td><td>{i.drug}</td>
                  <td>{i.route || '—'}</td><td>{i.frequency || '—'}</td>
                  <td>{i.duration ? `${i.duration}d` : '—'}</td>
                  <td>{i.qty}</td>
                  <td><Badge tone={statusTone(r.status || '')}>{r.status}</Badge></td>
                </tr>
              )))}
            </tbody>
          </table></div>
          <div className="muted" style={{ padding: '12px 14px' }}>Nurse administration records appear in the Activity timeline.</div>
        </Card>
      )}

      {tab === 'Payments' && (
        <Card title="Payments">
          <div className="tbl-wrap"><table className="tbl">
            <thead><tr><th>Reference</th><th>Service</th><th>Method</th><th>Amount</th><th>Date/Time</th><th>Status</th></tr></thead>
            <tbody>{payments.map((t: Any) => (
              <tr key={t.id}><td>{t.ref}</td><td>{t.service}</td><td>{t.method}</td><td className="money">{naira(t.amount || 0)}</td><td>{t.at}</td><td><Badge tone={t.status === 'Paid' ? 'green' : 'amber'}>{t.status}</Badge></td></tr>
            ))}</tbody>
          </table></div>
        </Card>
      )}

      {tab === 'Wallet' && (
        <Card title={`Wallet — balance ${naira(p.wallet || 0)}`}>
          <div className="tbl-wrap"><table className="tbl">
            <thead><tr><th>TX</th><th>Date/Time</th><th>Type</th><th>Amount</th><th>Reason</th><th>Staff</th><th>Method</th><th>Balance After</th></tr></thead>
            <tbody>{walletTxs.map((t: Any) => (
              <tr key={t.id}><td>{t.id}</td><td>{t.at}</td><td><Badge tone={t.type === 'Credit' ? 'green' : 'blue'}>{t.type}</Badge></td>
                <td className="money">{t.type === 'Credit' ? '+' : '−'}{naira(t.amount || 0)}</td><td>{t.reason}</td><td>{t.staff}</td><td>{t.method}</td><td className="money">{naira(t.balanceAfter || 0)}</td></tr>
            ))}</tbody>
          </table></div>
        </Card>
      )}

      {tab === 'Activity' && (
        <Card title="Complete Patient History — who did what, and when">
          <Timeline items={activity || []} />
        </Card>
      )}


      <div className="mt muted" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        Every tab is filtered by your role's permissions.
        <Link to="/patients" style={{ marginLeft: 'auto' }}>← Back to patients</Link>
      </div>
    </Layout>
  )
}

