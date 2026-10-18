import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Layout } from '../components/Layout'
import { Card, PageHead, Badge, statusTone, Modal, Tabs, naira, AlertCard, isTopUpError } from '../components/ui'
import { ReceiptModal, receiptFromTx, type ReceiptData } from '../components/Receipt'
import { useAuth } from '../auth'
import { api } from '../api'
import { paths, patientApi } from '../endpoints'
import { PatientSearch, filterPatients } from '../components/PatientSearch'
import type { Patient, Settings } from '../data'

/** Roles allowed to see (and activate) inactive patients. Mirrors the server,
 *  which is the real authority — this only shapes the UI. */
const SEES_INACTIVE = ['Records Officer', 'Accountant']

/**
 * Normalise whatever the patients endpoint hands back into a real array.
 * Handles: bare array, { data: [...] }, { list: [...] }, { patients: [...] },
 * { rows: [...] }, { items: [...] }, null/undefined/error envelopes.
 */
function toPatientArray(raw: unknown): Patient[] {
  if (Array.isArray(raw)) return raw as Patient[]
  if (raw && typeof raw === 'object') {
    const obj = raw as Record<string, unknown>
    for (const key of ['data', 'list', 'patients', 'rows', 'items', 'results']) {
      if (Array.isArray(obj[key])) return obj[key] as Patient[]
    }
  }
  return []
}

export default function Patients() {
  const [q, setQ] = useState('')
  const [visitFor, setVisitFor] = useState<Patient | null>(null)
  const [activateFor, setActivateFor] = useState<Patient | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [okMsg, setOkMsg] = useState('')
  /* Receipt for the last activation charge — review before printing. */
  const [receipt, setReceipt] = useState<ReceiptData | null>(null)
  const [lastReceipt, setLastReceipt] = useState<ReceiptData | null>(null)
  const [nav] = useSearchParams()
  const [tab, setTab] = useState(nav.get('show') === 'inactive' ? 'Inactive' : 'All')
  const nav2 = useNavigate()
  const { user } = useAuth()

  // ── Direct fetch: we own the data / loading / error state here ──────
  const [list, setList] = useState<Patient[]>([])
  const [loading, setLoading] = useState(true)
  const [loadErr, setLoadErr] = useState('')

  const loadPatients = useCallback(async () => {
    setLoading(true)
    setLoadErr('')
    try {
      const raw = await api.get(paths.patients)
      // If your api.get already returns parsed JSON, use it as-is.
      // If it returns a Response, uncomment the next line:
      // const raw = await (await api.get(paths.patients)).json()
      console.log('[Patients] raw payload →', raw)
      const arr = toPatientArray(raw)
      setList(arr)
      if (arr.length === 0) {
        console.warn('[Patients] endpoint returned an empty array or an unrecognised shape')
      }
    } catch (e) {
      const msg = (e as Error).message || 'Failed to load patients'
      console.error('[Patients] load failed →', e)
      setLoadErr(msg)
      setList([])
    } finally {
      setLoading(false)
    }
  }, [])

  const [settings, setSettings] = useState<Settings | null>(null)
  /* A settings load can fail (cold backend, network blip). Tracking that
     separately from "loaded with a zero fee" is what stops the modal from
     confidently announcing ₦0 while activation really charges the fee. */
  const [settingsOk, setSettingsOk] = useState(false)
  const loadSettings = useCallback(async () => {
    try {
      const raw = await api.get(paths.settings)
      setSettings(raw as Settings)
      setSettingsOk(true)
    } catch (e) {
      // Settings failing shouldn't break the page — but activation fee display
      // and confirmation are gated until a fresh copy arrives (see the modal).
      console.warn('[Patients] settings load failed →', e)
      setSettings(null)
      setSettingsOk(false)
    }
  }, [])

  useEffect(() => { loadPatients() }, [loadPatients])
  useEffect(() => { loadSettings() }, [loadSettings])

  const role = user?.role || ''
  const canStartVisit = role === 'Records Officer' || role === 'Doctor'
  const seesInactive = SEES_INACTIVE.includes(role)
  const canActivate = role === 'Records Officer'
  /* The fee is only "known" once settings loaded successfully — an unknown
     fee is never displayed as ₦0 (the modal says so explicitly). */
  const feeKnown = settingsOk && settings != null
  const activationFee = feeKnown ? Number(settings!.activationFee) || 0 : null

  /* Records Officer & Accountant see everything: "All" = the whole register,
     plus dedicated Active and Inactive views. Clinical staff only ever get the
     active list (the server filters Inactive out for them). */
  const shown = useMemo(
    () => list.filter((p) => (tab === 'Inactive' ? p.status === 'Inactive' : tab === 'Active' ? p.status === 'Active' : true)),
    [list, tab],
  )
  const filtered = useMemo(() => filterPatients(shown, q), [shown, q])

  const startVisit = async () => {
    if (!visitFor) return
    setBusy(true); setErr('')
    try {
      await patientApi.startVisit(visitFor.id)
      const id = visitFor.id
      setVisitFor(null)
      loadPatients()
      nav2(`/patients/${id}`)
    } catch (e) { setErr((e as Error).message) } finally { setBusy(false) }
  }

  const activate = async () => {
    if (!activateFor) return
    /* Never charge against a fee we could not verify — the notice must match
       what the server will deduct. */
    if (!feeKnown) { setErr('Could not verify the current activation fee — reload it below and try again.'); return }
    setBusy(true); setErr(''); setOkMsg('')
    const who = `${activateFor.firstName} ${activateFor.surname}`
    try {
      const r = await patientApi.activate(activateFor.id)
      setActivateFor(null)
      loadPatients()
      setTab('All')
      setOkMsg(`${who} activated.`
        + (r.activationFee > 0
          ? ` Activation fee ₦${Number(r.activationFee).toLocaleString()} taken from the wallet — new balance ₦${Number(r.wallet).toLocaleString()}.`
          : ' (no activation fee configured)')
        + (r.visitId ? ` Visit ${r.visitId} is open for the nurse to record vitals.` : ''))
      /* The activation charge always has a receipt — open it before printing. */
      if (r.walletTx) { const rc = receiptFromTx(r.walletTx, activateFor); setReceipt(rc); setLastReceipt(rc) }
    } catch (e) { setErr((e as Error).message) } finally { setBusy(false) }
  }

  return (
    <Layout title="Patients">
      <PageHead title="Patients" sub="One permanent record per patient — search before registering. Returning patients start a NEW VISIT, not a new patient.">
        {role === 'Records Officer' && <Link to="/register" className="btn primary">+ Register New Patient</Link>}
      </PageHead>

      {okMsg && (
        <AlertCard tone="green" title="Patient activated"
          actions={lastReceipt ? <button className="btn primary sm" onClick={() => setReceipt(lastReceipt)}>View Receipt</button> : undefined}>
          {okMsg}
        </AlertCard>
      )}
      {loadErr && (
        <div className="demo-note mb" style={{ background: 'var(--red-100)', color: 'var(--red-600)' }}>
          Could not load patients: {loadErr}{' '}
          <button className="btn ghost sm" onClick={loadPatients}>Retry</button>
        </div>
      )}

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
            <Tabs tabs={['All', 'Active', 'Inactive']} active={tab} onChange={setTab} />
            <div className="muted" style={{ marginTop: 8 }}>
              View <b>All</b> patients, or filter to <b>Active</b> / <b>Inactive</b> — inactive patients are visible to the Records Officer and the Accountant only. Clinical staff work from the active list.
            </div>
          </div>
        )}
      </Card>

      <Card>
        <div className="tbl-wrap"><table className="tbl">
          <thead>
            <tr>
              <th>Patient ID</th><th>Name</th><th>Gender</th><th>Phone</th>
              <th>Wallet</th><th>Status</th><th></th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={7} className="muted" style={{ textAlign: 'center', padding: '22px 14px' }}>Loading patients…</td></tr>
            )}
            {!loading && filtered.map((p) => (
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
                    <button
                      className="btn green sm"
                      onClick={() => { setActivateFor(p); setErr(''); setOkMsg(''); loadSettings() }}
                      title="Reloads the current activation fee first, so the notice matches what will be deducted"
                    >
                      Activate
                    </button>
                  )}{' '}
                  {canStartVisit && p.status === 'Active' && (
                    <button className="btn primary sm" onClick={() => setVisitFor(p)}>Start New Visit</button>
                  )}
                </td>
              </tr>
            ))}
            {!loading && filtered.length === 0 && (
              <tr><td colSpan={7} className="muted" style={{ textAlign: 'center', padding: '22px 14px' }}>
                {q.trim()
                  ? <>No patient matches <b>{q}</b> in {tab === 'Inactive' ? 'the inactive list' : 'the list'}.</>
                  : 'No patients here yet.'}
              </td></tr>
            )}
          </tbody>
        </table></div>
      </Card>

      {activateFor && (
        <Modal
          title={`Activate ${activateFor.firstName} ${activateFor.surname}`}
          onClose={() => setActivateFor(null)}
          footer={
            <>
              <button className="btn ghost" onClick={() => setActivateFor(null)}>Cancel</button>
              <button className="btn green" disabled={busy || !feeKnown} onClick={activate}>
                {busy ? 'Activating…' : 'Activate Patient'}
              </button>
            </>
          }
        >
          {err && (
            <AlertCard tone="red" title={isTopUpError(err) ? 'Top up the patient’s wallet' : 'Activation failed'}>
              {err}
            </AlertCard>
          )}
          <p>Only the Records Officer can activate a patient. Once activated they appear in the nurses' <b>new patients</b> queue for vitals.</p>
          {!feeKnown && (
            <div className="demo-note mb" style={{ background: 'var(--red-100)', color: 'var(--red-600)' }}>
              The current activation fee could not be loaded from the server — activation is paused
              so you never announce ₦0 while the wallet is really charged.{' '}
              <button className="btn ghost sm" onClick={loadSettings}>Reload the fee</button>
            </div>
          )}
          <div className="kv">
            <div className="k">Patient</div><div className="v">{activateFor.id}</div>
            <div className="k">Current status</div><div className="v"><Badge tone="gray">Inactive</Badge></div>
            <div className="k">Wallet balance</div><div className="v money">{naira(activateFor.wallet)}</div>
            <div className="k">Activation fee</div><div className="v money">{feeKnown ? naira(activationFee) : 'Unknown — not loaded'}</div>
            <div className="k">Balance after activation</div>
            <div className="v money">{feeKnown ? naira(Math.max(0, Number(activateFor.wallet) - (activationFee ?? 0))) : '—'}</div>
          </div>
          {feeKnown && (activationFee ?? 0) > Number(activateFor.wallet) && (
            <AlertCard tone="red" title="Top up the patient’s wallet">
              The wallet does not cover the activation fee. The accountant must fund it before activation can go ahead.
            </AlertCard>
          )}
        </Modal>
      )}

      {visitFor && (
        <Modal
          title="Start New Visit"
          onClose={() => setVisitFor(null)}
          footer={
            <>
              <button className="btn ghost" onClick={() => setVisitFor(null)}>Cancel</button>
              <button className="btn green" disabled={busy} onClick={startVisit}>
                {busy ? 'Creating…' : 'Create Visit'}
              </button>
            </>
          }
        >
          {err && <div className="demo-note" style={{ background: 'var(--red-100)', color: 'var(--red-600)' }}>{err}</div>}
          <p>
            The existing patient <b>{visitFor.firstName} {visitFor.surname} ({visitFor.id})</b> will get a new visit
            record. The patient record is <b>not</b> duplicated.
          </p>
          <div className="kv">
            <div className="k">Patient</div><div className="v">{visitFor.id}</div>
            <div className="k">Patient becomes</div><div className="v"><Badge tone="green">Active</Badge></div>
          </div>
        </Modal>
      )}

      {receipt && <ReceiptModal receipt={receipt} onClose={() => setReceipt(null)} />}
    </Layout>
  )
}