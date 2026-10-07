import { useEffect, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent, ReactNode } from 'react'
import { Icon, naira } from './ui'
import { api } from '../api'
import { patientApi } from '../endpoints'
import type { Patient } from '../data'

/** The one matching rule used by every search box on the accounting screens.
 *  Case-insensitive, and EVERY whitespace-separated term must match — so
 *  "amina bello", "245" and "080…" all find the record from one field. */
export function matchesFields(fields: (string | number | undefined | null)[], q: string): boolean {
  const terms = q.trim().toLowerCase().split(/\s+/).filter(Boolean)
  if (!terms.length) return true
  const haystack = fields.filter((f) => f !== undefined && f !== null && f !== '').join(' ').toLowerCase()
  return terms.every((t) => haystack.includes(t))
}

/** Match a patient on Patient ID, any part of the name, or phone.
 *  An accountant (and every other role) usually has either the KBC-… id or a
 *  name to hand, so one field has to find the record from both. */
export function matchesPatient(p: Patient, q: string): boolean {
  return matchesFields([p.id, p.firstName, p.otherName, p.surname, p.phone], q)
}

/** Filter a patient list with the same rule the search box uses. Only for
 *  lists that are already fully loaded (search boxes over server data should
 *  use server-side search instead). */
export function filterPatients(list: Patient[], q: string): Patient[] {
  return q.trim() ? list.filter((p) => matchesPatient(p, q)) : list
}

const MAX_SUGGESTIONS = 8

interface SearchBoxProps<T> {
  /** Rows to filter. Pass the already role-scoped list — the server decides. */
  items: T[]
  value: string
  onChange: (v: string) => void
  /** The searchable text of a row (id, name, reference, …). */
  fieldsOf: (item: T) => (string | number | undefined | null)[]
  keyOf: (item: T) => string
  /** What one row is called in the counter, e.g. "payment" → "12 payments". */
  noun: string
  placeholder?: string
  /** Shown while the box is empty. */
  hint?: ReactNode
  /** When given, a results list appears and picking a row runs this —
   *  e.g. open the fund dialog, or jump to the patient record. */
  onPick?: (item: T) => void
  /** How a suggested row is drawn. */
  renderRow?: (item: T) => ReactNode
}

/** Generic filter-as-you-type box with an optional "pick a result" dropdown.
 *  Backs every search on the Payments & Wallets screens so they all behave
 *  identically — the accountant only has to learn it once. */
export function SearchBox<T>({
  items, value, onChange, fieldsOf, keyOf, noun, onPick, renderRow,
  placeholder = 'Search…', hint,
}: SearchBoxProps<T>) {
  const [open, setOpen] = useState(false)
  const [cursor, setCursor] = useState(0)
  const box = useRef<HTMLDivElement>(null)

  const matches = useMemo(
    () => (value.trim() ? items.filter((i) => matchesFields(fieldsOf(i), value)) : items),
    [items, value, fieldsOf],
  )
  const typed = value.trim().length > 0
  const picks = typed ? matches.slice(0, MAX_SUGGESTIONS) : []
  const showMenu = !!onPick && !!renderRow && open && picks.length > 0

  /* Highlight the first suggestion whenever the query changes. */
  useEffect(() => { setCursor(0) }, [value])

  /* Close the results list when the click lands outside the field. */
  useEffect(() => {
    if (!showMenu) return
    const away = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', away)
    return () => document.removeEventListener('mousedown', away)
  }, [showMenu])

  const pick = (item: T) => {
    setOpen(false)
    onChange('')
    onPick?.(item)
  }

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') { setOpen(false); return }
    if (!showMenu) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setCursor((c) => Math.min(c + 1, picks.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setCursor((c) => Math.max(c - 1, 0)) }
    else if (e.key === 'Enter' && picks[cursor]) { e.preventDefault(); pick(picks[cursor]) }
  }

  const plural = (n: number) => `${n} ${noun}${n === 1 ? '' : 's'}`
  const summary = typed ? `${matches.length} of ${plural(items.length)}` : plural(items.length)

  return (
    <div className="patient-search" ref={box}>
      <div className="search-row">
        <div className="ps-field">
          <Icon name="search" size={16} />
          <input
            className="input"
            placeholder={placeholder}
            value={value}
            aria-label={`Search ${noun}s`}
            onChange={(e) => { onChange(e.target.value); setOpen(true) }}
            onFocus={() => setOpen(true)}
            onKeyDown={onKeyDown}
          />
          {typed && (
            <button className="ps-clear" title="Clear search" aria-label="Clear search" onClick={() => onChange('')}>×</button>
          )}
        </div>
        <span className="muted">{typed ? summary : (hint || summary)}</span>
      </div>

      {showMenu && (
        <div className="ps-menu">
          {picks.map((item, i) => (
            <button
              key={keyOf(item)}
              className={`ps-item${i === cursor ? ' active' : ''}`}
              onMouseEnter={() => setCursor(i)}
              onClick={() => pick(item)}
            >
              {renderRow!(item)}
            </button>
          ))}
          {matches.length > picks.length && (
            <div className="ps-more muted">+ {matches.length - picks.length} more — keep typing to narrow it down</div>
          )}
        </div>
      )}
    </div>
  )
}

/* How long the picker waits after the last keystroke before asking the server,
 * so "amina bello" costs one request, not eleven. */
const PICKER_DEBOUNCE_MS = 350
/* Matches the search-box dropdown cap; the *count* line always shows the
 * server's total, so the extra suggestion rows never hide results. */
const PICKER_SUGGESTIONS = 8

interface PatientPickerProps {
  /** The picked patient id ("" = none). */
  value: string
  onPick: (p: Patient | null) => void
  /** When set, the search is restricted, e.g. to Active patients. */
  status?: 'Active' | 'Inactive'
  /** Pre-select a known id (e.g. from ?patient=) without typing. */
  initialId?: string
  placeholder?: string
  label?: string
}

/** A patient picker that queries the server as you type — built for a register
 *  of 30,000, where a plain `<select>` is an endless scroll nobody can finish.
 *
 *  Type an ID fragment ("245"), a name ("amina"), or a phone number; the server
 *  answers with the first page of matches and every chooser on the screen
 *  (Consultation, Ward & Nursing, Procedures & Services) works off this one
 *  component. Selecting a row calls `onPick` with the full patient record.
 */
export function PatientPicker({
  value, onPick, status, initialId,
  placeholder = 'Type name, ID or phone…',
  label = 'Patient',
}: PatientPickerProps) {
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const [cursor, setCursor] = useState(0)
  const [rows, setRows] = useState<Patient[]>([])
  const [total, setTotal] = useState(0)
  const [busy, setBusy] = useState(false)
  const [picked, setPicked] = useState<Patient | null>(null)
  const box = useRef<HTMLDivElement>(null)

  /* Highlight the first suggestion whenever the query changes. */
  useEffect(() => { setCursor(0) }, [q])

  /* Close the results list when the click lands outside the field. */
  useEffect(() => {
    if (!open) return
    const away = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', away)
    return () => document.removeEventListener('mousedown', away)
  }, [open])

  /* Resolve a pre-selected id (dashboard "Consult" links) to its full record. */
  useEffect(() => {
    if (!initialId || initialId === picked?.id) return
    let live = true
    patientApi.search(initialId, { limit: 5 })
      .then((r) => {
        if (!live) return
        const hit = r.items.find((p) => p.id === initialId) || r.items[0] || null
        if (hit) { setPicked(hit); setQ(`${hit.firstName} ${hit.surname} — ${hit.id}`) }
      })
      .catch(() => { /* leave the field typable; the user can search instead */ })
    return () => { live = false }
  }, [initialId]) // eslint-disable-line react-hooks/exhaustive-deps

  /* When the parent clears the selection from outside, drop the shown record. */
  useEffect(() => {
    if (!value && picked) setPicked(null)
  }, [value]) // eslint-disable-line react-hooks/exhaustive-deps

  /* Debounced server search — one request per pause, never per keystroke. */
  useEffect(() => {
    const needle = q.trim()
    if (!needle) { setRows([]); setTotal(0); setBusy(false); return }
    setBusy(true)
    const t = setTimeout(() => {
      patientApi.search(needle, { status, limit: PICKER_SUGGESTIONS + 1 })
        .then((r) => { setRows(r.items); setTotal(r.total); setBusy(false) })
        .catch(() => { setRows([]); setTotal(0); setBusy(false) })
    }, PICKER_DEBOUNCE_MS)
    return () => clearTimeout(t)
  }, [q, status])

  const suggestions = rows.slice(0, PICKER_SUGGESTIONS)
  const showMenu = open && q.trim().length > 0
  const extra = Math.max(0, total - suggestions.length)

  const choose = (p: Patient | null) => {
    setOpen(false)
    if (p) {
      setPicked(p)
      setQ(`${p.firstName} ${p.surname} — ${p.id}`)
      setRows([])
    }
    onPick(p)
  }

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') { setOpen(false); return }
    if (e.key === 'ArrowDown' && suggestions.length) { e.preventDefault(); setCursor((c) => Math.min(c + 1, suggestions.length - 1)) }
    else if (e.key === 'ArrowUp' && suggestions.length) { e.preventDefault(); setCursor((c) => Math.max(c - 1, 0)) }
    else if (e.key === 'Enter' && suggestions[cursor]) { e.preventDefault(); choose(suggestions[cursor]) }
  }

  return (
    <div className="patient-search" ref={box}>
      <div className="search-row">
        <div className="ps-field" style={{ maxWidth: 420 }}>
          <Icon name="search" size={16} />
          <input
            className="input"
            placeholder={placeholder}
            value={picked && value ? `${picked.firstName} ${picked.surname} — ${picked.id}` : q}
            aria-label={`Search ${label.toLowerCase()}s`}
            onChange={(e) => { setQ(e.target.value); setPicked(null); onPick(null); setOpen(true) }}
            onFocus={() => setOpen(true)}
            onKeyDown={onKeyDown}
          />
          {(picked || q) && (
            <button
              className="ps-clear" title="Clear patient" aria-label="Clear patient"
              onClick={() => { setQ(''); setPicked(null); setRows([]); choose(null) }}
            >×</button>
          )}
        </div>
        <span className="muted">
          {busy ? 'Searching…' : q.trim() ? `${total} match${total === 1 ? '' : 'es'}` : 'Search by ID, name or phone'}
        </span>
      </div>

      {showMenu && (
        <div className="ps-menu">
          {suggestions.map((p, i) => (
            <button
              key={p.id}
              className={`ps-item${i === cursor ? ' active' : ''}`}
              onMouseEnter={() => setCursor(i)}
              onClick={() => choose(p)}
            >
              <span className="n">{p.firstName} {p.surname}</span>
              <span className="i">{p.id}</span>
              <span className="w money">{naira(p.wallet)}</span>
            </button>
          ))}
          {suggestions.length === 0 && !busy && (
            <div className="ps-more muted">No patient matches — check the spelling or the ID.</div>
          )}
          {extra > 0 && (
            <div className="ps-more muted">+ {extra} more — keep typing to narrow it down</div>
          )}
        </div>
      )}
    </div>
  )
}


/** Patient finder used on the Patients tab and the Patient Wallets tab. */
export function PatientSearch({
  patients, value, onChange, onPick,
  placeholder = 'Search by Patient ID, Name or Phone…',
  hint,
}: {
  patients: Patient[]; value: string; onChange: (v: string) => void
  placeholder?: string; hint?: ReactNode; onPick?: (p: Patient) => void
}) {
  return (
    <SearchBox<Patient>
      items={patients}
      value={value}
      onChange={onChange}
      onPick={onPick}
      noun="patient"
      placeholder={placeholder}
      hint={hint}
      keyOf={(p) => p.id}
      fieldsOf={(p) => [p.id, p.firstName, p.otherName, p.surname, p.phone]}
      renderRow={(p) => (
        <>
          <span className="n">{p.firstName} {p.surname}</span>
          <span className="i">{p.id}</span>
          <span className="w money">{naira(p.wallet)}</span>
        </>
      )}
    />
  )
}