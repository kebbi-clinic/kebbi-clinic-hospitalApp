import { Link } from 'react-router-dom'
import { Layout } from '../components/Layout'
import { StatCard, Card, Badge, statusTone, naira } from '../components/ui'
import { useAuth } from '../auth'
import { useFetch } from '../api'
import { paths } from '../endpoints'

type Any = Record<string, any>

export default function Dashboard() {
  const { user } = useAuth()
  const { data, loading, error } = useFetch<Any>(paths.dashboard)
  const role = user.role
  return (
    <Layout title="Dashboard">
      <div className="page-head">
        <h2>Good day, {user.name.split(' ').slice(0, 2).join(' ')} 👋</h2>
        <div className="sub">{role} dashboard — live data from the Kebbi Clinic backend</div>
      </div>
      {loading && <div className="muted">Loading…</div>}
      {error && <div className="demo-note" style={{ background: 'var(--red-100)', color: 'var(--red-600)' }}>{error}</div>}
      {data && <RoleDashboard role={role} data={data} />}
    </Layout>
  )
}

function RoleDashboard({ role, data }: { role: string; data: Any }) {
  const s = data.stats || {}
  if (role === 'Records Officer') return <RecordsDash s={s} />
  if (role === 'Doctor') return <DoctorDash s={s} data={data} />
  if (role === 'Nurse') return <NurseDash s={s} data={data} />
  if (role === 'Laboratory Scientist') return <LabDash s={s} data={data} />
  if (role === 'Pharmacist') return <PharmDash s={s} data={data} />
  if (role === 'Accountant') return <AcctDash s={s} data={data} />
  return <RadDash s={s} data={data} />
}

function RecordsDash({ s }: { s: Any }) {
  return (<>
      <div className="grid cols-4 mb">
        <StatCard icon="patients" value={s.total} label="Total Patients" />
        <StatCard icon="heart" value={s.active} label="Active Patients" tone="green" />
        <StatCard icon="clock" value={s.inactive} label="Inactive Patients" tone="amber" />
        <StatCard icon="register" value={s.newToday} label="New Patients Today" />
      </div>
      <Card title="Quick actions">
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <Link to="/register" className="btn primary">+ Register New Patient</Link>
          <span className="muted">Search a patient to start a new visit — never create a duplicate patient.</span>
        </div>
      </Card>
  </>)
}

function DoctorDash({ s, data }: { s: Any; data: Any }) {
  return (<>
      <div className="grid cols-4 mb">
        <StatCard icon="patients" value={s.today} label="Today's Patients" />
        <StatCard icon="clock" value={s.waiting} label="Waiting Patients" tone="amber" />
        <StatCard icon="doctor" value={s.consults} label="Active Consultations" tone="green" />
        <StatCard icon="clipboard" value={s.admitted} label="Admitted Patients" />
      </div>
      <div className="grid cols-2">
        <Card title="Pending Investigations">
          <div className="tbl-wrap"><table className="tbl">
            <thead><tr><th>Patient</th><th>Test</th><th>Status</th></tr></thead>
            <tbody>{(data.pendingInv || []).map((i: Any) => (
              <tr key={i.id}><td>{i.patientName}<div className="muted">{i.patientId}</div></td><td>{i.test}</td><td><Badge tone={statusTone(i.status)}>{i.status}</Badge></td></tr>
            ))}</tbody>
          </table></div>
        </Card>
        <Card title="Recent Patients">
          <div className="tbl-wrap"><table className="tbl">
            <thead><tr><th>Patient</th><th>Visit</th><th>Status</th><th></th></tr></thead>
            <tbody>{(data.recent || []).map((v: Any) => (
              <tr key={v.id}><td><Link to={`/patients/${v.patientId}`}>{v.patientName}</Link><div className="muted">{v.patientId}</div></td><td>{v.id}</td><td><Badge tone={statusTone(v.status)}>{v.status}</Badge></td>
                <td className="right"><Link className="btn primary sm" to={`/consultation?patient=${v.patientId}&visit=${v.id}`}>Consult</Link></td></tr>
            ))}</tbody>
          </table></div>
        </Card>
      </div>
  </>)
}
function NurseDash({ s, data }: { s: Any; data: Any }) {
  return (<>
      <div className="grid cols-4 mb">
        <StatCard icon="nurse" value={s.ward} label="Ward Patients" />
        <StatCard icon="clipboard" value={s.admitted} label="Admitted Patients" tone="blue" />
        <StatCard icon="bell" value={s.attention} label="Requiring Attention" tone="red" />
        <StatCard icon="pill" value={s.medTasks} label="Medication Tasks" tone="amber" />
      </div>
      <Card title="Recent Vitals">
        <div className="tbl-wrap"><table className="tbl">
          <thead><tr><th>Patient</th><th>Temp</th><th>BP</th><th>Pulse</th><th>SpO2</th><th>Weight</th><th>Recorded By</th><th>Time</th></tr></thead>
          <tbody>{(data.recentVitals || []).map((v: Any) => (
            <tr key={v.id}><td><Link to={`/patients/${v.patientId}`}>{v.patientName}</Link><div className="muted">{v.patientId}</div></td><td>{v.temp}</td><td>{v.bp}</td><td>{v.pulse}</td><td>{v.spo2}</td><td>{v.weight}</td><td>{v.staff}</td><td>{v.at}</td></tr>
          ))}</tbody>
        </table></div>
      </Card>
      <Card title="Ward Actions" className="mt">
        <Link to="/nursing" className="btn primary sm">Record Vitals / Ward Round</Link>{' '}
        <Link to="/admissions" className="btn ghost sm">View Admissions</Link>
      </Card>
  </>)
}

function LabDash({ s, data }: { s: Any; data: Any }) {
  return (<>
      <div className="grid cols-4 mb">
        <StatCard icon="clock" value={s.pending} label="Pending Requests" tone="amber" />
        <StatCard icon="clock" value={s.progress} label="In Progress" tone="blue" />
        <StatCard icon="check" value={s.completed} label="Completed" tone="green" />
        <StatCard icon="report" value={s.tests} label="Configured Tests" />
      </div>
      <Card title="Requests Queue">
        <div className="tbl-wrap"><table className="tbl">
          <thead><tr><th>ID</th><th>Patient</th><th>Test</th><th>Requested By</th><th>Status</th><th></th></tr></thead>
          <tbody>{(data.requests || []).map((i: Any) => (
            <tr key={i.id}><td>{i.id}</td><td>{i.patientName}<div className="muted">{i.patientId} · {i.visitId}</div></td><td>{i.test}</td><td>{i.doctor}</td><td><Badge tone={statusTone(i.status)}>{i.status}</Badge></td>
              <td className="right"><Link className="btn primary sm" to="/lab">Open Laboratory</Link></td></tr>
          ))}</tbody>
        </table></div>
      </Card>
  </>)
}
function PharmDash({ s, data }: { s: Any; data: Any }) {
  return (<>
      <div className="grid cols-4 mb">
        <StatCard icon="pill" value={s.pending} label="Pending Prescriptions" tone="amber" />
        <StatCard icon="check" value={s.dispensed} label="Dispensed" tone="green" />
        <StatCard icon="report" value={s.low} label="Low Stock" tone="amber" />
        <StatCard icon="report" value={s.out} label="Out of Stock" tone="red" />
      </div>
      <Card title="Prescriptions">
        <div className="tbl-wrap"><table className="tbl">
          <thead><tr><th>RX</th><th>Patient</th><th>Doctor</th><th>Total</th><th>Status</th><th></th></tr></thead>
          <tbody>{(data.rx || []).map((p: Any) => (
            <tr key={p.id}><td>{p.id}</td><td>{p.patientName}<div className="muted">{p.patientId}</div></td><td>{p.doctor}</td><td className="money">{naira(p.total)}</td><td><Badge tone={statusTone(p.status)}>{p.status}</Badge></td>
              <td className="right"><Link className="btn green sm" to="/pharmacy">Open Pharmacy</Link></td></tr>
          ))}</tbody>
        </table></div>
      </Card>
  </>)
}

function AcctDash({ s, data }: { s: Any; data: Any }) {
  return (<>
      <div className="grid cols-4 mb">
        <StatCard icon="money" value={naira(s.revenue)} label="Revenue (all paid)" tone="green" />
        <StatCard icon="clock" value={s.pending} label="Pending Payments" tone="amber" />
        <StatCard icon="check" value={s.completed} label="Completed Payments" />
        <StatCard icon="wallet" value={naira(s.funding)} label="Wallet Funding Today" tone="blue" />
      </div>
      <Card title="Recent Wallet Transactions">
        <div className="tbl-wrap"><table className="tbl">
          <thead><tr><th>Patient</th><th>Type</th><th>Amount</th><th>Reason</th><th>Method</th><th>Balance After</th></tr></thead>
          <tbody>{(data.txs || []).map((t: Any) => (
            <tr key={t.id}><td>{t.patientId}</td><td><Badge tone={t.type === 'Credit' ? 'green' : 'blue'}>{t.type}</Badge></td><td className="money">{t.type === 'Credit' ? '+' : '−'}{naira(t.amount)}</td><td>{t.reason}</td><td>{t.method}</td><td className="money">{naira(t.balanceAfter)}</td></tr>
          ))}</tbody>
        </table></div>
      </Card>
  </>)
}

function RadDash({ s, data }: { s: Any; data: Any }) {
  return (<>
      <div className="grid cols-3 mb">
        <StatCard icon="radiology" value={s.pending} label="Pending Requests" tone="amber" />
        <StatCard icon="check" value={s.completed} label="Completed" tone="green" />
        <StatCard icon="report" value={s.reports} label="Reports Uploaded" />
      </div>
      <Card title="Radiology Requests">
        <div className="tbl-wrap"><table className="tbl">
          <thead><tr><th>ID</th><th>Patient</th><th>Investigation</th><th>Requested By</th><th>Status</th></tr></thead>
          <tbody>{(data.requests || []).map((i: Any) => (
            <tr key={i.id}><td>{i.id}</td><td>{i.patientName}<div className="muted">{i.patientId}</div></td><td>{i.test}</td><td>{i.doctor}</td><td><Badge tone={statusTone(i.status)}>{i.status}</Badge></td></tr>
          ))}</tbody>
        </table></div>
      </Card>
  </>)
}

