export const AGING = {
  current: { id: 'current', label: 'Current', dot: '#15803d', bar: '#15803d', wash: '#dcfce7', text: '#166534' },
  d30: { id: 'd30', label: '1–30 days', dot: '#d97706', bar: '#d97706', wash: '#fef3c7', text: '#92400e' },
  d60: { id: 'd60', label: '31–60 days', dot: '#ea580c', bar: '#ea580c', wash: '#ffedd5', text: '#9a3412' },
  d90: { id: 'd90', label: '61–90 days', dot: '#c2410c', bar: '#c2410c', wash: '#fed7aa', text: '#9a3412' },
  late: { id: 'late', label: '90+ unpaid', dot: '#b91c1c', bar: '#b91c1c', wash: '#fee2e2', text: '#991b1b' },
}

export const AGING_ORDER = [AGING.current, AGING.d30, AGING.d60, AGING.d90, AGING.late]

export function ageStatus(days, { overdue = 0, open = 0 } = {}) {
  if (days == null || days >= 90) return AGING.late
  if (days >= 61) return AGING.d90
  if (days >= 31) return AGING.d60
  if (overdue === 0 && open === 0) return AGING.current
  if (days >= 1) return AGING.d30
  return AGING.current
}

export function bucketFor(days) {
  if (days == null || days >= 90) return AGING.late
  if (days >= 61) return AGING.d90
  if (days >= 31) return AGING.d60
  if (days >= 1) return AGING.d30
  return AGING.current
}

function money(value) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value || 0)
}

function shortLabel(name) {
  const text = String(name || '')
  return text.length > 22 ? `${text.slice(0, 20)}…` : text
}

function Tip({ text, children }) {
  return (
    <span className="group/tip relative block">
      {children}
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-1 hidden w-max max-w-[220px] -translate-x-1/2 rounded-md bg-slate-900 px-2 py-1 text-left text-[11px] font-medium leading-snug text-white shadow-lg group-hover/tip:block group-focus-within/tip:block"
      >
        {text}
      </span>
    </span>
  )
}

export function ColorLegend() {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1" aria-label="Payment age colors">
      {AGING_ORDER.map((item) => (
        <li key={item.id} className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-500">
          <i className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: item.dot }} />
          {item.label}
        </li>
      ))}
    </ul>
  )
}

function ChartCard({ title, subtitle, children, testId }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4" aria-label={title} data-testid={testId}>
      <header className="mb-3">
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
        {subtitle ? <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p> : null}
      </header>
      {children}
    </section>
  )
}

function HorizontalBars({ rows, valueOf, colorOf, formatValue, empty }) {
  const ranked = [...rows].sort((a, b) => valueOf(b) - valueOf(a) || a.client.localeCompare(b.client))
  const max = ranked.reduce((peak, row) => Math.max(peak, valueOf(row)), 0)
  if (!ranked.length || max <= 0) return <p className="text-sm text-slate-500">{empty}</p>
  return (
    <div className="grid gap-2">
      {ranked.map((row) => {
        const value = valueOf(row)
        const width = `${Math.max((value / max) * 100, value > 0 ? 3 : 0)}%`
        const color = colorOf(row, value, max)
        const tip = `${row.client}: ${formatValue(value)}`
        return (
          <Tip key={row.client} text={tip}>
            <span className="grid grid-cols-[minmax(0,7.5rem)_minmax(0,1fr)_auto] items-center gap-2 sm:grid-cols-[minmax(0,9rem)_minmax(0,1fr)_4.25rem]">
              <span className="truncate text-xs font-semibold text-slate-800" title={row.client}>{shortLabel(row.client)}</span>
              <span className="block h-2.5 overflow-hidden rounded-full bg-slate-100">
                <span className="block h-full rounded-full" style={{ width, background: color }} />
              </span>
              <span className="text-right text-xs font-semibold text-slate-600">{formatValue(value)}</span>
            </span>
          </Tip>
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
  const scale = Math.max(120, Math.ceil((Math.max(90, ...finite, 0)) / 30) * 30)
  if (!ranked.length) return <p className="text-sm text-slate-500">No payment ages to chart.</p>
  return (
    <div className="grid gap-2">
      {ranked.map((row) => {
        const days = row.days_since_last_payment
        const status = ageStatus(days, { overdue: row.overdue_balance, open: row.open_balance })
        const width = days == null ? '100%' : `${Math.max((Math.min(days, scale) / scale) * 100, 4)}%`
        const tip = days == null ? `${row.client}: no payment on file` : `${row.client}: ${days} days since last payment`
        return (
          <Tip key={row.client} text={tip}>
            <span className="grid grid-cols-[minmax(0,7.5rem)_minmax(0,1fr)_2.75rem] items-center gap-2 sm:grid-cols-[minmax(0,9rem)_minmax(0,1fr)_2.75rem]">
              <span className="truncate text-xs font-semibold text-slate-800" title={row.client}>{shortLabel(row.client)}</span>
              <span className="relative block h-2.5 overflow-hidden rounded-full">
                <span className="absolute inset-0 flex">
                  <span style={{ width: `${(30 / scale) * 100}%`, background: AGING.current.wash }} />
                  <span style={{ width: `${(30 / scale) * 100}%`, background: AGING.d30.wash }} />
                  <span style={{ width: `${(30 / scale) * 100}%`, background: AGING.d60.wash }} />
                  <span className="min-w-0 flex-1" style={{ background: AGING.late.wash }} />
                </span>
                <span className="absolute inset-y-0 left-0 rounded-full" style={{ width, background: status.bar }} />
              </span>
              <span className="text-right text-xs font-semibold text-slate-600">{days == null ? 'None' : days}</span>
            </span>
          </Tip>
        )
      })}
    </div>
  )
}

function OpenBalanceDonut({ clients }) {
  const overdue = clients.reduce((sum, row) => sum + (row.overdue_balance || 0), 0)
  const open = clients.reduce((sum, row) => sum + (row.open_balance || 0), 0)
  const current = Math.max(0, Math.round((open - overdue) * 100) / 100)
  const total = current + overdue
  const size = 148
  const stroke = 18
  const radius = (size - stroke) / 2
  const center = size / 2
  const circumference = 2 * Math.PI * radius
  const currentLen = total > 0 ? (current / total) * circumference : 0
  const overdueLen = total > 0 ? (overdue / total) * circumference : 0
  return (
    <div className="flex flex-wrap items-center gap-4">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Open balance split between current and overdue">
        <title>{`Open ${money(open)}. Current ${money(current)}. Overdue ${money(overdue)}.`}</title>
        <circle cx={center} cy={center} r={radius} fill="none" stroke="#e2e8f0" strokeWidth={stroke} />
        {total > 0 ? (
          <g transform={`rotate(-90 ${center} ${center})`}>
            <circle cx={center} cy={center} r={radius} fill="none" stroke={AGING.current.bar} strokeWidth={stroke} strokeDasharray={`${currentLen} ${circumference - currentLen}`} />
            <circle cx={center} cy={center} r={radius} fill="none" stroke={AGING.late.bar} strokeWidth={stroke} strokeDasharray={`${overdueLen} ${circumference - overdueLen}`} strokeDashoffset={-currentLen} />
          </g>
        ) : null}
        <text x={center} y={center - 2} textAnchor="middle" fill="#0f172a" fontSize="16" fontWeight="800">{money(open)}</text>
        <text x={center} y={center + 14} textAnchor="middle" fill="#64748b" fontSize="10" fontWeight="700">OPEN</text>
      </svg>
      <ul className="grid gap-2 text-sm">
        <li className="flex items-center gap-2 font-semibold text-slate-800">
          <i className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: AGING.current.dot }} />
          Current {money(current)}
        </li>
        <li className="flex items-center gap-2 font-semibold text-slate-800">
          <i className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: AGING.late.dot }} />
          Overdue {money(overdue)}
        </li>
      </ul>
    </div>
  )
}

function AgingBuckets({ clients }) {
  const buckets = AGING_ORDER.map((status) => ({ status, amount: 0, count: 0 }))
  const byId = new Map(buckets.map((bucket) => [bucket.status.id, bucket]))
  for (const row of clients) {
    const open = row.open_balance || 0
    if (open <= 0) continue
    const bucket = byId.get(bucketFor(row.days_since_last_payment).id)
    bucket.amount += open
    bucket.count += 1
  }
  const max = buckets.reduce((peak, bucket) => Math.max(peak, bucket.amount), 0)
  return (
    <div className="grid gap-2">
      {buckets.map((bucket) => {
        const width = max > 0 ? `${Math.max((bucket.amount / max) * 100, bucket.amount > 0 ? 3 : 0)}%` : '0%'
        const tip = `${bucket.status.label}: ${money(bucket.amount)} across ${bucket.count} client${bucket.count === 1 ? '' : 's'}`
        return (
          <Tip key={bucket.status.id} text={tip}>
            <span className="grid grid-cols-[5.5rem_minmax(0,1fr)_auto] items-center gap-2">
              <span className="text-xs font-semibold" style={{ color: bucket.status.text }}>{bucket.status.label}</span>
              <span className="block h-2.5 overflow-hidden rounded-full" style={{ background: bucket.status.wash }}>
                <span className="block h-full rounded-full" style={{ width, background: bucket.status.bar }} />
              </span>
              <span className="text-right text-xs font-semibold text-slate-600">{money(bucket.amount)}</span>
            </span>
          </Tip>
        )
      })}
    </div>
  )
}

export function BillingCharts({ clients = [] }) {
  const rows = Array.isArray(clients) ? clients : []
  const mrr = rows.reduce((sum, row) => sum + (row.monthly_recurring_amount || 0), 0)
  const top = [...rows].sort((a, b) => (b.monthly_recurring_amount || 0) - (a.monthly_recurring_amount || 0))[0]
  const topShare = top && mrr > 0 ? Math.round(((top.monthly_recurring_amount || 0) / mrr) * 100) : 0
  return (
    <div className="grid items-start gap-3 lg:grid-cols-2" data-testid="billing-charts">
      <ChartCard title="MRR by client" subtitle="Largest monthly amount at the top." testId="billing-chart-mrr">
        <HorizontalBars
          rows={rows}
          valueOf={(row) => row.monthly_recurring_amount || 0}
          colorOf={() => '#5b21b6'}
          formatValue={money}
          empty="No recurring amounts to chart."
        />
      </ChartCard>
      <ChartCard title="MRR concentration" subtitle={top ? `${shortLabel(top.client)} is ${topShare}% of MRR.` : 'Share of monthly recurring revenue.'} testId="billing-chart-concentration">
        <HorizontalBars
          rows={rows}
          valueOf={(row) => (mrr > 0 ? ((row.monthly_recurring_amount || 0) / mrr) * 100 : 0)}
          colorOf={(row) => (top && row.client === top.client ? '#5b21b6' : '#a78bfa')}
          formatValue={(value) => `${Math.round(value)}%`}
          empty="No recurring amounts to chart."
        />
      </ChartCard>
      <ChartCard title="Overdue balance by client" subtitle="The largest balance is red." testId="billing-chart-overdue">
        <HorizontalBars
          rows={rows.filter((row) => (row.overdue_balance || 0) > 0)}
          valueOf={(row) => row.overdue_balance || 0}
          colorOf={(_row, value, max) => (value === max ? AGING.late.bar : '#94a3b8')}
          formatValue={money}
          empty="No overdue balances to chart."
        />
      </ChartCard>
      <ChartCard title="Open-balance aging" subtitle="Open balance grouped by days since the last payment." testId="billing-chart-aging">
        <AgingBuckets clients={rows} />
      </ChartCard>
      <ChartCard title="Days since last payment" subtitle="Background bands mark 30, 60, and 90 days." testId="billing-chart-days">
        <DaysChart clients={rows} />
      </ChartCard>
      <ChartCard title="Open balance" subtitle="Current is open minus overdue." testId="billing-chart-donut">
        <OpenBalanceDonut clients={rows} />
      </ChartCard>
    </div>
  )
}
