import { meetingCloseRate, meetingCloseRateByMonth, meetingCloseRateBySource } from '../lib/meetingCloseRate'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function percentLabel(rate) {
  if (rate == null) return '—'
  return `${rate.toFixed(1)}%`
}

export function MeetingCloseRateSection({ leads = [], monthView = 'all', year = 2026 }) {
  const summary = meetingCloseRate(leads, { year, monthView })
  const bySource = meetingCloseRateBySource(leads, { year, monthView })
  const byMonth = meetingCloseRateByMonth(leads, { year })
  const selectedMonth = monthView === 'all' ? null : Number(monthView)

  return (
    <section className="mb-8" aria-labelledby="meeting-close-rate-title" data-testid="meeting-close-rate">
      <h2 id="meeting-close-rate-title" className="mb-2 text-lg font-semibold">Meeting close rate</h2>
      <p className="mb-3 text-sm text-muted-foreground">
        A Jira ticket means a meeting was set up. Close rate is leads with a ticket that are Closed or Won, divided by every lead with a ticket.
      </p>
      <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Close rate</p>
          <p className="mt-1 text-4xl font-semibold tracking-tight text-slate-900" data-testid="meeting-close-rate-value">
            {percentLabel(summary.rate)}
          </p>
          <p className="mt-2 text-sm font-medium text-slate-700" data-testid="meeting-close-rate-counts">
            {summary.meetings === 0
              ? 'No meetings in this view'
              : `${summary.closed} of ${summary.meetings} meetings closed`}
          </p>
          <p className="mt-2 text-xs text-slate-500">
            {selectedMonth ? `${MONTHS[selectedMonth - 1]} ${year}, by lead date` : 'All lead dates'}
          </p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm" data-testid="meeting-close-rate-chart">
          <h3 className="text-sm font-semibold text-slate-900">Close rate by month</h3>
          <p className="mb-3 text-xs text-slate-500">Share of Jira-ticket leads that closed, by the lead date.</p>
          <div className="flex items-end gap-1.5 overflow-x-auto" style={{ minHeight: 120 }}>
            {byMonth.map((row) => {
              const height = row.meetings ? Math.max((row.rate / 100) * 72, 8) : 4
              const active = selectedMonth == null || selectedMonth === row.month
              return (
                <div key={row.month} className="flex min-w-[2rem] flex-1 flex-col items-center justify-end" title={`${MONTHS[row.month - 1]}: ${row.closed} of ${row.meetings}`}>
                  <span className="mb-1 text-[10px] font-semibold text-slate-500">{row.meetings ? percentLabel(row.rate) : '—'}</span>
                  <span
                    className="block w-full rounded-sm"
                    style={{
                      height: `${height}px`,
                      background: active ? '#15803d' : '#cbd5e1',
                      opacity: selectedMonth && selectedMonth !== row.month ? 0.45 : 1,
                    }}
                  />
                  <span className="mt-1 text-[10px] font-semibold uppercase text-slate-400">{MONTHS[row.month - 1]}</span>
                </div>
              )
            })}
          </div>
          {bySource.length ? (
            <ul className="mt-4 grid gap-1.5">
              {bySource.map((row) => (
                <li key={row.source} className="grid grid-cols-[minmax(0,9rem)_minmax(0,1fr)_auto] items-center gap-2 text-xs">
                  <span className="truncate font-semibold text-slate-700">{row.source}</span>
                  <span className="block h-2 overflow-hidden rounded-full bg-slate-100">
                    <span className="block h-full rounded-full bg-[#5b21b6]" style={{ width: `${row.rate || 0}%` }} />
                  </span>
                  <span className="font-semibold tabular-nums text-slate-600">{row.closed} of {row.meetings}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </article>
      </div>
    </section>
  )
}
