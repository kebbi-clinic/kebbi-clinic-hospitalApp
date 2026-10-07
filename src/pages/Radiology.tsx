import { useState } from 'react'
import { Layout } from '../components/Layout'
import { Card, PageHead, Badge, statusTone, Modal, naira } from '../components/ui'
import { useFetch, useRealtime, fileUrl } from '../api'
import { investigationApi, paths } from '../endpoints'
import type { Investigation } from '../data'

export default function Radiology() {
  const [upload, setUpload] = useState<Investigation | null>(null)
  const [values, setValues] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [err, setErr] = useState('')
  const [ok, setOk] = useState('')
  const [busy, setBusy] = useState(false)
  const [view, setView] = useState<Investigation | null>(null)
  const { data: list = [], refetch } = useFetch<Investigation[]>(paths.investigations('Radiology'))

  /* New requests / results appear live — no manual refresh needed. */
  useRealtime(() => refetch(), ['data.changed', 'activity.new'])

  const submit = async () => {
    if (!upload || !file) { setErr('Please select a report image (PNG/JPG) or PDF.'); return }
    setBusy(true); setErr('')
    try {
      const fd = new FormData()
      fd.append('values', values)
      fd.append('image', file)
      /* Same rule as the laboratory: the test fee comes off the wallet on submit. */
      const r = await investigationApi.saveResult(upload.id, fd)
      const parts = [`${upload.test} submitted.`]
      if (r.price > 0) {
        parts.push(`${naira(r.debitedFromWallet)} taken from the patient's wallet (charge ${naira(r.price)}).`)
        if (r.walletBalance != null) parts.push(`Balance ${naira(r.walletBalance)}.`)
        if (r.outstanding > 0) parts.push(`${naira(r.outstanding)} outstanding — the accountant has been notified.`)
      } else {
        parts.push('No fee configured for this test, so nothing was charged.')
      }
      setOk(parts.join(' '))
      setUpload(null); setValues(''); setFile(null)
      refetch()
    } catch (e) { setErr((e as Error).message) } finally { setBusy(false) }
  }

  return (
    <Layout title="Radiology">
      <PageHead title="Radiology Requests" sub="Same workflow as laboratory: receive request → perform → upload report/image → linked to patient & visit. The test fee is taken from the patient's wallet when you submit.">
        {ok && <Badge tone="green">{ok}</Badge>}
      </PageHead>
      <Card title="Requests">
        <div className="tbl-wrap"><table className="tbl">
          <thead><tr><th>ID</th><th>Patient</th><th>Investigation</th><th>Requested By</th><th>Date</th><th>Status</th><th></th></tr></thead>
          <tbody>{list.map((i) => (
            <tr key={i.id}>
              <td>{i.id}</td><td>{i.patientId}<div className="muted">{i.visitId}</div></td><td>{i.test}</td><td>{i.doctor}</td><td>{i.createdAt}</td>
              <td><Badge tone={statusTone(i.status)}>{i.status}</Badge></td>
              <td className="right">{i.status !== 'Completed'
                ? <button className="btn primary sm" onClick={() => { setUpload(i); setValues(''); setFile(null); setErr('') }}>Upload Report</button>
                : <button className="btn ghost sm" onClick={() => setView(i)}>View Report</button>}</td>
            </tr>
          ))}</tbody>
        </table></div>
      </Card>
      {upload && (
        <Modal title={`Upload Report — ${upload.test} (${upload.id})`} onClose={() => setUpload(null)}
          footer={<><button className="btn ghost" onClick={() => setUpload(null)}>Cancel</button><button className="btn green" disabled={busy} onClick={submit}>{busy ? 'Uploading…' : 'Submit Report'}</button></>}>
          {err && <div className="demo-note" style={{ background: 'var(--red-100)', color: 'var(--red-600)' }}>{err}</div>}
          <label className="upload-box" style={{ display: 'block' }}>
            {file ? <>Selected: <b>{file.name}</b></> : <>📷 Select report image / scan<br /><span className="muted">Attached to patient, visit & investigation</span></>}
            <input type="file" accept="image/png,image/jpeg,image/webp,application/pdf" style={{ display: 'none' }} onChange={(e) => setFile(e.target.files?.[0] || null)} />
          </label>
          <div className="field mt"><label>Radiologist report / findings</label><textarea className="input" rows={3} value={values} onChange={(e) => setValues(e.target.value)} /></div>
        </Modal>
      )}
      {view?.result && (
        <Modal title={`Report — ${view.test} (${view.id})`} onClose={() => setView(null)}
          footer={<><a className="btn primary" href={fileUrl(view.result.image)} target="_blank" rel="noreferrer">Open file</a><button className="btn ghost" onClick={() => setView(null)}>Close</button></>}>
          <div className="kv">
            <div className="k">Patient</div><div className="v">{view.patientId}</div>
            <div className="k">Requested by</div><div className="v">{view.doctor}</div>
            <div className="k">Reported by</div><div className="v">{view.result.by}</div>
            <div className="k">At</div><div className="v">{view.result.at}</div>
          </div>
          {view.result.values && (<><div className="muted mt mb" style={{ fontWeight: 700 }}>Findings</div><div style={{ whiteSpace: 'pre-wrap' }}>{view.result.values}</div></>)}
          <div className="muted mt mb" style={{ fontWeight: 700 }}>Attached file</div>
          {view.result.image.toLowerCase().endsWith('.pdf')
            ? <iframe src={fileUrl(view.result.image)} title="report" style={{ width: '100%', height: 420, border: '1px solid var(--border)', borderRadius: 10 }} />
            : <a href={fileUrl(view.result.image)} target="_blank" rel="noreferrer"><img src={fileUrl(view.result.image)} alt="report" style={{ maxWidth: '100%', borderRadius: 10 }} /></a>}
        </Modal>
      )}
    </Layout>
  )
}

