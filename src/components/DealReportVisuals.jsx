import {
  BRAND,
  EmptyPanel,
  HorizontalBars,
  KpiCard,
  Legend,
  WinLossDonut,
  formatCount,
} from './analytics/AnalyticsVisuals'
import { formatMoney } from '../lib/leads'
import { buildDealReportVisual } from '../lib/dealReportVisuals'

const STAGE_COLOR = {
  lead: '#94a3b8',
  kickoff: BRAND.blue,
  proposal: BRAND.purple,
  contract: BRAND.orange,
  won: BRAND.teal,
}

function formatPct(value) {
  if (value == null || Number.isNaN(Number(value))) return '—'
  const rounded = Math.round(Number(value) * 10) / 10
  return `${Number.isInteger(rounded) ? rounded : rounded.toFixed(1)}%`
}

function money(value) {
  if (value == null) return '—'
  return formatMoney(value) || '$0'
}

function leadHint(visual) {
  if (!visual.selectedMonth) return 'Sparkline is 2026 by lead month'
  if (!visual.previousLabel) return 'No prior month'
  return `vs ${visual.previousLabel} lead date`
}

function Card({ title, info, testId, children }) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5" data-testid={testId} title={info}>
      <h3 className="mb-3 text-sm font-semibold text-slate-900">{title}</h3>
      {children}
    </article>
  )
}

function moneyBars(rows) {
  const maxValue = Math.max(...rows.map((row) => row.value), 0)
  return rows.map((row) => ({
    label: row.label,
    value: maxValue > 0 ? row.value : row.count,
    display: `${money(row.value)} · ${row.count}`,
    color: row.color,
  }))
}

function StageValueFunnel({ stages }) {
  if (!stages.some((stage) => stage.count)) {
    return (
      <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-600">
        No deals in this view yet.
      </p>
    )
  }
  const max = Math.max(...stages.map((stage) => (stage.value > 0 ? stage.value : stage.count)), 1)
  return (
    <ol className="space-y-3" aria-label="Deal stage funnel">
      {stages.map((stage) => {
        const size = stage.value > 0 ? stage.value : stage.count
        const width = size ? Math.max((size / max) * 100, 8) : 0
        const detail = `${stage.title}: ${stage.count} deals, ${money(stage.value)}${stage.conversionFromPrevious != null ? `. ${formatPct(stage.conversionFromPrevious)} continued from the stage before` : ''}`
        return (
          <li key={stage.id} title={detail}>
            <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
              <span className="inline-flex min-w-0 items-center gap-2 text-slate-700">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: STAGE_COLOR[stage.id] || BRAND.orange }} />
                <span className="truncate">{stage.title}</span>
              </span>
              <span className="shrink-0 font-semibold tabular-nums text-slate-800">{money(stage.value)} · {stage.count}</span>
            </div>
            <span className="block h-3 overflow-hidden rounded-full bg-slate-100">
              <span className="block h-full rounded-full" style={{ width: `${width}%`, background: STAGE_COLOR[stage.id] || BRAND.orange }} />
            </span>
          </li>
        )
      })}
    </ol>
  )
}

function ActivityChart({ months, selectedMonth }) {
  const max = Math.max(...months.flatMap((month) => [month.created, month.won, month.lost]), 1)
  const empty = months.every((month) => !month.created && !month.won && !month.lost)
  if (empty) {
    return <EmptyPanel title="No 2026 activity yet">Created, won, and lost deals show up here once a date in 2026 is stored.</EmptyPanel>
  }
  return (
    <div>
      <div className="mb-3">
        <Legend items={[
          { label: 'Created', color: BRAND.orange },
          { label: 'Won', color: BRAND.teal },
          { label: 'Lost', color: BRAND.coral },
        ]} />
      </div>
      <div className="overflow-x-auto">
        <div className="flex h-52 min-w-[640px] items-end gap-1.5" role="img" aria-label="Deals created, won, and lost by month">
          {months.map((month) => {
            const selected = selectedMonth === month.month
            const bar = (value, color, name) => (
              <span
                className="w-2.5 rounded-t-sm sm:w-3"
                style={{ height: value ? Math.max((value / max) * 128, 6) : 0, background: color }}
                title={`${month.label} ${name}: ${value}`}
              />
            )
            return (
              <div key={month.month} className={`flex min-w-0 flex-1 flex-col items-center rounded-md px-0.5 ${selected ? 'bg-orange-50' : ''}`} title={`${month.label}: ${month.created} created, ${month.won} won, ${month.lost} lost`}>
                <span className="flex h-32 items-end gap-0.5">
                  {bar(month.created, BRAND.orange, 'created')}
                  {bar(month.won, BRAND.teal, 'won')}
                  {bar(month.lost, BRAND.coral, 'lost')}
                </span>
                <span className={`mt-1 text-[10px] font-semibold uppercase ${selected ? 'text-brand-orange' : 'text-slate-400'}`}>{month.label}</span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function LostReasons({ visual }) {
  if (visual.hasLostReasons) {
    return (
      <div className="space-y-3">
        <HorizontalBars
          rows={visual.lostReasons.map((row) => ({ label: row.reason, value: row.count, display: String(row.count) }))}
          color={BRAND.coral}
        />
        {visual.lostWithoutReason ? (
          <p className="text-xs text-slate-500">{visual.lostWithoutReason} lost {visual.lostWithoutReason === 1 ? 'deal has' : 'deals have'} no reason stored.</p>
        ) : null}
      </div>
    )
  }
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center" data-testid="deal-report-lost-empty">
      <p className="text-sm font-semibold text-slate-800">{visual.lostCount ? 'Lost reasons are not stored yet' : 'No lost deals in this view'}</p>
      <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-slate-600">
        {visual.lostCount
          ? 'These lost deals do not have a reason saved. A reason appears in this chart when it is stored on the deal.'
          : 'When a deal is marked lost and a reason is saved, it shows up here.'}
      </p>
    </div>
  )
}

export default function DealReportVisuals({ rows, monthView, now }) {
  const visual = buildDealReportVisual(rows, { monthView, now })
  const comparing = Boolean(visual.selectedMonth && visual.previous)
  const hint = leadHint(visual)
  return (
    <section className="mb-8 space-y-4" data-testid="deal-report-visual" aria-labelledby="deal-visual-title">
      <header>
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-brand-orange">Pipeline</p>
        <h2 id="deal-visual-title" className="text-xl font-semibold tracking-tight text-slate-900">At a glance</h2>
        <p className="mt-1 max-w-3xl text-sm text-slate-500">
          Amounts match the deal board: close amount for a win, otherwise the 2026 value. A monthly deal multiplies that value by its contract months. Selecting a month filters these cards by lead date.
        </p>
      </header>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <KpiCard label="Open pipeline" value={money(visual.openValue)} current={comparing ? visual.openValue : null} previous={comparing ? visual.previous.openValue : null} hint={hint} series={visual.series.openValue} testId="visual-kpi-open" />
        <KpiCard label="Weighted pipeline" value={money(visual.weightedValue)} current={comparing ? visual.weightedValue : null} previous={comparing ? visual.previous.weightedValue : null} hint={visual.previousLabel ? `Stage weights · vs ${visual.previousLabel}` : 'Stage weights on the deal board'} series={visual.series.weightedValue} color={BRAND.blue} testId="visual-kpi-weighted" />
        <KpiCard label="Win rate" value={formatPct(visual.winRate)} current={comparing ? visual.winRate : null} previous={comparing ? visual.previous.winRate : null} hint={hint} series={visual.series.winRate} color={BRAND.teal} testId="visual-kpi-win" />
        <KpiCard label="New deals" value={formatCount(visual.newDeals)} current={visual.selectedMonth ? visual.newDeals : null} previous={visual.selectedMonth ? visual.previous?.newDeals ?? null : null} hint={visual.previousLabel ? `${visual.newDealsHint} · vs ${visual.previousLabel} created` : visual.newDealsHint} series={visual.series.newDeals} color={BRAND.purple} testId="visual-kpi-new" />
        <KpiCard label="Avg deal size" value={money(visual.averageDealSize)} current={comparing ? visual.averageDealSize : null} previous={comparing ? visual.previous.averageDealSize : null} hint={visual.previousLabel ? `Closed-won average · vs ${visual.previousLabel}` : 'Average closed-won amount'} series={visual.series.averageDealSize} color={BRAND.orange} testId="visual-kpi-average" />
        <KpiCard label="Meeting-to-close" value={formatPct(visual.meetingRate)} current={comparing ? visual.meetingRate : null} previous={comparing ? visual.previous.meetingRate : null} hint={visual.meetings ? `${visual.meetingsClosed} closed of ${visual.meetings} meetings` : 'No Jira meeting on these deals'} series={visual.series.meetingRate} color={BRAND.teal} testId="visual-kpi-meeting" />
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        <Card title="Stage funnel" info="Bar length follows the deal value. The count is the number of deals in that stage." testId="deal-report-visual-funnel">
          <StageValueFunnel stages={visual.stages} />
        </Card>
        <Card title="Won vs lost" info="A deal that is both Closed and Deal Lost counts as won, matching the reports below." testId="deal-report-visual-donut">
          <WinLossDonut won={visual.wonCount} lost={visual.lostCount} />
          <p className="mt-3 text-sm text-slate-600">Won {money(visual.wonValue)} · Lost {money(visual.lostValue)}</p>
        </Card>
      </div>
      <Card title="Deals created and closed over time" info={visual.activityNote} testId="deal-report-visual-activity">
        <ActivityChart months={visual.activity} selectedMonth={visual.selectedMonth} />
        <p className="mt-3 text-xs leading-5 text-slate-500">{visual.activityNote}</p>
      </Card>
      <div className="grid gap-3 lg:grid-cols-3">
        <Card title="Open pipeline by stage owner" info="Deals do not store their own owner. This uses the owner on each stage in the sales process." testId="deal-report-visual-owners">
          {visual.owners.length ? <HorizontalBars rows={moneyBars(visual.owners)} color={BRAND.blue} /> : <p className="text-sm text-slate-500">No open deals in this view.</p>}
          <p className="mt-3 text-xs leading-5 text-slate-500">Stage owner from the sales process. A separate deal owner is not stored.</p>
        </Card>
        <Card title="Open pipeline by source" info="Open deal value grouped by the source stored on the deal." testId="deal-report-visual-sources">
          {visual.sources.length ? <HorizontalBars rows={moneyBars(visual.sources)} /> : <p className="text-sm text-slate-500">No open deals in this view.</p>}
        </Card>
        <Card title="Lost reasons" info="Counted from the lost reason stored on the deal." testId="deal-report-lost-reasons">
          <LostReasons visual={visual} />
        </Card>
      </div>
    </section>
  )
}
