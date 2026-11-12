import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Loader2, Plus } from 'lucide-react'
import PageHeader from '../components/PageHeader'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { saveLaborRates, useLaborRateRows } from '../lib/laborRates'

function workerTypeOf(row) {
  return String(row?.worker_type || row?.workerType || '').trim().toLowerCase() === 'contractor'
    ? 'contractor'
    : 'employee'
}

function toSaveRow(row) {
  return {
    id: row.id,
    name: row.name,
    hourly: row.hourly,
    workerType: workerTypeOf(row),
    weeklyCapacity: Number(row.weekly_capacity) > 0 ? Number(row.weekly_capacity) : 40,
    birthday: row.birthday || '',
    startDate: row.start_date || row.startDate || '',
    showOnAnnouncements: row.show_on_announcements !== false,
  }
}

export default function NewAdmin() {
  const { rows, setRows, ready, error } = useLaborRateRows()
  const people = rows || []
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

  async function addPerson() {
    const trimmed = name.trim()
    const monthlyAmount = Number(String(monthly).replace(/[$,]/g, ''))
    const rate = Number(String(hourly).replace(/[$,]/g, '')) || (type === 'employee' && monthlyAmount > 0 ? monthlyAmount / 160 : NaN)
    if (!trimmed) {
      setFail('Name is required.')
      return
    }
    if (!(rate >= 0)) {
      setFail('Hourly rate has to be 0 or more.')
      return
    }
    setSaving(true)
    setFail('')
    setMessage('')
    try {
      const saved = await saveLaborRates([
        ...people.map(toSaveRow),
        {
          name: trimmed,
          hourly: rate,
          workerType: type,
          weeklyCapacity: 40,
          birthday: '',
          startDate: '',
          showOnAnnouncements: true,
        },
      ])
      setRows(saved.rows)
      setName('')
      setHourly('')
      setMonthly('')
      setMessage(`${trimmed} added. Pay also shows on People.`)

      if (email.trim()) {
        const link = `${window.location.origin}/login?invite=true&email=${encodeURIComponent(email.trim())}&role=team`
        setInviteLink(link)
      }
    } catch (err) {
      setFail(err.message || 'Could not add person.')
    } finally {
      setSaving(false)
    }
  }

  function makeInvite() {
    if (!email.trim()) {
      setFail('Email is required to invite.')
      return
    }
    const link = invitePreview
    setInviteLink(link)
    navigator.clipboard?.writeText(link)
    setMessage('Invite link copied. Send it to them so they can log in.')
    setFail('')
  }

  if (!ready) return <div className="p-8 text-sm text-slate-500">Loading people…</div>

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
      <PageHeader
        title="Admin"
        description="Current employees and contractors. Add someone to People, then invite them to log in."
      />
      <p className="mt-2 text-sm text-slate-500">
        <Link className="font-medium text-[#1644ED]" to="/people">People</Link>
        {' is pay. This page is who is on the team and how they get in.'}
      </p>
      {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
      {fail ? <p className="mt-3 text-sm text-red-600">{fail}</p> : null}
      {message ? <p className="mt-3 text-sm text-emerald-700">{message}</p> : null}

      <div className="mt-6 rounded-2xl border bg-white p-5 shadow-sm">
        <h2 className="text-base font-semibold">Add someone</h2>
        <p className="mt-1 text-sm text-slate-500">{type === 'employee' ? 'Employees: monthly salary ÷ 160 hours = hourly. Contractors stay hourly.' : 'Contractors: hourly only.'}</p>
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
              const amount = Number(String(value).replace(/[$,]/g, ''))
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
                const amount = Number(String(value).replace(/[$,]/g, ''))
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
        {inviteLink ? (
          <p className="mt-3 break-all rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600">{inviteLink}</p>
        ) : null}
      </div>

      <Roster title="Employees" rows={employees} />
      <Roster title="Contractors" rows={contractors} />
    </div>
  )
}

function Roster({ title, rows }) {
  return (
    <div className="mt-6 overflow-hidden rounded-2xl border bg-white shadow-sm">
      <div className="border-b px-5 py-4">
        <h2 className="text-base font-semibold">{title}</h2>
        <p className="text-sm text-slate-500">{rows.length}</p>
      </div>
      {rows.map((row) => (
        <div key={row.id || row.name} className="flex items-center justify-between border-t px-5 py-3">
          <div>
            <p className="font-medium">{row.name}</p>
            <p className="text-xs text-slate-500">{row.start_date ? `Started ${row.start_date.slice(0, 10)}` : 'No start date'}</p>
          </div>
          <p className="text-sm tabular-nums text-slate-600">${Number(row.hourly || 0)}/hr</p>
        </div>
      ))}
      {!rows.length ? <p className="px-5 py-4 text-sm text-slate-500">None yet.</p> : null}
    </div>
  )
}
