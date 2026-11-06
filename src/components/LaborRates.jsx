import { useState } from 'react'
import { saveLaborRates, saveMonthlyOverhead } from '../lib/laborRates'

function draftFrom(rows) {
  return (rows || []).map((row) => ({
    id: row.id,
    name: row.name,
    hourly: row.hourly == null ? '' : String(row.hourly),
  }))
}

function overheadText(value) {
  return value == null || value === '' ? '' : String(value)
}

export default function LaborRates({ rows, fallback, overhead, fallbackOverhead, missing, overheadMissing, onSaved, alwaysOpen = false }) {
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
      hourly: row.hourly,
    }))
    if (cleaned.some((row) => !row.name)) {
      setError('Every person needs a name.')
      return
    }
    if (cleaned.some((row) => !(Number(row.hourly) > 0))) {
      setError('Every hourly cost has to be greater than 0.')
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
      const savedRows = await saveLaborRates(cleaned)
      const savedOverhead = overheadEditable ? await saveMonthlyOverhead(overheadAmount) : overhead
      onSaved(savedRows, savedOverhead)
      setDraft(draftFrom(savedRows))
      setOverheadDraft(overheadText(savedOverhead != null ? savedOverhead : startingOverhead))
      setSaved(true)
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
            <p className="pr-note">Profitability uses these hourly costs and the monthly overhead. Hours still come from Tempo.</p>
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
                setOverheadDraft(event.target.value)
              }}
            />
          </label>
          <p className="pr-rates-label">Employee costs</p>
          <div className="pr-rates-grid">
            {draft.map((row, index) => (
              <div className="pr-rates-row" key={row.id || `new-${index}`}>
                <input
                  aria-label="Name"
                  value={row.name}
                  disabled={!editable || saving}
                  onChange={(event) => update(index, 'name', event.target.value)}
                />
                <input
                  aria-label={`Hourly cost for ${row.name || 'person'}`}
                  inputMode="decimal"
                  value={row.hourly}
                  disabled={!editable || saving}
                  onChange={(event) => update(index, 'hourly', event.target.value)}
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
                  setDraft((current) => [...current, { name: '', hourly: '' }])
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
