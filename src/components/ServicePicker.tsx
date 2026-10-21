import { useEffect, useMemo, useRef, useState } from 'react'
import { matchesFields } from './PatientSearch'
import { naira } from './ui'
import type { Service } from '../data'

/**
 * Searchable procedure / service dropdown for the Services page.
 * Type to filter by name / category / id / department, ArrowUp/Down + Enter
 * to pick, Esc or click-away to close. Inactive services are shown but disabled.
 */
export function ServicePicker({
  services,
  value,
  onChange,
  placeholder = 'Select procedure / service… type to search',
}: {
  services: Service[]
  value: string
  onChange: (serviceId: string) => void
  placeholder?: string
}) {
  const selected = useMemo(() => services.find((s) => s.id === value), [services, value])
  const [q, setQ] = useState(selected?.name || '')
  const [open, setOpen] = useState(false)
  const [cursor, setCursor] = useState(0)
  const box = useRef<HTMLDivElement>(null)

  /* Keep the text in sync when the row value changes from outside
     (new row added, service picked in another way, list loads). */
  useEffect(() => {
    setQ(selected?.name || '')
  }, [selected?.name, value])

  const matches = useMemo(() => {
    const query = q.trim()
    if (!query) return services
    /* When the box shows the picked service's full name, show the whole
       catalogue on focus so the user can browse — only filter once they
       start typing something different. */
    if (selected && query.toLowerCase() === selected.name.toLowerCase()) return services
    return services.filter((s) => matchesFields([s.name, s.category, s.id, s.department], query))
  }, [services, q, selected])

  /* Only active services are pickable; cursor moves over those. */
  const pickable = useMemo(() => matches.filter((s) => s.active !== false), [matches])

  useEffect(() => { setCursor(0) }, [q])

  useEffect(() => {
    if (!open) return
    const away = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) {
        setOpen(false)
        /* If they typed gibberish and clicked away, snap back to the picked service. */
        setQ(selected?.name || '')
      }
    }
    const esc = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false)
        setQ(selected?.name || '')
      }
    }
    document.addEventListener('mousedown', away)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('mousedown', away)
      document.removeEventListener('keydown', esc)
    }
  }, [open, selected?.name])

  const choose = (s: Service) => {
    if (s.active === false) return
    onChange(s.id)
    setQ(s.name)
    setOpen(false)
  }

  return (
    <div className="combo" ref={box}>
      <input
        className="input combo-input"
        placeholder={services.length ? placeholder : 'No procedures or services configured…'}
        value={q}
        aria-label="Search procedures / services"
        autoComplete="off"
        onChange={(e) => {
          setQ(e.target.value)
          setOpen(true)
          if (e.target.value.trim() === '') onChange('')
        }}
        onFocus={(e) => {
          setOpen(true)
          requestAnimationFrame(() => e.target.select())
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' && pickable.length) {
            e.preventDefault()
            setOpen(true)
            setCursor((c) => Math.min(c + 1, pickable.length - 1))
          } else if (e.key === 'ArrowUp' && pickable.length) {
            e.preventDefault()
            setOpen(true)
            setCursor((c) => Math.max(c - 1, 0))
          } else if (e.key === 'Enter' && open && pickable[cursor]) {
            e.preventDefault()
            choose(pickable[cursor])
          }
        }}
      />
      <span className="combo-chev" aria-hidden>▾</span>
      {q && (
        <button
          className="ps-clear"
          title="Clear service"
          aria-label="Clear service"
          type="button"
          onClick={() => { setQ(''); onChange(''); setOpen(true) }}
        >×</button>
      )}
      {open && (
        <div className="combo-menu" role="listbox">
          {matches.length === 0 && (
            <div className="ps-more muted">No service matches “{q.trim()}” — check the spelling.</div>
          )}
          {matches.map((s) => {
            const inactive = s.active === false
            const isActive = pickable[cursor]?.id === s.id
            return (
              <button
                key={s.id}
                type="button"
                role="option"
                aria-selected={s.id === value}
                disabled={inactive}
                className={`ps-item${isActive ? ' active' : ''}${inactive ? ' disabled' : ''}`}
                onMouseEnter={() => {
                  const i = pickable.findIndex((p) => p.id === s.id)
                  if (i >= 0) setCursor(i)
                }}
                onMouseDown={(e) => { e.preventDefault(); choose(s) }}
              >
                <span className="n">{s.name}</span>
                <span className="i">{s.category} · {s.department}</span>
                <span className="w money">{naira(s.amount)}</span>
                {inactive && <span className="i"> · inactive</span>}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}