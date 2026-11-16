/**
 * Fictional rows for local dev, tests, and preview when BILLING_CLIENTS_JSON is unset.
 * Production never reads this file's data. Do not replace these with real clients.
 */

const DAY_MS = 24 * 60 * 60 * 1000

function daysSince(isoDate) {
  if (!isoDate) return null
  const then = Date.parse(`${isoDate}T00:00:00Z`)
  if (Number.isNaN(then)) return null
  return Math.max(0, Math.floor((Date.now() - then) / DAY_MS))
}

function row(client, qbCustomerId, monthly, months, lastInvoice, lastPayment, openBalance, overdue, notes) {
  const days = daysSince(lastPayment)
  return {
    client,
    qb_customer_id: qbCustomerId,
    monthly_recurring_amount: monthly,
    months_billed_last_12: months,
    last_invoice_date: lastInvoice,
    last_payment_date: lastPayment,
    days_since_last_payment: days,
    open_balance: openBalance,
    overdue_balance: overdue,
    unpaid_90_days_flag: days == null || days >= 90,
    notes,
  }
}

function alert(type, client, amount, detail, sinceDate) {
  return { type, client, amount, detail, since_date: sinceDate }
}

function oneTime(client, overdue, lastPayment, notes) {
  return {
    client,
    overdue_amount: overdue,
    last_payment_date: lastPayment,
    days_since_payment: daysSince(lastPayment),
    notes,
  }
}

export function sampleBillingDataset() {
  return {
    clients: sampleBillingClients(),
    alerts: sampleBillingAlerts(),
    non_recurring_unpaid: sampleNonRecurringUnpaid(),
    updated_at: '2026-11-16T18:41:00.000Z',
  }
}

export function sampleBillingAlerts() {
  return [
    alert(
      'overdue',
      'Fictional Pinecone Sample',
      9300,
      'FICTIONAL SAMPLE — recurring overdue balance, largest first.',
      '2026-09-01',
    ),
    alert(
      'overdue',
      'Fictional Harbor Sample',
      3600,
      'FICTIONAL SAMPLE — recurring overdue balance.',
      '2026-08-01',
    ),
    alert(
      'no_payment_90',
      'Fictional Pinecone Sample',
      9300,
      'FICTIONAL SAMPLE — no payment on file and the open balance is still unpaid.',
      '2026-09-01',
    ),
    alert(
      'no_payment_90',
      'Fictional Harbor Sample',
      5400,
      'FICTIONAL SAMPLE — no payment in 90+ days, open balance remains.',
      '2026-07-01',
    ),
    alert(
      'no_payment_90',
      'Fictional Lighthouse Sample',
      2200,
      'FICTIONAL SAMPLE — one-time customer, no payment in 90+ days, open balance remains.',
      '2026-06-15',
    ),
    alert(
      'payment_not_applied',
      'Fictional Cedar Sample',
      4200,
      'FICTIONAL SAMPLE — a sample invoice is still open while the customer balance is $0.',
      '2026-11-01',
    ),
    alert(
      'credit_mismatch',
      'Fictional Northwind Sample',
      750,
      'FICTIONAL SAMPLE — a payment was received and sample invoices are still open.',
      '2026-10-20',
    ),
  ]
}

export function sampleNonRecurringUnpaid() {
  return [
    oneTime(
      'Fictional Lighthouse Sample',
      2200,
      '2026-06-15',
      'FICTIONAL SAMPLE — not a retainer. One-time project invoice, unpaid.',
    ),
    oneTime(
      'Fictional Quartz Sample',
      640,
      '2026-10-28',
      'FICTIONAL SAMPLE — not a retainer. Recent one-time invoice, not 90 days yet.',
    ),
  ]
}

export function sampleBillingClients() {
  return [
    row(
      'Fictional Cedar Sample',
      'SAMPLE-1001',
      4200,
      12,
      '2026-11-01',
      '2026-11-02',
      0,
      0,
      'FICTIONAL SAMPLE — not a real client. Paid the latest sample invoice.',
    ),
    row(
      'Fictional Harbor Sample',
      'SAMPLE-1002',
      1800,
      11,
      '2026-11-01',
      '2026-07-01',
      5400,
      3600,
      'FICTIONAL SAMPLE — not a real client. No payment in 90+ days.',
    ),
    row(
      'Fictional Northwind Sample',
      'SAMPLE-1003',
      750,
      6,
      '2026-10-01',
      '2026-10-20',
      750,
      0,
      'FICTIONAL SAMPLE — not a real client. Open balance, payment is recent.',
    ),
    row(
      'Fictional Pinecone Sample',
      'SAMPLE-1004',
      3100,
      12,
      '2026-09-01',
      null,
      9300,
      9300,
      'FICTIONAL SAMPLE — not a real client. No payment on file.',
    ),
    row(
      'Fictional Atlas Sample',
      'SAMPLE-1005',
      960,
      3,
      '2026-11-01',
      '2026-11-08',
      0,
      0,
      'FICTIONAL SAMPLE — not a real client. New sample retainer.',
    ),
  ]
}
