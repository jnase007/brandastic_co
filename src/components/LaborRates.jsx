import { useMemo, useState } from 'react'
import { Loader2, Plus, Trash2 } from 'lucide-react'
import { saveLaborRates, saveMonthlyOverhead } from '../lib/laborRates'
import PageHeader from './PageHeader'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { cn } from '../lib/utils'

const WEEKS_PER_MONTH = 52 / 12

function money(value) {
  if (value == null || Number.isNaN(value)) return '—'
  return value.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

function hourlyNumber(row) {
  return Number(String(row.hourly ?? '').replace(/[$,]/g, '')) || 0
}

function plannedMonthly(row) {
  const hourly = hourlyNumber(row)
  const weekly = Number(row.weeklyCapacity) || 0
  if (!(hourly > 0) || !(weekly > 0)) return 0
  return hourly * weekly * WEEKS_PER_MONTH
}

function plannedAnnual(row) {
  return plannedMonthly(row) * 12
}

function draftFrom(rows) {
  return (rows || []).map((row) => ({
    id: row.id,
    name: row.name,
    hourly: row.hourly == null ? '' : commaNumber(row.hourly),
    workerType: row.worker_type === 'contractor' ? 'contractor' : 'employee',
    weeklyCapacity: row.weekly_capacity == null || row.weekly_capacity === '' ? '40' : String(row.weekly_capacity),
    birthday: dateInput(row.birthday),
    startDate: dateInput(row.start_date),
    showOnAnnouncements: row.show_on_announcements !== false,
  }))
}

function commaNumber(value) {
  const cleaned = String(value ?? '').replace(/[^0-9.]/g, '')
  if (!cleaned) return ''
  const [whole, fraction] = cleaned.split('.')
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return fraction != null && fraction !== '' ? `${grouped}.${fraction.slice(0, 2)}` : grouped
}

function dateInput(value) {
  const text = String(value || '')
  return /^\d{4}-\d{2}-\d{2}/.test(text) ? text.slice(0, 10) : ''
}

function todayIso() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles' }).format(new Date())
}

function addDays(iso, days) {
  const [year, month, day] = iso.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day + days))
  return date.toISOString().slice(0, 10)
}

function overheadText(value) {
  return value == null || value === '' ? '' : commaNumber(value)
}

const fieldClass = 'h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm shadow-sm focus-visible:ring-[#FF6B00]/40'
const moneyWrap = 'flex h-10 items-center rounded-lg border border-slate-200 bg-white shadow-sm focus-within:ring-2 focus-within:ring-[#FF6B00]/40'

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

  const costs = useMemo(() => {
    let employeeTotal = 0
    let contractorTotal = 0
    for (const row of draft) {
      if (row.workerType === 'contractor') contractorTotal += plannedMonthly(row)
      else employeeTotal += plannedMonthly(row)
    }
    const overheadAmount = Number(String(overheadDraft).replace(/[$,]/g, '')) || 0
    return {
      employeeTotal,
      contractorTotal,
      peopleTotal: employeeTotal + contractorTotal,
      overheadAmount,
      companyTotal: employeeTotal + contractorTotal + overheadAmount,
    }
  }, [draft, overheadDraft])

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
      birthday: row.birthday,
      startDate: row.startDate,
      showOnAnnouncements: row.showOnAnnouncements,
    }))
    if (cleaned.some((row) => !row.name)) {
      setError('Every person needs a name.')
      return
    }
    if (cleaned.some((row) => !(Number(String(row.hourly).replace(/[$,]/g, '')) > 0))) {
      setError('Every hourly cost has to be greater than 0.')
      return
    }
    if (cleaned.some((row) => !(Number(row.weeklyCapacity) > 0))) {
      setError('Weekly hours have to be greater than 0.')
      return
    }
    const latestStart = addDays(todayIso(), 60)
    if (cleaned.some((row) => row.startDate && row.startDate > latestStart)) {
      setError('Start date can\'t be more than 60 days in the future.')
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
        setError('Hourly costs saved, but type and weekly hours did not save.')
        setSaved(false)
      } else if (savedRates.announceSaved === false) {
        setError('Hourly costs saved, but birthday and start date did not save.')
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
    <section className="space-y-6">
      <PageHeader
        title="People"
        description="Monthly updates as you type weekly hours. Hourly × weekly × 52 / 12. Then Save people."
        actions={alwaysOpen ? null : (
          <Button variant="outline" type="button" onClick={() => setOpen((value) => !value)}>
            {open ? 'Hide' : 'Edit'}
          </Button>
        )}
      />
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">What you pay the team</p>
        <div className="mt-3 grid gap-6 sm:grid-cols-2">
          <div>
            <p className="text-sm text-slate-500">Monthly</p>
            <p className="text-3xl font-semibold tabular-nums">{money(costs.peopleTotal)}</p>
          </div>
          <div>
            <p className="text-sm text-slate-500">Annual</p>
            <p className="text-3xl font-semibold tabular-nums">{money(costs.peopleTotal * 12)}</p>
          </div>
        </div>
        <p className="mt-3 text-sm text-slate-500">
          With overhead: {money(costs.companyTotal)} / mo · {money(costs.companyTotal * 12)} / yr
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Employees</p>
          <p className="mt-1 text-xl font-semibold tabular-nums">{money(costs.employeeTotal)} / mo</p>
          <p className="text-sm tabular-nums text-slate-500">{money(costs.employeeTotal * 12)} / yr</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Contractors</p>
          <p className="mt-1 text-xl font-semibold tabular-nums">{money(costs.contractorTotal)} / mo</p>
          <p className="text-sm tabular-nums text-slate-500">{money(costs.contractorTotal * 12)} / yr</p>
        </div>
      </div>

      {alwaysOpen || open ? (
        <>
          {missing || overheadMissing ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
              These numbers are still read from the cost sheet. Run supabase/labor-rates.sql once, then they can be edited here.
            </div>
          ) : null}

          <div className="max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-base font-semibold">Company settings</h2>
            <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Monthly overhead</p>
            <p className="mt-1 text-sm text-slate-500">Rent, tools, and everything that isn’t a person on this list.</p>
            <div className={cn(moneyWrap, 'mt-4 max-w-xs')}>
              <span className="pl-3 text-slate-400">$</span>
              <input
                aria-label="Monthly overhead"
                inputMode="decimal"
                className="h-10 flex-1 border-0 bg-transparent px-2 text-lg font-semibold tabular-nums outline-none"
                value={overheadDraft}
                disabled={!overheadEditable || saving}
                onChange={(event) => {
                  setSaved(false)
                  setOverheadDraft(commaNumber(event.target.value))
                }}
              />
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b px-5 py-4">
              <div>
                <h2 className="text-base font-semibold">People</h2>
                <p className="text-sm text-slate-500">{draft.length} people</p>
              </div>
              {editable ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={saving}
                  onClick={() => {
                    setSaved(false)
                    setDraft((current) => [...current, { name: '', hourly: '', workerType: 'employee', weeklyCapacity: '40', birthday: '', startDate: '', showOnAnnouncements: true }])
                  }}
                >
                  <Plus className="mr-1 h-4 w-4" />
                  Add person
                </Button>
              ) : null}
            </div>
            <div>
              {draft.map((row, index) => (
                <div key={row.id || `new-${index}`} className="space-y-3 border-t px-5 py-4">
                  <div className="grid items-end gap-3 md:grid-cols-[minmax(0,1.5fr)_140px_130px_150px_110px_110px_auto]">
                    <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Name
                      <Input
                        className={cn(fieldClass, 'mt-1')}
                        aria-label="Name"
                        value={row.name}
                        disabled={!editable || saving}
                        onChange={(event) => update(index, 'name', event.target.value)}
                      />
                      <p className="mt-1 text-sm font-semibold tabular-nums text-slate-700">
                        {money(plannedMonthly(row))} / mo · {money(plannedAnnual(row))} / yr
                      </p>
                    </label>
                    <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Type
                      <select
                        aria-label={`Type for ${row.name || 'person'}`}
                        className={cn(fieldClass, 'mt-1 w-full')}
                        value={row.workerType}
                        disabled={!editable || saving}
                        onChange={(event) => update(index, 'workerType', event.target.value)}
                      >
                        <option value="employee">Employee</option>
                        <option value="contractor">Contractor</option>
                      </select>
                    </label>
                    <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Weekly hours
                      <Input
                        className={cn(fieldClass, 'mt-1')}
                        aria-label={`Weekly hours for ${row.name || 'person'}`}
                        inputMode="decimal"
                        value={row.weeklyCapacity}
                        placeholder={row.workerType === 'contractor' ? 'typical' : '40'}
                        disabled={!editable || saving}
                        onChange={(event) => update(index, 'weeklyCapacity', event.target.value)}
                      />
                    </label>
                    <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Hourly cost
                      <div className={cn(moneyWrap, 'mt-1')}>
                        <span className="pl-3 text-slate-400">$</span>
                        <input
                          aria-label={`Hourly cost for ${row.name || 'person'}`}
                          inputMode="decimal"
                          className="h-10 w-full border-0 bg-transparent px-2 font-medium tabular-nums outline-none"
                          value={row.hourly}
                          disabled={!editable || saving}
                          onChange={(event) => update(index, 'hourly', commaNumber(event.target.value))}
                        />
                      </div>
                    </label>
                    <div className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Monthly
                      <p className="mt-2 text-sm font-semibold tabular-nums text-slate-900">
                        {money(plannedMonthly(row))}
                      </p>
                    </div>
                    <div className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Annual
                      <p className="mt-2 text-sm font-semibold tabular-nums text-slate-900">
                        {money(plannedAnnual(row))}
                      </p>
                    </div>
                    {editable ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-slate-400 hover:text-red-600"
                        disabled={saving}
                        aria-label={`Remove ${row.name || 'person'}`}
                        onClick={() => {
                          setSaved(false)
                          setDraft((current) => current.filter((_, rowIndex) => rowIndex !== index))
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    ) : <span />}
                  </div>
                  <div className="grid items-end gap-3 md:grid-cols-[180px_180px_auto]">
                    <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Birthday
                      <Input
                        className={cn(fieldClass, 'mt-1')}
                        type="date"
                        aria-label={`Birthday for ${row.name || 'person'}`}
                        value={row.birthday || ''}
                        disabled={!editable || saving}
                        onChange={(event) => update(index, 'birthday', event.target.value)}
                      />
                    </label>
                    <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Start date
                      <Input
                        className={cn(fieldClass, 'mt-1')}
                        type="date"
                        aria-label={`Start date for ${row.name || 'person'}`}
                        value={row.startDate || ''}
                        disabled={!editable || saving}
                        onChange={(event) => update(index, 'startDate', event.target.value)}
                      />
                    </label>
                    <label className="flex h-10 items-center gap-2 text-sm font-medium text-slate-700">
                      <input
                        type="checkbox"
                        aria-label={`Announce ${row.name || 'person'}`}
                        checked={row.showOnAnnouncements !== false}
                        disabled={!editable || saving}
                        onChange={(event) => update(index, 'showOnAnnouncements', event.target.checked)}
                      />
                      Announce
                    </label>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {editable ? (
            <div className="flex flex-wrap items-center gap-3">
              <Button
                type="button"
                className="bg-[#FF6B00] text-white hover:bg-[#e05f00]"
                disabled={saving}
                onClick={save}
              >
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {saving ? 'Saving…' : 'Save people'}
              </Button>
              {saved ? <span className="text-sm font-medium text-green-600">Saved</span> : null}
              {error ? <p className="text-sm text-red-600">{error}</p> : null}
            </div>
          ) : error ? (
            <p className="text-sm text-red-600">{error}</p>
          ) : null}
        </>
      ) : null}
    </section>
  )
}
