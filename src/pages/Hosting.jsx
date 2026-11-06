import { useEffect, useMemo, useState } from 'react'
import { ExternalLink, RefreshCw } from 'lucide-react'
import { fetchHosting } from '../lib/hosting'

export default function Hosting() {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [profitOpen, setProfitOpen] = useState(false)

  const load = () => {
    setLoading(true)
    setError('')
    fetchHosting()
      .then(setData)
      .catch((err) => setError(err.message || 'Could not load hosting'))
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  const alerts = (data?.retainers || []).filter((row) => row.level === 'over' || row.level === 'warn')
  const tier2 = (data?.retainers || []).filter((row) => row.tier === 'Tier-2')
  const clients = [...(data?.retainers || [])].sort((a, b) => {
    const tier = (a.tier === 'Tier-2' ? 0 : 1) - (b.tier === 'Tier-2' ? 0 : 1)
    if (tier) return tier
    return shortClientName(a.client).localeCompare(shortClientName(b.client))
  })

  return (
    <div className="min-h-full bg-[#f6f7fb] px-4 py-6 lg:px-8">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Hosting</h1>
          <p className="mt-1 text-sm text-slate-500">Hosting and maintenance retainers.</p>
        </div>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {error && !data ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="text-lg font-semibold text-slate-900">Hosting</h2>
          <p className="mt-2 text-sm text-slate-500">{error}</p>
        </section>
      ) : null}

      {loading && !data ? <p className="text-sm text-slate-500">Loading retainers…</p> : null}

      {data ? (
        <>
          <div className="mb-5 grid grid-cols-1 items-stretch gap-3 min-[900px]:grid-cols-3">
            <div className="grid h-full grid-cols-2 gap-3 min-[900px]:grid-cols-1 min-[900px]:grid-rows-3">
              <Kpi label="Active retainers" value={data.kpis.active} detail={`${data.kpis.tier1} Tier 1 · ${data.kpis.tier2} Tier 2`} />
              <Kpi label="Annual revenue" value={money(data.kpis.annualRevenue)} detail={`${data.kpis.hosting} hosting · ${data.kpis.hostingMaintenance} both · ${data.kpis.maintenance} maintenance`} />
              <Kpi
                label="Projected annual profit"
                value={money(data.profit.profit)}
                tone={data.profit.profit < 0 ? 'loss' : 'profit'}
                detail={`Revenue ${money(data.profit.fees)} · Kinsta ${money(data.profit.kinsta)} · Labor ${money(data.profit.labor)}`}
                margin={marginLabel(data.profit.margin)}
                note={profitNote(data.profit)}
                onClick={() => setProfitOpen(true)}
                active={profitOpen}
                className="col-span-2 min-[900px]:col-span-1"
              />
            </div>
            <div className="min-[900px]:col-span-2 min-[900px]:h-full">
              <InvoiceRevenue retainers={data.retainers} />
            </div>
          </div>

          {alerts.length ? (
            <section className="mb-5 rounded-2xl border border-slate-200 bg-white p-4">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Hours this billing year</h2>
              <ul className="mt-3 grid gap-2 md:grid-cols-2">
                {alerts.map((row) => (
                  <li key={row.key} className={`rounded-xl px-3 py-2 text-sm ${row.level === 'over' ? 'bg-red-50 text-red-800' : 'bg-amber-50 text-amber-900'}`}>
                    <span className="font-medium">{row.client}</span>
                    <span className="mt-0.5 block text-xs">
                      {row.currentHours}h used of {row.allottedHours}h · {row.percentUsed}%
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Biannual updates</h2>
            {tier2.length ? (
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {[...tier2].sort(compareUpdates).map((row) => (
                  <UpdateCard key={row.key} row={row} />
                ))}
              </div>
            ) : (
              <p className="mt-2 text-sm text-slate-500">No Tier 2 retainers.</p>
            )}
          </section>

          <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-4">
            <div className="mb-3 flex items-baseline justify-between gap-3">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Clients</h2>
              <p className="text-sm text-slate-500">{clients.length}</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-2 py-2 font-medium">Client</th>
                    <th className="px-2 py-2 font-medium">Tier</th>
                    <th className="px-2 py-2 font-medium">Service</th>
                    <th className="px-2 py-2 font-medium">Annual revenue</th>
                    <th className="px-2 py-2 font-medium">Hours</th>
                  </tr>
                </thead>
                <tbody>
                  {clients.map((row) => (
                    <tr key={row.key} className="border-t border-slate-100 align-top">
                      <td className="px-2 py-3">
                        <a className="inline-flex items-center gap-1 font-medium text-slate-900 hover:text-[#1644ED]" href={row.url} target="_blank" rel="noreferrer">
                          {shortClientName(row.client)}
                          {row.launching ? <LaunchingPill /> : null}
                          <ExternalLink className="h-3 w-3" />
                        </a>
                        <span className="mt-0.5 block text-xs text-slate-500">{row.key}</span>
                      </td>
                      <td className="px-2 py-3 whitespace-nowrap"><TierPill tier={row.tier} /></td>
                      <td className="px-2 py-3 whitespace-nowrap"><ServiceTag service={row.service} /></td>
                      <td className="px-2 py-3">{row.amountPending ? <em className="text-slate-500">Pending</em> : money(row.annualFee)}</td>
                      <td className="px-2 py-3"><HoursCell row={row} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!clients.length ? <p className="px-2 py-6 text-sm text-slate-500">No retainers.</p> : null}
            </div>
          </section>
          {profitOpen ? <ProfitBreakdown profit={data.profit} onClose={() => setProfitOpen(false)} /> : null}
        </>
      ) : null}
    </div>
  )
}

const CHART_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const CHART_WIDTH = 720
const CHART_HEIGHT = 260
const CHART_LEFT = 72
const CHART_RIGHT = 16
const CHART_TOP = 16
const CHART_BOTTOM = 32

function InvoiceRevenue({ retainers }) {
  const [mode, setMode] = useState('monthly')
  const [hover, setHover] = useState(null)
  const model = useMemo(() => revenueByMonth(retainers), [retainers])
  const shown = mode === 'running'
    ? model.months.map((month, index) => model.months.slice(0, index + 1).reduce((sum, item) => sum + item.total, 0))
    : model.months.map((month) => month.total)
  const peak = Math.max(...shown, 0)
  const scale = chartTicks(peak)
  const top = scale[scale.length - 1] || 1
  const plotWidth = CHART_WIDTH - CHART_LEFT - CHART_RIGHT
  const plotHeight = CHART_HEIGHT - CHART_TOP - CHART_BOTTOM
  const xAt = (index) => CHART_LEFT + (index * plotWidth) / 11
  const yAt = (value) => CHART_TOP + (1 - value / top) * plotHeight
  const points = shown.map((value, index) => ({ x: xAt(index), y: yAt(value) }))
  const active = hover == null ? null : model.months[hover]

  return (
    <section className="flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-4">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Revenue by invoice month</h2>
          <div className="mt-2 inline-flex rounded-lg bg-slate-100 p-0.5 text-sm">
            <button
              type="button"
              onClick={() => setMode('monthly')}
              className={`rounded-md px-2.5 py-1 ${mode === 'monthly' ? 'bg-white font-medium text-slate-900 shadow-sm' : 'text-slate-500'}`}
            >
              Monthly
            </button>
            <button
              type="button"
              onClick={() => setMode('running')}
              className={`rounded-md px-2.5 py-1 ${mode === 'running' ? 'bg-white font-medium text-slate-900 shadow-sm' : 'text-slate-500'}`}
            >
              Running total
            </button>
          </div>
        </div>
        <p className="text-lg font-semibold text-slate-900">{money(model.yearly)}</p>
      </div>
      <div className="relative min-h-64 flex-1">
        <svg viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`} className="h-full min-h-64 w-full" role="img" aria-label="Revenue by invoice month" onMouseLeave={() => setHover(null)}>
          {scale.map((tick) => (
            <g key={tick}>
              <line x1={CHART_LEFT} x2={CHART_WIDTH - CHART_RIGHT} y1={yAt(tick)} y2={yAt(tick)} stroke="#e2e8f0" />
              <text x={CHART_LEFT - 8} y={yAt(tick) + 4} textAnchor="end" fill="#94a3b8" fontSize="11">{money(tick)}</text>
            </g>
          ))}
          <polyline points={points.map((point) => `${point.x},${point.y}`).join(' ')} fill="none" stroke="#1644ED" strokeWidth="2" />
          {points.map((point, index) => (
            <circle key={CHART_MONTHS[index]} cx={point.x} cy={point.y} r="4" fill="#1644ED" />
          ))}
          {CHART_MONTHS.map((month, index) => (
            <text key={month} x={xAt(index)} y={CHART_HEIGHT - 8} textAnchor="middle" fill="#64748b" fontSize="11">{month.slice(0, 3)}</text>
          ))}
          {CHART_MONTHS.map((month, index) => (
            <rect
              key={`${month}-hit`}
              x={xAt(index) - plotWidth / 22}
              y={CHART_TOP}
              width={plotWidth / 11}
              height={plotHeight}
              fill="transparent"
              onMouseEnter={() => setHover(index)}
            />
          ))}
        </svg>
        {active ? (
          <div
            className="pointer-events-none absolute top-2 z-10 w-max max-w-sm rounded-lg bg-slate-900 px-3 py-2 text-xs text-white shadow-lg"
            style={{ left: `${Math.min(Math.max((hover / 11) * 100, 8), 68)}%` }}
          >
            <p className="font-semibold">{active.name} · {moneyExact(active.total)}</p>
            {active.clients.length ? (
              <ul className="mt-1 max-h-40 space-y-0.5 overflow-auto">
                {active.clients.map((client) => (
                  <li key={client.key} className="flex justify-between gap-3">
                    <span>{client.client}</span>
                    <span className="shrink-0">{moneyExact(client.amount)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-1 text-slate-300">No invoices</p>
            )}
          </div>
        ) : null}
      </div>
      {model.missing.length ? (
        <div className="mt-3 border-t border-slate-100 pt-3">
          <p className="text-xs font-medium text-amber-700">Missing invoice month or amount.</p>
          <ul className="mt-1 text-sm text-slate-600">
            {model.missing.map((row) => <li key={row.key}>{row.client}</li>)}
          </ul>
        </div>
      ) : null}
    </section>
  )
}

function revenueByMonth(retainers) {
  const months = CHART_MONTHS.map((name) => ({ name, total: 0, clients: [] }))
  const missing = []
  for (const row of retainers || []) {
    if (row.annualFee == null || (!row.chartMonth && !row.chartMonthly)) {
      missing.push(row)
      continue
    }
    if (row.chartMonthly) {
      const share = row.annualFee / 12
      months.forEach((month) => {
        month.total += share
        month.clients.push({ key: row.key, client: row.client, amount: share })
      })
      continue
    }
    const month = months.find((item) => item.name === row.chartMonth)
    if (!month) {
      missing.push(row)
      continue
    }
    month.total += row.annualFee
    month.clients.push({ key: row.key, client: row.client, amount: row.annualFee })
  }
  months.forEach((month) => month.clients.sort((a, b) => b.amount - a.amount || a.client.localeCompare(b.client)))
  return {
    months,
    missing: missing.sort((a, b) => a.client.localeCompare(b.client)),
    yearly: months.reduce((sum, month) => sum + month.total, 0),
  }
}

function chartTicks(max) {
  if (!(max > 0)) return [0]
  const rough = max / 4
  const power = 10 ** Math.floor(Math.log10(rough))
  const step = [1, 2, 2.5, 5, 10].map((size) => size * power).find((size) => size >= rough) || power * 10
  const ticks = []
  for (let value = 0; value < max + step * 0.01; value += step) ticks.push(Math.round(value * 100) / 100)
  if (ticks[ticks.length - 1] < max) ticks.push(Math.round((ticks[ticks.length - 1] + step) * 100) / 100)
  return ticks
}

function moneyExact(value) {
  const cents = Math.round(Math.abs(value) * 100) % 100
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: cents ? 2 : 0,
  }).format(value || 0)
}

function TierPill({ tier }) {
  const tier2 = tier === 'Tier-2'
  return (
    <span className={`inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${tier2 ? 'bg-teal-50 text-teal-800' : 'bg-slate-100 text-slate-600'}`}>
      {tier2 ? 'Tier 2' : 'Tier 1'}
    </span>
  )
}

function ServiceTag({ service }) {
  if (service === 'Hosting + Maintenance') {
    return (
      <span className="inline-flex items-center whitespace-nowrap rounded-full bg-gradient-to-r from-[#e8eeff] to-[#f3e8ff] px-2 py-0.5 text-xs font-medium">
        <span className="text-[#1644ED]">Hosting</span>
        <span className="mx-1 text-slate-300">+</span>
        <span className="text-[#7c3aed]">Maintenance</span>
      </span>
    )
  }
  const hosting = service === 'Hosting'
  return (
    <span className={`inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${hosting ? 'bg-[#e8eeff] text-[#1644ED]' : 'bg-[#f3e8ff] text-[#7c3aed]'}`}>
      {service}
    </span>
  )
}

function Kpi({ label, value, detail, margin, note, tone, onClick, active, className = '' }) {
  const classNames = `flex h-full flex-col justify-center rounded-2xl border bg-white p-4 text-left ${active ? 'border-[#1644ED]' : 'border-slate-200'} ${onClick ? 'hover:border-[#1644ED]' : ''} ${className}`
  const valueColor = tone === 'loss' || tone === 'over' ? 'text-red-700' : tone === 'profit' ? 'text-emerald-600' : 'text-slate-900'
  const body = (
    <>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${valueColor}`}>{value}</p>
      <p className="mt-1 text-xs text-slate-500">{detail}</p>
      {margin ? <p className="mt-1 text-lg font-bold text-slate-900">{margin}</p> : null}
      {note ? <p className="mt-1 text-xs text-slate-400">{note}</p> : null}
    </>
  )
  if (onClick) {
    return (
      <button type="button" onClick={onClick} aria-pressed={!!active} className={classNames}>
        {body}
      </button>
    )
  }
  return <section className={classNames}>{body}</section>
}

const CYCLE_LABEL = {
  done: 'Done',
  scheduled: 'Scheduled',
  needs: 'Needs ticket',
  overdue: 'Overdue',
  upcoming: 'Upcoming',
}

const CYCLE_RANK = { overdue: 0, needs: 1, scheduled: 2, upcoming: 3, done: 4, na: 5 }

const CYCLE_TEXT = {
  scheduled: 'text-[#1644ED]',
  needs: 'text-amber-800',
  overdue: 'text-red-700',
  upcoming: 'text-slate-500',
}

function compareUpdates(a, b) {
  const rank = updateRank(a) - updateRank(b)
  if (rank) return rank
  return a.client.localeCompare(b.client)
}

function updateRank(row) {
  const june = CYCLE_RANK[row.updates?.june?.state] ?? 5
  const november = CYCLE_RANK[row.updates?.november?.state] ?? 5
  return Math.min(june, november) * 10 + Math.max(june, november)
}

function shortClientName(name) {
  const raw = String(name || '').trim()
  const first = raw.split(/\s+/)[0]?.replace(/[-–—+]/g, '') || ''
  const keepFirst = /^(hosting|maintenance)$/i.test(first)
  const short = raw
    .replace(/\btier[-\s]?[12]\b/gi, '')
    .replace(/\bhosting\b/gi, '')
    .replace(/\bmaintenance\b/gi, '')
    .replace(/\+/g, '')
    .replace(/[-–—]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (keepFirst) return `${first} ${short}`.replace(/\s+/g, ' ').trim()
  return short || raw
}

function LaunchingPill() {
  return <span className="inline-flex shrink-0 whitespace-nowrap rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">Launching</span>
}

function UpdateCard({ row }) {
  return (
    <article className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        <a className="text-[15px] font-semibold leading-snug tracking-tight text-slate-900 hover:text-[#1644ED]" href={row.url} target="_blank" rel="noreferrer">
          {shortClientName(row.client)}
        </a>
        {row.launching ? <LaunchingPill /> : null}
      </div>
      <div className="grid gap-2">
        <CycleRow label="JUN" cycle={row.updates?.june} />
        <CycleRow label="NOV" cycle={row.updates?.november} />
      </div>
    </article>
  )
}

function marginLabel(value) {
  if (value == null) return ''
  const rounded = Math.round(value * 10) / 10
  return `${Number.isInteger(rounded) ? rounded : rounded.toFixed(1)}% margin`
}

function profitNote(profit) {
  if (!profit) return ''
  const parts = []
  if (profit.missingBillingMonths) {
    const count = profit.missingBillingMonths
    parts.push(`${count} missing a billing month`)
  }
  return parts.join(' · ')
}

function ProfitBreakdown({ profit, onClose }) {
  useEffect(() => {
    const onKey = (event) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-auto bg-slate-900/40 p-4" onClick={onClose}>
      <div
        className="mt-10 w-full max-w-3xl rounded-2xl bg-white p-5 shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="hosting-profit-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="hosting-profit-title" className="text-lg font-semibold text-slate-900">Projected annual profit</h2>
            <p className="mt-1 text-sm text-slate-500">Each row is the revenue minus projected labor. Kinsta is subtracted once, on the card.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg px-2 py-1 text-sm text-slate-500 hover:bg-slate-100">Close</button>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-2 py-2 font-medium">Client</th>
                <th className="px-2 py-2 font-medium">Revenue</th>
                <th className="px-2 py-2 font-medium">Projected hours</th>
                <th className="px-2 py-2 font-medium">Projected labor</th>
                <th className="px-2 py-2 font-medium">Projected profit</th>
              </tr>
            </thead>
            <tbody>
              {(profit.clients || []).map((row) => (
                <tr key={row.key} className="border-t border-slate-100">
                  <td className="px-2 py-2">
                    <a className="font-medium text-slate-900 hover:text-[#1644ED]" href={row.url} target="_blank" rel="noreferrer">{row.client}</a>
                  </td>
                  <td className="px-2 py-2">{row.fee == null ? <em className="text-slate-500">Pending</em> : money(row.fee)}</td>
                  <td className="px-2 py-2">{hourCount(row.projectedHours)}h</td>
                  <td className="px-2 py-2">{money(row.projectedLabor)}</td>
                  <td className={`px-2 py-2 font-medium ${row.projectedProfit < 0 ? 'text-red-700' : 'text-emerald-700'}`}>{money(row.projectedProfit)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function CycleRow({ label, cycle }) {
  const done = cycle?.state === 'done'
  return (
    <div className="flex items-baseline justify-between gap-3">
      <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{label}</p>
      {cycle?.state === 'na' ? (
        <span className="text-sm font-medium text-slate-400">N/A</span>
      ) : done ? (
        <span className="text-base font-semibold text-emerald-600" aria-label="Done">✓</span>
      ) : (
        <p className={`text-right text-sm font-medium ${CYCLE_TEXT[cycle?.state] || CYCLE_TEXT.upcoming}`}>
          {CYCLE_LABEL[cycle?.state] || 'Upcoming'}
          {cycle?.key ? (
            <>
              {' · '}
              <a className="hover:underline" href={cycle.url} target="_blank" rel="noreferrer">{cycle.key}</a>
            </>
          ) : null}
        </p>
      )}
    </div>
  )
}

function HoursCell({ row }) {
  const missing = row.billingMonthMissing || row.allottedHours == null
  const label = row.billingMonthMissing
    ? 'Billing month missing'
    : row.allottedHours == null
      ? 'Pending'
      : `${hourCount(row.currentHours)} of ${hourCount(row.allottedHours)}h`
  return (
    <div className="w-40">
      <span className={missing ? 'text-amber-700' : 'text-slate-800'}>{label}</span>
      {missing ? null : <UsageBar percent={row.percentUsed} />}
    </div>
  )
}

function UsageBar({ percent }) {
  const value = percent == null ? 0 : percent
  const width = value <= 0 ? 0 : Math.max(Math.min(value, 100), 4)
  const color = value > 100 ? 'bg-red-600' : value >= 80 ? 'bg-amber-500' : 'bg-emerald-500'
  return (
    <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-slate-200">
      <span className={`block h-full rounded-full ${color}`} style={{ width: `${width}%` }} />
    </span>
  )
}

function money(value) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value || 0)
}

function hourCount(value) {
  if (value == null) return '—'
  const rounded = Math.round(value * 10) / 10
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1)
}
