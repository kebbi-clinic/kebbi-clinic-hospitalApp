import React from 'react'

interface Props { children: React.ReactNode }
interface State { error: Error | null }

/** Last line of defence: a render error must never leave the user on a blank
 *  screen. Shows a recovery card with a reload action instead of crashing. */
export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[app] render error:', error, info.componentStack)
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children
    return (
      <div className="login-page">
        <div className="login-card">
          <h1>Something went wrong</h1>
          <div className="sub">The app hit an unexpected error and stopped this screen. Your data is safe on the server.</div>
          <div className="demo-note" style={{ background: 'var(--red-100)', color: 'var(--red-600)', whiteSpace: 'pre-wrap' }}>
            {error.message || 'Unknown error'}
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn primary" style={{ flex: 1, justifyContent: 'center' }} onClick={() => window.location.reload()}>Reload</button>
            <button className="btn ghost" style={{ flex: 1, justifyContent: 'center' }} onClick={() => { this.setState({ error: null }); window.location.replace('/login') }}>Back to login</button>
          </div>
        </div>
      </div>
    )
  }
}
