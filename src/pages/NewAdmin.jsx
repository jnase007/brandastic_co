import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Loader2, Plus, Trash2 } from 'lucide-react'
import PageHeader from '../components/PageHeader'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { saveLaborRates, useLaborRateRows } from '../lib/laborRates'

function workerTypeOf(row) {
  return String(row?.worker_type || row?.workerType || '').trim().toLowerCase() === 'contractor'
    ? 'contractor'
    : 'employee'
}

function moneyNum(value) {
  return Number(String(value || '').replace(/[$,]/g, ''))
}

function toSaveRow(row) {
  const type = workerTypeOf(row)
  const monthly = moneyNum(row.monthly)
  const hourly = moneyNum(row.hourly) || (type === 'employee' && monthly > 0 ? monthly / 160 : 0)
  return {
    id: row.id,
    name: row.name,
    hourly,
    workerType: type,
    weeklyCapacity: Number(row.weekly_capacity || row.weeklyCapacity) > 0 ? Number(row.weekly_capacity || row.weeklyCapacity) : 40,
    birthday: row.birthday || '',
    startDate: row.start_date || row.startDate || '',
    showOnAnnouncements: row.show_on_announcements !== false,
  }
}

function fromPeople(rows) {
  return (rows || []).map((row) => {
    const type = workerTypeOf(row)
    const hourly = Number(row.hourly) || 0
    return {
      ...row,
      worker_type: type,
      hourly: hourly ? String(hourly) : '',
      monthly: type === 'employee' && hourly ? String(Math.round(hourly * 160)) : '',
    }
  })
}

export default function NewAdmin() {
  const { rows, setRows, ready, error } = useLaborRateRows()
  const [draft, setDraft] = useState(null)
  const people = draft || fromPeople(rows)
  const employees = people.filter((row) => workerTypeOf(row) === 'employee')
  const contractors = people.filter((row) => workerTypeOf(row) === 'contractor')
  const [name, setName] = useState('')
  const [hourly, setHourly] = useState('')
  const [monthly, setMonthly] = useState('')
  const [type, setType] = useState('employee')
  const [email, setEmail] = useState('')
  const [inviteLink, setInviteLink] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [fail, setFail] = useState('')

  const invitePreview = useMemo(() => {
    if (!email.trim()) return ''
    return `${window.location.origin}/login?invite=true&email=${encodeURIComponent(email.trim())}&role=team`
  }, [email])

  function patch(id, changes) {
    setDraft((current) => (current || fromPeople(rows)).map((row) => (row.id === id ? { ...row, ...changes } : row)))
  }

  async function saveTeam(nextPeople, note) {
    setSaving(true)
    setFail('')
    setMessage('')
    try {
      const saved = await saveLaborRates(nextPeople.map(toSaveRow))
      setRows(saved.rows)
      setDraft(fromPeople(saved.rows))
      setMessage(note)
    } catch (err) {
      setFail(err.message || 'Could not save.')
    } finally {
      setSaving(false)
    }
  }

  async function addPerson() {
    const trimmed = name.trim()
    const monthlyAmount = moneyNum(monthly)
    const rate = moneyNum(hourly) || (type === 'employee' && monthlyAmount > 0 ? monthlyAmount / 160 : NaN)
    if (!trimmed) {
      setFail('Name is required.')
      return
    }
    if (!(rate >= 0)) {
      setFail(type === 'employee' ? 'Salary or hourly is required.' : 'Hourly rate is required.')
      return
    }
    await saveTeam(
      [
        ...people,
        {
          name: trimmed,
          hourly: String(rate),
          monthly: type === 'employee' ? String(Math.round(rate * 160)) : '',
          worker_type: type,
          weekly_capacity: 40,
        },
      ],
      `${trimmed} added.`
    )
    setName('')
    setHourly('')
    setMonthly('')
    if (email.trim()) {
      const link = `${window.location.origin}/login?invite=true&email=${encodeURIComponent(email.trim())}&role=team`
      setInviteLink(link)
    }
  }

  function makeInvite() {
    if (!email.trim()) {
      setFail('Email is required to invite.')
      return
    }
    setInviteLink(invitePreview)
    navigator.clipboard?.writeText(invitePreview)
    setMessage('Invite link copied. Send it to them so they can log in.')
    setFail('')
  }

  if (!ready) return <div className="p-8 text-sm text-slate-500">Loading people…</div>

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
      <PageHeader
        title="Admin"
        description="Edit people and rates here. Employees are salary. Contractors are hourly. Invite is how they log in."
      />
      <p className="mt-2 text-sm text-slate-500">
        Same list as <Link className="font-medium text-[#1644ED]" to="/people">People</Link>.
      </p>
      {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
      {fail ? <p className="mt-3 text-sm text-red-600">{fail}</p> : null}
      {message ? <p className="mt-3 text-sm text-emerald-700">{message}</p> : null}

      <div className="mt-6 rounded-2xl border bg-white p-5 shadow-sm">
        <h2 className="text-base font-semibold">Add someone</h2>
        <p className="mt-1 text-sm text-slate-500">{type === 'employee' ? 'Employees: monthly salary ÷ 160 = hourly.' : 'Contractors: hourly only.'}</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Input placeholder="Name" value={name} onChange={(event) => setName(event.target.value)} />
          {type === 'employee' ? (
            <Input
              placeholder="Monthly salary $"
              inputMode="decimal"
              value={monthly}
              onChange={(event) => {
                const value = event.target.value
                setMonthly(value)
                const amount = moneyNum(value)
                if (amount > 0) setHourly(String(Math.round((amount / 160) * 100) / 100))
              }}
            />
          ) : null}
          <Input
            placeholder="Hourly $"
            inputMode="decimal"
            value={hourly}
            onChange={(event) => {
              const value = event.target.value
              setHourly(value)
              if (type === 'employee') {
                const amount = moneyNum(value)
                if (amount > 0) setMonthly(String(Math.round(amount * 160)))
              }
            }}
          />
          <select className="h-10 rounded-lg border border-slate-200 px-3 text-sm" value={type} onChange={(event) => { setType(event.target.value); if (event.target.value === 'contractor') setMonthly('') }}>
            <option value="employee">Employee</option>
            <option value="contractor">Contractor</option>
          </select>
          <Input placeholder="Email (for invite)" type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button type="button" className="bg-[#FF6B00] text-white hover:bg-[#e05f00]" disabled={saving} onClick={addPerson}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-1 h-4 w-4" />}
            Add to team
          </Button>
          <Button type="button" variant="outline" onClick={makeInvite}>Copy invite link</Button>
        </div>
        {inviteLink ? <p className="mt-3 break-all rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600">{inviteLink}</p> : null}
      </div>

      <Roster
        title="Employees"
        hint="Salary ÷ 160 hours"
        rows={employees}
        employee
        onChange={patch}
        onRemove={(id) => saveTeam(people.filter((row) => row.id !== id), 'Removed.')}
      />
      <Roster
        title="Contractors"
        hint="Hourly"
        rows={contractors}
        onChange={patch}
        onRemove={(id) => saveTeam(people.filter((row) => row.id !== id), 'Removed.')}
      />
      <div className="mt-4">
        <Button type="button" className="bg-[#FF6B00] text-white hover:bg-[#e05f00]" disabled={saving} onClick={() => saveTeam(people, 'Rates saved.')}>
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Save rates
        </Button>
      </div>
    </div>
  )
}

function Roster({ title, hint, rows, employee, onChange, onRemove }) {
  return (
    <div className="mt-6 overflow-hidden rounded-2xl border bg-white shadow-sm">
      <div className="border-b px-5 py-4">
        <h2 className="text-base font-semibold">{title}</h2>
        <p className="text-sm text-slate-500">{rows.length} · {hint}</p>
      </div>
      {rows.map((row) => (
        <div key={row.id || row.name} className="grid items-end gap-3 border-t px-5 py-3 sm:grid-cols-[1fr_140px_120px_auto]">
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Name
            <Input className="mt-1" value={row.name || ''} onChange={(event) => onChange(row.id, { name: event.target.value })} />
          </label>
          {employee ? (
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Monthly $
              <Input
                className="mt-1"
                inputMode="decimal"
                value={row.monthly || ''}
                onChange={(event) => {
                  const monthly = event.target.value
                  const amount = moneyNum(monthly)
                  onChange(row.id, {
                    monthly,
                    hourly: amount > 0 ? String(Math.round((amount / 160) * 100) / 100) : row.hourly,
                  })
                }}
              />
            </label>
          ) : (
            <span />
          )}
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Hourly $
            <Input
              className="mt-1"
              inputMode="decimal"
              value={row.hourly || ''}
              onChange={(event) => {
                const hourly = event.target.value
                const amount = moneyNum(hourly)
                onChange(row.id, {
                  hourly,
                  monthly: employee && amount > 0 ? String(Math.round(amount * 160)) : row.monthly,
                })
              }}
            />
          </label>
          <Button type="button" variant="ghost" className="text-slate-400 hover:text-red-600" onClick={() => onRemove(row.id)} aria-label={`Remove ${row.name}`}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ))}
      {!rows.length ? <p className="px-5 py-4 text-sm text-slate-500">None yet.</p> : null}
    </div>
  )
}
