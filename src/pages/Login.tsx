import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth'
import type { User } from '../api'

export default function Login() {
  const nav = useNavigate()
  const { login, changePassword } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  /* When the account is flagged "must change password", login succeeds into this step. */
  const [pending, setPending] = useState<User | null>(null)
  const [pw1, setPw1] = useState('')
  const [pw2, setPw2] = useState('')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true); setError('')
    try {
      const u = await login(username.trim(), password)
      if (u.mustChangePassword) { setPending(u); setBusy(false); return }
      nav('/dashboard')
    } catch (err) {
      setError((err as Error).message)
    } finally { setBusy(false) }
  }

  const submitNew = async (e: React.FormEvent) => {
    e.preventDefault()
    if (pw1.length < 6) { setError('Password must be at least 6 characters.'); return }
    if (pw1 !== pw2) { setError('The two passwords do not match.'); return }
    if (pw1 === password) { setError('Choose a password different from the temporary one.'); return }
    setBusy(true); setError('')
    try {
      await changePassword(password, pw1)
      nav('/dashboard')
    } catch (err) {
      setError((err as Error).message)
    } finally { setBusy(false) }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="logo">
          <img src="/logo.png" alt="Kebbi Clinic logo" />
        </div>
        {pending ? (<>
          <h1>Choose a New Password</h1>
          <div className="sub">Welcome, <b>{pending.name}</b>. Your administrator requires you to set your own password before using the system.</div>
          <form onSubmit={submitNew}>
            <div className="field">
              <label>New password</label>
              <input className="input" type="password" value={pw1} onChange={(e) => setPw1(e.target.value)} placeholder="At least 6 characters" autoFocus />
            </div>
            <div className="field">
              <label>Confirm new password</label>
              <input className="input" type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} />
            </div>
            {error && <div className="demo-note" style={{ background: 'var(--red-100)', color: 'var(--red-600)' }}>{error}</div>}
            <button className="btn green" style={{ width: '100%', justifyContent: 'center', marginTop: 4 }} type="submit" disabled={busy}>
              {busy ? 'Saving…' : 'Save password & continue'}
            </button>
            <div className="demo-note">This is a one-time step — after this you sign in with your own password.</div>
          </form>
        </>) : (<>
        <h1>Welcome Back</h1>
        <div className="sub">Sign in to the Kebbi Clinic Hospital Staff App</div>
        <form onSubmit={submit}>
          <div className="field">
            <label>Username / Phone</label>
            <input className="input" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="e.g. dr.ahmed" autoFocus />
          </div>
          <div className="field">
            <label>Password</label>
            <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          {error && <div className="demo-note" style={{ background: 'var(--red-100)', color: 'var(--red-600)' }}>{error}</div>}
          <button className="btn primary" style={{ width: '100%', justifyContent: 'center', marginTop: 4 }} type="submit" disabled={busy}>
            {busy ? 'Signing in…' : 'Login'}
          </button>
          <div className="foot"><a href="#">Forgot Password?</a></div>
          <div className="demo-note">
            Use the credentials issued to you by the administrator. Administration staff use the separate <b>Admin App</b>.
          </div>
        </form>
        </>)}
      </div>
    </div>
  )
}
