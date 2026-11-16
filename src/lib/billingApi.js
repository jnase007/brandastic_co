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
  const summary = body.summary && typeof body.summary === 'object' ? body.summary : {}
  return {
    status: 'ready',
    report: {
      sample: body.sample === true,
      clients,
      alerts,
      non_recurring_unpaid: nonRecurring,
      summary: {
        mrr: numberOrNull(summary.mrr) ?? 0,
        client_count: numberOrNull(summary.client_count) ?? clients.length,
        open_balance: numberOrNull(summary.open_balance) ?? 0,
        overdue_balance: numberOrNull(summary.overdue_balance) ?? 0,
        no_payment_90_count: numberOrNull(summary.no_payment_90_count) ?? clients.filter((row) => row.unpaid_90_days_flag).length,
      },
    },
  }
}
