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

function withCommas(value) {
  const text = String(value ?? '')
  const negative = text.trim().startsWith('-')
  const raw = text.replace(/[^0-9.]/g, '')
  if (!raw) return ''
  const parts = raw.split('.')
  const whole = parts[0]
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  const body = parts.length > 1 ? grouped + '.' + parts.slice(1).join('').slice(0, 2) : grouped
  return negative ? '-' + body : body
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
    hireAmount: state.hireAmount,
    hireFrom: state.hireFrom,
    hireAmount: state.hireAmount,
    hireFrom: state.hireFrom,
    otherMonthly: state.otherMonthly,
    offBooks: state.offBooks,
    overhead: state.overhead,
    clientEnds: state.clientEnds,
    clientPlans: state.clientPlans,
    futureClients: state.futureClients,
    currentId: state.scenarioId,
    currentName: state.scenarioName,
  }
}


function BreakEvenChart({ months }) {
  const [hover, setHover] = useState(null)
  if (!months?.length) return null
  const width = 920
  const height = 300
  const pad = { l: 8, r: 8, t: 16, b: 8 }
  const innerW = width - pad.l - pad.r
  const innerH = height - pad.t - pad.b
  const maxY = Math.max(1, ...months.map((row) => Math.max(row.revenue, row.cost, row.staff, 0)))
  const minY = Math.min(0, ...months.map((row) => row.profit))
  const span = maxY - minY
  const x = (i) => pad.l + (months.length === 1 ? innerW / 2 : (i / (months.length - 1)) * innerW)
  const y = (value) => pad.t + innerH - ((value - minY) / span) * innerH
  const line = (key) => months.map((row, i) => `${i ? 'L' : 'M'} ${x(i)} ${y(row[key])}`).join(' ')
  const avgCost = months.reduce((sum, row) => sum + row.cost, 0) / months.length
  const zero = y(0)
  const active = hover || null
  return (
    <div className="mt-6 rounded-2xl border bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-slate-900">Revenue and costs</p>
          <p className="text-xs text-slate-500">Purple on yellow means you’re even. That’s real when leftover is near $0. Hover for the dollars.</p>
        </div>
        <p className="text-xs font-medium text-slate-600">Break-even at {money(avgCost)} / mo</p>
      </div>
      <div className="relative mt-3">
        <svg viewBox={`0 0 ${width} ${height}`} className="h-64 w-full" preserveAspectRatio="none">
          {[0.25, 0.5, 0.75].map((tick) => (
            <line key={tick} x1={0} x2={width} y1={pad.t + innerH * (1 - tick)} y2={pad.t + innerH * (1 - tick)} stroke="#e2e8f0" />
          ))}
          <line x1={0} x2={width} y1={zero} y2={zero} stroke="#fca5a5" strokeDasharray="4 4" strokeWidth="1.5" />
          {active ? <line x1={x(months.indexOf(active))} x2={x(months.indexOf(active))} y1={pad.t} y2={pad.t + innerH} stroke="#cbd5e1" /> : null}
          <path d={line('revenue')} fill="none" stroke="#7c3aed" strokeWidth="3" />
          <path d={line('cost')} fill="none" stroke="#ca8a04" strokeWidth="2.5" strokeDasharray="7 6" />
          <path d={line('staff')} fill="none" stroke="#ea580c" strokeWidth="2.5" />
          <path d={line('profit')} fill="none" stroke="#0891b2" strokeWidth="3" />
          {months.map((row, i) => (
            <g key={row.key}>
              <circle cx={x(i)} cy={y(row.revenue)} r="4.5" fill="#7c3aed" />
              <circle cx={x(i)} cy={y(row.cost)} r="4.5" fill="#ca8a04" />
              <circle cx={x(i)} cy={y(row.staff)} r="4" fill="#ea580c" />
              <circle cx={x(i)} cy={y(row.profit)} r="4.5" fill="#0891b2" />
            </g>
          ))}
        </svg>
        <div className="absolute inset-0 flex">
          {months.map((row) => (
            <div key={row.key} className="h-full flex-1 cursor-crosshair" onMouseEnter={() => setHover(row)} onMouseLeave={() => setHover(null)} />
          ))}
        </div>
        {active ? (
          <div className="pointer-events-none absolute left-1/2 top-6 z-10 w-64 -translate-x-1/2 rounded-xl border bg-white p-3 text-sm shadow-lg">
            <p className="font-semibold">{active.label}</p>
            <p className="mt-2 tabular-nums text-cyan-700">Left {money(active.profit)}</p>
            <p className="tabular-nums text-violet-700">In {money(active.revenue)}</p>
            <p className="tabular-nums text-orange-700">Team {money(active.staff)}</p>
            <p className="tabular-nums text-yellow-700">Total out {money(active.cost)}</p>
            <p className="mt-1 font-medium tabular-nums">Margin {pct(active.margin)}</p>
          </div>
        ) : null}
      </div>
      <div className="mt-1 grid" style={{ gridTemplateColumns: `repeat(${months.length}, minmax(0, 1fr))` }}>
        {months.map((row) => (
          <p key={row.key} className="text-center text-[10px] text-slate-500">{row.label}</p>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-4 text-xs text-slate-600">
        <span className="text-violet-700">● In</span>
        <span className="text-yellow-700">● Total out</span>
        <span className="text-orange-700">● Team</span>
        <span className="text-cyan-700">● Left</span>
      </div>
    </div>
  )
}


function LeftChart({ months }) {
  const [hover, setHover] = useState(null)
  if (!months?.length) return null
  const width = 920
  const height = 220
  const pad = { l: 8, r: 8, t: 16, b: 8 }
  const innerW = width - pad.l - pad.r
  const innerH = height - pad.t - pad.b
  const profits = months.map((row) => row.profit)
  const rawMax = Math.max(0, ...profits)
  const rawMin = Math.min(0, ...profits)
  const padY = Math.max(5000, (rawMax - rawMin) * 0.2)
  const maxY = rawMax + padY
  const minY = rawMin - padY
  const span = maxY - minY || 1
  const x = (i) => pad.l + (months.length === 1 ? innerW / 2 : (i / (months.length - 1)) * innerW)
  const y = (value) => pad.t + innerH - ((value - minY) / span) * innerH
  const line = months.map((row, i) => `${i ? 'L' : 'M'} ${x(i)} ${y(row.profit)}`).join(' ')
  const zero = y(0)
  const active = hover || null
  return (
    <div className="mt-4 rounded-2xl border bg-white p-5 shadow-sm">
      <p className="text-sm font-semibold text-slate-900">What’s left (zoomed in)</p>
      <p className="text-xs text-slate-500">Same months. This scale is dollars left, not the $160k in/out lines. $0 is the red dotted line.</p>
      <div className="relative mt-3">
        <svg viewBox={`0 0 ${width} ${height}`} className="h-48 w-full" preserveAspectRatio="none">
          <line x1={0} x2={width} y1={zero} y2={zero} stroke="#ef4444" strokeDasharray="4 4" strokeWidth="1.5" />
          {active ? <line x1={x(months.indexOf(active))} x2={x(months.indexOf(active))} y1={pad.t} y2={pad.t + innerH} stroke="#cbd5e1" /> : null}
          <path d={line} fill="none" stroke="#0891b2" strokeWidth="3" />
          {months.map((row, i) => (
            <circle key={row.key} cx={x(i)} cy={y(row.profit)} r="5" fill={row.profit < 0 ? '#dc2626' : '#0891b2'} />
          ))}
        </svg>
        <div className="absolute inset-0 flex">
          {months.map((row) => (
            <div key={row.key} className="h-full flex-1 cursor-crosshair" onMouseEnter={() => setHover(row)} onMouseLeave={() => setHover(null)} />
          ))}
        </div>
        {active ? (
          <div className="pointer-events-none absolute left-1/2 top-4 z-10 w-56 -translate-x-1/2 rounded-xl border bg-white p-3 text-sm shadow-lg">
            <p className="font-semibold">{active.label}</p>
            <p className={active.profit < 0 ? 'mt-1 font-medium text-red-600' : 'mt-1 font-medium text-cyan-800'}>{money(active.profit)} left</p>
            <p className="tabular-nums text-slate-600">In {money(active.revenue)}</p>
            <p className="tabular-nums text-slate-600">Out {money(active.cost)}</p>
            <p className="tabular-nums">Gap {money(active.revenue - active.cost)}</p>
          </div>
        ) : null}
      </div>
      <div className="mt-1 grid" style={{ gridTemplateColumns: `repeat(${months.length}, minmax(0, 1fr))` }}>
        {months.map((row) => (
          <p key={row.key} className="text-center text-[10px] text-slate-500">{row.label}</p>
        ))}
      </div>
    </div>
  )
}

export default function Scenarios() {
  const { rows, ready, error } = useLaborRateRows()
  const retainers = useClientRetainers()
  const [raiseFrom, setRaiseFrom] = useState('2027-02')
  const [raiseUntil, setRaiseUntil] = useState('')
  const [raises, setRaises] = useState({})
  const [extraClient, setExtraClient] = useState('')
  const [hireAmount, setHireAmount] = useState('')
  const [hireFrom, setHireFrom] = useState('2027-01')
  const [otherMonthly, setOtherMonthly] = useState('')
  const [offBooks, setOffBooks] = useState('10,000')
  const [overhead, setOverhead] = useState('40,000')
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
      if (loaded.hireAmount != null) setHireAmount(loaded.hireAmount)
      if (loaded.hireFrom != null) setHireFrom(loaded.hireFrom)
      if (loaded.otherMonthly != null) setOtherMonthly(loaded.otherMonthly)
      if (loaded.offBooks != null) setOffBooks(loaded.offBooks)
      if (loaded.overhead != null) setOverhead(withCommas(loaded.overhead))
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
      const hire = (!hireFrom || key >= hireFrom) ? num(hireAmount) : 0
      const raisePctOn = raised ? Number(Object.values(raises).find((v) => Number(v) > 0) || 0) : 0
      const raiseExtra = Math.max(0, peopleRaised - peopleNow)
      const hireCost = hire * (1 + raisePctOn / 100)
      const staff = BOOKS.cogsAvg + raiseExtra + hireCost
      const opex = num(overhead) || 40000
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
      const sba = num(offBooks)
      const profit = BOOKS.noiAvg + (revenue - BOOKS.incomeAvg) - raiseExtra - hireCost - (opex - 40000) - sba
      const cost = revenue - profit
      months.push({
        key,
        label: date.toLocaleString('en-US', { month: 'short', year: '2-digit' }),
        staff,
        overhead: opex,
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
  }, [people, clients, clientEnds, clientPlans, futureClients, extraClient, hireAmount, hireFrom, otherMonthly, offBooks, overhead, raiseFrom, raiseUntil, raises])

  function applyLoaded(row) {
    const data = row.data || {}
    setScenarioId(row.id)
    setScenarioName(row.name)
    setCurrentScenario(row.id)
    if (data.raiseFrom) setRaiseFrom(data.raiseFrom)
    setRaiseUntil(data.raiseUntil || '')
    setRaises(data.raises || {})
    setExtraClient(data.extraClient || '')
    setHireAmount(data.hireAmount || '')
    setHireFrom(data.hireFrom || '2027-01')
    if (data.otherMonthly != null) setOtherMonthly(data.otherMonthly)
    if (data.offBooks != null) setOffBooks(data.offBooks)
    if (data.overhead != null) setOverhead(withCommas(data.overhead))
    setClientEnds(data.clientEnds || {})
    setClientPlans(data.clientPlans || {})
    setFutureClients(data.futureClients || [])
    setSaved(`Opened “${row.name}”.`)
  }

  function loadThisPlan() {
    const drop = ['jb white', 'white dds', 'crummack', 'criummack', 'paragon']
    const plans = { ...clientPlans }
    const ends = { ...clientEnds }
    for (const client of clients) {
      const name = String(client.name || '').toLowerCase()
      if (drop.some((bit) => name.includes(bit))) {
        plans[client.id] = { ...plans[client.id], end: '2026-11' }
        ends[client.id] = '2026-11'
      }
    }
    setClientPlans(plans)
    setClientEnds(ends)
    setHireAmount('4,200')
    setHireFrom('2027-01')
    setRaiseFrom('2027-02')
    setRaiseUntil('')
    setOverhead('40,000')
    const next = {}
    for (const row of people) {
      if (String(row.worker_type || '').toLowerCase() !== 'contractor') next[row.id || row.name] = 4
    }
    setRaises(next)
    setScenarioName('3 leave Dec, hire Jan, 4% Feb')
    setSaved('This plan is on the chart. Type the SBA loan if you want that out too.')
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

  const state = { raiseFrom, raiseUntil, raises, extraClient, hireAmount, hireFrom, otherMonthly, offBooks, overhead, clientEnds, clientPlans, futureClients, scenarioId, scenarioName }

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
        <p className="text-xs font-semibold uppercase tracking-wide text-[#1644ED]">Money left this month (average)</p>
        <p className={cn('mt-2 text-5xl font-bold tabular-nums', projection.avgProfit < 0 ? 'text-red-600' : 'text-slate-900')}>
          {money(projection.avgProfit)}
          <span className="ml-2 text-2xl font-semibold text-slate-500">/ mo</span>
        </p>
        <p className="mt-3 text-2xl font-semibold tabular-nums">That is {pct(projection.avgMargin)} of money in</p>
        <p className="mt-2 text-sm text-slate-600">
          This year left about $20,500 a month on the P&L. SBA loan starts at $10,000.
        </p>
        <div className="mt-4 flex flex-wrap gap-4">
        <label className="block max-w-sm text-sm font-semibold text-slate-700">
          Overhead / mo
          <Input className="mt-1 h-12 text-lg tabular-nums" value={withCommas(overhead)} onChange={(event) => setOverhead(withCommas(event.target.value))} placeholder="40,000" />
        </label>
        <label className="block max-w-sm text-sm font-semibold text-slate-700">
          SBA loan / mo
          <Input className="mt-1 h-12 text-lg tabular-nums" value={withCommas(offBooks)} onChange={(event) => setOffBooks(withCommas(event.target.value))} placeholder="10,000" />
        </label>
        </div>
        <p className="mt-2 text-sm text-slate-500">Overhead and the SBA loan both come out. They lower what’s left.</p>
      </div>

      <BreakEvenChart months={projection.months} />
      <LeftChart months={projection.months} />

      <div className="mt-6 rounded-2xl border bg-white p-5 shadow-sm">
        <p className="text-sm font-semibold">Plans</p>
        <Button type="button" className="mt-3 bg-[#1644ED] text-white hover:bg-[#1236c4]" onClick={loadThisPlan}>Load this plan: 3 leave Dec, hire Jan, 4% Feb</Button>
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
          <Input className="mt-1 h-10" value={otherMonthly} placeholder={withCommas(Math.round(BOOKS.otherAvg))} onChange={(event) => setOtherMonthly(withCommas(event.target.value))} />
        </label>
        <div className="mt-3 flex flex-wrap gap-3">
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            New person / mo
            <Input className="mt-1 h-10 w-36" value={hireAmount} onChange={(event) => setHireAmount(withCommas(event.target.value))} placeholder="4200" />
          </label>
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Starts
            <Input className="mt-1 h-10" type="month" value={hireFrom} onChange={(event) => setHireFrom(event.target.value)} />
          </label>
        </div>
      </div>

      <div className="mt-6 overflow-hidden rounded-2xl border bg-white shadow-sm">
        <div className="border-b px-5 py-4">
          <p className="text-sm font-semibold">Clients</p>
          <p className="text-sm text-slate-500">Last month they pay the current amount. Leave blank if they stay.</p>
        </div>
        <div className="hidden gap-2 border-t bg-slate-50 px-5 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500 sm:grid sm:grid-cols-[1fr_90px_150px_110px_150px]">
          <p>Client</p>
          <p>Now / mo</p>
          <p>Last month</p>
          <p>New amount</p>
          <p>New amount starts</p>
        </div>
        {clients.map((client) => {
          const plan = clientPlans[client.id] || {}
          return (
            <div key={client.id} className="grid gap-2 border-t px-5 py-3 sm:grid-cols-[1fr_90px_150px_110px_150px]">
              <p className="font-medium">{client.name}</p>
              <p className="tabular-nums text-slate-600">{money(Number(client.monthly) || 0)}</p>
              <label className="text-xs text-slate-500 sm:text-[0]">
                Last month
                <Input type="month" className="mt-1" value={plan.end || clientEnds[client.id] || ''} onChange={(event) => {
                  const end = event.target.value
                  setClientEnds((current) => ({ ...current, [client.id]: end }))
                  setClientPlans((current) => ({ ...current, [client.id]: { ...current[client.id], end } }))
                }} />
              </label>
              <label className="text-xs text-slate-500 sm:text-[0]">
                New amount
                <Input className="mt-1" placeholder="0 if they leave" value={plan.nextAmount || ''} onChange={(event) => setClientPlans((current) => ({ ...current, [client.id]: { ...current[client.id], nextAmount: event.target.value } }))} />
              </label>
              <label className="text-xs text-slate-500 sm:text-[0]">
                New amount starts
                <Input className="mt-1" type="month" value={plan.nextFrom || ''} onChange={(event) => setClientPlans((current) => ({ ...current, [client.id]: { ...current[client.id], nextFrom: event.target.value } }))} />
              </label>
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
