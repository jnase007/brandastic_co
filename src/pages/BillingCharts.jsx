const MRR_COLOR = '#5b21b6'
const OVERDUE_COLOR = '#94a3b8'
const OVERDUE_TOP = '#c2410c'
const CURRENT_COLOR = '#5b21b6'
const BANDS = [
  { until: 30, label: 'Under 30', swatch: '#86efac', bar: '#15803d' },
  { until: 60, label: '30–59', swatch: '#fde68a', bar: '#b45309' },
  { until: 90, label: '60–89', swatch: '#fdba74', bar: '#c2410c' },
  { until: Infinity, label: '90+ or none', swatch: '#fca5a5', bar: '#b91c1c' },
]

function money(value) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value || 0)
}

function shortLabel(name) {
  const text = String(name || '')
  return text.length > 26 ? `${text.slice(0, 24)}…` : text
}

function bandFor(days) {
  if (days == null || days >= 90) return BANDS[3]
  if (days >= 60) return BANDS[2]
  if (days >= 30) return BANDS[1]
  return BANDS[0]
}

function ChartCard({ title, children, testId }) {
  return (
    <section className="pr-panel" aria-label={title} data-testid={testId}>
      <div className="pr-panel-head">
        <h3>{title}</h3>
      </div>
      {children}
    </section>
  )
}

function HorizontalBars({ rows, valueKey, colorFor, empty }) {
  const ranked = [...rows].sort((a, b) => (b[valueKey] || 0) - (a[valueKey] || 0) || a.client.localeCompare(b.client))
  const max = ranked.reduce((peak, row) => Math.max(peak, row[valueKey] || 0), 0)
  if (!ranked.length || max <= 0) return <p className="pr-note">{empty}</p>
  return (
    <div className="grid gap-2.5">
      {ranked.map((row) => {
        const value = row[valueKey] || 0
        const width = `${Math.max((value / max) * 100, value > 0 ? 2 : 0)}%`
        return (
          <div key={row.client} className="grid grid-cols-[minmax(0,9.5rem)_minmax(0,1fr)_4.5rem] items-center gap-2">
            <span className="truncate text-xs font-semibold text-slate-800" title={row.client}>{shortLabel(row.client)}</span>
            <span className="block h-3 overflow-hidden rounded-full bg-slate-100">
              <span className="block h-full rounded-full" style={{ width, background: colorFor(row, value, max) }} />
            </span>
            <span className="text-right text-xs font-semibold text-slate-600">{money(value)}</span>
          </div>
        )
      })}
    </div>
  )
}

function DaysChart({ clients }) {
  const ranked = [...clients].sort((a, b) => {
    const aDays = a.days_since_last_payment ?? Number.POSITIVE_INFINITY
    const bDays = b.days_since_last_payment ?? Number.POSITIVE_INFINITY
    return bDays - aDays || a.client.localeCompare(b.client)
  })
  const finite = ranked.map((row) => row.days_since_last_payment).filter((days) => days != null)
  const peak = Math.max(90, ...finite, 0)
  const scale = Math.ceil(peak / 30) * 30
  if (!ranked.length) return <p className="pr-note">No payment ages to chart.</p>
  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-3">
        {BANDS.map((band) => (
          <span key={band.label} className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-500">
            <i className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: band.bar }} />
            {band.label}
          </span>
        ))}
      </div>
      <div className="grid gap-2.5">
        {ranked.map((row) => {
          const days = row.days_since_last_payment
          const band = bandFor(days)
          const width = days == null ? '100%' : `${Math.max((Math.min(days, scale) / scale) * 100, 2)}%`
          return (
            <div key={row.client} className="grid grid-cols-[minmax(0,9.5rem)_minmax(0,1fr)_3.25rem] items-center gap-2">
              <span className="truncate text-xs font-semibold text-slate-800" title={row.client}>{shortLabel(row.client)}</span>
              <span className="relative block h-3 overflow-hidden rounded-full">
                <span className="absolute inset-0 flex">
                  <span style={{ width: `${(30 / scale) * 100}%`, background: BANDS[0].swatch }} />
                  <span style={{ width: `${(30 / scale) * 100}%`, background: BANDS[1].swatch }} />
                  <span style={{ width: `${(30 / scale) * 100}%`, background: BANDS[2].swatch }} />
                  <span className="flex-1" style={{ background: BANDS[3].swatch }} />
                </span>
                <span className="absolute inset-y-0 left-0 rounded-full" style={{ width, background: band.bar }} />
              </span>
              <span className="text-right text-xs font-semibold text-slate-600">{days == null ? 'None' : days}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function OpenBalanceDonut({ clients }) {
  const overdue = clients.reduce((sum, row) => sum + (row.overdue_balance || 0), 0)
  const open = clients.reduce((sum, row) => sum + (row.open_balance || 0), 0)
  const current = Math.max(0, Math.round((open - overdue) * 100) / 100)
  const total = current + overdue
  const size = 168
  const stroke = 22
  const radius = (size - stroke) / 2
  const center = size / 2
  const circumference = 2 * Math.PI * radius
  const currentLen = total > 0 ? (current / total) * circumference : 0
  const overdueLen = total > 0 ? (overdue / total) * circumference : 0
  return (
    <div className="flex flex-wrap items-center gap-5">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Open balance split between current and overdue">
        <circle cx={center} cy={center} r={radius} fill="none" stroke="#e2e8f0" strokeWidth={stroke} />
        {total > 0 ? (
          <g transform={`rotate(-90 ${center} ${center})`}>
            <circle
              cx={center}
              cy={center}
              r={radius}
              fill="none"
              stroke={CURRENT_COLOR}
              strokeWidth={stroke}
              strokeDasharray={`${currentLen} ${circumference - currentLen}`}
              strokeLinecap="butt"
            />
            <circle
              cx={center}
              cy={center}
              r={radius}
              fill="none"
              stroke={OVERDUE_TOP}
              strokeWidth={stroke}
              strokeDasharray={`${overdueLen} ${circumference - overdueLen}`}
              strokeDashoffset={-currentLen}
              strokeLinecap="butt"
            />
          </g>
        ) : null}
        <text x={center} y={center - 4} textAnchor="middle" className="pr-donut-value">{money(open)}</text>
        <text x={center} y={center + 16} textAnchor="middle" className="pr-donut-sub">Open</text>
      </svg>
      <ul className="grid gap-2 text-sm">
        <li className="flex items-center gap-2 font-semibold text-slate-800">
          <i className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: CURRENT_COLOR }} />
          Current {money(current)}
        </li>
        <li className="flex items-center gap-2 font-semibold text-slate-800">
          <i className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: OVERDUE_TOP }} />
          Overdue {money(overdue)}
        </li>
      </ul>
    </div>
  )
}

export function BillingCharts({ clients = [] }) {
  const rows = Array.isArray(clients) ? clients : []
  return (
    <div className="grid gap-4 lg:grid-cols-2" data-testid="billing-charts">
      <ChartCard title="MRR by client" testId="billing-chart-mrr">
        <HorizontalBars
          rows={rows}
          valueKey="monthly_recurring_amount"
          colorFor={() => MRR_COLOR}
          empty="No recurring amounts to chart."
        />
      </ChartCard>
      <ChartCard title="Overdue balance by client" testId="billing-chart-overdue">
        <HorizontalBars
          rows={rows.filter((row) => (row.overdue_balance || 0) > 0)}
          valueKey="overdue_balance"
          colorFor={(_row, value, max) => (value === max ? OVERDUE_TOP : OVERDUE_COLOR)}
          empty="No overdue balances to chart."
        />
      </ChartCard>
      <ChartCard title="Days since last payment" testId="billing-chart-days">
        <DaysChart clients={rows} />
      </ChartCard>
      <ChartCard title="Open balance" testId="billing-chart-donut">
        <OpenBalanceDonut clients={rows} />
      </ChartCard>
    </div>
  )
}
