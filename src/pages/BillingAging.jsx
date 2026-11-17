import { AGING } from './BillingCharts'
import { asOfDate, buildAgingReport } from '../lib/billingAging'

const COLUMNS = [
  { key: 'current', label: 'Current', hint: 'Not yet due', tone: AGING.current },
  { key: 'd30', label: '1–30 Days', tone: AGING.d30 },
  { key: 'd60', label: '31–60 Days', tone: AGING.d60 },
  { key: 'd90', label: '61–90 Days', tone: AGING.d90 },
  { key: 'late', label: '90+ Days', tone: AGING.late },
]

function money(value) {
  const formatted = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(Math.abs(value || 0))
  return value < 0 ? `(${formatted})` : formatted
}

function cellStyle(amount, tone, emphasize) {
  if (!amount) return { fontWeight: emphasize ? 800 : 500, color: '#0f172a' }
  if (amount < 0) {
    return {
      background: '#f8fafc',
      color: '#64748b',
      fontWeight: emphasize ? 800 : 500,
    }
  }
  return {
    background: tone.wash,
    color: tone.text,
    fontWeight: emphasize ? 800 : 650,
  }
}

function Amount({ value, tone, emphasize = false }) {
  if (!value) return <td className="border border-slate-300 bg-white text-right" />
  return (
    <td className="border border-slate-300 text-right tabular-nums" style={cellStyle(value, tone, emphasize)}>
      {money(value)}
    </td>
  )
}

export function AgingReport({ clients = [], nonRecurring = [], otherOpen = [], updatedAt }) {
  const asOf = asOfDate(updatedAt)
  const parties = [
    ...clients.map((row) => ({ client: row.client, open_balance: row.open_balance, open_invoices: row.open_invoices })),
    ...nonRecurring.map((row) => ({ client: row.client, open_balance: row.overdue_amount, open_invoices: row.open_invoices })),
    ...otherOpen.map((row) => ({ client: row.client, open_balance: row.open_balance, open_invoices: row.open_invoices })),
  ]
  const report = buildAgingReport(parties, asOf)
  return (
    <section id="billing-aging" className="grid gap-2" aria-labelledby="billing-aging-title" data-testid="billing-aging">
      <header className="border-b border-slate-200 pb-2">
        <h2 id="billing-aging-title" className="text-base font-semibold tracking-tight text-slate-900 sm:text-lg">Aging report</h2>
        <p className="mt-0.5 text-sm text-slate-500">Open invoices by days past the due date, as of {asOf}.</p>
      </header>
      {report.rows.length === 0 ? (
        <p className="rounded-md border border-dashed border-slate-300 bg-white px-3 py-4 text-sm text-slate-500">No open balances in this data.</p>
      ) : (
        <div className="billing-scroll rounded-md border border-slate-400 bg-white">
          <table className="billing-table border-collapse text-xs sm:text-sm" data-testid="billing-aging-table">
            <colgroup>
              <col style={{ width: '24%' }} />
              <col style={{ width: '12.6%' }} />
              <col style={{ width: '12.6%' }} />
              <col style={{ width: '12.6%' }} />
              <col style={{ width: '12.6%' }} />
              <col style={{ width: '12.6%' }} />
              <col style={{ width: '13%' }} />
            </colgroup>
            <thead>
              <tr className="bg-slate-100 text-[11px] font-bold uppercase tracking-wide text-slate-600">
                <th className="border border-slate-300 text-left">Client</th>
                {COLUMNS.map((column) => (
                  <th key={column.key} className="border border-slate-300 text-right">{column.label}</th>
                ))}
                <th className="border border-slate-300 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {report.rows.map((row) => (
                <tr key={row.client}>
                  <td className="clip border border-slate-300 font-medium text-slate-900">{row.client}</td>
                  {COLUMNS.map((column) => (
                    <Amount key={column.key} value={row[column.key]} tone={column.tone} />
                  ))}
                  <td className="border border-slate-300 text-right font-semibold tabular-nums" style={{ color: row.total < 0 ? '#64748b' : '#0f172a' }}>{money(row.total)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-slate-50">
                <td className="border border-slate-300 font-extrabold text-slate-900">Totals</td>
                {COLUMNS.map((column) => (
                  <Amount key={column.key} value={report.totals[column.key]} tone={column.tone} emphasize />
                ))}
                <td className="border border-slate-300 text-right font-extrabold tabular-nums" style={{ color: report.totals.total < 0 ? '#64748b' : '#0f172a' }}>{money(report.totals.total)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
      {report.missingInvoices ? (
        <p className="text-xs text-slate-500">
          Some open balances have no invoice due dates, so those bucket cells are blank and only the total is shown. Add `open_invoices` with `due_date` and `balance` for each open invoice.
        </p>
      ) : null}
    </section>
  )
}
