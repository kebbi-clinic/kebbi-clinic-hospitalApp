import React from 'react'

/* ---------- Icons (inline SVG, filled) ---------- */
const paths: Record<string, string> = {
  dashboard: 'M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z',
  patients: 'M16 11c1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3 1.34 3 3 3zm-8 0c1.66 0 3-1.34 3-3S9.66 5 8 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z',
  register: 'M15 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm-9-2V7H4v3H1v2h3v3h2v-3h3v-2H6zm9 4c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z',
  doctor: 'M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 14h-2v-2h2v2zm0-4h-2V7h2v6z',
  nurse: 'M12 2 4.5 20.29l.71.71L12 18l6.79 3 .71-.71L12 2z',
  lab: 'M9 3h2v6l6 10a2 2 0 0 1-1.7 3H8.7A2 2 0 0 1 7 19L13 9V3H9zm8 0h5v2h-5z',
  pharmacy: 'M4 8h16v13H4V8zm4-4h8v3H8V4z',
  accountant: 'M11.8 10.9c-2.27-.59-3-1.2-3-2.15 0-1.09 1.01-1.85 2.7-1.85 1.78 0 2.44.85 2.5 2.1h2.21c-.07-1.72-1.12-3.3-3.21-3.81V3h-3v2.16c-1.94.42-3.5 1.68-3.5 3.61 0 2.31 1.91 3.46 4.7 4.13 2.5.6 3 1.48 3 2.41 0 .69-.49 1.79-2.7 1.79-2.06 0-2.87-.92-2.98-2.1h-2.2c.12 2.19 1.76 3.42 3.68 3.83V21h3v-2.15c1.95-.37 3.5-1.5 3.5-3.55 0-2.84-2.43-3.81-4.7-4.4z',
  radiology: 'M12 2C8 2 4 2.5 4 6v9.5C4 17.43 5.57 19 7.5 19L6 20.5v.5h2.23l2-2H14l2 2H18v-.5L16.5 19c1.93 0 3.5-1.57 3.5-3.5V6c0-3.5-3.58-4-8-4zM7.5 17a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm3.5-7H7V7h4v3zm2 0V7h4v3h-4zm3.5 7a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3z',
  logout: 'M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5-5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z',
  bell: 'M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.63-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.64 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z',
  search: 'M15.5 14h-.79l-.28-.27A6.47 6.47 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z',
  menu: 'M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z',
  wallet: 'M21 18v1c0 1.1-.9 2-2 2H5c-1.11 0-2-.9-2-2V5c0-1.1.89-2 2-2h14c1.1 0 2 .9 2 2v1h-9c-1.11 0-2 .9-2 2v8c0 1.1.89 2 2 2h9zm-8-2h10V9H13v7zm3-2.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z',
  money: 'M4 6h16v12H4V6zm8 3a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
  pill: 'M4.22 11.29l7.07-7.07a5 5 0 0 1 7.07 7.07l-7.07 7.07a5 5 0 0 1-7.07-7.07zm1.41 1.42a3 3 0 0 0 4.24 4.24l2.83-2.83-4.24-4.24-2.83 2.83z',
  clipboard: 'M19 3h-4.18C14.4 1.84 13.3 1 12 1s-2.4.84-2.82 2H5c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 0c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm-2 4h4v2h-4V7zm0 4h8v2h-8v-2zm0 4h8v2h-8v-2z',
  report: 'M5 3h14v18H5V3zm2 4h10v2H7V7zm0 4h10v2H7v-2zm0 4h6v2H7v-2z',
  settings: 'M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6A3.6 3.6 0 1 1 12 8.4a3.6 3.6 0 0 1 0 7.2z',
  shield: 'M12 1 3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z',
  check: 'M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z',
  clock: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm.5 13H11v-6l5.25 3.15.75-1.23-4.5-2.67V7h1.5z',
  heart: 'M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z',
}

export function Icon({ name, size = 18, color }: { name: string; size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color || 'currentColor'} style={{ flexShrink: 0 }}>
      <path d={paths[name] || paths.dashboard} />
    </svg>
  )
}

/* ---------- Formatters ---------- */
export const naira = (n: number | undefined | null) => '₦' + Number(n || 0).toLocaleString('en-NG')

/* ---------- Small building blocks ---------- */
export function StatCard({ icon, value, label, tone = 'blue' }: { icon: string; value: string | number; label: string; tone?: 'blue' | 'green' | 'red' | 'amber' }) {
  return (
    <div className="card stat">
      <div className={`ic ${tone}`}><Icon name={icon} size={22} /></div>
      <div>
        <div className="v">{value}</div>
        <div className="l">{label}</div>
      </div>
    </div>
  )
}

export function Badge({ tone, children }: { tone: 'green' | 'blue' | 'red' | 'amber' | 'gray'; children: React.ReactNode }) {
  return <span className={`badge ${tone}`}>{children}</span>
}

export function statusTone(s: string): 'green' | 'blue' | 'red' | 'amber' | 'gray' {
  const map: Record<string, 'green' | 'blue' | 'red' | 'amber' | 'gray'> = {
    Active: 'green', Completed: 'green', Paid: 'green', Dispensed: 'green', Given: 'green',
    Pending: 'amber', 'In Progress': 'blue', Waiting: 'amber', 'Low Stock': 'amber', Open: 'amber',
    'Out of Stock': 'red', Inactive: 'gray', Admitted: 'blue', Discharged: 'gray', Cancelled: 'red',
  }
  return map[s] || 'gray'
}

export function PageHead({ title, sub, children }: { title: string; sub?: string; children?: React.ReactNode }) {
  return (
    <div className="page-head">
      <h2>{title}</h2>
      <div className="spacer" />
      {children}
      {sub && <div className="sub">{sub}</div>}
    </div>
  )
}

export function Card({ title, children, actions, className = '' }: { title?: string; children: React.ReactNode; actions?: React.ReactNode; className?: string }) {
  return (
    <div className={`card ${className}`}>
      {title && (
        <div className="card-h">
          <h3>{title}</h3>
          {actions && <div style={{ marginLeft: 'auto' }}>{actions}</div>}
        </div>
      )}
      <div className="card-b" style={title ? {} : { padding: 0 }}>{children}</div>
    </div>
  )
}

export function Tabs({ tabs, active, onChange }: { tabs: string[]; active: string; onChange: (t: string) => void }) {
  return (
    <div className="tabs">
      {tabs.map((t) => (
        <button key={t} className={t === active ? 'active' : ''} onClick={() => onChange(t)}>{t}</button>
      ))}
    </div>
  )
}

export function Modal({ title, onClose, children, footer, wide }: { title: string; onClose: () => void; children: React.ReactNode; footer?: React.ReactNode; wide?: boolean }) {
  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" style={wide ? { maxWidth: 760 } : undefined} onClick={(e) => e.stopPropagation()}>
        <div className="m-h">
          <h3>{title}</h3>
          <button className="x" onClick={onClose}>×</button>
        </div>
        <div className="m-b">{children}</div>
        {footer && <div className="m-f">{footer}</div>}
      </div>
    </div>
  )
}

export function Field({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return <div className={`field ${full ? 'full' : ''}`}><label>{label}</label>{children}</div>
}

export function Timeline({ items }: { items?: any[] }) {
  const list: any[] = items || []
  if (list.length === 0) return <div className="muted" style={{ padding: 14 }}>No activity yet.</div>
  return (
    <div className="timeline">
      {list.map((i, idx) => (
        <div key={idx} className={`tl-item ${i.green ? 'green' : ''}`}>
          <div className="t">{i.time}</div>
          <div className="what">{i.what}</div>
          <div className="meta">{i.meta}</div>
        </div>
      ))}
    </div>
  )
}