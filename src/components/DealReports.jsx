import {
  REPORT_YEAR,
  averageTimeInStage,
  closedWonBySource,
  closedWonCycle,
  dealsCreatedOverTime,
  filterDealsByLeadMonth,
  stageConversion,
  stageDistribution,
  stalledByStage,
  wonLostOverTime,
} from '../lib/dealReports'

const BAR = '#0f766e'
const WON = '#0f766e'
const LOST = '#94a3b8'

function Card({ title, caption, children, testId }) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5" data-testid={testId || 'deal-report'}>
      <h2 className="text-base font-semibold text-slate-900">{title}</h2>
      {caption ? <p className="mt-1 text-sm text-slate-500">{caption}</p> : null}
      <div className="mt-4">{children}</div>
    </article>
  )
}

function Empty({ reason }) {
  return (
    <p className="rounded-xl bg-slate-50 px-4 py-6 text-sm text-slate-600" data-testid="deal-report-empty">
      {reason}
    </p>
  )
}

function HorizontalBars({ rows, valueKey = 'count', suffix = '' }) {
  const max = Math.max(...rows.map((row) => Number(row[valueKey]) || 0), 1)
  return (
    <ul className="space-y-2">
      {rows.map((row) => {
        const value = Number(row[valueKey]) || 0
        const width = value ? Math.max((value / max) * 100, 2) : 0
        return (
          <li key={row.id || row.source} className="grid grid-cols-[minmax(8rem,12rem)_minmax(0,1fr)_auto] items-center gap-3 text-sm">
            <span className="truncate text-slate-700">{row.title || row.source}</span>
            <span className="block h-7 overflow-hidden rounded-sm bg-slate-100">
              <span className="block h-full rounded-sm" style={{ width: `${width}%`, background: BAR }} />
            </span>
            <span className="font-semibold tabular-nums text-slate-800">{value}{suffix}</span>
          </li>
        )
      })}
    </ul>
  )
}

function Funnel({ rows }) {
  const report = stageConversion(rows)
  const max = Math.max(...report.steps.map((step) => step.count), 1)
  return (
    <Card
      title="Stage conversion funnel"
      caption={report.note}
      testId="deal-report-funnel"
    >
      <ol className="space-y-3">
        {report.steps.map((step) => (
          <li key={step.id}>
            {step.conversionFromPrevious != null ? (
              <p className="mb-1 text-xs font-semibold text-slate-500">{step.conversionFromPrevious}% from the previous stage</p>
            ) : null}
            <div className="grid grid-cols-[minmax(8rem,12rem)_minmax(0,1fr)_auto] items-center gap-3">
              <span className="text-sm text-slate-700">{step.title}</span>
              <span className="block h-8 overflow-hidden bg-slate-100" style={{ clipPath: 'polygon(0 0, calc(100% - 14px) 0, 100% 50%, calc(100% - 14px) 100%, 0 100%)' }}>
                <span
                  className="block h-full"
                  style={{ width: `${step.count ? Math.max((step.count / max) * 100, 8) : 0}%`, background: BAR }}
                />
              </span>
              <span className="text-sm font-semibold tabular-nums text-slate-800">{step.count}</span>
            </div>
          </li>
        ))}
      </ol>
      <p className="mt-4 text-sm text-slate-600">Deal Lost: {report.lost}</p>
    </Card>
  )
}

function WonBySource({ rows }) {
  const bars = closedWonBySource(rows)
  return (
    <Card title="Closed won deals by source" caption="Closed means quality Closed or pipeline stage won. Count of deals, by source." testId="deal-report-won-source">
      {bars.length ? <HorizontalBars rows={bars} /> : <Empty reason="No closed-won deals in this month view." />}
    </Card>
  )
}

function Cycle() {
  const report = closedWonCycle()
  return (
    <Card title="Average closed-won cycle" caption="Average days from lead date to close." testId="deal-report-cycle">
      <Empty reason={report.reason} />
    </Card>
  )
}

function TimeInStage({ rows, now }) {
  const report = averageTimeInStage(rows, now)
  return (
    <Card title="Average current time in stage" caption={report.basis} testId="deal-report-time">
      {report.enough ? (
        <>
          <HorizontalBars rows={report.bars.map((bar) => ({ ...bar, count: bar.average }))} suffix=" days" />
          {report.undated ? <p className="mt-3 text-xs text-slate-500">{report.undated} open deals have no date and are not in the average.</p> : null}
        </>
      ) : (
        <Empty reason={report.reason} />
      )}
    </Card>
  )
}

function Stalled({ rows, now }) {
  const report = stalledByStage(rows, now)
  return (
    <Card title="Stalled deals by stage" caption={report.basis} testId="deal-report-stalled">
      {report.enough ? (
        <>
          <HorizontalBars rows={report.bars} />
          {report.undated ? <p className="mt-3 text-xs text-slate-500">{report.undated} open deals have no date and were not counted.</p> : null}
        </>
      ) : (
        <Empty reason={report.reason} />
      )}
    </Card>
  )
}

function WonLost({ rows }) {
  const report = wonLostOverTime(rows)
  const max = Math.max(...report.months.map((month) => month.won + month.lost), 1)
  return (
    <Card title="Won vs lost over time" caption={report.note} testId="deal-report-won-lost">
      <div className="mb-2 flex gap-4 text-xs font-semibold text-slate-600">
        <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full" style={{ background: WON }} /> Closed won</span>
        <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full" style={{ background: LOST }} /> Deal Lost</span>
      </div>
      <div className="flex items-end gap-1.5 overflow-x-auto" style={{ minHeight: 160 }}>
        {report.months.map((month) => {
          const total = month.won + month.lost
          const height = total ? Math.max((total / max) * 120, 8) : 0
          const wonHeight = total ? (month.won / total) * height : 0
          const lostHeight = height - wonHeight
          return (
            <div key={month.month} className="flex min-w-[2.2rem] flex-1 flex-col items-center justify-end" title={`${month.label}: ${month.won} won, ${month.lost} lost`}>
              <span className="mb-1 text-[10px] font-semibold text-slate-500">{total || ''}</span>
              <span className="flex w-full flex-col justify-end" style={{ height: 120 }}>
                <span style={{ height: wonHeight, background: WON }} />
                <span style={{ height: lostHeight, background: LOST }} />
              </span>
              <span className="mt-1 text-[10px] font-semibold uppercase text-slate-400">{month.label}</span>
            </div>
          )
        })}
      </div>
      {report.skipped ? <p className="mt-3 text-xs text-slate-500">{report.skipped} won or lost deals have no {REPORT_YEAR} lead date and are not on this chart.</p> : null}
    </Card>
  )
}

function Distribution({ rows }) {
  const bars = stageDistribution(rows)
  return (
    <Card title="Current stage distribution" caption="Where deals sit right now." testId="deal-report-distribution">
      <HorizontalBars rows={bars} />
    </Card>
  )
}

function Created({ rows }) {
  const report = dealsCreatedOverTime(rows)
  if (!report.enough) {
    return (
      <Card title="Deals created over time" caption="Counted by created_at, not the lead date." testId="deal-report-created">
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
    const y = height - pad - (month.count / max) * (height - pad * 2)
    return { ...month, x, y }
  })
  const line = points.map((point) => `${point.x},${point.y}`).join(' ')
  return (
    <Card title="Deals created over time" caption="Counted by created_at. The month filter still uses the lead date, same as Score Card." testId="deal-report-created">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-44 w-full" role="img" aria-label="Deals created by month">
        <polyline fill="none" stroke={BAR} strokeWidth="3" points={line} />
        {points.map((point) => (
          <g key={point.month}>
            <circle cx={point.x} cy={point.y} r="4" fill={BAR} />
            <text x={point.x} y={height - 2} textAnchor="middle" fontSize="10" fill="#64748b">{point.label}</text>
          </g>
        ))}
      </svg>
      {report.missing ? <p className="mt-2 text-xs text-slate-500">{report.missing} deals have no created date and are not on this line.</p> : null}
    </Card>
  )
}

export default function DealReports({ rows, report, monthView = 'all', now }) {
  const filtered = filterDealsByLeadMonth(rows, { monthView })
  if (report === 'funnel') return <Funnel rows={filtered} />
  if (report === 'won-by-source') return <WonBySource rows={filtered} />
  if (report === 'cycle') return <Cycle />
  if (report === 'time-in-stage') return <TimeInStage rows={filtered} now={now} />
  if (report === 'stalled') return <Stalled rows={filtered} now={now} />
  if (report === 'won-lost') return <WonLost rows={filtered} />
  if (report === 'distribution') return <Distribution rows={filtered} />
  if (report === 'created') return <Created rows={filtered} />
  return null
}
