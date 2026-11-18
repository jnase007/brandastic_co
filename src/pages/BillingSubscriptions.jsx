import { Fragment, useMemo, useState } from 'react'
import {
  GROUP_COLORS,
  SUBSCRIPTION_FILTERS,
  SUBSCRIPTIONS_EMPTY_MESSAGE,
  SUBSCRIPTIONS_INTRO,
  filterSubscriptionItems,
  formatDay,
  formatSourceWindow,
  formatSubscriptionUpdated,
  groupColor,
  groupLabel,
  monthlyChargeSeries,
  monthlyCostByGroup,
  overallMonthlyTrend,
  sortSubscriptionItems,
  subscriptionMonthly,
  subscriptionsEmptyState,
  sumMonthly,
  topSubscriptionsByMonthly,
} from '../lib/billingSubscriptionsView'

const STATUS_STYLE = {
  active: { label: 'Active', wash: '#dcfce7', text: '#166534', dot: '#15803d' },
  stopped: { label: 'Stopped', wash: '#f1f5f9', text: '#475569', dot: '#64748b' },
  possible: { label: 'Possible', wash: '#fef3c7', text: '#92400e', dot: '#d97706' },
  annual: { label: 'Annual', wash: '#ede9fe', text: '#5b21b6', dot: '#6d28d9' },
}

function money(value) {
  if (typeof value !== 'number' || Number.isNaN(value)) return '—'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value)
}

function shortMonth(month) {
  const match = /^(\d{4})-(\d{2})$/.exec(month || '')
  if (!match) return month || ''
  const utc = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, 1))
  return new Intl.DateTimeFormat('en-US', { month: 'short', timeZone: 'UTC' }).format(utc)
}

function Sparkline({ series, label }) {
  if (!series.length) return null
  const width = 76
  const height = 18
  const max = Math.max(...series.map((point) => Math.abs(point.amount)), 1)
  const gap = 2
  const barWidth = Math.max(2, (width - gap * (series.length - 1)) / series.length)
  const title = series.map((point) => `${point.month} ${money(point.amount)}`).join(', ')
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={label || title} className="mt-1">
      <title>{title}</title>
      {series.map((point, index) => {
        const barHeight = Math.max(2, (Math.abs(point.amount) / max) * (height - 1))
        const x = index * (barWidth + gap)
        return <rect key={point.month} x={x} y={height - barHeight} width={barWidth} height={barHeight} rx="1" fill="#5b21b6" />
      })}
    </svg>
  )
}

function ChartCard({ title, subtitle, children, testId, className = '' }) {
  return (
    <section className={`rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4 ${className}`} aria-label={title} data-testid={testId}>
      <header className="mb-3">
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
        {subtitle ? <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p> : null}
      </header>
      {children}
    </section>
  )
}

function TopCostBars({ items }) {
  const ranked = topSubscriptionsByMonthly(items, 15)
  const max = ranked.reduce((peak, item) => Math.max(peak, subscriptionMonthly(item) || 0), 0)
  if (!ranked.length || max <= 0) return <p className="text-sm text-slate-500">No monthly amounts to chart.</p>
  return (
    <div className="grid gap-2">
      {ranked.map((item) => {
        const value = subscriptionMonthly(item) || 0
        const width = `${Math.max((value / max) * 100, 3)}%`
        const name = item.vendor || '—'
        return (
          <span key={item.id || name} className="grid grid-cols-[minmax(0,7.5rem)_minmax(0,1fr)_auto] items-center gap-2 sm:grid-cols-[minmax(0,9rem)_minmax(0,1fr)_4.5rem]" title={`${name}: ${money(value)}`}>
            <span className="truncate text-xs font-semibold text-slate-800">{name}</span>
            <span className="block h-2.5 overflow-hidden rounded-full bg-slate-100">
              <span className="block h-full rounded-full" style={{ width, background: groupColor(item.group) }} />
            </span>
            <span className="text-right text-xs font-semibold text-slate-600">{money(value)}</span>
          </span>
        )
      })}
    </div>
  )
}

function GroupDonut({ items }) {
  const slices = monthlyCostByGroup(items)
  const total = slices.reduce((sum, slice) => sum + slice.amount, 0)
  const size = 148
  const stroke = 18
  const radius = (size - stroke) / 2
  const center = size / 2
  const circumference = 2 * Math.PI * radius
  let cursor = 0
  const arcs = slices.map((slice) => {
    const len = total > 0 ? (slice.amount / total) * circumference : 0
    const arc = { ...slice, len, offset: cursor }
    cursor += len
    return arc
  })
  if (!slices.length) return <p className="text-sm text-slate-500">No monthly amounts to chart.</p>
  const summary = slices.map((slice) => `${groupLabel(slice.group)} ${money(slice.amount)}`).join('. ')
  return (
    <div className="flex flex-wrap items-center gap-4">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`Monthly cost by group. ${summary}`}>
        <title>{summary}</title>
        <circle cx={center} cy={center} r={radius} fill="none" stroke="#e2e8f0" strokeWidth={stroke} />
        <g transform={`rotate(-90 ${center} ${center})`}>
          {arcs.map((arc) => (
            <circle
              key={arc.group}
              cx={center}
              cy={center}
              r={radius}
              fill="none"
              stroke={groupColor(arc.group)}
              strokeWidth={stroke}
              strokeDasharray={`${arc.len} ${Math.max(circumference - arc.len, 0)}`}
              strokeDashoffset={-arc.offset}
            />
          ))}
        </g>
        <text x={center} y={center - 2} textAnchor="middle" fill="#0f172a" fontSize="13" fontWeight="800">{money(total)}</text>
        <text x={center} y={center + 14} textAnchor="middle" fill="#64748b" fontSize="10" fontWeight="700">MONTHLY</text>
      </svg>
      <ul className="grid min-w-0 gap-1.5 text-sm">
        {slices.map((slice) => (
          <li key={slice.group} className="flex items-center gap-2 font-semibold text-slate-800">
            <i className="inline-block h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: GROUP_COLORS[slice.group] || GROUP_COLORS.ungrouped }} />
            <span className="min-w-0 truncate">{groupLabel(slice.group)}</span>
            <span className="ml-auto tabular-nums">{money(slice.amount)}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function TrendChart({ series }) {
  const max = series.reduce((peak, point) => Math.max(peak, point.amount), 0)
  if (!series.length || max <= 0) return null
  return (
    <div className="flex items-end gap-1.5 overflow-x-auto" style={{ minHeight: 112 }}>
      {series.map((point) => {
        const height = Math.max((point.amount / max) * 100, 6)
        return (
          <div key={point.month} className="flex min-w-[2.25rem] flex-1 flex-col items-center justify-end" title={`${point.month}: ${money(point.amount)}`}>
            <span className="mb-1 text-[10px] font-semibold text-slate-500">{money(point.amount)}</span>
            <span className="block w-full rounded-sm" style={{ height: `${height}px`, background: '#5b21b6', maxHeight: 72 }} />
            <span className="mt-1 text-[10px] font-semibold uppercase text-slate-400">{shortMonth(point.month)}</span>
          </div>
        )
      })}
    </div>
  )
}

function StatusBadge({ status }) {
  const tone = STATUS_STYLE[status] || STATUS_STYLE.active
  return (
    <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide" style={{ background: tone.wash, color: tone.text }}>
      <i className="h-1.5 w-1.5 rounded-full" style={{ background: tone.dot }} />
      {tone.label}
    </span>
  )
}

function FlagChip({ children, title, tone }) {
  return (
    <span title={title} className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide" style={tone}>
      {children}
    </span>
  )
}

function rowKey(item, index) {
  return item.id || `${item.status || 'row'}-${item.vendor || 'vendor'}-${index}`
}

export function BillingSubscriptions({ data }) {
  const view = subscriptionsEmptyState(data)
  const items = view.loaded ? data.items : []
  const [filter, setFilter] = useState('all')
  const [sort, setSort] = useState({ key: 'monthly', dir: 'desc' })
  const [open, setOpen] = useState(() => new Set())

  const filtered = useMemo(
    () => sortSubscriptionItems(filterSubscriptionItems(items, filter), sort.key, sort.dir),
    [items, filter, sort],
  )
  const trend = useMemo(() => overallMonthlyTrend(items), [items])
  const totalShown = sumMonthly(filtered)
  const totals = data?.totals || {}
  const windowLabel = formatSourceWindow(data?.source_window)
  const updatedLabel = formatSubscriptionUpdated(data?.updated_at)

  function toggleSort(key) {
    setSort((current) => ({ key, dir: current.key === key && current.dir === 'desc' ? 'asc' : 'desc' }))
  }

  function toggleRow(key) {
    setOpen((current) => {
      const next = new Set(current)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const kpis = [
    ['Monthly run rate', money(totals.monthly_run_rate), 'Active subscriptions'],
    ['Annualized cost', money(totals.annualized_cost), 'Active run rate for a year'],
    ['Active subscriptions', String(totals.subscription_count ?? 0), 'Still charging'],
    ['Stopped', String(totals.stopped_count ?? 0), 'No longer charging'],
    ['Price increases', String(totals.price_increase_count ?? 0), 'Amount changed recently'],
    ['Possible overlaps', String(totals.overlap_count ?? 0), 'Flagged as duplicate or overlap'],
  ]

  return (
    <section id="billing-subscriptions" className="billing-subscriptions grid gap-3" aria-labelledby="billing-subscriptions-title" data-testid="billing-subscriptions">
      <style>{`
        .billing-subscriptions .billing-table { table-layout: auto; min-width: 880px; }
        .billing-subscriptions .billing-table tr { height: auto; }
        .billing-subscriptions .billing-table th,
        .billing-subscriptions .billing-table td { height: auto; white-space: normal; vertical-align: top; padding-top: 8px; padding-bottom: 8px; }
        .billing-subscriptions .billing-table tbody tr.sub-main { cursor: pointer; }
        .billing-subscriptions .billing-table tr.sub-detail,
        .billing-subscriptions .billing-table tr.sub-detail td { cursor: default; background: #f8fafc; }
      `}</style>
      <header className="border-b border-slate-200 pb-2">
        <h2 id="billing-subscriptions-title" className="text-base font-semibold tracking-tight text-slate-900 sm:text-lg">Subscriptions</h2>
        <p className="mt-0.5 text-sm text-slate-600">{SUBSCRIPTIONS_INTRO}</p>
        {view.loaded ? (
          <p className="mt-1 text-sm text-slate-500" data-testid="billing-subscriptions-meta">
            {updatedLabel}
            {windowLabel ? ` · ${windowLabel}` : ''}
            {data.source ? ` · ${data.source}` : ''}
          </p>
        ) : null}
      </header>

      {!view.loaded ? (
        <p className="rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-6 text-sm text-slate-500" data-testid="billing-subscriptions-empty">
          {SUBSCRIPTIONS_EMPTY_MESSAGE}
        </p>
      ) : (
        <>
          {Array.isArray(data.access_issues) && data.access_issues.length ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
              {data.access_issues.map((issue) => <p key={issue}>{issue}</p>)}
            </div>
          ) : null}

          <div className="grid grid-cols-2 gap-3 xl:grid-cols-6" data-testid="billing-subscriptions-kpis">
            {kpis.map(([label, value, detail]) => (
              <article key={label} className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
                <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{label}</p>
                <p className="mt-1 text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">{value}</p>
                <p className="mt-1 text-xs text-slate-500">{detail}</p>
              </article>
            ))}
          </div>
          {totals.note ? <p className="text-xs text-slate-500">{totals.note}</p> : null}

          <div className="grid items-start gap-3 lg:grid-cols-2">
            <ChartCard title="Top subscriptions by monthly cost" subtitle="Largest 15, excluding stopped rows." testId="billing-subscriptions-bars">
              <TopCostBars items={items} />
            </ChartCard>
            <ChartCard title="Monthly cost by group" subtitle="Active, possible, and annual rows." testId="billing-subscriptions-donut">
              <GroupDonut items={items} />
            </ChartCard>
            {trend.length ? (
              <ChartCard className="lg:col-span-2" title="Monthly spend" subtitle="Sum of charge history included in this file." testId="billing-subscriptions-trend">
                <TrendChart series={trend} />
              </ChartCard>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Subscription filters">
            {SUBSCRIPTION_FILTERS.map((item) => {
              const active = filter === item.id
              const count = filterSubscriptionItems(items, item.id).length
              return (
                <button
                  key={item.id}
                  type="button"
                  title={item.title || undefined}
                  aria-pressed={active}
                  className="rounded-full px-3 py-1 text-xs font-bold"
                  style={active ? { background: '#5b21b6', color: '#fff' } : { background: '#f1f5f9', color: '#475569' }}
                  onClick={() => setFilter(item.id)}
                >
                  {item.label} {count}
                </button>
              )
            })}
          </div>

          {filtered.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-6 text-sm text-slate-500">
              {items.length === 0 ? 'No recurring charges in this window.' : 'No subscriptions match this filter.'}
            </p>
          ) : (
            <div className="billing-scroll rounded-2xl border border-slate-200 bg-white shadow-sm">
              <table className="billing-table text-left text-xs sm:text-sm" data-testid="billing-subscriptions-table">
                <caption className="sr-only">Recurring charges. Choose a row to read notes and charge history. This table does not change any subscription.</caption>
                <thead className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
                  <tr>
                    {[
                      ['vendor', 'Vendor'],
                      ['group', 'Group'],
                      ['monthly', 'Monthly'],
                      ['last_charged_date', 'Last charge'],
                      ['next_expected_date', 'Next expected'],
                      ['last4', 'Card'],
                      ['status', 'Status'],
                    ].map(([key, label]) => {
                      const active = sort.key === key
                      return (
                        <th key={key} scope="col" aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
                          <button type="button" className="inline-flex items-center gap-1" onClick={() => toggleSort(key)}>
                            {label}
                            <span className="text-[10px] text-slate-400">{active ? (sort.dir === 'asc' ? '↑' : '↓') : ''}</span>
                          </button>
                        </th>
                      )
                    })}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((item, index) => {
                    const key = rowKey(item, index)
                    const expanded = open.has(key)
                    const series = monthlyChargeSeries(item.charges)
                    const monthly = subscriptionMonthly(item)
                    return (
                      <Fragment key={key}>
                        <tr
                          className="sub-main"
                          tabIndex={0}
                          aria-expanded={expanded}
                          onClick={() => toggleRow(key)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault()
                              toggleRow(key)
                            }
                          }}
                        >
                          <td className="border-t border-slate-100 font-semibold text-slate-900">
                            <span className="block">{item.vendor || '—'}</span>
                            <span className="mt-1 flex flex-wrap gap-1">
                              {item.amount_changed_recently === true ? (
                                <FlagChip title="The amount changed recently." tone={{ background: '#ffedd5', color: '#9a3412' }}>Price up</FlagChip>
                              ) : null}
                              {item.possible_duplicate_or_overlap ? (
                                <FlagChip title={item.possible_duplicate_or_overlap} tone={{ background: '#fef3c7', color: '#92400e' }}>Overlap</FlagChip>
                              ) : null}
                              {item.group === 'maybe_personal' ? (
                                <FlagChip title="Grouped as maybe personal." tone={{ background: '#ffe4e6', color: '#9f1239' }}>Maybe personal</FlagChip>
                              ) : null}
                            </span>
                          </td>
                          <td className="border-t border-slate-100 text-slate-700">{groupLabel(item.group)}</td>
                          <td className="border-t border-slate-100 text-right tabular-nums">
                            <span className="block">{money(monthly)}</span>
                            <Sparkline series={series} label={item.vendor ? `${item.vendor} monthly charges` : 'Monthly charges'} />
                          </td>
                          <td className="border-t border-slate-100">{formatDay(item.last_charged_date)}</td>
                          <td className="border-t border-slate-100">{formatDay(item.next_expected_date)}</td>
                          <td className="border-t border-slate-100 tabular-nums">{item.payment_account_last4 ? `••${item.payment_account_last4}` : '—'}</td>
                          <td className="border-t border-slate-100"><StatusBadge status={item.status} /></td>
                        </tr>
                        {expanded ? (
                          <tr className="sub-detail">
                            <td colSpan={7} className="border-t border-slate-100 text-sm text-slate-600">
                              <dl className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                                <div><dt className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Latest charge</dt><dd>{money(item.latest_charge)}</dd></div>
                                <div><dt className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Average</dt><dd>{money(item.average_monthly_amount)}</dd></div>
                                <div><dt className="text-[11px] font-bold uppercase tracking-wide text-slate-400">First seen</dt><dd>{formatDay(item.first_seen)}</dd></div>
                                <div><dt className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Charges in window</dt><dd>{item.charge_count_in_window == null ? '—' : item.charge_count_in_window}</dd></div>
                                {item.category_or_account ? <div className="sm:col-span-2"><dt className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Category or account</dt><dd>{item.category_or_account}</dd></div> : null}
                                {item.payment_account ? <div><dt className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Payment account</dt><dd>{item.payment_account}</dd></div> : null}
                              </dl>
                              {item.vendor_name_variants?.length ? <p className="mt-3">Also seen as {item.vendor_name_variants.join(', ')}.</p> : null}
                              {item.notes ? <p className="mt-3">{item.notes}</p> : null}
                              {item.reason_possible ? <p className="mt-2">Why this may not be software: {item.reason_possible}</p> : null}
                              {item.possible_duplicate_or_overlap ? <p className="mt-2">Overlap: {item.possible_duplicate_or_overlap}</p> : null}
                              {item.charges?.length ? (
                                <div className="mt-3 overflow-x-auto">
                                  <table className="w-full min-w-[640px] text-left text-xs">
                                    <thead className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
                                      <tr>
                                        <th className="py-1 pr-3">Date</th>
                                        <th className="py-1 pr-3 text-right">Amount</th>
                                        <th className="py-1 pr-3">Memo</th>
                                        <th className="py-1 pr-3">Account</th>
                                        <th className="py-1 pr-3">Card</th>
                                        <th className="py-1">Type</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {item.charges.map((charge, chargeIndex) => (
                                        <tr key={`${charge.date || 'date'}-${charge.txn_id || chargeIndex}`}>
                                          <td className="border-t border-slate-200 py-1 pr-3">{formatDay(charge.date)}</td>
                                          <td className="border-t border-slate-200 py-1 pr-3 text-right tabular-nums">{money(charge.amount)}</td>
                                          <td className="border-t border-slate-200 py-1 pr-3">{charge.memo || '—'}</td>
                                          <td className="border-t border-slate-200 py-1 pr-3">{charge.account || '—'}</td>
                                          <td className="border-t border-slate-200 py-1 pr-3 tabular-nums">{charge.payment_account_last4 ? `••${charge.payment_account_last4}` : '—'}</td>
                                          <td className="border-t border-slate-200 py-1">{charge.txn_type || '—'}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              ) : null}
                              {!item.notes && !item.charges?.length ? <p className="mt-3">No notes or charge history for this row.</p> : null}
                            </td>
                          </tr>
                        ) : null}
                      </Fragment>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr>
                    <td className="border-t border-slate-200 font-extrabold text-slate-900">Totals</td>
                    <td className="border-t border-slate-200 text-slate-500">{filtered.length} shown</td>
                    <td className="border-t border-slate-200 text-right font-extrabold tabular-nums">{money(totalShown)}</td>
                    <td className="border-t border-slate-200" colSpan={4} />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </>
      )}
    </section>
  )
}
