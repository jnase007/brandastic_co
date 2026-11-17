import { useMemo, useState } from 'react'
import { AGING, BillingCharts, ColorLegend, ageStatus } from './BillingCharts'
import { AgingReport } from './BillingAging'

export const BILLING_DATA_SOURCE_LABEL = 'Data pulled via QuickBooks Online'

function money(value) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(value || 0)
}

function formatDate(value) {
  if (!value) return '—'
  const [year, month, day] = value.split('-').map(Number)
  if (!year || !month || !day) return '—'
  const utc = new Date(Date.UTC(year, month - 1, day))
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(utc)
}

function formatUpdated(value) {
  if (!value) return 'Last updated time was not included in this data.'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Last updated time was not included in this data.'
  const formatted = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date)
  return `Updated ${formatted} PT`
}

function sortByAmount(rows) {
  return [...rows].sort((a, b) => b.amount - a.amount || a.client.localeCompare(b.client))
}

function Pill({ status }) {
  return (
    <span
      className="inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide"
      style={{ background: status.wash, color: status.text }}
    >
      <i className="h-1.5 w-1.5 rounded-full" style={{ background: status.dot }} />
      {status.label}
    </span>
  )
}

function Section({ id, title, subtitle, children }) {
  return (
    <section id={id} className="grid h-auto min-h-0 content-start items-start gap-3" aria-labelledby={`${id}-title`}>
      <header className="border-b border-slate-200 pb-2">
        <h2 id={`${id}-title`} className="text-base font-semibold tracking-tight text-slate-900 sm:text-lg">{title}</h2>
        <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>
      </header>
      {children}
    </section>
  )
}

function Shell({ children }) {
  return (
    <div className="billing-page">
      <style>{`
        .billing-page { display: block; height: auto; min-height: 0; width: min(1180px, 100%); max-width: 100%; margin: 0 auto; padding: 16px 16px 32px; }
        .billing-page > * + * { margin-top: 20px; }
        @media (min-width: 1024px) { .billing-page { padding: 20px 28px 40px; } .billing-page > * + * { margin-top: 24px; } }
        .billing-scroll { width: 100%; max-width: 100%; height: auto; min-height: 0; overflow-x: auto; }
        .billing-table { width: 100%; height: auto; table-layout: fixed; border-collapse: collapse; }
        .billing-table tr { height: 44px; }
        .billing-table th, .billing-table td { height: 44px; padding: 4px 8px; vertical-align: middle; white-space: nowrap; line-height: 1.2; }
        .billing-table th { position: sticky; top: 0; z-index: 2; background: #fff; text-align: left; font-size: 11px; }
        .billing-table td.clip { overflow: hidden; text-overflow: ellipsis; }
        .billing-table tbody tr { cursor: pointer; }
        .billing-table tbody tr:hover td { background: #f8fafc; }
      `}</style>
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#6d28d9]">Team</p>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Billing</h1>
        </div>
      </header>
      {children}
    </div>
  )
}

function Message({ title, children }) {
  return (
    <Shell>
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" data-testid="billing-message">
        <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
        <p className="mt-2 text-sm text-slate-500">{children}</p>
      </section>
    </Shell>
  )
}

function SourceLine({ updatedAt }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1" data-testid="billing-source">
      <span className="inline-flex items-center gap-2 rounded-full border border-[#b7e0b0] bg-[#f3faf1] px-2.5 py-1 text-sm font-semibold text-[#1f7a12]">
        <span className="grid h-5 w-5 place-items-center rounded bg-[#2ca01c] text-[10px] font-bold leading-none text-white" aria-hidden="true">QB</span>
        {BILLING_DATA_SOURCE_LABEL}
      </span>
      <span className="text-sm text-slate-500">{formatUpdated(updatedAt)}</span>
    </div>
  )
}

function LoadingState() {
  return (
    <Shell>
      <div className="grid gap-3" aria-busy="true" aria-live="polite">
        <p className="text-sm text-slate-500">Loading billing…</p>
        <div className="h-24 animate-pulse rounded-2xl bg-slate-200/70" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => <div key={index} className="h-20 animate-pulse rounded-2xl bg-slate-200/70" />)}
        </div>
        <div className="h-48 animate-pulse rounded-2xl bg-slate-200/70" />
      </div>
    </Shell>
  )
}

const RECURRING_FILTERS = [
  { id: 'all', label: 'All recurring' },
  { id: 'overdue', label: 'Overdue' },
  { id: 'late', label: '90+ unpaid' },
]

function compareValues(a, b, dir) {
  if (a == null && b == null) return 0
  if (a == null) return 1
  if (b == null) return -1
  const diff = typeof a === 'string' ? a.localeCompare(b) : a - b
  return dir === 'asc' ? diff : -diff
}

function ClientDrawer({ item, alerts, onClose }) {
  if (!item) return null
  const recurring = item.kind === 'recurring'
  const row = item.row
  const status = recurring
    ? ageStatus(row.days_since_last_payment, { overdue: row.overdue_balance, open: row.open_balance })
    : ageStatus(row.days_since_payment, { overdue: row.overdue_amount, open: row.overdue_amount })
  const related = (alerts || []).filter((alert) => alert.client === row.client)
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 sm:items-stretch sm:justify-end" onClick={onClose}>
      <aside
        className="max-h-[88vh] w-full overflow-auto rounded-t-2xl bg-white p-5 shadow-xl sm:max-h-none sm:max-w-md sm:rounded-none"
        role="dialog"
        aria-modal="true"
        aria-labelledby="billing-drawer-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{recurring ? 'Recurring client' : 'Non-recurring'}</p>
            <h2 id="billing-drawer-title" className="text-lg font-semibold text-slate-900">{row.client}</h2>
          </div>
          <button type="button" className="rounded-lg px-2 py-1 text-sm font-semibold text-slate-500 hover:bg-slate-100" onClick={onClose}>Close</button>
        </div>
        <div className="mt-3"><Pill status={status} /></div>
        <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
          {recurring ? (
            <>
              <div><dt className="text-xs font-bold uppercase tracking-wide text-slate-400">Monthly</dt><dd className="font-semibold text-slate-900">{money(row.monthly_recurring_amount)}</dd></div>
              <div><dt className="text-xs font-bold uppercase tracking-wide text-slate-400">Months billed</dt><dd className="font-semibold text-slate-900">{row.months_billed_last_12}</dd></div>
              <div><dt className="text-xs font-bold uppercase tracking-wide text-slate-400">Last invoice</dt><dd className="font-semibold text-slate-900">{formatDate(row.last_invoice_date)}</dd></div>
              <div><dt className="text-xs font-bold uppercase tracking-wide text-slate-400">Last payment</dt><dd className="font-semibold text-slate-900">{formatDate(row.last_payment_date)}</dd></div>
              <div><dt className="text-xs font-bold uppercase tracking-wide text-slate-400">Days since payment</dt><dd className="font-semibold text-slate-900">{row.days_since_last_payment == null ? 'None on file' : row.days_since_last_payment}</dd></div>
              <div><dt className="text-xs font-bold uppercase tracking-wide text-slate-400">QuickBooks id</dt><dd className="font-semibold text-slate-900">{row.qb_customer_id || '—'}</dd></div>
              <div><dt className="text-xs font-bold uppercase tracking-wide text-slate-400">Open balance</dt><dd className="font-semibold text-slate-900">{money(row.open_balance)}</dd></div>
              <div><dt className="text-xs font-bold uppercase tracking-wide text-slate-400">Overdue</dt><dd className="font-semibold text-slate-900">{money(row.overdue_balance)}</dd></div>
            </>
          ) : (
            <>
              <div><dt className="text-xs font-bold uppercase tracking-wide text-slate-400">Overdue</dt><dd className="font-semibold text-slate-900">{money(row.overdue_amount)}</dd></div>
              <div><dt className="text-xs font-bold uppercase tracking-wide text-slate-400">Last payment</dt><dd className="font-semibold text-slate-900">{formatDate(row.last_payment_date)}</dd></div>
              <div className="col-span-2"><dt className="text-xs font-bold uppercase tracking-wide text-slate-400">Days since payment</dt><dd className="font-semibold text-slate-900">{row.days_since_payment == null ? 'None on file' : row.days_since_payment}</dd></div>
            </>
          )}
        </dl>
        {row.notes ? <p className="mt-4 text-sm text-slate-600">{row.notes}</p> : null}
        {related.length ? (
          <div className="mt-4 grid gap-2">
            <h3 className="text-xs font-bold uppercase tracking-wide text-slate-400">Related alerts</h3>
            {related.map((alert) => {
              const tone = alert.type === 'overdue' || alert.type === 'no_payment_90' ? AGING.late : AGING.d60
              return (
                <p key={`${alert.type}-${alert.since_date || ''}`} className="rounded-xl px-3 py-2 text-sm" style={{ background: tone.wash, color: tone.text }}>
                  <span className="font-semibold">{money(alert.amount)}</span> · {alert.detail || alert.type}
                </p>
              )
            })}
          </div>
        ) : null}
      </aside>
    </div>
  )
}

export function BillingScreen({ state, initialLateOnly = false, initialClientName = '' }) {
  const [filter, setFilter] = useState(initialLateOnly ? 'late' : 'all')
  const [query, setQuery] = useState('')
  const [nonQuery, setNonQuery] = useState('')
  const [sort, setSort] = useState({ key: 'overdue_balance', dir: 'desc' })
  const [nonSort, setNonSort] = useState({ key: 'overdue_amount', dir: 'desc' })
  const [selected, setSelected] = useState(() => {
    const match = (state?.report?.clients || []).find((row) => row.client === initialClientName)
    return match ? { kind: 'recurring', row: match } : null
  })
  const report = state?.status === 'ready' ? state.report : null

  const recurringRows = useMemo(() => {
    const clients = report?.clients || []
    const needle = query.trim().toLowerCase()
    const filtered = clients.filter((row) => {
      if (needle && !row.client.toLowerCase().includes(needle)) return false
      if (filter === 'overdue') return (row.overdue_balance || 0) > 0
      if (filter === 'late') return row.unpaid_90_days_flag || row.days_since_last_payment == null || row.days_since_last_payment >= 90
      return true
    })
    return [...filtered].sort((a, b) => compareValues(a[sort.key], b[sort.key], sort.dir) || a.client.localeCompare(b.client))
  }, [report, query, filter, sort])

  const nonRecurringRows = useMemo(() => {
    const rows = report?.non_recurring_unpaid || []
    const needle = nonQuery.trim().toLowerCase()
    const filtered = needle ? rows.filter((row) => row.client.toLowerCase().includes(needle)) : rows
    return [...filtered].sort((a, b) => compareValues(a[nonSort.key], b[nonSort.key], nonSort.dir) || a.client.localeCompare(b.client))
  }, [report, nonQuery, nonSort])

  if (!state || state.status === 'loading') return <LoadingState />

  if (state.status === 'forbidden') {
    return (
      <Message title="You don't have access to billing.">
        This page is limited to two people. No billing data is loaded for this account.
      </Message>
    )
  }

  if (state.status === 'not_configured') {
    return (
      <Message title="Billing access is not configured.">
        Set the server environment variable BILLING_ALLOWED_EMAILS to exactly two login emails. Until then, billing stays closed.
      </Message>
    )
  }

  if (state.status === 'unconfigured_data') {
    return (
      <Message title="Billing data is not configured.">
        Set BILLING_CLIENTS_JSON on the server. Client and payment rows are not stored in the repository.
      </Message>
    )
  }

  if (state.status !== 'ready' || !report) {
    return (
      <Message title="Billing could not be loaded.">
        Try again in a moment. Nothing from the billing file is shown on this screen.
      </Message>
    )
  }

  const summary = report.summary || {}
  const alerts = report.alerts || []
  const overdueAlerts = sortByAmount(alerts.filter((row) => row.type === 'overdue'))
  const biggest = overdueAlerts[0] || null
  const lateCount = summary.no_payment_90_count || 0

  function toggleSort(key, current, setCurrent) {
    setCurrent((prev) => ({ key, dir: prev.key === key && prev.dir === 'desc' ? 'asc' : 'desc' }))
  }

  function SortHeader({ label, column, current, onSort }) {
    const active = current.key === column
    return (
      <th scope="col">
        <button type="button" className="inline-flex items-center gap-1" onClick={() => onSort(column)}>
          {label}
          <span className="text-[10px] text-slate-400">{active ? (current.dir === 'asc' ? '↑' : '↓') : ''}</span>
        </button>
      </th>
    )
  }

  return (
    <Shell>
      <SourceLine updatedAt={report.updated_at} />
      {report.sample ? (
        <p className="text-sm text-slate-500" data-testid="billing-sample-banner">
          Sample data for review. Every client on this page is fictional.
        </p>
      ) : null}

      <AgingReport
        clients={report.clients || []}
        nonRecurring={report.non_recurring_unpaid || []}
        updatedAt={report.updated_at}
      />

      <Section id="billing-attention" title="Needs attention" subtitle="What to look at before anything else.">
        <div
          className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-3"
          style={{ borderLeftWidth: 4, borderLeftColor: (summary.overdue_balance || 0) > 0 ? AGING.late.dot : AGING.current.dot }}
          data-testid="billing-banner"
        >
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Overdue total</p>
            <p className="mt-1 text-2xl font-semibold tracking-tight" style={{ color: (summary.overdue_balance || 0) > 0 ? AGING.late.text : AGING.current.text }}>{money(summary.overdue_balance)}</p>
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">90+ days unpaid</p>
            <p className="mt-1 text-2xl font-semibold tracking-tight" style={{ color: lateCount > 0 ? AGING.late.text : AGING.current.text }}>{lateCount}</p>
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Biggest risk</p>
            <p className="mt-1 text-base font-semibold text-slate-900">{biggest ? biggest.client : 'None'}</p>
            <p className="text-sm text-slate-500">{biggest ? money(biggest.amount) : 'No overdue alert in this data.'}</p>
          </div>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {overdueAlerts.slice(0, 4).map((alert) => (
            <p key={`${alert.client}-${alert.since_date || ''}`} className="rounded-xl px-3 py-2 text-sm" style={{ background: AGING.late.wash, color: AGING.late.text }}>
              <span className="font-semibold">{alert.client}</span> · {money(alert.amount)} · {alert.detail}
            </p>
          ))}
        </div>
      </Section>

      <Section id="billing-overview" title="Overview" subtitle="Recurring revenue and what is still unpaid.">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            ['Total MRR', money(summary.mrr), `${summary.client_count || 0} recurring clients`],
            ['Open balance', money(summary.open_balance), 'Unpaid across these clients'],
            ['Overdue', money(summary.overdue_balance), 'Past due'],
            ['90+ unpaid', String(lateCount), 'Flagged clients'],
          ].map(([label, value, detail]) => (
            <article key={label} className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{label}</p>
              <p className="mt-1 text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">{value}</p>
              <p className="mt-1 text-xs text-slate-500">{detail}</p>
            </article>
          ))}
        </div>
      </Section>

      <Section id="billing-charts-section" title="Trends and charts" subtitle="Same colors as the status pills. Hover a bar for the exact figure.">
        <ColorLegend />
        <BillingCharts clients={report.clients || []} />
      </Section>

      <Section id="billing-recurring" title="Recurring clients" subtitle="Search, sort, and open a client for the invoice and payment summary.">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Recurring filters">
            {RECURRING_FILTERS.map((item) => {
              const active = filter === item.id
              return (
                <button
                  key={item.id}
                  type="button"
                  aria-pressed={active}
                  className="rounded-full px-3 py-1 text-xs font-bold"
                  style={active ? { background: '#5b21b6', color: '#fff' } : { background: '#f1f5f9', color: '#475569' }}
                  onClick={() => setFilter(item.id)}
                >
                  {item.label}
                </button>
              )
            })}
            <a href="#billing-nonrecurring" className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">Non-recurring</a>
          </div>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search clients"
            aria-label="Search recurring clients"
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm sm:w-56"
          />
        </div>
        {recurringRows.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-6 text-sm text-slate-500">No recurring clients match this search or filter.</p>
        ) : (
          <div className="billing-scroll rounded-2xl border border-slate-200 bg-white shadow-sm">
            <table className="billing-table text-left text-xs sm:text-sm" data-testid="billing-table">
              <colgroup>
                <col style={{ width: '18%' }} />
                <col style={{ width: '12%' }} />
                <col style={{ width: '12%' }} />
                <col style={{ width: '12%' }} />
                <col style={{ width: '8%' }} />
                <col style={{ width: '12%' }} />
                <col style={{ width: '12%' }} />
                <col style={{ width: '14%' }} />
              </colgroup>
              <thead className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
                <tr>
                  <SortHeader label="Client" column="client" current={sort} onSort={(key) => toggleSort(key, sort, setSort)} />
                  <SortHeader label="Monthly" column="monthly_recurring_amount" current={sort} onSort={(key) => toggleSort(key, sort, setSort)} />
                  <SortHeader label="Last invoice" column="last_invoice_date" current={sort} onSort={(key) => toggleSort(key, sort, setSort)} />
                  <SortHeader label="Last payment" column="last_payment_date" current={sort} onSort={(key) => toggleSort(key, sort, setSort)} />
                  <SortHeader label="Days" column="days_since_last_payment" current={sort} onSort={(key) => toggleSort(key, sort, setSort)} />
                  <SortHeader label="Open" column="open_balance" current={sort} onSort={(key) => toggleSort(key, sort, setSort)} />
                  <SortHeader label="Overdue" column="overdue_balance" current={sort} onSort={(key) => toggleSort(key, sort, setSort)} />
                  <th scope="col">Status</th>
                </tr>
              </thead>
              <tbody>
                {recurringRows.map((row) => {
                  const status = ageStatus(row.days_since_last_payment, { overdue: row.overdue_balance, open: row.open_balance })
                  return (
                    <tr key={`${row.qb_customer_id}-${row.client}`} onClick={() => setSelected({ kind: 'recurring', row })}>
                      <td className="clip border-t border-slate-100 font-semibold text-slate-900" style={{ boxShadow: `inset 3px 0 0 ${status.dot}` }} title={row.qb_customer_id || row.client}>{row.client}</td>
                      <td className="border-t border-slate-100 text-right tabular-nums">{money(row.monthly_recurring_amount)}</td>
                      <td className="border-t border-slate-100">{formatDate(row.last_invoice_date)}</td>
                      <td className="border-t border-slate-100">{formatDate(row.last_payment_date)}</td>
                      <td className="border-t border-slate-100 text-right tabular-nums">{row.days_since_last_payment == null ? '—' : row.days_since_last_payment}</td>
                      <td className="border-t border-slate-100 text-right tabular-nums">{money(row.open_balance)}</td>
                      <td className="border-t border-slate-100 text-right tabular-nums">{money(row.overdue_balance)}</td>
                      <td className="border-t border-slate-100"><Pill status={status} /></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Section id="billing-nonrecurring" title="Non-recurring unpaid" subtitle="One-time customers. These amounts are not part of MRR.">
        <input
          value={nonQuery}
          onChange={(event) => setNonQuery(event.target.value)}
          placeholder="Search non-recurring"
          aria-label="Search non-recurring clients"
          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm sm:w-56"
        />
        {nonRecurringRows.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-6 text-sm text-slate-500">No non-recurring unpaid customers match this search.</p>
        ) : (
          <div className="billing-scroll rounded-2xl border border-slate-200 bg-white shadow-sm" data-testid="billing-non-recurring">
            <table className="billing-table text-left text-xs sm:text-sm">
              <colgroup>
                <col style={{ width: '34%' }} />
                <col style={{ width: '16%' }} />
                <col style={{ width: '18%' }} />
                <col style={{ width: '12%' }} />
                <col style={{ width: '20%' }} />
              </colgroup>
              <thead className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
                <tr>
                  <SortHeader label="Client" column="client" current={nonSort} onSort={(key) => toggleSort(key, nonSort, setNonSort)} />
                  <SortHeader label="Overdue" column="overdue_amount" current={nonSort} onSort={(key) => toggleSort(key, nonSort, setNonSort)} />
                  <SortHeader label="Last payment" column="last_payment_date" current={nonSort} onSort={(key) => toggleSort(key, nonSort, setNonSort)} />
                  <SortHeader label="Days" column="days_since_payment" current={nonSort} onSort={(key) => toggleSort(key, nonSort, setNonSort)} />
                  <th scope="col">Status</th>
                </tr>
              </thead>
              <tbody>
                {nonRecurringRows.map((row) => {
                  const status = ageStatus(row.days_since_payment, { overdue: row.overdue_amount, open: row.overdue_amount })
                  return (
                    <tr key={row.client} onClick={() => setSelected({ kind: 'nonrecurring', row })}>
                      <td className="clip border-t border-slate-100 font-semibold text-slate-900" style={{ boxShadow: `inset 3px 0 0 ${status.dot}` }}>{row.client}</td>
                      <td className="border-t border-slate-100 text-right tabular-nums">{money(row.overdue_amount)}</td>
                      <td className="border-t border-slate-100">{formatDate(row.last_payment_date)}</td>
                      <td className="border-t border-slate-100 text-right tabular-nums">{row.days_since_payment == null ? '—' : row.days_since_payment}</td>
                      <td className="border-t border-slate-100"><Pill status={status} /></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <ClientDrawer item={selected} alerts={alerts} onClose={() => setSelected(null)} />
    </Shell>
  )
}
