import { useState } from 'react'
import { Layout } from '../components/Layout'
import { Card, PageHead, Badge, statusTone, Modal, naira } from '../components/ui'
import { useAuth } from '../auth'
import { api, useFetch, useRealtime, fileUrl } from '../api'
import { investigationApi, paths } from '../endpoints'
import type { Investigation } from '../data'

export default function Laboratory() {
  const [upload, setUpload] = useState<Investigation | null>(null)
  const [values, setValues] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [view, setView] = useState<Investigation | null>(null)
  const { user } = useAuth()
  const { data: all = [], refetch } = useFetch<Investigation[]>(paths.investigations('Lab'))

  /* New requests / results appear live — no manual refresh needed. */
  useRealtime(() => refetch(), ['data.changed', 'activity.new'])
  const list = all // queue is already sorted newest-first
  const s = {
    pending: list.filter((i) => i.status === 'Pending').length,
    progress: list.filter((i) => i.status === 'In Progress').length,
    completed: list.filter((i) => i.status === 'Completed').length,
  }

  const submit = async () => {
    if (!upload || !file) { setErr('Please select a result image (PNG/JPG) or PDF.'); return }
    setBusy(true); setErr('')
    try {
      const fd = new FormData()
      fd.append('values', values)
      fd.append('image', file)
      await investigationApi.saveResult(upload.id, fd)
      setUpload(null); setValues(''); setFile(null)
      refetch()
    } catch (e) { setErr((e as Error).message) } finally { setBusy(false) }
  }

  return (
    <Layout title="Laboratory">
      <PageHead title="Laboratory Investigations" sub="Requests from doctors arrive here in real time. Upload result images linked to patient, visit and requesting doctor.">
        <span className="muted">Signed in as {user?.name || 'Staff'}</span>
      </PageHead>
      <div className="grid cols-4 mb">
        <Card><div className="stat"><div className="ic amber"><Badge tone="amber">Pending</Badge></div><div><div className="v">{s.pending}</div><div className="l">Pending Requests</div></div></div></Card>
        <Card><div className="stat"><div className="ic blue"><Badge tone="blue">In Progress</Badge></div><div><div className="v">{s.progress}</div><div className="l">In Progress</div></div></div></Card>
        <Card><div className="stat"><div className="ic green"><Badge tone="green">Completed</Badge></div><div><div className="v">{s.completed}</div><div className="l">Completed</div></div></div></Card>
        <Card><div className="stat"><div className="ic blue"><Badge tone="blue">Queue</Badge></div><div><div className="v">{list.length}</div><div className="l">Total Requests</div></div></div></Card>
      </div>
      <Card title="Requests Queue">
        <div className="tbl-wrap"><table className="tbl">
          <thead><tr><th>ID</th><th>Patient</th><th>Test</th><th>Requested By</th><th>Date</th><th>Status</th><th></th></tr></thead>
          <tbody>{list.map((i) => (
            <tr key={i.id}>
              <td>{i.id}</td><td>{i.patientId}<div className="muted">{i.patientId} · {i.visitId}</div></td><td>{i.test}</td><td>{i.doctor}</td><td>{i.createdAt}</td>
              <td><Badge tone={statusTone(i.status)}>{i.status}</Badge></td>
              <td className="right">{i.status !== 'Completed'
                ? <button className="btn primary sm" onClick={() => { setUpload(i); setValues(''); setFile(null); setErr('') }}>Upload Result</button>
                : <button className="btn ghost sm" onClick={() => setView(i)}>View Result</button>}</td>
            </tr>
          ))}</tbody>
        </table></div>
      </Card>
      {upload && (
        <Modal title={`Upload Result — ${upload.test} (${upload.id})`} onClose={() => setUpload(null)}
          footer={<><button className="btn ghost" onClick={() => setUpload(null)}>Cancel</button><button className="btn green" disabled={busy} onClick={submit}>{busy ? 'Uploading…' : 'Submit Result'}</button></>}>
          {err && <div className="demo-note" style={{ background: 'var(--red-100)', color: 'var(--red-600)' }}>{err}</div>}
          <label className="upload-box" style={{ display: 'block' }}>
            {file ? <>Selected: <b>{file.name}</b><br /><span className="muted">Tap to change</span></> : <>📷 Select result image (camera / gallery)<br /><span className="muted">PNG / JPG — linked to patient, visit & investigation</span></>}
            <input type="file" accept="image/png,image/jpeg,image/webp,application/pdf" style={{ display: 'none' }} onChange={(e) => setFile(e.target.files?.[0] || null)} />
          </label>
          <div className="field mt"><label>Result values / notes</label><textarea className="input" rows={3} placeholder="e.g. PCV 32% · Hb 10.5 g/dL · WBC 7,800" value={values} onChange={(e) => setValues(e.target.value)} /></div>
          <div className="kv">
            <div className="k">Patient</div><div className="v">{upload.patientId}</div>
            <div className="k">Visit</div><div className="v">{upload.visitId}</div>
            <div className="k">Requested by</div><div className="v">{upload.doctor}</div>
            <div className="k">Charge</div><div className="v money">{naira(upload.price)} (auto-billed on completion)</div>
          </div>
        </Modal>
      )}
      {view?.result && (
        <Modal title={`Result — ${view.test} (${view.id})`} onClose={() => setView(null)}
          footer={<><a className="btn primary" href={fileUrl(view.result.image)} target="_blank" rel="noreferrer">Open file</a><button className="btn ghost" onClick={() => setView(null)}>Close</button></>}>
          <div className="kv">
            <div className="k">Patient</div><div className="v">{view.patientId}</div>
            <div className="k">Requested by</div><div className="v">{view.doctor}</div>
            <div className="k">Reported by</div><div className="v">{view.result.by}</div>
            <div className="k">At</div><div className="v">{view.result.at}</div>
          </div>
          {view.result.values && (<><div className="muted mt mb" style={{ fontWeight: 700 }}>Result values</div><div style={{ whiteSpace: 'pre-wrap' }}>{view.result.values}</div></>)}
          <div className="muted mt mb" style={{ fontWeight: 700 }}>Attached file</div>
          {view.result.image.toLowerCase().endsWith('.pdf')
            ? <iframe src={fileUrl(view.result.image)} title="result" style={{ width: '100%', height: 420, border: '1px solid var(--border)', borderRadius: 10 }} />
            : <a href={fileUrl(view.result.image)} target="_blank" rel="noreferrer"><img src={fileUrl(view.result.image)} alt="result" style={{ maxWidth: '100%', borderRadius: 10 }} /></a>}
        </Modal>
      )}
    </Layout>
  )
}

