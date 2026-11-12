import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Loader2, Plus, Trash2 } from 'lucide-react'
import PageHeader from '../components/PageHeader'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { saveLaborRates, useLaborRateRows } from '../lib/laborRates'
import { deactivateClient, saveClientRetainers, useClientRetainers } from '../lib/clientRetainers'

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
  const annual = moneyNum(row.annual)
  const hourly = moneyNum(row.hourly) || (type === 'employee' && annual > 0 ? annual / 1920 : 0)
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
      annual: type === 'employee' && hourly ? String(Math.round(hourly * 1920)) : '',
    }
  })
}

export default function NewAdmin() {
  const { rows, setRows, ready, error } = useLaborRateRows()
  const retainers = useClientRetainers()
  const [clientDraft, setClientDraft] = useState(null)
  const [clientName, setClientName] = useState('')
  const [clientMonthly, setClientMonthly] = useState('')
  const clients = clientDraft || (retainers.rows || []).filter((row) => !row.internal)
  const [draft, setDraft] = useState(null)
  const people = draft || fromPeople(rows)
  const employees = people.filter((row) => workerTypeOf(row) === 'employee')
  const contractors = people.filter((row) => workerTypeOf(row) === 'contractor')
  const [name, setName] = useState('')
  const [hourly, setHourly] = useState('')
  const [annual, setAnnual] = useState('')
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
    const annualAmount = moneyNum(annual)
    const rate = moneyNum(hourly) || (type === 'employee' && annualAmount > 0 ? annualAmount / 1920 : NaN)
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
          annual: type === 'employee' ? String(Math.round(rate * 1920)) : '',
          worker_type: type,
          weekly_capacity: 40,
        },
      ],
      `${trimmed} added.`
    )
    setName('')
    setHourly('')
    setAnnual('')
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
        description="Add and edit team and clients here. Same people as People. Same clients as Scenarios."
      />
      <p className="mt-2 text-sm text-slate-500">
        Same list as <Link className="font-medium text-[#1644ED]" to="/people">People</Link>.
      </p>
      {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
      {fail ? <p className="mt-3 text-sm text-red-600">{fail}</p> : null}
      {message ? <p className="mt-3 text-sm text-emerald-700">{message}</p> : null}

      <div className="mt-6 rounded-2xl border bg-white p-5 shadow-sm">
        <h2 className="text-base font-semibold">Add someone</h2>
        <p className="mt-1 text-sm text-slate-500">{type === 'employee' ? 'Employees: enter annual salary. Hourly = annual ÷ 1,920 (160 hrs × 12).' : 'Contractors: hourly only.'}</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Input placeholder="Name" value={name} onChange={(event) => setName(event.target.value)} />
          {type === 'employee' ? (
            <Input
              placeholder="Annual salary $"
              inputMode="decimal"
              value={annual}
              onChange={(event) => {
                const value = event.target.value
                setAnnual(value)
                const amount = moneyNum(value)
                if (amount > 0) setHourly(String(Math.round((amount / 1920) * 100) / 100))
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
                if (amount > 0) setAnnual(String(Math.round(amount * 1920)))
              }
            }}
          />
          <select className="h-10 rounded-lg border border-slate-200 px-3 text-sm" value={type} onChange={(event) => { setType(event.target.value); if (event.target.value === 'contractor') setAnnual('') }}>
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
        hint="Annual salary. Hourly = annual ÷ 1,920."
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

      <div className="mt-10 rounded-2xl border bg-white p-5 shadow-sm">
        <h2 className="text-base font-semibold">Add a client</h2>
        <p className="mt-1 text-sm text-slate-500">Monthly retainer. Brandastic stays internal / not billable.</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Input placeholder="Client name" value={clientName} onChange={(event) => setClientName(event.target.value)} />
          <Input placeholder="Monthly $" inputMode="decimal" value={clientMonthly} onChange={(event) => setClientMonthly(event.target.value)} />
        </div>
        <Button
          type="button"
          className="mt-4 bg-[#FF6B00] text-white hover:bg-[#e05f00]"
          disabled={saving}
          onClick={async () => {
            const trimmed = clientName.trim()
            const monthly = moneyNum(clientMonthly)
            if (!trimmed) {
              setFail('Client name is required.')
              return
            }
            if (!(monthly >= 0)) {
              setFail('Monthly retainer has to be 0 or more.')
              return
            }
            setSaving(true)
            setFail('')
            try {
              const saved = await saveClientRetainers([...clients, { name: trimmed, monthly }])
              retainers.setRows(saved)
              setClientDraft(saved.filter((row) => !row.internal))
              setClientName('')
              setClientMonthly('')
              setMessage(`${trimmed} added.`)
            } catch (err) {
              setFail(err.message || 'Could not add client.')
            } finally {
              setSaving(false)
            }
          }}
        >
          Add client
        </Button>
      </div>

      <div className="mt-6 overflow-hidden rounded-2xl border bg-white shadow-sm">
        <div className="flex items-center justify-between border-b px-5 py-4">
          <div>
            <h2 className="text-base font-semibold">Clients</h2>
            <p className="text-sm text-slate-500">{clients.length} billable</p>
          </div>
          <Button type="button" className="bg-[#FF6B00] text-white hover:bg-[#e05f00]" disabled={saving} onClick={async () => {
            setSaving(true)
            setFail('')
            try {
              const saved = await saveClientRetainers(clients)
              retainers.setRows(saved)
              setClientDraft(saved.filter((row) => !row.internal))
              setMessage('Clients saved.')
            } catch (err) {
              setFail(err.message || 'Could not save clients.')
            } finally {
              setSaving(false)
            }
          }}>
            Save clients
          </Button>
        </div>
        {clients.map((row) => (
          <div key={row.id || row.name} className="grid items-end gap-3 border-t px-5 py-3 sm:grid-cols-[1fr_160px_auto]">
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Client
              <Input className="mt-1" value={row.name || ''} onChange={(event) => setClientDraft((current) => (current || clients).map((item) => (item.id === row.id ? { ...item, name: event.target.value } : item)))} />
            </label>
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Monthly $
              <Input className="mt-1" inputMode="decimal" value={row.monthly ?? ''} onChange={(event) => setClientDraft((current) => (current || clients).map((item) => (item.id === row.id ? { ...item, monthly: event.target.value } : item)))} />
            </label>
            <Button
              type="button"
              variant="ghost"
              className="text-slate-400 hover:text-red-600"
              onClick={async () => {
                if (!window.confirm(`Are you sure you want to remove ${row.name || 'this client'}?`)) return
                if (!row.id) {
                  setClientDraft((current) => (current || clients).filter((item) => item !== row))
                  return
                }
                setSaving(true)
                try {
                  await deactivateClient(row.id)
                  const next = clients.filter((item) => item.id !== row.id)
                  setClientDraft(next)
                  retainers.setRows((current) => (current || []).filter((item) => item.id !== row.id))
                  setMessage(`${row.name} removed.`)
                } catch (err) {
                  setFail(err.message || 'Could not remove client.')
                } finally {
                  setSaving(false)
                }
              }}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
        {!clients.length ? <p className="px-5 py-4 text-sm text-slate-500">Add billable clients here.</p> : null}
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
              Annual $
              <Input
                className="mt-1"
                inputMode="decimal"
                value={row.annual || ''}
                onChange={(event) => {
                  const annual = event.target.value
                  const amount = moneyNum(annual)
                  onChange(row.id, {
                    annual,
                    hourly: amount > 0 ? String(Math.round((amount / 1920) * 100) / 100) : row.hourly,
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
                  annual: employee && amount > 0 ? String(Math.round(amount * 1920)) : row.annual,
                })
              }}
            />
          </label>
          <Button type="button" variant="ghost" className="text-slate-400 hover:text-red-600" onClick={() => {
            if (!window.confirm(`Are you sure you want to remove ${row.name || 'this person'}?`)) return
            onRemove(row.id)
          }} aria-label={`Remove ${row.name}`}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ))}
      {!rows.length ? <p className="px-5 py-4 text-sm text-slate-500">None yet.</p> : null}
    </div>
  )
}
