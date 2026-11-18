import { supabase } from './supabase'

const allowedCache = new Map()

async function accessToken() {
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token || ''
}

function requestInit(token) {
  return {
    method: 'GET',
    cache: 'no-store',
    credentials: 'omit',
    referrerPolicy: 'no-referrer',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    },
  }
}

export function fetchBillingAllowed(userId) {
  if (!userId) return Promise.resolve(false)
  const existing = allowedCache.get(userId)
  if (existing) return existing
  const promise = readAllowed().catch(() => false)
  allowedCache.set(userId, promise)
  return promise
}

async function readAllowed() {
  const token = await accessToken()
  if (!token) return false
  const response = await fetch('/api/billing-access', requestInit(token))
  if (!response.ok) return false
  const body = await response.json().catch(() => null)
  return body?.allowed === true
}

function numberOrNull(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function moneyOrNull(value) {
  return typeof value === 'number' && Number.isFinite(value) ? Math.round(value * 100) / 100 : null
}

const SUBSCRIPTION_STATUSES = new Set(['active', 'stopped', 'possible', 'annual'])

function emptySubscriptionTotals() {
  return {
    subscription_count: 0,
    possible_count: 0,
    annual_count: 0,
    stopped_count: 0,
    monthly_run_rate: null,
    annualized_cost: null,
    note: '',
    price_increase_count: 0,
    overlap_count: 0,
  }
}

export function emptySubscriptionsReport() {
  return {
    configured: false,
    updated_at: null,
    source_window: null,
    source: '',
    access_issues: [],
    items: [],
    totals: emptySubscriptionTotals(),
  }
}

function pickSubscriptionCharge(row) {
  if (!row || typeof row !== 'object') return null
  return {
    date: typeof row.date === 'string' ? row.date : null,
    amount: moneyOrNull(row.amount),
    memo: typeof row.memo === 'string' ? row.memo : '',
    account: typeof row.account === 'string' ? row.account : '',
    payment_account: typeof row.payment_account === 'string' ? row.payment_account : '',
    payment_account_last4: typeof row.payment_account_last4 === 'string' ? row.payment_account_last4 : '',
    txn_type: typeof row.txn_type === 'string' ? row.txn_type : '',
    txn_id: typeof row.txn_id === 'string' ? row.txn_id : '',
  }
}

function pickSubscriptionItem(row, index) {
  if (!row || typeof row !== 'object') return null
  return {
    id: typeof row.id === 'string' && row.id ? row.id : `row-${index}`,
    vendor: typeof row.vendor === 'string' ? row.vendor : '',
    vendor_name_variants: Array.isArray(row.vendor_name_variants)
      ? row.vendor_name_variants.filter((entry) => typeof entry === 'string')
      : [],
    group: typeof row.group === 'string' ? row.group : '',
    category_or_account: typeof row.category_or_account === 'string' ? row.category_or_account : '',
    typical_monthly_amount: moneyOrNull(row.typical_monthly_amount),
    latest_charge: moneyOrNull(row.latest_charge),
    average_monthly_amount: moneyOrNull(row.average_monthly_amount),
    first_seen: typeof row.first_seen === 'string' ? row.first_seen : null,
    last_charged_date: typeof row.last_charged_date === 'string' ? row.last_charged_date : null,
    charge_count_in_window: numberOrNull(row.charge_count_in_window),
    payment_account: typeof row.payment_account === 'string' ? row.payment_account : '',
    payment_account_last4: typeof row.payment_account_last4 === 'string' ? row.payment_account_last4 : '',
    next_expected_date: typeof row.next_expected_date === 'string' ? row.next_expected_date : null,
    amount_changed_recently: row.amount_changed_recently === true ? true : row.amount_changed_recently === false ? false : null,
    possible_duplicate_or_overlap: typeof row.possible_duplicate_or_overlap === 'string' ? row.possible_duplicate_or_overlap : '',
    reason_possible: typeof row.reason_possible === 'string' ? row.reason_possible : '',
    notes: typeof row.notes === 'string' ? row.notes : '',
    charges: Array.isArray(row.charges) ? row.charges.map(pickSubscriptionCharge).filter(Boolean) : [],
    status: SUBSCRIPTION_STATUSES.has(row.status) ? row.status : 'active',
  }
}

function pickSubscriptionTotals(raw) {
  const base = emptySubscriptionTotals()
  if (!raw || typeof raw !== 'object') return base
  return {
    subscription_count: numberOrNull(raw.subscription_count) ?? 0,
    possible_count: numberOrNull(raw.possible_count) ?? 0,
    annual_count: numberOrNull(raw.annual_count) ?? 0,
    stopped_count: numberOrNull(raw.stopped_count) ?? 0,
    monthly_run_rate: moneyOrNull(raw.monthly_run_rate),
    annualized_cost: moneyOrNull(raw.annualized_cost),
    note: typeof raw.note === 'string' ? raw.note : '',
    price_increase_count: numberOrNull(raw.price_increase_count) ?? 0,
    overlap_count: numberOrNull(raw.overlap_count) ?? 0,
  }
}

function pickSubscriptions(raw) {
  try {
    if (!raw || raw.configured !== true || !Array.isArray(raw.items)) return emptySubscriptionsReport()
    const sourceWindow = raw.source_window && typeof raw.source_window === 'object' ? raw.source_window : null
    return {
      configured: true,
      updated_at: typeof raw.updated_at === 'string' ? raw.updated_at : null,
      source_window: sourceWindow ? {
        start: typeof sourceWindow.start === 'string' ? sourceWindow.start : null,
        end: typeof sourceWindow.end === 'string' ? sourceWindow.end : null,
      } : null,
      source: typeof raw.source === 'string' ? raw.source : '',
      access_issues: Array.isArray(raw.access_issues) ? raw.access_issues.filter((entry) => typeof entry === 'string') : [],
      items: raw.items.map(pickSubscriptionItem).filter(Boolean),
      totals: pickSubscriptionTotals(raw.totals),
    }
  } catch {
    return emptySubscriptionsReport()
  }
}

const ALERT_TYPES = new Set(['overdue', 'no_payment_90', 'payment_not_applied', 'credit_mismatch'])

function pickAlert(row) {
  if (!row || typeof row !== 'object') return null
  const client = typeof row.client === 'string' ? row.client : ''
  if (!client || !ALERT_TYPES.has(row.type)) return null
  return {
    type: row.type,
    client,
    amount: numberOrNull(row.amount) ?? 0,
    detail: typeof row.detail === 'string' ? row.detail : '',
    since_date: typeof row.since_date === 'string' ? row.since_date : null,
  }
}

function pickInvoices(value) {
  if (!Array.isArray(value)) return []
  return value
    .filter((invoice) => invoice && typeof invoice.balance === 'number' && invoice.balance !== 0)
    .map((invoice) => ({
      due_date: typeof invoice.due_date === 'string' ? invoice.due_date : null,
      balance: invoice.balance,
      invoice_date: typeof invoice.invoice_date === 'string' ? invoice.invoice_date : null,
      invoice_number: typeof invoice.invoice_number === 'string' ? invoice.invoice_number : '',
    }))
}

function pickOtherOpen(row) {
  if (!row || typeof row !== 'object') return null
  const client = typeof row.client === 'string' ? row.client : ''
  if (!client) return null
  return {
    client,
    notes: typeof row.notes === 'string' ? row.notes : '',
    open_balance: numberOrNull(row.open_balance) ?? 0,
    open_invoices: pickInvoices(row.open_invoices),
  }
}

function pickNonRecurring(row) {
  if (!row || typeof row !== 'object') return null
  const client = typeof row.client === 'string' ? row.client : ''
  if (!client) return null
  return {
    client,
    overdue_amount: numberOrNull(row.overdue_amount) ?? 0,
    last_payment_date: typeof row.last_payment_date === 'string' ? row.last_payment_date : null,
    days_since_payment: numberOrNull(row.days_since_payment),
    notes: typeof row.notes === 'string' ? row.notes : '',
    open_invoices: pickInvoices(row.open_invoices),
  }
}

function pickClient(row) {
  if (!row || typeof row !== 'object') return null
  const client = typeof row.client === 'string' ? row.client : ''
  if (!client) return null
  return {
    client,
    qb_customer_id: typeof row.qb_customer_id === 'string' ? row.qb_customer_id : '',
    monthly_recurring_amount: numberOrNull(row.monthly_recurring_amount) ?? 0,
    months_billed_last_12: numberOrNull(row.months_billed_last_12) ?? 0,
    last_invoice_date: typeof row.last_invoice_date === 'string' ? row.last_invoice_date : null,
    last_payment_date: typeof row.last_payment_date === 'string' ? row.last_payment_date : null,
    days_since_last_payment: numberOrNull(row.days_since_last_payment),
    open_balance: numberOrNull(row.open_balance) ?? 0,
    overdue_balance: numberOrNull(row.overdue_balance) ?? 0,
    unpaid_90_days_flag: row.unpaid_90_days_flag === true,
    notes: typeof row.notes === 'string' ? row.notes : '',
    open_invoices: pickInvoices(row.open_invoices),
  }
}

export async function fetchBilling() {
  const token = await accessToken()
  if (!token) return { status: 'unauthorized' }

  const response = await fetch('/api/billing-data', requestInit(token))
  if (response.status === 401) return { status: 'unauthorized' }
  if (response.status === 403) {
    let code = 'forbidden'
    try {
      const body = await response.json()
      if (body?.error === 'not_configured') code = 'not_configured'
    } catch {
      code = 'forbidden'
    }
    return { status: code }
  }
  if (!response.ok) return { status: 'error' }

  const body = await response.json().catch(() => null)
  if (!body || body.configured !== true || !Array.isArray(body.clients)) {
    return { status: 'unconfigured_data' }
  }

  const clients = body.clients.map(pickClient).filter(Boolean)
  const alerts = Array.isArray(body.alerts) ? body.alerts.map(pickAlert).filter(Boolean) : []
  const nonRecurring = Array.isArray(body.non_recurring_unpaid)
    ? body.non_recurring_unpaid.map(pickNonRecurring).filter(Boolean)
    : []
  const otherOpen = Array.isArray(body.other_open)
    ? body.other_open.map(pickOtherOpen).filter(Boolean)
    : []
  const summary = body.summary && typeof body.summary === 'object' ? body.summary : {}
  return {
    status: 'ready',
    report: {
      sample: body.sample === true,
      updated_at: typeof body.updated_at === 'string' ? body.updated_at : null,
      clients,
      alerts,
      non_recurring_unpaid: nonRecurring,
      other_open: otherOpen,
      summary: {
        mrr: numberOrNull(summary.mrr) ?? 0,
        client_count: numberOrNull(summary.client_count) ?? clients.length,
        open_balance: numberOrNull(summary.open_balance) ?? 0,
        overdue_balance: numberOrNull(summary.overdue_balance) ?? 0,
        no_payment_90_count: numberOrNull(summary.no_payment_90_count) ?? clients.filter((row) => row.unpaid_90_days_flag).length,
      },
      subscriptions: pickSubscriptions(body.subscriptions),
    },
  }
}
