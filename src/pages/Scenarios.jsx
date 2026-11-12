import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import PageHeader from '../components/PageHeader'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { cn } from '../lib/utils'
import { useLaborRateRows } from '../lib/laborRates'
import { useClientRetainers } from '../lib/clientRetainers'
import { loadScenario, saveScenario } from '../lib/scenarioStore'

const WEEKS = 52 / 12
const TAX = 0.062 + 0.0145 + 0.006 + 0.034 + 0.001

function money(value) {
  if (value == null || Number.isNaN(value)) return '—'
  return value.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

function wages(row) {
  const hourly = Number(row.hourly) || 0
  if (String(row.worker_type || '').toLowerCase() !== 'contractor') return hourly * 160
  const weekly = Number(row.weekly_capacity) > 0 ? Number(row.weekly_capacity) : 40
  return hourly * weekly * WEEKS
}

function trueMonthly(row, raisePct = 0) {
  const pay = wages(row) * (1 + raisePct / 100)
  if (String(row.worker_type || '').toLowerCase() === 'contractor') return pay
  return pay * (1 + TAX)
}

function num(value) {
  return Number(String(value || '').replace(/[$,]/g, '')) || 0
}

function amountInMonth(current, key, plan) {
  const nextFrom = plan?.nextFrom || ''
  const nextAmount = num(plan?.nextAmount)
  const end = plan?.end || ''
  if (nextFrom && key >= nextFrom) return nextAmount
  if (end && key > end) return 0
  return Number(current) || 0
}

function futureInMonth(row, key) {
  if (row.from && key < row.from) return 0
  if (row.end && key > row.end) return 0
  return num(row.monthly)
}

export default function Scenarios() {
  const { rows, overhead, ready, error } = useLaborRateRows()
  const retainers = useClientRetainers()
  const [raiseFrom, setRaiseFrom] = useState('2027-02')
  const [raises, setRaises] = useState({})
  const [extraClient, setExtraClient] = useState('')
  const [clientEnds, setClientEnds] = useState({})
  const [clientPlans, setClientPlans] = useState({})
  const [futureClients, setFutureClients] = useState([])
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState('')
  const [saveError, setSaveError] = useState('')

  useEffect(() => {
    let cancel = false
    loadScenario().then((loaded) => {
      if (cancel || !loaded) return
      if (loaded.raiseFrom) setRaiseFrom(loaded.raiseFrom)
      if (loaded.raises) setRaises(loaded.raises)
      if (loaded.extraClient != null) setExtraClient(loaded.extraClient)
      if (loaded.clientEnds) setClientEnds(loaded.clientEnds)
      if (loaded.clientPlans) setClientPlans(loaded.clientPlans)
      if (loaded.futureClients) setFutureClients(loaded.futureClients)
    })
    return () => { cancel = true }
  }, [])

  const people = rows || []
  const clients = (retainers.rows || []).filter((row) => !row.internal)
  const overheadAmount = overhead == null || overhead === '' ? 40000 : Number(overhead) || 0

  const projection = useMemo(() => {
    const extra = Number(String(extraClient).replace(/[$,]/g, '')) || 0
    const hasRaises = Object.values(raises).some((value) => Number(value) > 0)
    const now = new Date()
    const months = []
    for (let i = 0; i < 12; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() + i, 1)
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
      const raised = hasRaises && Boolean(raiseFrom) && key >= raiseFrom
      const staff = people.reduce((sum, row) => {
        const pct = raised && String(row.worker_type || '').toLowerCase() !== 'contractor' ? Number(raises[row.id || row.name] || 0) : 0
        return sum + trueMonthly(row, pct)
      }, 0)
      const cost = staff + overheadAmount
      const revenue = extra + clients.reduce((sum, client) => {
        const plan = {
          end: clientPlans[client.id]?.end || clientEnds[client.id] || '',
          nextFrom: clientPlans[client.id]?.nextFrom || '',
          nextAmount: clientPlans[client.id]?.nextAmount || '',
        }
        return sum + amountInMonth(client.monthly, key, plan)
      }, 0) + futureClients.reduce((sum, row) => sum + futureInMonth(row, key), 0)
      const profit = revenue - cost
      months.push({
        key,
        label: date.toLocaleString('en-US', { month: 'short', year: '2-digit' }),
        staff,
        overhead: overheadAmount,
        cost,
        revenue,
        profit,
        margin: revenue > 0 ? profit / revenue : null,
        raised,
      })
    }
    const peak = Math.max(1, ...months.map((row) => Math.max(row.revenue, row.cost)))
    const after = months.find((row) => row.raised) || null
    const nowRow = months[0]
    return { months, peak, after, nowRow, hasRaises: months.some((row) => row.raised) }
  }, [people, overheadAmount, clients, clientEnds, clientPlans, futureClients, extraClient, raiseFrom, raises])

  function setAllRaises(pct) {
    if (!pct) {
      setRaises({})
      return
    }
    const next = {}
    for (const row of people) {
      if (String(row.worker_type || '').toLowerCase() !== 'contractor') next[row.id || row.name] = pct
    }
    setRaises(next)
  }

  if (!ready) {
    return <div className="p-8 text-sm text-slate-500">Loading people and clients…</div>
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <PageHeader
        title="Scenarios"
        description="Team from People. Revenue from Client retainers. Set an end month on a client to see the dip. No Tempo."
        actions={
          <Button
            type="button"
            className="bg-[#FF6B00] text-white hover:bg-[#e05f00]"
            disabled={saving}
            onClick={async () => {
              setSaving(true)
              setSaveError('')
              setSaved('')
              try {
                const result = await saveScenario({ raiseFrom, raises, extraClient, clientEnds, clientPlans, futureClients })
                if (result.error) setSaved('Saved on this browser. Run supabase/scenario-plans.sql to share it.')
                else setSaved('Scenario saved.')
              } catch (err) {
                setSaveError(err.message || 'Could not save.')
              } finally {
                setSaving(false)
              }
            }}
          >
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Save scenario
          </Button>
        }
      />
      <p className="mt-2 text-sm text-slate-500">
        <Link className="font-medium text-[#1644ED]" to="/people">People</Link>
        {' · '}
        <Link className="font-medium text-[#1644ED]" to="/retainers">Client retainers</Link>
      </p>
      {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}
      {saveError ? <p className="mt-4 text-sm text-red-600">{saveError}</p> : null}
      {saved ? <p className="mt-4 text-sm text-emerald-700">{saved}</p> : null}

      <div className="mt-6 grid gap-3 sm:grid-cols-4">
        <div className="rounded-2xl border bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Client retainers / mo</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{money(projection.nowRow.revenue)}</p>
          <p className="text-xs text-slate-500">{clients.length} clients</p>
        </div>
        <div className="rounded-2xl border bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Cost now</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{money(projection.nowRow.cost)}</p>
          <p className="text-xs font-medium text-teal-700">Includes {money(overheadAmount)} overhead</p>
        </div>
        {projection.hasRaises ? (
          <div className="rounded-2xl border border-orange-200 bg-orange-50 p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-orange-700">After planned raises</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-orange-950">{money(projection.after.cost)}</p>
          </div>
        ) : (
          <div className="rounded-2xl border bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">No raises planned</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">{money(projection.nowRow.cost)}</p>
            <p className="text-xs text-slate-500">Pick 2–4% to add one</p>
          </div>
        )}
        <div className="rounded-2xl border bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{projection.hasRaises ? 'Margin after' : 'Margin now'}</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">
            {(projection.hasRaises ? projection.after.margin : projection.nowRow.margin) == null ? '—' : `${Math.round((projection.hasRaises ? projection.after.margin : projection.nowRow.margin) * 1000) / 10}%`}
          </p>
          <p className="text-xs text-slate-500">{money(projection.hasRaises ? projection.after.profit : projection.nowRow.profit)} / mo</p>
        </div>
      </div>

      <div className="mt-6 rounded-2xl border bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Raises start
            <Input className="mt-1 h-10" type="month" value={raiseFrom} onChange={(event) => setRaiseFrom(event.target.value)} />
          </label>
          <div className="flex gap-2">
            {[0, 2, 3, 4].map((pct) => (
              <button
                key={pct}
                type="button"
                onClick={() => setAllRaises(pct)}
                className="rounded-full bg-slate-100 px-3 py-1.5 text-sm font-semibold text-slate-700"
              >
                {pct === 0 ? 'Clear' : `${pct}% all employees`}
              </button>
            ))}
          </div>
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Extra client / mo
            <Input className="mt-1 h-10" inputMode="decimal" value={extraClient} onChange={(event) => setExtraClient(event.target.value)} />
          </label>
        </div>

        <div className="mt-6 flex h-40 items-end gap-1">
          {projection.months.map((row) => (
            <div key={row.key} className="flex h-full min-w-0 flex-1 flex-col justify-end gap-0.5">
              <div className="w-full rounded-t bg-[#1644ED]/70" style={{ height: `${(row.revenue / projection.peak) * 100}%` }} />
              <div className={cn('w-full rounded-t', row.raised ? 'bg-orange-400' : 'bg-slate-300')} style={{ height: `${((row.cost - overheadAmount) / projection.peak) * 100}%` }} />
              <div className="w-full rounded-t bg-teal-500" style={{ height: `${(overheadAmount / projection.peak) * 100}%` }} />
            </div>
          ))}
        </div>
        <div className="mt-2 flex gap-1">
          {projection.months.map((row) => (
            <p key={row.key} className={cn('min-w-0 flex-1 text-center text-[10px] text-slate-400', row.raised && 'font-semibold text-orange-600')}>{row.label}</p>
          ))}
        </div>
        <p className="mt-3 text-xs text-slate-400">Blue = retainers. Gray = team. Orange = team after raises. Teal = $40k overhead.</p>
      </div>

      <div className="mt-6 overflow-hidden rounded-2xl border bg-white shadow-sm">
        <div className="border-b px-5 py-4">
          <h2 className="text-base font-semibold">People raises</h2>
          <p className="text-sm text-slate-500">Set % per person. Contractors stay at current cost.</p>
        </div>
        {people.map((row) => {
          const key = row.id || row.name
          const contractor = row.worker_type === 'contractor'
          const pct = Number(raises[key] || 0)
          return (
            <div key={key} className="grid items-center gap-3 border-t px-5 py-3 sm:grid-cols-[1fr_120px_140px_140px]">
              <div>
                <p className="font-medium">{row.name}</p>
                <p className="text-xs text-slate-500">{contractor ? 'Contractor' : 'Employee'} · {money(trueMonthly(row))} / mo now</p>
              </div>
              {contractor ? (
                <p className="text-sm text-slate-400">No raise</p>
              ) : (
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Raise %
                  <Input
                    className="mt-1 h-10"
                    inputMode="decimal"
                    value={raises[key] ?? ''}
                    placeholder="0"
                    onChange={(event) => setRaises((current) => ({ ...current, [key]: event.target.value }))}
                  />
                </label>
              )}
              <p className="text-sm tabular-nums text-slate-600">After {money(trueMonthly(row, contractor ? 0 : pct))}</p>
              <p className="text-sm tabular-nums text-slate-400">{money(trueMonthly(row, contractor ? 0 : pct) * 12)} / yr</p>
            </div>
          )
        })}
      </div>

      <div className="mt-6 overflow-hidden rounded-2xl border bg-white shadow-sm">
        <div className="border-b px-5 py-4">
          <h2 className="text-base font-semibold">Clients in the model</h2>
          <p className="text-sm text-slate-500">End the current retainer, then start the next $ in a later month (same client, smaller book).</p>
        </div>
        <div className="hidden border-t px-5 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400 sm:grid sm:grid-cols-[1fr_100px_140px_110px_140px]">
          <span>Client</span><span>Now / mo</span><span>Ends</span><span>Next $</span><span>Next starts</span>
        </div>
        {clients.map((client) => {
          const plan = clientPlans[client.id] || {}
          return (
            <div key={client.id} className="grid items-center gap-3 border-t px-5 py-3 sm:grid-cols-[1fr_100px_140px_110px_140px]">
              <p className="font-medium">{client.name}</p>
              <p className="tabular-nums text-slate-700">{money(Number(client.monthly) || 0)}</p>
              <Input type="month" value={plan.end || clientEnds[client.id] || ''} onChange={(event) => {
                const end = event.target.value
                setClientEnds((current) => ({ ...current, [client.id]: end }))
                setClientPlans((current) => ({ ...current, [client.id]: { ...current[client.id], end } }))
              }} />
              <Input inputMode="decimal" placeholder="Next $" value={plan.nextAmount || ''} onChange={(event) => setClientPlans((current) => ({ ...current, [client.id]: { ...current[client.id], nextAmount: event.target.value } }))} />
              <Input type="month" value={plan.nextFrom || ''} onChange={(event) => setClientPlans((current) => ({ ...current, [client.id]: { ...current[client.id], nextFrom: event.target.value } }))} />
            </div>
          )
        })}
        {!clients.length ? <p className="px-5 py-4 text-sm text-slate-500">Add clients on Clients, then come back.</p> : null}
      </div>

      <div className="mt-6 overflow-hidden rounded-2xl border bg-white shadow-sm">
        <div className="flex items-center justify-between border-b px-5 py-4">
          <div>
            <h2 className="text-base font-semibold">New retainers later</h2>
            <p className="text-sm text-slate-500">A client that is not on the book yet, or a split that starts in a given month.</p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={() => setFutureClients((current) => [...current, { id: `new-${Date.now()}`, name: '', monthly: '', from: '', end: '' }])}>Add later retainer</Button>
        </div>
        {futureClients.map((row) => (
          <div key={row.id} className="grid items-center gap-3 border-t px-5 py-3 sm:grid-cols-[1fr_110px_140px_140px_auto]">
            <Input placeholder="Client" value={row.name} onChange={(event) => setFutureClients((current) => current.map((item) => (item.id === row.id ? { ...item, name: event.target.value } : item)))} />
            <Input placeholder="$ / mo" inputMode="decimal" value={row.monthly} onChange={(event) => setFutureClients((current) => current.map((item) => (item.id === row.id ? { ...item, monthly: event.target.value } : item)))} />
            <Input type="month" value={row.from} onChange={(event) => setFutureClients((current) => current.map((item) => (item.id === row.id ? { ...item, from: event.target.value } : item)))} />
            <Input type="month" value={row.end} onChange={(event) => setFutureClients((current) => current.map((item) => (item.id === row.id ? { ...item, end: event.target.value } : item)))} />
            <Button type="button" variant="ghost" className="text-slate-400" onClick={() => setFutureClients((current) => current.filter((item) => item.id !== row.id))}>Remove</Button>
          </div>
        ))}
        {!futureClients.length ? <p className="px-5 py-4 text-sm text-slate-500">None yet.</p> : null}
      </div>

      <div className="mt-6 overflow-auto rounded-2xl border bg-white shadow-sm">
        <div className="border-b px-5 py-4">
          <h2 className="text-base font-semibold">Margin vs expenses</h2>
          <p className="text-sm text-slate-500">Revenue minus team minus overhead. Same 12 months as the chart.</p>
        </div>
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-2">Month</th>
              <th className="px-4 py-2 text-right">Revenue</th>
              <th className="px-4 py-2 text-right">Team</th>
              <th className="px-4 py-2 text-right">Overhead</th>
              <th className="px-4 py-2 text-right">Profit</th>
              <th className="px-4 py-2 text-right">Margin</th>
            </tr>
          </thead>
          <tbody>
            {projection.months.map((row) => (
              <tr key={row.key} className="border-t">
                <td className={cn('px-4 py-2', row.raised && 'font-semibold text-orange-700')}>{row.label}</td>
                <td className="px-4 py-2 text-right tabular-nums">{money(row.revenue)}</td>
                <td className="px-4 py-2 text-right tabular-nums">{money(row.staff)}</td>
                <td className="px-4 py-2 text-right tabular-nums">{money(row.overhead)}</td>
                <td className={cn('px-4 py-2 text-right tabular-nums font-medium', row.profit < 0 ? 'text-red-600' : 'text-emerald-700')}>{money(row.profit)}</td>
                <td className="px-4 py-2 text-right tabular-nums">{row.margin == null ? '—' : `${Math.round(row.margin * 1000) / 10}%`}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
