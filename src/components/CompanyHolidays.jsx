import { useState } from 'react'
import { holidayPreview, losAngelesToday } from '../lib/announcements'
import { COMMON_US_HOLIDAYS, holidayRuleFromRow, saveCompanyHolidays } from '../lib/companyHolidays'
import '../profitability.css'

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const NTHS = ['1st', '2nd', '3rd', '4th']

function blankHoliday() {
  return { name: '', notes: '', repeatRule: 'none', startDate: '', month: '', day: '', weekday: '', nth: '', lengthDays: 1 }
}

function draftFrom(rows) {
  return (rows || []).map((row) => ({ id: row.id, ...holidayRuleFromRow(row) }))
}

export default function CompanyHolidays({ rows, missing, columnsMissing, onSaved }) {
  const editable = Array.isArray(rows) && !missing && !columnsMissing
  const today = losAngelesToday()
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(() => draftFrom(rows))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  function update(index, field, value) {
    setSaved(false)
    setDraft((current) => current.map((row, rowIndex) => (rowIndex === index ? { ...row, [field]: value } : row)))
  }

  function validate(cleaned) {
    if (cleaned.some((row) => !row.name)) return 'Every holiday needs a name.'
    if (cleaned.some((row) => !Number.isInteger(Number(row.lengthDays)) || Number(row.lengthDays) < 1)) return 'Days off has to be at least 1.'
    if (cleaned.some((row) => row.repeatRule === 'none' && !/^\d{4}-\d{2}-\d{2}$/.test(row.startDate))) return 'One-time holidays need a date.'
    if (cleaned.some((row) => row.repeatRule === 'fixed' && (Number(row.month) < 1 || Number(row.day) < 1 || Number(row.day) > 31))) return 'Same-date holidays need a month and a day from 1 to 31.'
    if (cleaned.some((row) => row.repeatRule === 'nth_weekday' && (row.month === '' || row.weekday === '' || row.nth === ''))) return 'Nth weekday holidays need a month, a weekday, and which week.'
    if (cleaned.some((row) => row.repeatRule === 'last_weekday' && (row.month === '' || row.weekday === ''))) return 'Last weekday holidays need a month and a weekday.'
    return ''
  }

  async function saveRows(next) {
    const problem = validate(next)
    if (problem) {
      setError(problem)
      return
    }
    setSaving(true)
    setError('')
    try {
      const savedRows = await saveCompanyHolidays(next)
      onSaved(savedRows)
      setDraft(draftFrom(savedRows))
      setSaved(true)
    } catch (err) {
      setError(err.message || 'Could not save holidays')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="pr-panel pr-rates">
      <div className="pr-panel-head">
        <h3>Company holidays</h3>
        <button type="button" className="pr-rates-toggle" onClick={() => setOpen((value) => !value)}>
          {open ? 'Hide' : 'Edit'}
        </button>
      </div>
      {open ? (
        <>
          {missing ? (
            <p className="pr-note">In Supabase, open the SQL editor and run supabase/announcements.sql once. Then holidays can be edited here.</p>
          ) : null}
          {columnsMissing ? (
            <p className="pr-note">In Supabase, open the SQL editor and run supabase/holidays-recurring.sql. Then each holiday can repeat every year.</p>
          ) : null}
          {editable ? (
            <p className="pr-note">Enter each holiday once. Yearly rules come back on their own. Days off is how long the office is closed, starting on that date.</p>
          ) : null}
          <div className="an-holiday-list">
            {draft.map((row, index) => {
              const preview = holidayPreview(row, today)
              return (
                <div className="an-holiday" key={row.id || `new-${index}`}>
                  <div className="an-holiday-fields">
                    <label>
                      Name
                      <input aria-label="Holiday name" value={row.name} disabled={!editable || saving} onChange={(event) => update(index, 'name', event.target.value)} />
                    </label>
                    <label>
                      Repeats
                      <select aria-label={`Repeats for ${row.name || 'holiday'}`} value={row.repeatRule} disabled={!editable || saving} onChange={(event) => update(index, 'repeatRule', event.target.value)}>
                        <option value="none">One time</option>
                        <option value="fixed">Same date every year</option>
                        <option value="nth_weekday">Nth weekday of month</option>
                        <option value="last_weekday">Last weekday of month</option>
                      </select>
                    </label>
                    {row.repeatRule === 'none' ? (
                      <label>
                        Date
                        <input aria-label={`Date for ${row.name || 'holiday'}`} type="date" value={row.startDate} disabled={!editable || saving} onChange={(event) => update(index, 'startDate', event.target.value)} />
                      </label>
                    ) : null}
                    {row.repeatRule === 'nth_weekday' ? (
                      <label>
                        Week
                        <select aria-label={`Week for ${row.name || 'holiday'}`} value={row.nth} disabled={!editable || saving} onChange={(event) => update(index, 'nth', event.target.value)}>
                          <option value="">Week</option>
                          {NTHS.map((label, nth) => <option key={label} value={nth + 1}>{label}</option>)}
                        </select>
                      </label>
                    ) : null}
                    {row.repeatRule === 'nth_weekday' || row.repeatRule === 'last_weekday' ? (
                      <label>
                        Weekday
                        <select aria-label={`Weekday for ${row.name || 'holiday'}`} value={row.weekday} disabled={!editable || saving} onChange={(event) => update(index, 'weekday', event.target.value)}>
                          <option value="">Weekday</option>
                          {WEEKDAYS.map((label, weekday) => <option key={label} value={weekday}>{label}</option>)}
                        </select>
                      </label>
                    ) : null}
                    {row.repeatRule !== 'none' ? (
                      <label>
                        Month
                        <select aria-label={`Month for ${row.name || 'holiday'}`} value={row.month} disabled={!editable || saving} onChange={(event) => update(index, 'month', event.target.value)}>
                          <option value="">Month</option>
                          {MONTHS.map((label, month) => <option key={label} value={month + 1}>{label}</option>)}
                        </select>
                      </label>
                    ) : null}
                    {row.repeatRule === 'fixed' ? (
                      <label>
                        Day
                        <input aria-label={`Day for ${row.name || 'holiday'}`} type="number" min="1" max="31" value={row.day} disabled={!editable || saving} onChange={(event) => update(index, 'day', event.target.value)} />
                      </label>
                    ) : null}
                    <label>
                      Days off
                      <input aria-label={`Days off for ${row.name || 'holiday'}`} type="number" min="1" value={row.lengthDays} disabled={!editable || saving} onChange={(event) => update(index, 'lengthDays', event.target.value)} />
                    </label>
                    <label>
                      Notes
                      <input aria-label={`Notes for ${row.name || 'holiday'}`} value={row.notes} placeholder="Optional" disabled={!editable || saving} onChange={(event) => update(index, 'notes', event.target.value)} />
                    </label>
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
                  {preview ? <p className="an-holiday-preview">{preview}</p> : null}
                </div>
              )
            })}
          </div>
          {editable ? (
            <div className="pr-rates-actions">
              {!rows.length && !draft.length ? (
                <button type="button" disabled={saving} onClick={() => saveRows(COMMON_US_HOLIDAYS)}>
                  {saving ? 'Saving…' : 'Load common US holidays'}
                </button>
              ) : null}
              <button
                type="button"
                disabled={saving}
                onClick={() => {
                  setSaved(false)
                  setDraft((current) => [...current, blankHoliday()])
                }}
              >
                Add holiday
              </button>
              <button type="button" className="pr-rates-save" disabled={saving} onClick={() => saveRows(draft)}>
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
