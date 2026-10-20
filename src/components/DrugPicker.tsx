import { useEffect, useMemo, useRef, useState } from 'react'
import { matchesFields } from './PatientSearch'
import { naira } from './ui'
import type { Drug } from '../data'

/**
 * Searchable drug dropdown for the Consultation prescription table.
 * Type to filter by name / category / id, ArrowUp/Down + Enter to pick,
 * Esc or click-away to close. Out-of-stock drugs are shown but disabled.
 */
export function DrugPicker({
  drugs,
  value,
  onChange,
  placeholder = 'Select drug… type to search',
}: {
  drugs: Drug[]
  value: string
  onChange: (drugId: string) => void
  placeholder?: string
}) {
  const selected = useMemo(() => drugs.find((d) => d.id === value), [drugs, value])
  const [q, setQ] = useState(selected?.name || '')
  const [open, setOpen] = useState(false)
  const [cursor, setCursor] = useState(0)
  const box = useRef<HTMLDivElement>(null)

  /* Keep the text in sync when the row value changes from outside
     (new row added, drug picked in another way, list loads). */
  useEffect(() => {
    setQ(selected?.name || '')
  }, [selected?.name, value])

  const matches = useMemo(() => {
    const query = q.trim()
    if (!query) return drugs
    /* When the box shows the picked drug's full name, show the whole
       catalogue on focus so the doctor can browse — only filter once
       they start typing something different. */
    if (selected && query.toLowerCase() === selected.name.toLowerCase()) return drugs
    return drugs.filter((d) => matchesFields([d.name, d.category, d.id, d.unit], query))
  }, [drugs, q, selected])

  /* Only in-stock drugs are pickable; cursor moves over those. */
  const pickable = useMemo(() => matches.filter((d) => d.stock !== 0), [matches])

  useEffect(() => { setCursor(0) }, [q])

  useEffect(() => {
    if (!open) return
    const away = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) {
        setOpen(false)
        /* If they typed gibberish and clicked away, snap back to the picked drug. */
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

  const choose = (d: Drug) => {
    if (d.stock === 0) return
    onChange(d.id)
    setQ(d.name)
    setOpen(false)
  }

  return (
    <div className="combo" ref={box}>
      <input
        className="input combo-input"
        placeholder={drugs.length ? placeholder : 'No drugs in inventory…'}
        value={q}
        aria-label="Search drugs"
        autoComplete="off"
        onChange={(e) => {
          setQ(e.target.value)
          setOpen(true)
          if (e.target.value.trim() === '') onChange('')
        }}
        onFocus={(e) => {
          setOpen(true)
          /* Highlight the text so typing immediately starts a fresh search. */
          requestAnimationFrame(() => e.target.select())
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' && pickable.length) {
            e.preventDefault()
            setOpen(true)
            setCursor((c) => Math.min(c + 1, pickable.length - 1))
          } else if (e.key === 'ArrowUp' && pickable.length) {
            e.preventDefault()
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
          title="Clear drug"
          aria-label="Clear drug"
          type="button"
          onClick={() => { setQ(''); onChange(''); setOpen(true) }}
        >×</button>
      )}
      {open && (
        <div className="combo-menu" role="listbox">
          {matches.length === 0 && (
            <div className="ps-more muted">No drug matches “{q.trim()}” — check the spelling.</div>
          )}
          {matches.map((d) => {
            const out = d.stock === 0
            const isActive = pickable[cursor]?.id === d.id
            return (
              <button
                key={d.id}
                type="button"
                role="option"
                aria-selected={d.id === value}
                disabled={out}
                className={`ps-item${isActive ? ' active' : ''}${out ? ' disabled' : ''}`}
                onMouseEnter={() => {
                  const i = pickable.findIndex((p) => p.id === d.id)
                  if (i >= 0) setCursor(i)
                }}
                /* mousedown fires before the click-away handler closes the menu */
                onMouseDown={(e) => { e.preventDefault(); choose(d) }}
              >
                <span className="n">{d.name}</span>
                <span className="i">{d.category} · stock {d.stock}</span>
                <span className="w money">{naira(d.price)}</span>
                {out && <span className="i"> · out of stock</span>}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
