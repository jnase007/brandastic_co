import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Trash2, Loader2 } from 'lucide-react'
import PageHeader from '../components/PageHeader'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { saveClientRetainers, useClientRetainers } from '../lib/clientRetainers'

function money(value) {
  const n = Number(value)
  if (!n) return '$0'
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

function commaNumber(value) {
  const raw = String(value || '').replace(/[^0-9.]/g, '')
  if (!raw) return ''
  const [whole, dec] = raw.split('.')
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return dec != null ? `${grouped}.${dec}` : grouped
}

export default function ClientRetainers() {
  const { rows, setRows, missing, error: loadError, ready } = useClientRetainers()
  const [draft, setDraft] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const list = draft || (rows || []).map((row) => ({
    id: row.id,
    name: row.name,
    monthly: row.monthly == null ? '' : commaNumber(row.monthly),
  }))

  const total = list.reduce((sum, row) => sum + (Number(String(row.monthly).replace(/[$,]/g, '')) || 0), 0)

  function update(index, field, value) {
    setSaved(false)
    setDraft((current) => {
      const base = current || list
      return base.map((row, i) => (i === index ? { ...row, [field]: value } : row))
    })
  }

  function addClient() {
    setSaved(false)
    setDraft((current) => [{ name: '', monthly: '' }, ...(current || list)])
  }

  async function save() {
    const cleaned = (draft || list).map((row) => ({
      id: row.id,
      name: String(row.name || '').trim(),
      monthly: String(row.monthly).replace(/[$,]/g, ''),
    }))
    if (cleaned.some((row) => !row.name)) {
      setError('Every client needs a name.')
      return
    }
    if (cleaned.some((row) => !(Number(row.monthly) >= 0))) {
      setError('Monthly retainer has to be 0 or more.')
      return
    }
    setSaving(true)
    setError('')
    try {
      const savedRows = await saveClientRetainers(cleaned)
      setRows(savedRows)
      setDraft(null)
      setSaved(true)
    } catch (err) {
      setError(err.message || 'Could not save. Run supabase/client-retainers.sql in Supabase if the table is missing.')
    } finally {
      setSaving(false)
    }
  }

  if (!ready) return <div className="p-8 text-sm text-slate-500">Loading clients…</div>

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
      <PageHeader
        title="Client retainers"
        description="Monthly revenue by client. Same idea as People. Scenarios uses this list."
        actions={(
          <Button type="button" variant="outline" size="sm" onClick={addClient}>
            <Plus className="mr-1 h-4 w-4" />
            Add client
          </Button>
        )}
      />
      <p className="mt-2 text-sm text-slate-500">
        <Link className="font-medium text-[#1644ED]" to="/people">People</Link>
        {' · '}
        <Link className="font-medium text-[#1644ED]" to="/scenarios">Scenarios</Link>
      </p>
      <div className="mt-6 rounded-2xl border bg-white p-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Monthly retainers</p>
        <p className="mt-1 text-3xl font-semibold tabular-nums">{money(total)}</p>
        <p className="text-sm text-slate-500">{money(total * 12)} / yr · {list.length} clients</p>
      </div>
      {missing ? (
        <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          The client_retainers table is not in Supabase yet. Run supabase/client-retainers.sql, then save.
        </p>
      ) : null}
      {loadError || error ? <p className="mt-4 text-sm text-red-600">{error || loadError}</p> : null}
      {saved ? <p className="mt-4 text-sm text-emerald-700">Saved.</p> : null}

      <div className="mt-6 overflow-hidden rounded-2xl border bg-white shadow-sm">
        {list.map((row, index) => (
          <div key={row.id || `new-${index}`} className="grid items-end gap-3 border-t px-5 py-4 first:border-t-0 sm:grid-cols-[1fr_160px_auto]">
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Client
              <Input className="mt-1" value={row.name} onChange={(event) => update(index, 'name', event.target.value)} />
            </label>
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Monthly $
              <Input className="mt-1" inputMode="decimal" value={row.monthly} onChange={(event) => update(index, 'monthly', commaNumber(event.target.value))} />
            </label>
            <Button type="button" variant="ghost" className="text-slate-400 hover:text-red-600" onClick={() => { setSaved(false); setDraft((current) => (current || list).filter((_, i) => i !== index)) }}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
        {!list.length ? <p className="px-5 py-6 text-sm text-slate-500">Add each retainer client and the monthly amount.</p> : null}
      </div>
      <div className="mt-4">
        <Button type="button" className="bg-[#FF6B00] text-white hover:bg-[#e05f00]" disabled={saving} onClick={save}>
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Save clients
        </Button>
      </div>
    </div>
  )
}
