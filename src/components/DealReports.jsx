import {
  REPORT_MONTHS,
  REPORT_VIEWS,
  REPORT_YEAR,
  averageTimeInStage,
  closedWonBySource,
  dealsCreatedOverTime,
  filterDealsByLeadMonth,
  reportingKpis,
  stageConversion,
  stageDistribution,
  stalledByStage,
  wonLostOverTime,
} from '../lib/dealReports'

const BLUE = '#1644ED'
const VIOLET = '#7c3aed'
const WON = '#0f766e'
const LOST = '#94a3b8'

export function formatPct(value) {
  if (value == null || Number.isNaN(Number(value))) return '—'
  const rounded = Math.round(Number(value) * 10) / 10
  return `${Number.isInteger(rounded) ? rounded : rounded.toFixed(1)}%`
}

function Delta({ value }) {
  if (value == null) {
    return <span className="text-xs font-semibold text-slate-400">—</span>
  }
  const up = value > 0
  const down = value < 0
  const tone = up ? 'bg-emerald-50 text-emerald-700' : down ? 'bg-red-50 text-red-700' : 'bg-slate-100 text-slate-600'
  const arrow = up ? '▲' : down ? '▼' : '●'
  const word = up ? 'up' : down ? 'down' : 'unchanged'
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${tone}`}>
      <span aria-hidden="true">{arrow}</span>
      {formatPct(Math.abs(value))}
      <span className="sr-only">{word}</span>
    </span>
  )
}

function Info({ text }) {
  return (
    <button
      type="button"
      className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-slate-200 text-[11px] font-semibold text-slate-500 hover:border-[#1644ED] hover:text-[#1644ED]"
      aria-label={text}
      title={text}
    >
      i
    </button>
  )
}

function Card({ title, info, testId, children, featured }) {
  return (
    <article
      className={`rounded-2xl border bg-white p-4 shadow-[0_10px_30px_rgba(15,23,42,0.06)] transition hover:-translate-y-0.5 hover:shadow-[0_16px_40px_rgba(22,68,237,0.12)] sm:p-5 ${featured ? 'ring-2 ring-[#1644ED]' : 'border-slate-200'}`}
      data-testid={testId}
    >
      <div className="mb-3 flex items-start justify-between gap-2">
        <h2 className="text-base font-semibold text-slate-900">{title}</h2>
        <Info text={info} />
      </div>
      {children}
    </article>
  )
}

function Empty({ reason }) {
  return (
    <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-600" data-testid="deal-report-empty">
      {reason}
    </p>
  )
}

function FunnelChart({ rows }) {
  const report = stageConversion(rows)
  const max = Math.max(...report.steps.map((step) => step.count), 1)
  return (
    <Card title="Stage conversion funnel" info={report.note} testId="deal-report-funnel">
      <p className="mb-3 text-sm text-slate-600">
        Overall conversion <span className="text-lg font-semibold text-[#1644ED]">{formatPct(report.overall)}</span>
      </p>
      <ol className="space-y-2">
        {report.steps.map((step) => (
          <li key={step.id}>
            {step.conversionFromPrevious != null ? (
              <p className="mb-1 flex items-center gap-1 text-xs font-semibold text-[#5b21b6]">
                <span aria-hidden="true">❯</span>
                {formatPct(step.conversionFromPrevious)} from the previous stage
              </p>
            ) : null}
            <div className="grid grid-cols-[minmax(7rem,11rem)_minmax(0,1fr)_auto] items-center gap-3">
              <span className="truncate text-sm text-slate-700">{step.title}</span>
              <span className="block h-8 overflow-hidden rounded-md bg-slate-100" style={{ clipPath: 'polygon(0 0, calc(100% - 14px) 0, 100% 50%, calc(100% - 14px) 100%, 0 100%)' }}>
                <span
                  className="block h-full transition-[width] duration-700 ease-out"
                  style={{
                    width: `${step.count ? Math.max((step.count / max) * 100, 8) : 0}%`,
                    background: `linear-gradient(90deg, ${BLUE}, ${VIOLET})`,
                  }}
                />
              </span>
              <span className="text-sm font-semibold tabular-nums text-slate-800">{step.count}</span>
            </div>
          </li>
        ))}
      </ol>
      <p className="mt-3 text-sm text-slate-600">Deal Lost: {report.lost}</p>
    </Card>
  )
}

function SourceChart({ rows }) {
  const bars = closedWonBySource(rows)
  const max = Math.max(...bars.map((row) => row.count), 1)
  return (
    <Card title="Closed won by source" info="Share is this source’s closed-won deals divided by every closed-won deal. Win rate is closed won divided by closed won plus Deal Lost for that source." testId="deal-report-won-source">
      {bars.length ? (
        <ul className="space-y-3">
          {bars.map((row) => (
            <li key={row.source}>
              <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
                <span className="truncate font-medium text-slate-700">{row.source}</span>
                <span className="shrink-0 tabular-nums text-slate-600">{row.count} · {formatPct(row.share)} share · {formatPct(row.winRate)} win</span>
              </div>
              <span className="block h-3 overflow-hidden rounded-full bg-slate-100">
                <span className="block h-full rounded-full transition-[width] duration-700 ease-out" style={{ width: `${Math.max((row.count / max) * 100, 6)}%`, background: `linear-gradient(90deg, ${WON}, #14b8a6)` }} />
              </span>
            </li>
          ))}
        </ul>
      ) : <Empty reason="No closed-won deals in this month view." />}
    </Card>
  )
}

function DistributionChart({ rows }) {
  const bars = stageDistribution(rows)
  const max = Math.max(...bars.map((row) => row.count), 1)
  return (
    <Card title="Current stage distribution" info="Each percent is deals in that stage divided by every deal in this view." testId="deal-report-distribution">
      <ul className="space-y-2">
        {bars.map((row) => (
          <li key={row.id} className="grid grid-cols-[minmax(7rem,10rem)_minmax(0,1fr)_auto] items-center gap-2 text-sm">
            <span className="truncate text-slate-700">{row.title}</span>
            <span className="block h-2.5 overflow-hidden rounded-full bg-slate-100">
              <span className="block h-full rounded-full bg-[#1644ED] transition-[width] duration-700" style={{ width: `${row.count ? Math.max((row.count / max) * 100, 4) : 0}%` }} />
            </span>
            <span className="tabular-nums font-semibold text-slate-800">{row.count} · {formatPct(row.share)}</span>
          </li>
        ))}
      </ul>
    </Card>
  )
}

function StalledChart({ rows, now }) {
  const report = stalledByStage(rows, now)
  const max = Math.max(...report.bars.map((row) => row.count), 1)
  return (
    <Card title="Stalled deals by stage" info={`${report.basis} The percent is stalled deals divided by deals currently in that stage.`} testId="deal-report-stalled">
      {report.enough ? (
        <ul className="space-y-2">
          {report.bars.map((row) => (
            <li key={row.id} className="grid grid-cols-[minmax(7rem,10rem)_minmax(0,1fr)_auto] items-center gap-2 text-sm">
              <span className="truncate text-slate-700">{row.title}</span>
              <span className="block h-2.5 overflow-hidden rounded-full bg-slate-100">
                <span className="block h-full rounded-full bg-[#c2410c] transition-[width] duration-700" style={{ width: `${row.count ? Math.max((row.count / max) * 100, 4) : 0}%` }} />
              </span>
              <span className="tabular-nums font-semibold text-slate-800">{row.count} · {formatPct(row.share)}</span>
            </li>
          ))}
        </ul>
      ) : <Empty reason={report.reason} />}
    </Card>
  )
}

function TimeChart({ rows, now }) {
  const report = averageTimeInStage(rows, now)
  const max = Math.max(...report.bars.map((row) => row.average), 1)
  const measured = report.bars.reduce((sum, row) => sum + row.count, 0)
  return (
    <Card title="Average current time in stage" info={report.basis} testId="deal-report-time">
      {report.enough ? (
        <ul className="space-y-2">
          {report.bars.map((row) => {
            const share = measured ? Math.round((row.count / measured) * 1000) / 10 : null
            return (
              <li key={row.id} className="grid grid-cols-[minmax(7rem,10rem)_minmax(0,1fr)_auto] items-center gap-2 text-sm">
                <span className="truncate text-slate-700">{row.title}</span>
                <span className="block h-2.5 overflow-hidden rounded-full bg-slate-100">
                  <span className="block h-full rounded-full bg-[#5b21b6] transition-[width] duration-700" style={{ width: `${Math.max((row.average / max) * 100, 4)}%` }} />
                </span>
                <span className="tabular-nums font-semibold text-slate-800">{row.average} days · {formatPct(share)}</span>
              </li>
            )
          })}
        </ul>
      ) : <Empty reason={report.reason} />}
    </Card>
  )
}

function WonLostChart({ rows }) {
  const report = wonLostOverTime(rows)
  const max = Math.max(...report.months.map((month) => month.won + month.lost), 1)
  return (
    <Card title="Won vs lost over time" info={`${report.note} Win percent is closed won divided by closed won plus Deal Lost that month.`} testId="deal-report-won-lost">
      <div className="mb-3 flex gap-4 text-xs font-semibold text-slate-600">
        <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full" style={{ background: WON }} /> Closed won</span>
        <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full" style={{ background: LOST }} /> Deal Lost</span>
      </div>
      <div className="flex items-end gap-1.5 overflow-x-auto" style={{ minHeight: 160 }}>
        {report.months.map((month) => {
          const total = month.won + month.lost
          const height = total ? Math.max((total / max) * 112, 8) : 0
          const wonHeight = total ? (month.won / total) * height : 0
          return (
            <div key={month.month} className="flex min-w-[2.4rem] flex-1 flex-col items-center justify-end">
              <span className="mb-1 text-[10px] font-semibold text-[#1644ED]">{formatPct(month.winRate)}</span>
              <span className="flex w-full flex-col justify-end overflow-hidden rounded-t-md" style={{ height: 112 }}>
                <span style={{ height: wonHeight, background: WON }} />
                <span style={{ height: height - wonHeight, background: LOST }} />
              </span>
              <span className="mt-1 text-[10px] font-semibold uppercase text-slate-400">{month.label}</span>
            </div>
          )
        })}
      </div>
    </Card>
  )
}

function CreatedChart({ rows }) {
  const report = dealsCreatedOverTime(rows)
  if (!report.enough) {
    return (
      <Card title="Deals created over time" info="Counted by created_at. The percent is the change from the previous month. January has no prior month in this year." testId="deal-report-created">
        <Empty reason={report.reason} />
      </Card>
    )
  }
  const max = Math.max(...report.months.map((month) => month.count), 1)
  const width = 640
  const height = 180
  const pad = 16
  const points = report.months.map((month, index) => {
    const x = pad + (index * (width - pad * 2)) / 11
    const y = height - 28 - (month.count / max) * (height - 48)
    return { ...month, x, y }
  })
  return (
    <Card title="Deals created over time" info="Counted by created_at. The percent under each month is the change from the previous month. A dash means the previous month was zero or this is January." testId="deal-report-created">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-44 w-full" role="img" aria-label="Deals created by month with month-over-month change">
        <polyline fill="none" stroke={BLUE} strokeWidth="3" points={points.map((point) => `${point.x},${point.y}`).join(' ')} />
        {points.map((point) => (
          <g key={point.month}>
            <circle cx={point.x} cy={point.y} r="4" fill={BLUE} />
            <text x={point.x} y={height - 2} textAnchor="middle" fontSize="10" fill="#64748b">{point.label}</text>
          </g>
        ))}
      </svg>
      <ul className="mt-2 grid grid-cols-3 gap-1 text-[11px] sm:grid-cols-6 lg:grid-cols-12">
        {report.months.map((month) => (
          <li key={month.month} className="text-center">
            <span className="block font-semibold text-slate-500">{month.label}</span>
            <Delta value={month.change} />
          </li>
        ))}
      </ul>
    </Card>
  )
}

function CycleChart() {
  return (
    <Card title="Average closed-won cycle" info="This needs a close date. first_contact_date is the lead date, and updated_at changes on any edit." testId="deal-report-cycle">
      <p className="text-4xl font-semibold tracking-tight text-slate-300">—</p>
      <Empty reason="Not enough data yet. No close date is stored, so days to close is not shown." />
    </Card>
  )
}

const CHARTS = {
  funnel: FunnelChart,
  'won-by-source': SourceChart,
  distribution: DistributionChart,
  stalled: StalledChart,
  'time-in-stage': TimeChart,
  'won-lost': WonLostChart,
  created: CreatedChart,
  cycle: CycleChart,
}

function Kpi({ label, value, change, note, testId }) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_10px_30px_rgba(15,23,42,0.06)]" data-testid={testId}>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-3xl font-semibold tracking-tight text-slate-900">{value}</p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Delta value={change} />
        <span className="text-[11px] text-slate-400">{note}</span>
      </div>
    </article>
  )
}

export default function DealReportingDashboard({ rows, monthView, onMonth, now, focus, onFocus }) {
  const filtered = filterDealsByLeadMonth(rows, { monthView })
  const kpis = reportingKpis(rows, { monthView, now })
  const order = ['funnel', 'won-by-source', 'distribution', 'stalled', 'time-in-stage', 'won-lost', 'created', 'cycle']
  const visible = !focus || focus === 'all' ? order : [focus, ...order.filter((id) => id !== focus)]
  return (
    <div data-testid="deal-reporting">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">Reporting</h1>
          <p className="mt-1 max-w-xl text-sm text-slate-500">Percents are labeled on each chart. A dash means there is nothing to divide by.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select aria-label="Reporting view" className="h-11 rounded-lg border bg-white px-3 text-sm sm:h-9" value={focus || 'all'} onChange={(event) => onFocus(event.target.value)}>
            <option value="all">All reports</option>
            {REPORT_VIEWS.map((view) => <option key={view.id} value={view.id}>{view.label}</option>)}
          </select>
          <select aria-label="Month view" className="h-11 rounded-lg border bg-white px-3 text-sm sm:h-9" value={monthView} onChange={(event) => onMonth(event.target.value)}>
            <option value="all">Month view: All</option>
            {REPORT_MONTHS.map((month) => <option key={month.id} value={String(month.id)}>{month.label} {REPORT_YEAR}</option>)}
          </select>
        </div>
      </div>
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Kpi label="Total deals" value={kpis.total} change={kpis.totalChange} note={kpis.compareLabel} testId="kpi-total" />
        <Kpi label="Win rate" value={formatPct(kpis.winRate)} change={kpis.winRateChange} note={kpis.compareLabel} testId="kpi-win-rate" />
        <Kpi label="Days to close" value="—" change={null} note="No close date stored" testId="kpi-cycle" />
        <Kpi label="Open pipeline" value={kpis.open} change={kpis.openChange} note={kpis.compareLabel} testId="kpi-open" />
        <Kpi label="Won this month" value={kpis.wonThisMonth} change={kpis.wonThisMonthChange} note={kpis.compareLabel} testId="kpi-won-month" />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {visible.map((id) => {
          const Chart = CHARTS[id]
          const wide = id === 'funnel' || id === 'won-lost' || id === 'created' || id === focus
          return (
            <div key={id} className={wide ? 'lg:col-span-2' : ''}>
              <Chart rows={filtered} now={now} />
            </div>
          )
        })}
      </div>
    </div>
  )
}
