const MAX_INVOICES = 200
const MAX_LIST = 500

function round2(value) {
  return Math.round(value * 100) / 100
}

function num(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value !== 'string') return null
  const cleaned = value.replace(/[$,\s]/g, '').trim()
  if (!cleaned) return null
  const parsed = Number(cleaned)
  return Number.isFinite(parsed) ? parsed : null
}

function day(value) {
  if (typeof value !== 'string') return null
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(value.trim())
  if (!match) return null
  const [year, month, date] = match[1].split('-').map(Number)
  const utc = new Date(Date.UTC(year, month - 1, date))
  if (utc.getUTCFullYear() !== year || utc.getUTCMonth() !== month - 1 || utc.getUTCDate() !== date) return null
  return match[1]
}

function clip(value, max) {
  const text = Array.from(String(value || ''), (char) => (char.charCodeAt(0) < 32 ? ' ' : char)).join('').trim()
  if (!text) return ''
  return text.length > max ? text.slice(0, max) : text
}

function monthIndex(iso) {
  const [year, month] = iso.split('-').map(Number)
  return year * 12 + (month - 1)
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  if (sorted.length % 2) return sorted[mid]
  return (sorted[mid - 1] + sorted[mid]) / 2
}

function customerId(row) {
  const value = row?.CustomerRef?.value ?? row?.Id
  if (value == null) return ''
  return String(value).trim()
}

function walkReportRows(rows, visit) {
  for (const row of rows || []) {
    if (Array.isArray(row?.Rows?.Row)) walkReportRows(row.Rows.Row, visit)
    if (Array.isArray(row?.ColData)) visit(row.ColData)
  }
}

export function pastDueByCustomer(report) {
  const totals = new Map()
  if (!report || typeof report !== 'object') return totals
  const columns = Array.isArray(report?.Columns?.Column) ? report.Columns.Column : []
  walkReportRows(report?.Rows?.Row, (cols) => {
    const name = clip(cols[0]?.value, 200).toLowerCase()
    if (!name || name === 'total') return
    let past = 0
    for (let index = 1; index < cols.length; index += 1) {
      const title = String(columns[index]?.ColTitle || columns[index]?.ColType || '').toLowerCase()
      if (!title || title.includes('current') || title.includes('total') || title.includes('name')) continue
      const amount = num(cols[index]?.value)
      if (amount != null && amount > 0) past += amount
    }
    if (past > 0) totals.set(name, round2((totals.get(name) || 0) + past))
  })
  return totals
}

function blankParty(id) {
  return {
    id,
    name: '',
    balance: null,
    history: [],
    invoices: [],
    payments: [],
    unapplied: 0,
  }
}

function reject(code) {
  const error = new Error(code)
  error.code = code
  throw error
}

export function mapQuickBooksReceivables({ customers = [], invoices = [], payments = [], creditMemos = [], agedReport = null, asOf }) {
  const today = day(asOf)
  if (!today) reject('invalid_snapshot')
  const todayIndex = monthIndex(today)
  const parties = new Map()

  function party(id, name) {
    const key = id || `name:${name.toLowerCase()}`
    let row = parties.get(key)
    if (!row) {
      row = blankParty(id)
      parties.set(key, row)
    }
    if (name && !row.name) row.name = name
    return row
  }

  for (const customer of customers) {
    const id = customer?.Id == null ? '' : String(customer.Id).trim()
    const name = clip(customer?.DisplayName || customer?.FullyQualifiedName, 180)
    if (!id && !name) continue
    const row = party(id, name)
    if (name) row.name = name
    const balance = num(customer?.Balance)
    if (balance != null) row.balance = balance
  }

  for (const invoice of invoices) {
    const id = customerId(invoice)
    const name = clip(invoice?.CustomerRef?.name, 180)
    if (!id && !name) continue
    const row = party(id, name)
    const txn = day(invoice?.TxnDate)
    const due = day(invoice?.DueDate) || txn
    const balance = num(invoice?.Balance)
    const total = num(invoice?.TotalAmt)
    if (txn && total != null && total > 0) row.history.push({ date: txn, total })
    if (balance != null && balance > 0 && due) {
      row.invoices.push({
        due_date: due,
        balance: round2(balance),
        invoice_date: txn,
        invoice_number: clip(invoice?.DocNumber, 40),
      })
    }
  }

  for (const payment of payments) {
    const id = customerId(payment)
    const name = clip(payment?.CustomerRef?.name, 180)
    if (!id && !name) continue
    const row = party(id, name)
    const txn = day(payment?.TxnDate)
    const unapplied = num(payment?.UnappliedAmt)
    if (txn) row.payments.push(txn)
    if (unapplied != null && unapplied > 0) row.unapplied = round2(row.unapplied + unapplied)
  }

  for (const memo of creditMemos) {
    const id = customerId(memo)
    const name = clip(memo?.CustomerRef?.name, 180)
    if (!id && !name) continue
    const row = party(id, name)
    const remaining = num(memo?.RemainingCredit ?? memo?.Balance)
    if (remaining == null || remaining <= 0) continue
    row.invoices.push({
      due_date: day(memo?.DueDate),
      balance: round2(-Math.abs(remaining)),
      invoice_date: day(memo?.TxnDate),
      invoice_number: clip(memo?.DocNumber, 40),
    })
  }

  const aged = pastDueByCustomer(agedReport)
  const built = []
  for (const row of parties.values()) {
    const name = clip(row.name, 180)
    if (!name) continue
    if (row.invoices.length > MAX_INVOICES) reject('intuit_rejected')
    const positive = row.invoices.filter((invoice) => invoice.balance > 0)
    const overdueFromDates = round2(
      positive.filter((invoice) => invoice.due_date < today).reduce((sum, invoice) => sum + invoice.balance, 0),
    )
    const open = row.balance == null
      ? round2(Math.max(0, positive.reduce((sum, invoice) => sum + invoice.balance, 0) - row.unapplied))
      : round2(Math.max(0, row.balance))
    const agedPast = aged.get(name.toLowerCase())
    const overdue = round2(Math.min(open, Math.max(overdueFromDates, agedPast || 0)))
    const monthlyTotals = new Map()
    for (const entry of row.history) {
      const index = monthIndex(entry.date)
      if (index < todayIndex - 11 || index > todayIndex) continue
      monthlyTotals.set(index, round2((monthlyTotals.get(index) || 0) + entry.total))
    }
    const amounts = [...monthlyTotals.values()].filter((value) => value > 0)
    const months = Math.min(12, amounts.length)
    const lastInvoice = [...row.history.map((entry) => entry.date), ...positive.map((invoice) => invoice.invoice_date)]
      .filter(Boolean)
      .sort()
      .at(-1) || null
    const lastPayment = [...row.payments].sort().at(-1) || null
    built.push({
      name,
      id: clip(row.id, 80),
      open,
      overdue,
      months,
      monthly: amounts.length ? round2(median(amounts)) : 0,
      recurring: months >= 3,
      lastInvoice,
      lastPayment,
      unapplied: row.unapplied,
      invoices: row.invoices,
      positive,
    })
  }

  const nameCount = new Map()
  for (const row of built) nameCount.set(row.name, (nameCount.get(row.name) || 0) + 1)
  for (const row of built) {
    if (nameCount.get(row.name) > 1 && row.id) row.name = clip(`${row.name} (${row.id})`, 200)
  }

  const clients = []
  const nonRecurring = []
  const otherOpen = []
  const alerts = []

  for (const row of built) {
    const openInvoices = row.invoices.map((invoice) => ({
      due_date: invoice.due_date,
      balance: round2(invoice.balance),
      invoice_date: invoice.invoice_date,
      invoice_number: invoice.invoice_number || '',
    }))
    const stalePayment = !row.lastPayment || row.lastPayment < shiftDays(today, -90)
    if (row.recurring) {
      clients.push({
        client: row.name,
        qb_customer_id: row.id,
        monthly_recurring_amount: row.monthly,
        months_billed_last_12: row.months,
        last_invoice_date: row.lastInvoice,
        last_payment_date: row.lastPayment,
        days_since_last_payment: null,
        open_balance: row.open,
        overdue_balance: row.overdue,
        unpaid_90_days_flag: false,
        notes: '',
        open_invoices: openInvoices,
      })
    } else if (row.overdue > 0) {
      nonRecurring.push({
        client: row.name,
        overdue_amount: row.overdue,
        last_payment_date: row.lastPayment,
        days_since_payment: null,
        notes: '',
        open_invoices: openInvoices,
      })
    } else if (row.open > 0 || openInvoices.length) {
      otherOpen.push({
        client: row.name,
        notes: '',
        open_balance: row.open,
        open_invoices: openInvoices,
      })
    } else {
      continue
    }

    if (row.overdue > 0) {
      const oldest = row.positive.filter((invoice) => invoice.due_date < today).map((invoice) => invoice.due_date).sort()[0] || null
      alerts.push({ type: 'overdue', client: row.name, amount: row.overdue, detail: 'Overdue balance', since_date: oldest })
    }
    const openInvoiceTotal = round2(row.positive.reduce((sum, invoice) => sum + invoice.balance, 0))
    const notApplied = row.unapplied > 0 || (openInvoiceTotal > 0 && row.open === 0)
    if (notApplied && (row.unapplied > 0 || openInvoiceTotal > 0)) {
      alerts.push({
        type: 'payment_not_applied',
        client: row.name,
        amount: round2(row.unapplied > 0 ? row.unapplied : openInvoiceTotal),
        detail: 'Open invoice with no matching customer balance',
        since_date: row.lastPayment,
      })
    } else if (row.open > 0 && row.overdue === 0 && row.lastPayment && openInvoiceTotal > 0) {
      alerts.push({
        type: 'credit_mismatch',
        client: row.name,
        amount: row.open,
        detail: 'Payment received and an invoice is still open',
        since_date: row.lastPayment,
      })
    }
    if ((stalePayment || !row.lastPayment) && (row.open > 0 || row.overdue > 0)) {
      alerts.push({
        type: 'no_payment_90',
        client: row.name,
        amount: round2(row.open > 0 ? row.open : row.overdue),
        detail: 'No payment in 90 days',
        since_date: row.lastPayment,
      })
    }
  }

  if (clients.length > MAX_LIST || nonRecurring.length > MAX_LIST || otherOpen.length > MAX_LIST || alerts.length > MAX_LIST) {
    reject('intuit_rejected')
  }

  return {
    clients,
    alerts,
    non_recurring_unpaid: nonRecurring,
    other_open: otherOpen,
    updated_at: new Date(`${today}T18:00:00.000Z`).toISOString(),
  }
}

function shiftDays(iso, days) {
  const [year, month, date] = iso.split('-').map(Number)
  const utc = new Date(Date.UTC(year, month - 1, date + days))
  return utc.toISOString().slice(0, 10)
}
