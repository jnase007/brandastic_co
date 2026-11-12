import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import PageHeader from '../components/PageHeader'
import { Input } from '../components/ui/input'
import { cn } from '../lib/utils'
import { useLaborRateRows } from '../lib/laborRates'
import { useClientRetainers } from '../lib/clientRetainers'

const WEEKS = 52 / 12
const TAX = 0.062 + 0.0145 + 0.006 + 0.034 + 0.001

function money(value) {
  if (value == null || Number.isNaN(value)) return '—'
  return value.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

function wages(row) {
  const hourly = Number(row.hourly) || 0
  const weekly = Number(row.weekly_capacity) > 0 ? Number(row.weekly_capacity) : 40
  return hourly * weekly * WEEKS
}

function trueMonthly(row, raisePct = 0) {
  const pay = wages(row) * (1 + raisePct / 100)
  if (String(row.worker_type || '').toLowerCase() === 'contractor') return pay
  return pay * (1 + TAX)
}

export default function Scenarios() {
  const { rows, overhead, ready, error } = useLaborRateRows()
  const retainers = useClientRetainers()
  const [raiseFrom, setRaiseFrom] = useState('2027-02')
  const [raises, setRaises] = useState({})
  const [extraClient, setExtraClient] = useState('')
  const [clientEnds, setClientEnds] = useState({})

  const people = rows || []
  const clients = retainers.rows || []
  const overheadAmount = overhead == null || overhead === '' ? 40000 : Number(overhead) || 0

  const projection = useMemo(() => {
    const extra = Number(String(extraClient).replace(/[$,]/g, '')) || 0
    const now = new Date()
    const months = []
    for (let i = 0; i < 12; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() + i, 1)
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
      const raised = key >= raiseFrom
      const staff = people.reduce((sum, row) => {
        const pct = raised && String(row.worker_type || '').toLowerCase() !== 'contractor' ? Number(raises[row.id || row.name] || 0) : 0
        return sum + trueMonthly(row, pct)
      }, 0)
      const cost = staff + overheadAmount
      const revenue = extra + clients.reduce((sum, client) => {
        const end = clientEnds[client.id]
        if (end && key > end) return sum
        return sum + (Number(client.monthly) || 0)
      }, 0)
      const profit = revenue - cost
      months.push({
        key,
        label: date.toLocaleString('en-US', { month: 'short', year: '2-digit' }),
        cost,
        revenue,
        profit,
        margin: revenue > 0 ? profit / revenue : null,
        raised,
      })
    }
    const peak = Math.max(1, ...months.map((row) => Math.max(row.revenue, row.cost)))
    const after = months.find((row) => row.raised) || months[months.length - 1]
    const nowRow = months[0]
    return { months, peak, after, nowRow }
  }, [people, overheadAmount, clients, clientEnds, extraClient, raiseFrom, raises])

  function setAllRaises(pct) {
    const next = {}
    for (const row of people) {
      if (row.worker_type !== 'contractor') next[row.id || row.name] = pct
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
      />
      <p className="mt-2 text-sm text-slate-500">
        <Link className="font-medium text-[#1644ED]" to="/people">People</Link>
        {' · '}
        <Link className="font-medium text-[#1644ED]" to="/retainers">Client retainers</Link>
      </p>
      {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}

      <div className="mt-6 grid gap-3 sm:grid-cols-4">
        <div className="rounded-2xl border bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Client retainers / mo</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{money(projection.nowRow.revenue)}</p>
          <p className="text-xs text-slate-500">{clients.length} clients</p>
        </div>
        <div className="rounded-2xl border bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Cost now</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{money(projection.nowRow.cost)}</p>
          <p className="text-xs text-slate-500">Includes {money(overheadAmount)} overhead</p>
        </div>
        <div className="rounded-2xl border bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">After planned raises</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{money(projection.after.cost)}</p>
        </div>
        <div className="rounded-2xl border bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Margin after</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">
            {projection.after.margin == null ? '—' : `${Math.round(projection.after.margin * 1000) / 10}%`}
          </p>
          <p className="text-xs text-slate-500">{money(projection.after.profit)} / mo</p>
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
              <div className={cn('w-full rounded-t', row.raised ? 'bg-orange-400' : 'bg-slate-300')} style={{ height: `${(row.cost / projection.peak) * 100}%` }} />
            </div>
          ))}
        </div>
        <div className="mt-2 flex gap-1">
          {projection.months.map((row) => (
            <p key={row.key} className={cn('min-w-0 flex-1 text-center text-[10px] text-slate-400', row.raised && 'font-semibold text-orange-600')}>{row.label}</p>
          ))}
        </div>
        <p className="mt-3 text-xs text-slate-400">Blue = retainers (+ extra client). Gray = cost now. Orange = cost after raises.</p>
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
          <p className="text-sm text-slate-500">Amounts from Client retainers. Set an end month to drop them off.</p>
        </div>
        {clients.map((client) => (
          <div key={client.id} className="grid items-center gap-3 border-t px-5 py-3 sm:grid-cols-[1fr_120px_160px]">
            <p className="font-medium">{client.name}</p>
            <p className="tabular-nums text-slate-700">{money(Number(client.monthly) || 0)} / mo</p>
            <Input type="month" value={clientEnds[client.id] || ''} onChange={(event) => setClientEnds((current) => ({ ...current, [client.id]: event.target.value }))} />
          </div>
        ))}
        {!clients.length ? <p className="px-5 py-4 text-sm text-slate-500">Add retainers on Client retainers, then come back.</p> : null}
      </div>
    </div>
  )
}
