import { useState } from 'react'
import { saveLaborRates, saveMonthlyOverhead } from '../lib/laborRates'

function draftFrom(rows) {
  return (rows || []).map((row) => ({
    id: row.id,
    name: row.name,
    hourly: row.hourly == null ? '' : commaNumber(row.hourly),
    workerType: row.worker_type === 'contractor' ? 'contractor' : 'employee',
    weeklyCapacity: row.weekly_capacity == null || row.weekly_capacity === '' ? '40' : String(row.weekly_capacity),
    role: row.role || '',
  }))
}

function commaNumber(value) {
  const cleaned = String(value ?? '').replace(/[^0-9.]/g, '')
  if (!cleaned) return ''
  const [whole, fraction] = cleaned.split('.')
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return fraction != null && fraction !== '' ? `${grouped}.${fraction.slice(0, 2)}` : grouped
}

function overheadText(value) {
  return value == null || value === '' ? '' : commaNumber(value)
}

export default function LaborRates({ rows, fallback, overhead, fallbackOverhead, missing, overheadMissing, profileReady = true, onSaved, alwaysOpen = false }) {
  const editable = Array.isArray(rows)
  const overheadEditable = editable && !overheadMissing
  const startingOverhead = overhead != null ? overhead : fallbackOverhead
  const [open, setOpen] = useState(alwaysOpen)
  const [draft, setDraft] = useState(() => draftFrom(editable ? rows : fallback))
  const [overheadDraft, setOverheadDraft] = useState(() => overheadText(startingOverhead))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  function update(index, field, value) {
    setSaved(false)
    setDraft((current) => current.map((row, rowIndex) => (
      rowIndex === index ? { ...row, [field]: value } : row
    )))
  }

  async function save() {
    const cleaned = draft.map((row) => ({
      id: row.id,
      name: row.name.trim(),
      hourly: String(row.hourly).replace(/[$,]/g, ''),
      workerType: row.workerType === 'contractor' ? 'contractor' : 'employee',
      weeklyCapacity: row.weeklyCapacity,
      role: row.role,
    }))
    if (cleaned.some((row) => !row.name)) {
      setError('Every person needs a name.')
      return
    }
    if (cleaned.some((row) => !(Number(String(row.hourly).replace(/[$,]/g, '')) > 0))) {
      setError('Every hourly cost has to be greater than 0.')
      return
    }
    if (cleaned.some((row) => row.workerType === 'employee' && !(Number(row.weeklyCapacity) > 0))) {
      setError('Weekly hours for an employee have to be greater than 0.')
      return
    }
    const overheadAmount = Number(String(overheadDraft).replace(/[$,]/g, ''))
    if (overheadEditable && !(overheadAmount >= 0)) {
      setError('Monthly overhead has to be 0 or more.')
      return
    }
    const names = cleaned.map((row) => row.name.toLowerCase())
    if (new Set(names).size !== names.length) {
      setError('Two rows have the same name.')
      return
    }
    setSaving(true)
    setError('')
    try {
      const savedRates = await saveLaborRates(cleaned)
      const savedRows = savedRates.rows
      const savedOverhead = overheadEditable ? await saveMonthlyOverhead(overheadAmount) : overhead
      onSaved(savedRows, savedOverhead)
      setDraft(draftFrom(savedRows))
      setOverheadDraft(overheadText(savedOverhead != null ? savedOverhead : startingOverhead))
      if (!savedRates.profileSaved) {
        setError('Hourly costs saved, but type, weekly hours, and role did not save.')
        setSaved(false)
      } else {
        setSaved(true)
      }
    } catch (err) {
      setError(err.message || 'Could not save hourly costs')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="pr-panel pr-rates">
      <div className="pr-panel-head">
        <h3>Costs</h3>
        {alwaysOpen ? null : (
          <button type="button" className="pr-rates-toggle" onClick={() => setOpen((value) => !value)}>
            {open ? 'Hide' : 'Edit'}
          </button>
        )}
      </div>
      {alwaysOpen || open ? (
        <>
          {missing || overheadMissing ? (
            <p className="pr-note">
              These numbers are still read from the cost sheet. In Supabase, open the SQL editor and run supabase/labor-rates.sql once. Then they can be edited here.
            </p>
          ) : (
            <p className="pr-note">
              Profitability uses these hourly costs and the monthly overhead. Hours still come from Tempo. Team uses type, weekly hours, and role. Weekly hours are for employees and start at 40.
            </p>
          )}
          <label className="pr-rates-overhead">
            <span>Monthly overhead</span>
            <input
              aria-label="Monthly overhead"
              inputMode="decimal"
              value={overheadDraft}
              disabled={!overheadEditable || saving}
              onChange={(event) => {
                setSaved(false)
                setOverheadDraft(commaNumber(event.target.value))
              }}
            />
          </label>
          <p className="pr-rates-label">People</p>
          <div className="pr-rates-grid">
            <div className="pr-rates-head">
              <span>Name</span>
              <span>Type</span>
              <span>Role</span>
              <span>Weekly hours</span>
              <span>Hourly cost</span>
              <span />
            </div>
            {draft.map((row, index) => (
              <div className="pr-rates-row" key={row.id || `new-${index}`}>
                <input
                  aria-label="Name"
                  value={row.name}
                  disabled={!editable || saving}
                  onChange={(event) => update(index, 'name', event.target.value)}
                />
                <select
                  aria-label={`Type for ${row.name || 'person'}`}
                  value={row.workerType}
                  disabled={!editable || saving}
                  onChange={(event) => update(index, 'workerType', event.target.value)}
                >
                  <option value="employee">Employee</option>
                  <option value="contractor">Contractor</option>
                </select>
                <input
                  aria-label={`Role for ${row.name || 'person'}`}
                  value={row.role}
                  placeholder="Optional"
                  disabled={!editable || saving}
                  onChange={(event) => update(index, 'role', event.target.value)}
                />
                <input
                  aria-label={`Weekly hours for ${row.name || 'person'}`}
                  inputMode="decimal"
                  value={row.workerType === 'contractor' ? '' : row.weeklyCapacity}
                  placeholder={row.workerType === 'contractor' ? '—' : '40'}
                  disabled={!editable || saving || row.workerType === 'contractor'}
                  onChange={(event) => update(index, 'weeklyCapacity', event.target.value)}
                />
                <input
                  aria-label={`Hourly cost for ${row.name || 'person'}`}
                  inputMode="decimal"
                  value={row.hourly}
                  disabled={!editable || saving}
                  onChange={(event) => update(index, 'hourly', commaNumber(event.target.value))}
                />
                {editable ? (
                  <button
                    type="button"
                    className="pr-rates-remove"
                    disabled={saving}
                    onClick={() => {
                      setSaved(false)
                      setDraft((current) => current.filter((_, rowIndex) => rowIndex !== index))
                    }}
                  >
                    Remove
                  </button>
                ) : null}
              </div>
            ))}
          </div>
          {editable ? (
            <div className="pr-rates-actions">
              <button
                type="button"
                disabled={saving}
                onClick={() => {
                  setSaved(false)
                  setDraft((current) => [...current, { name: '', hourly: '', workerType: 'employee', weeklyCapacity: '40', role: '' }])
                }}
              >
                Add person
              </button>
              <button type="button" className="pr-rates-save" disabled={saving} onClick={save}>
                {saving ? 'Saving…' : 'Save'}
              </button>
              {saved ? <span>Saved</span> : null}
            </div>
          ) : null}
          {error ? <p className="pr-rates-error">{error}</p> : null}
        </>
      ) : null}
    </section>
  )
}
