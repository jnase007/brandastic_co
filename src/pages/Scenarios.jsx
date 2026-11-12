import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import PageHeader from '../components/PageHeader'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { cn } from '../lib/utils'
import { useLaborRateRows } from '../lib/laborRates'
import { useClientRetainers } from '../lib/clientRetainers'
import { deleteScenario, listScenarios, loadScenario, saveScenario, saveScenarioAs, setCurrentScenario } from '../lib/scenarioStore'

const WEEKS = 52 / 12
const TAX = 0.062 + 0.0145 + 0.006 + 0.034 + 0.001

const BOOKS = {
  months: 10,
  incomeAvg: 171635.83,
  cogsAvg: 80067.55,
  opexAvg: 71056.55,
  noiAvg: 20508.72,
  recurringAug: 126585.33,
  otherAvg: 45050.50,
}

function money(value) {
  if (value == null || Number.isNaN(value)) return '—'
  return value.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

function pct(value) {
  if (value == null || Number.isNaN(value)) return '—'
  return `${(value * 100).toFixed(1)}%`
}

function num(value) {
  return Number(String(value || '').replace(/[$,]/g, '')) || 0
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

function payloadOf(state) {
  return {
    raiseFrom: state.raiseFrom,
    raiseUntil: state.raiseUntil,
    raises: state.raises,
    extraClient: state.extraClient,
    otherMonthly: state.otherMonthly,
    clientEnds: state.clientEnds,
    clientPlans: state.clientPlans,
    futureClients: state.futureClients,
    currentId: state.scenarioId,
    currentName: state.scenarioName,
  }
}

export default function Scenarios() {
  const { rows, ready, error } = useLaborRateRows()
  const retainers = useClientRetainers()
  const [raiseFrom, setRaiseFrom] = useState('2027-02')
  const [raiseUntil, setRaiseUntil] = useState('')
  const [raises, setRaises] = useState({})
  const [extraClient, setExtraClient] = useState('')
  const [otherMonthly, setOtherMonthly] = useState('')
  const [clientEnds, setClientEnds] = useState({})
  const [clientPlans, setClientPlans] = useState({})
  const [futureClients, setFutureClients] = useState([])
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState('')
  const [scenarioName, setScenarioName] = useState('This year')
  const [scenarioId, setScenarioId] = useState('')
  const [scenarioList, setScenarioList] = useState([])

  useEffect(() => {
    let cancel = false
    loadScenario().then((loaded) => {
      if (cancel || !loaded) {
        setScenarioList(listScenarios())
        return
      }
      if (loaded.raiseFrom) setRaiseFrom(loaded.raiseFrom)
      if (loaded.raiseUntil != null) setRaiseUntil(loaded.raiseUntil)
      if (loaded.raises) setRaises(loaded.raises)
      if (loaded.extraClient != null) setExtraClient(loaded.extraClient)
      if (loaded.otherMonthly != null) setOtherMonthly(loaded.otherMonthly)
      if (loaded.clientEnds) setClientEnds(loaded.clientEnds)
      if (loaded.clientPlans) setClientPlans(loaded.clientPlans)
      if (loaded.futureClients) setFutureClients(loaded.futureClients)
      if (loaded.currentName) setScenarioName(loaded.currentName)
      if (loaded.currentId) setScenarioId(loaded.currentId)
      setScenarioList(loaded.list || listScenarios())
    })
    return () => { cancel = true }
  }, [])

  const people = rows || []
  const clients = (retainers.rows || []).filter((row) => !row.internal)

  const projection = useMemo(() => {
    const extra = num(extraClient)
    const other = otherMonthly === '' ? BOOKS.otherAvg : num(otherMonthly)
    const hasRaises = Object.values(raises).some((value) => Number(value) > 0)
    const now = new Date()
    const months = []
    const peopleNow = people.reduce((sum, row) => sum + trueMonthly(row, 0), 0)
    for (let i = 0; i < 12; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() + i, 1)
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
      const raised = hasRaises && Boolean(raiseFrom) && key >= raiseFrom && (!raiseUntil || key <= raiseUntil)
      const peopleRaised = people.reduce((sum, row) => {
        const raisePct = raised && String(row.worker_type || '').toLowerCase() !== 'contractor' ? Number(raises[row.id || row.name] || 0) : 0
        return sum + trueMonthly(row, raisePct)
      }, 0)
      const staff = BOOKS.cogsAvg + Math.max(0, peopleRaised - peopleNow)
      const overhead = BOOKS.opexAvg
      const retainersMo = clients.reduce((sum, client) => {
        const plan = {
          end: clientPlans[client.id]?.end || clientEnds[client.id] || '',
          nextFrom: clientPlans[client.id]?.nextFrom || '',
          nextAmount: clientPlans[client.id]?.nextAmount || '',
        }
        return sum + amountInMonth(client.monthly, key, plan)
      }, 0)
      const later = futureClients.reduce((sum, row) => sum + futureInMonth(row, key), 0)
      const revenue = retainersMo + later + extra + other
      const cost = staff + overhead
      const profit = revenue - cost
      months.push({
        key,
        label: date.toLocaleString('en-US', { month: 'short', year: '2-digit' }),
        staff,
        overhead,
        retainers: retainersMo,
        other,
        cost,
        revenue,
        profit,
        margin: revenue > 0 ? profit / revenue : null,
        raised,
      })
    }
    const avgProfit = months.reduce((sum, row) => sum + row.profit, 0) / months.length
    const avgRevenue = months.reduce((sum, row) => sum + row.revenue, 0) / months.length
    const avgMargin = avgRevenue > 0 ? avgProfit / avgRevenue : null
    const minProfit = Math.min(...months.map((row) => row.profit))
    return { months, avgProfit, avgMargin, minProfit, other }
  }, [people, clients, clientEnds, clientPlans, futureClients, extraClient, otherMonthly, raiseFrom, raiseUntil, raises])

  function applyLoaded(row) {
    const data = row.data || {}
    setScenarioId(row.id)
    setScenarioName(row.name)
    setCurrentScenario(row.id)
    if (data.raiseFrom) setRaiseFrom(data.raiseFrom)
    setRaiseUntil(data.raiseUntil || '')
    setRaises(data.raises || {})
    setExtraClient(data.extraClient || '')
    if (data.otherMonthly != null) setOtherMonthly(data.otherMonthly)
    setClientEnds(data.clientEnds || {})
    setClientPlans(data.clientPlans || {})
    setFutureClients(data.futureClients || [])
    setSaved(`Opened “${row.name}”.`)
  }

  function setAllRaises(pctValue) {
    if (!pctValue) {
      setRaises({})
      return
    }
    const keys = people.filter((row) => String(row.worker_type || '').toLowerCase() !== 'contractor').map((row) => row.id || row.name)
    const already = keys.length && keys.every((key) => Number(raises[key]) === pctValue)
    if (already) {
      setRaises({})
      return
    }
    const next = {}
    for (const key of keys) next[key] = pctValue
    setRaises(next)
  }

  const activeRaisePct = (() => {
    const vals = Object.values(raises).map((value) => Number(value)).filter((value) => value > 0)
    if (!vals.length) return 0
    return vals.every((value) => value === vals[0]) ? vals[0] : null
  })()

  const state = { raiseFrom, raiseUntil, raises, extraClient, otherMonthly, clientEnds, clientPlans, futureClients, scenarioId, scenarioName }

  if (!ready) return <div className="p-8 text-sm text-slate-500">Loading…</div>

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
      <PageHeader
        title="Scenarios"
        description="This year’s books first. Then change one thing."
        actions={
          <Button
            type="button"
            className="bg-[#FF6B00] text-white hover:bg-[#e05f00]"
            disabled={saving}
            onClick={async () => {
              setSaving(true)
              try {
                const result = await saveScenario(payloadOf(state), { name: scenarioName, id: scenarioId || undefined })
                setScenarioId(result.id)
                setScenarioList(result.list || listScenarios())
                setSaved(`Saved “${scenarioName}”.`)
              } finally {
                setSaving(false)
              }
            }}
          >
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Save
          </Button>
        }
      />
      <p className="mt-2 text-sm text-slate-500">
        <Link className="font-medium text-[#1644ED]" to="/people">People</Link>
        {' · '}
        <Link className="font-medium text-[#1644ED]" to="/accounts">Clients</Link>
      </p>
      {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
      {saved ? <p className="mt-3 text-sm text-emerald-700">{saved}</p> : null}

      <div className="mt-6 rounded-2xl border-2 border-[#1644ED] bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-[#1644ED]">Room to pay people</p>
        <p className={cn('mt-2 text-5xl font-bold tabular-nums', projection.avgProfit < 0 ? 'text-red-600' : 'text-slate-900')}>
          {money(projection.avgProfit)}
          <span className="ml-2 text-2xl font-semibold text-slate-500">/ mo</span>
        </p>
        <p className="mt-3 text-2xl font-semibold tabular-nums">Net margin {pct(projection.avgMargin)}</p>
        <p className="mt-2 text-sm text-slate-600">
          Books this year: {money(BOOKS.noiAvg)} / mo and {pct(BOOKS.noiAvg / BOOKS.incomeAvg)} on {money(BOOKS.incomeAvg)} in.
          Tightest month in this plan: {money(projection.minProfit)}.
        </p>
      </div>

      <div className="mt-6 rounded-2xl border bg-white p-5 shadow-sm">
        <p className="text-sm font-semibold">Plans</p>
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <Input className="h-10 w-56" value={scenarioName} onChange={(event) => setScenarioName(event.target.value)} placeholder="Name" />
          <Button
            type="button"
            variant="outline"
            onClick={async () => {
              const name = window.prompt('Name this plan', scenarioName || 'New plan')
              if (!name) return
              const result = await saveScenarioAs(payloadOf(state), name)
              setScenarioId(result.id)
              setScenarioName(name)
              setScenarioList(result.list || listScenarios())
              setSaved(`Saved “${name}”.`)
            }}
          >
            Save as new
          </Button>
        </div>
        <div className="mt-3 space-y-2">
          {scenarioList.map((row) => (
            <div key={row.id} className="flex items-center justify-between gap-2 rounded-xl border px-3 py-2">
              <p className="text-sm font-medium">{row.name}{row.id === scenarioId ? ' · open' : ''}</p>
              <div className="flex gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => applyLoaded(row)}>Open</Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-red-600"
                  onClick={() => {
                    if (!window.confirm(`Delete “${row.name}”?`)) return
                    const next = deleteScenario(row.id)
                    setScenarioList(next)
                    if (scenarioId === row.id) {
                      setScenarioId('')
                      setScenarioName('This year')
                    }
                    setSaved(`Deleted “${row.name}”.`)
                  }}
                >
                  Delete
                </Button>
              </div>
            </div>
          ))}
          {!scenarioList.length ? <p className="text-sm text-slate-500">No saved plans yet.</p> : null}
        </div>
      </div>

      <div className="mt-6 rounded-2xl border bg-white p-5 shadow-sm">
        <p className="text-sm font-semibold">Raises</p>
        <p className="text-sm text-slate-500">Click the same % to turn it off.</p>
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Start
            <Input className="mt-1 h-10" type="month" value={raiseFrom} onChange={(event) => setRaiseFrom(event.target.value)} />
          </label>
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            End
            <Input className="mt-1 h-10" type="month" value={raiseUntil} onChange={(event) => setRaiseUntil(event.target.value)} />
          </label>
          {[2, 3, 4].map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setAllRaises(value)}
              className={cn('h-10 rounded-full px-4 text-sm font-semibold', activeRaisePct === value ? 'bg-orange-500 text-white' : 'bg-slate-100 text-slate-700')}
            >
              {value}%
            </button>
          ))}
          <button type="button" className="h-10 rounded-full bg-slate-100 px-4 text-sm font-semibold" onClick={() => { setRaises({}); setRaiseUntil('') }}>
            Off
          </button>
        </div>
      </div>

      <div className="mt-6 rounded-2xl border bg-white p-5 shadow-sm">
        <p className="text-sm font-semibold">Money in</p>
        <p className="mt-1 text-sm text-slate-500">Retainers {money(BOOKS.recurringAug)} + other projects {money(BOOKS.otherAvg)} = {money(BOOKS.incomeAvg)} / mo.</p>
        <label className="mt-3 block max-w-xs text-xs font-semibold uppercase tracking-wide text-slate-500">
          Other projects / mo
          <Input className="mt-1 h-10" value={otherMonthly} placeholder={String(Math.round(BOOKS.otherAvg))} onChange={(event) => setOtherMonthly(event.target.value)} />
        </label>
        <label className="mt-3 block max-w-xs text-xs font-semibold uppercase tracking-wide text-slate-500">
          Extra / mo
          <Input className="mt-1 h-10" value={extraClient} onChange={(event) => setExtraClient(event.target.value)} />
        </label>
      </div>

      <div className="mt-6 overflow-hidden rounded-2xl border bg-white shadow-sm">
        <div className="border-b px-5 py-4">
          <p className="text-sm font-semibold">Retainer changes</p>
          <p className="text-sm text-slate-500">End this $, start the next $ later.</p>
        </div>
        {clients.map((client) => {
          const plan = clientPlans[client.id] || {}
          return (
            <div key={client.id} className="grid gap-2 border-t px-5 py-3 sm:grid-cols-[1fr_90px_130px_90px_130px]">
              <p className="font-medium">{client.name}</p>
              <p className="tabular-nums text-slate-600">{money(Number(client.monthly) || 0)}</p>
              <Input type="month" value={plan.end || clientEnds[client.id] || ''} onChange={(event) => {
                const end = event.target.value
                setClientEnds((current) => ({ ...current, [client.id]: end }))
                setClientPlans((current) => ({ ...current, [client.id]: { ...current[client.id], end } }))
              }} />
              <Input placeholder="Next $" value={plan.nextAmount || ''} onChange={(event) => setClientPlans((current) => ({ ...current, [client.id]: { ...current[client.id], nextAmount: event.target.value } }))} />
              <Input type="month" value={plan.nextFrom || ''} onChange={(event) => setClientPlans((current) => ({ ...current, [client.id]: { ...current[client.id], nextFrom: event.target.value } }))} />
            </div>
          )
        })}
      </div>

      <div className="mt-6 overflow-auto rounded-2xl border bg-white shadow-sm">
        <div className="border-b px-5 py-4">
          <p className="text-sm font-semibold">12 months</p>
        </div>
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-2">Month</th>
              <th className="px-4 py-2 text-right">In</th>
              <th className="px-4 py-2 text-right">Out</th>
              <th className="px-4 py-2 text-right">Left</th>
              <th className="px-4 py-2 text-right">Margin</th>
            </tr>
          </thead>
          <tbody>
            {projection.months.map((row) => (
              <tr key={row.key} className="border-t">
                <td className={cn('px-4 py-2', row.raised && 'font-semibold text-orange-700')}>{row.label}</td>
                <td className="px-4 py-2 text-right tabular-nums">{money(row.revenue)}</td>
                <td className="px-4 py-2 text-right tabular-nums">{money(row.cost)}</td>
                <td className={cn('px-4 py-2 text-right tabular-nums font-medium', row.profit < 0 ? 'text-red-600' : 'text-emerald-700')}>{money(row.profit)}</td>
                <td className="px-4 py-2 text-right tabular-nums">{pct(row.margin)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
