import React, { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Icon } from './ui'
import { useAuth } from '../auth'
import { useFetch, useRealtime, subscribeRole } from '../api'
import { playPing } from '../sound'
import { initPush } from '../push'
import { paths } from '../endpoints'
import type { Role } from '../data'

interface NavItem { to: string; label: string; icon: string; count?: number }
const NAV: Record<Role, { section: string; items: NavItem[] }[]> = {
  'Doctor': [
    { section: 'Clinical', items: [
      { to: '/dashboard', label: 'Dashboard', icon: 'dashboard' },
      { to: '/patients', label: 'Patients', icon: 'patients' },
      { to: '/consultation', label: 'Consultation', icon: 'doctor' },
      { to: '/lab', label: 'Laboratory', icon: 'lab' },
      { to: '/radiology', label: 'Radiology', icon: 'radiology' },
      { to: '/nursing', label: 'Ward & Nursing', icon: 'nurse' },
    ]},
  ],
  'Nurse': [
    { section: 'Ward', items: [
      { to: '/dashboard', label: 'Dashboard', icon: 'dashboard' },
      { to: '/patients', label: 'Patients', icon: 'patients' },
      { to: '/nursing', label: 'Ward & Nursing', icon: 'nurse' },
      { to: '/admissions', label: 'Admissions', icon: 'clipboard' },
    ]},
  ],
  'Records Officer': [
    { section: 'Records', items: [
      { to: '/dashboard', label: 'Dashboard', icon: 'dashboard' },
      { to: '/patients', label: 'Patients', icon: 'patients' },
      { to: '/register', label: 'Register Patient', icon: 'register' },
      { to: '/admissions', label: 'Admissions', icon: 'clipboard' },
    ]},
  ],
  'Laboratory Scientist': [
    { section: 'Laboratory', items: [
      { to: '/dashboard', label: 'Dashboard', icon: 'dashboard' },
      { to: '/patients', label: 'Patients', icon: 'patients' },
      { to: '/lab', label: 'Investigations', icon: 'lab' },
    ]},
  ],
  'Pharmacist': [
    { section: 'Pharmacy', items: [
      { to: '/dashboard', label: 'Dashboard', icon: 'dashboard' },
      { to: '/patients', label: 'Patients', icon: 'patients' },
      { to: '/pharmacy', label: 'Prescriptions', icon: 'pill' },
      { to: '/inventory', label: 'Inventory', icon: 'clipboard' },
    ]},
  ],
  'Accountant': [
    { section: 'Accounting', items: [
      { to: '/dashboard', label: 'Dashboard', icon: 'dashboard' },
      { to: '/patients', label: 'Patients', icon: 'patients' },
      { to: '/accounting', label: 'Payments & Wallets', icon: 'accountant' },
    ]},
  ],
  'Radiologist': [
    { section: 'Radiology', items: [
      { to: '/dashboard', label: 'Dashboard', icon: 'dashboard' },
      { to: '/patients', label: 'Patients', icon: 'patients' },
      { to: '/radiology', label: 'Radiology Requests', icon: 'radiology' },
    ]},
  ],
}

interface Notif { role: string; text: string; at: string }

export function Layout({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(() => typeof window === 'undefined' || window.innerWidth > 900)
  const [showNotifs, setShowNotifs] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const loc = useLocation()
  const nav = useNavigate()
  const { user, logout } = useAuth()
  /* Defensive: if the render somehow runs without a session (stale storage,
     expired token), bounce to login instead of dereferencing `user.role`. */
  const role = (user?.role || '') as Role
  const { data: notifs = [], refetch: refetchNotifs } = useFetch<Notif[]>(paths.notifications)
  const sections = NAV[role] || []
  const initials = useMemo(
    () => (user?.name || '?').split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase(),
    [user?.name],
  )

  useEffect(() => { if (!user) nav('/login', { replace: true }) }, [user, nav])

  /* Join this staff member's role-room once so targeted events reach them. */
  useEffect(() => { subscribeRole(role) }, [role])

  /* Register this browser for Web Push so alerts (with OS sound) still arrive
     when the tab is closed — role is taken from the session server-side. */
  useEffect(() => { void initPush() }, [])

  /* Keep the sidebar open on desktop; only auto-close the drawer on mobile. */
  useEffect(() => {
    const onResize = () => { if (window.innerWidth > 900) setOpen(true) }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  const closeIfMobile = () => { if (window.innerWidth <= 900) setOpen(false) }

  /* Live: notifications + activity arrive without a page reload. */
  useRealtime((evt, payload) => {
    if (evt === 'notification') {
      const n = payload as Notif | undefined
      if (n?.text) { playPing(); setToast(n.text); setTimeout(() => setToast(null), 6000) }
    }
    refetchNotifs()
  }, ['notification', 'activity.new', 'data.changed'], role)

  return (
    <div className="shell">
      {toast && (
        <div className="live-toast">
          <Icon name="bell" size={16} />
          <div><b>New notification</b><div className="t">{toast}</div></div>
        </div>
      )}
      <div className={`backdrop ${open ? 'show' : ''}`} onClick={() => setOpen(false)} />
      <aside className={`sidebar ${open ? '' : 'collapsed'}`}>
        <div className="brand">
          <img src="/logo.png" alt="Kebbi Clinic" />
          <div>
            <div className="name">Kebbi Clinic</div>
            <div className="sub">Hospital Staff App</div>
          </div>
        </div>
        <nav className="nav">
          {sections.map((s) => (
            <div key={s.section}>
              <div className="section">{s.section}</div>
              {s.items.map((it) => (
                <Link key={it.to} to={it.to} className={loc.pathname === it.to ? 'active' : ''} onClick={closeIfMobile}>
                  <Icon name={it.icon} /> {it.label}
                </Link>
              ))}
            </div>
          ))}
        </nav>
        <div className="user-box">
          <div className="avatar">{initials}</div>
          <div className="who">
            <div className="n">{user?.name || 'Staff'}</div>
            <div className="r">{role}</div>
          </div>
          <button title="Log out" onClick={() => { logout(); nav('/login') }} style={{ marginLeft: 'auto', color: '#9dc3ea', background: 'none', border: 'none', cursor: 'pointer' }}><Icon name="logout" /></button>
        </div>
      </aside>
      <div className="main">
        <div className="topbar">
          <button className="icon-btn hamburger" onClick={() => setOpen(!open)}><Icon name="menu" /></button>
          <div className="page-title">{title}</div>
          <div className="spacer" />
          <div style={{ position: 'relative' }}>
            <button className="icon-btn" onClick={() => setShowNotifs(!showNotifs)}>
              <Icon name="bell" />{notifs.length > 0 && <span className="dot" />}
            </button>
            {showNotifs && (
              <div className="notif-panel">
                {notifs.length === 0 && <div className="n-item">No notifications</div>}
                {notifs.map((n, i) => (
                  <div className="n-item" key={i}>
                    <Icon name="bell" size={15} />
                    <div>{n.text}<div className="t">{n.at}</div></div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="avatar" style={{ background: 'var(--blue-700)' }}>{initials}</div>
        </div>
        <div className="content">{children}</div>
      </div>
    </div>
  )
}