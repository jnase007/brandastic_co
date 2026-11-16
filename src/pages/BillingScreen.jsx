import { useMemo, useState } from 'react'

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

function sortByAmount(rows) {
  return [...rows].sort((a, b) => b.amount - a.amount || a.client.localeCompare(b.client))
}

function AlertList({ rows, empty }) {
  if (!rows.length) return <p className="pr-note">{empty}</p>
  return (
    <div className="pr-table-wrap">
      <table className="pr-table">
        <thead>
          <tr>
            <th scope="col">Client</th>
            <th scope="col">Amount</th>
            <th scope="col">Since</th>
            <th scope="col">Detail</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={`${row.type}-${row.client}-${row.since_date || ''}`}>
              <td className="font-semibold text-slate-900">{row.client}</td>
              <td>{money(row.amount)}</td>
              <td>{formatDate(row.since_date)}</td>
              <td className="max-w-md text-slate-600">{row.detail || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function sortClients(clients) {
  return [...clients].sort((a, b) => {
    if (a.unpaid_90_days_flag !== b.unpaid_90_days_flag) return a.unpaid_90_days_flag ? -1 : 1
    const aDays = a.days_since_last_payment ?? -1
    const bDays = b.days_since_last_payment ?? -1
    if (aDays !== bDays) return bDays - aDays
    return a.client.localeCompare(b.client)
  })
}

function Shell({ children }) {
  return (
    <div className="pr-page">
      <header className="pr-header">
        <div className="pr-brand">
          <div>
            <strong>Team</strong>
            <h1>Billing</h1>
          </div>
        </div>
      </header>
      {children}
    </div>
  )
}

function Message({ title, children }) {
  return (
    <Shell>
      <section className="pr-panel" data-testid="billing-message">
        <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
        <p className="pr-note mt-2">{children}</p>
      </section>
    </Shell>
  )
}

export function BillingScreen({ state, initialLateOnly = false }) {
  const [lateOnly, setLateOnly] = useState(initialLateOnly)
  const report = state?.status === 'ready' ? state.report : null
  const rows = useMemo(() => {
    const clients = report?.clients || []
    const sorted = sortClients(clients)
    return lateOnly ? sorted.filter((row) => row.unpaid_90_days_flag) : sorted
  }, [report, lateOnly])

  if (!state || state.status === 'loading') {
    return (
      <Shell>
        <p className="pr-note">Loading…</p>
      </Shell>
    )
  }

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
        Try again in a moment.
      </Message>
    )
  }

  const summary = report.summary || {}
  const alerts = report.alerts || []
  const overdueAlerts = sortByAmount(alerts.filter((row) => row.type === 'overdue'))
  const lateBalanceAlerts = alerts.filter((row) => row.type === 'no_payment_90')
  const mismatchAlerts = alerts.filter((row) => row.type === 'payment_not_applied' || row.type === 'credit_mismatch')
  const nonRecurring = [...(report.non_recurring_unpaid || [])].sort(
    (a, b) => b.overdue_amount - a.overdue_amount || a.client.localeCompare(b.client),
  )
  const lateStyle = { background: '#fff7ed' }

  return (
    <Shell>
      {report.sample ? (
        <p className="pr-note" data-testid="billing-sample-banner">
          Sample data for review. Every client on this page is fictional.
        </p>
      ) : null}

      <section className="pr-panel" aria-label="Billing alerts" data-testid="billing-alerts">
        <div className="pr-panel-head">
          <h3>Alerts</h3>
        </div>
        <div className="grid gap-6">
          <div>
            <h4 className="mb-2 text-sm font-semibold text-slate-900">Recurring clients with an overdue balance</h4>
            <AlertList rows={overdueAlerts} empty="No overdue recurring balances." />
          </div>
          <div>
            <h4 className="mb-2 text-sm font-semibold text-slate-900">No payment in 90+ days, open balance remains</h4>
            <AlertList rows={lateBalanceAlerts} empty="No open balances older than 90 days." />
          </div>
          <div>
            <h4 className="mb-2 text-sm font-semibold text-slate-900">Payment not applied or credit mismatch</h4>
            <p className="pr-note mb-2">Invoice still open while the customer balance is $0, or a payment came in and invoices are still open.</p>
            <AlertList rows={mismatchAlerts} empty="No payment or credit mismatches." />
          </div>
          <div>
            <h4 className="mb-2 text-sm font-semibold text-slate-900">Non-recurring unpaid</h4>
            {nonRecurring.length === 0 ? (
              <p className="pr-note">No non-recurring unpaid customers.</p>
            ) : (
              <div className="pr-table-wrap">
                <table className="pr-table" data-testid="billing-non-recurring">
                  <thead>
                    <tr>
                      <th scope="col">Client</th>
                      <th scope="col">Overdue</th>
                      <th scope="col">Last payment</th>
                      <th scope="col">Days since payment</th>
                      <th scope="col">Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {nonRecurring.map((row) => (
                      <tr key={row.client}>
                        <td className="font-semibold text-slate-900">{row.client}</td>
                        <td>{money(row.overdue_amount)}</td>
                        <td>{formatDate(row.last_payment_date)}</td>
                        <td>{row.days_since_payment == null ? '—' : row.days_since_payment}</td>
                        <td className="max-w-md text-slate-600">{row.notes || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </section>

      <div className="tm-kpis">
        <article className="pr-kpi">
          <span>Total MRR</span>
          <strong>{money(summary.mrr)}</strong>
          <small>{summary.client_count || 0} recurring clients</small>
        </article>
        <article className="pr-kpi">
          <span>Open balance</span>
          <strong>{money(summary.open_balance)}</strong>
          <small>Unpaid across these clients</small>
        </article>
        <article className="pr-kpi">
          <span>Overdue balance</span>
          <strong>{money(summary.overdue_balance)}</strong>
          <small>Past due</small>
        </article>
        <article className="pr-kpi">
          <span>No payment in 90+ days</span>
          <strong>{summary.no_payment_90_count || 0}</strong>
          <small>Flagged clients</small>
        </article>
      </div>

      <section className="pr-panel" aria-label="Recurring billing clients">
        <div className="pr-panel-head">
          <h3>Recurring clients</h3>
          <div className="pr-segment" role="group" aria-label="Billing filter">
            <button type="button" className={lateOnly ? '' : 'active'} aria-pressed={!lateOnly} onClick={() => setLateOnly(false)}>
              All clients
            </button>
            <button type="button" className={lateOnly ? 'active' : ''} aria-pressed={lateOnly} onClick={() => setLateOnly(true)}>
              No payment in 90+ days
            </button>
          </div>
        </div>

        {rows.length === 0 ? (
          <p className="pr-note">No clients in this filter.</p>
        ) : (
          <div className="pr-table-wrap">
            <table className="pr-table" data-testid="billing-table">
              <thead>
                <tr>
                  <th scope="col">Client</th>
                  <th scope="col">Monthly recurring</th>
                  <th scope="col">Months billed</th>
                  <th scope="col">Last invoice</th>
                  <th scope="col">Last payment</th>
                  <th scope="col">Days since payment</th>
                  <th scope="col">Open balance</th>
                  <th scope="col">Overdue</th>
                  <th scope="col">90+ days</th>
                  <th scope="col">Notes</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={`${row.qb_customer_id}-${row.client}`}>
                    <td style={row.unpaid_90_days_flag ? lateStyle : undefined}>
                      <div className="font-semibold text-slate-900">{row.client}</div>
                      <div className="text-xs font-medium text-slate-500">{row.qb_customer_id || '—'}</div>
                    </td>
                    <td style={row.unpaid_90_days_flag ? lateStyle : undefined}>{money(row.monthly_recurring_amount)}</td>
                    <td style={row.unpaid_90_days_flag ? lateStyle : undefined}>{row.months_billed_last_12}</td>
                    <td style={row.unpaid_90_days_flag ? lateStyle : undefined}>{formatDate(row.last_invoice_date)}</td>
                    <td style={row.unpaid_90_days_flag ? lateStyle : undefined}>{formatDate(row.last_payment_date)}</td>
                    <td style={row.unpaid_90_days_flag ? lateStyle : undefined}>
                      {row.days_since_last_payment == null ? '—' : row.days_since_last_payment}
                    </td>
                    <td style={row.unpaid_90_days_flag ? lateStyle : undefined}>{money(row.open_balance)}</td>
                    <td style={row.unpaid_90_days_flag ? lateStyle : undefined}>{money(row.overdue_balance)}</td>
                    <td style={row.unpaid_90_days_flag ? lateStyle : undefined}>
                      {row.unpaid_90_days_flag ? (
                        <span className="inline-flex whitespace-nowrap rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-amber-800">
                          No payment in 90+ days
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td style={row.unpaid_90_days_flag ? lateStyle : undefined} className="max-w-xs text-slate-600">
                      {row.notes || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </Shell>
  )
}
