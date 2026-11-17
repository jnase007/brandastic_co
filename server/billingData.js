/**
 * Billing rows are loaded on the server from the BILLING_CLIENTS_JSON environment variable.
 * That variable is a Vercel project env value (server-only, not VITE_-prefixed, never committed).
 * Canonical value: a JSON object with `clients`, `alerts`, and `non_recurring_unpaid`.
 * A bare array is still accepted and treated as `clients` only.
 *
 * Aging buckets need optional per-invoice lines. Each client (and each non-recurring
 * customer) may include `open_invoices`. Omit the array on older files. Each invoice is
 * `{ "due_date": "YYYY-MM-DD", "balance": number, "invoice_date"?: "YYYY-MM-DD", "invoice_number"?: string }`.
 * `due_date` and `balance` are required when an invoice object is present. The report
 * measures days past `due_date` against `updated_at` (Pacific date), or today if that
 * timestamp is missing.
 *
 * Vercel Blob and Global Config are not used. A blob URL or a client-readable config token
 * could expose the file; this variable stays inside the function environment.
 *
 * Production (VERCEL_ENV=production) returns no rows when the variable is missing.
 * Preview and local development fall back to fictional sample rows, and only after the
 * allowlist check in billingHttp.js has already succeeded.
 */

import { sampleBillingDataset } from './billingSample.js'

export const BILLING_DATA_STORE = 'BILLING_CLIENTS_JSON'
const MAX_JSON_CHARS = 500_000
const MAX_ROWS = 500
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/
export const ALERT_TYPES = ['overdue', 'no_payment_90', 'payment_not_applied', 'credit_mismatch']
const ALERT_TYPE_SET = new Set(ALERT_TYPES)

export const CLIENT_FIELDS = [
  'client',
  'qb_customer_id',
  'monthly_recurring_amount',
  'months_billed_last_12',
  'last_invoice_date',
  'last_payment_date',
  'days_since_last_payment',
  'open_balance',
  'overdue_balance',
  'unpaid_90_days_flag',
  'notes',
]

function invalid() {
  throw new Error('invalid billing data')
}

function parseJson(raw) {
  if (typeof raw !== 'string') return raw
  if (raw.length > MAX_JSON_CHARS) invalid()
  try {
    let value = JSON.parse(raw)
    if (typeof value === 'string') {
      if (value.length > MAX_JSON_CHARS) invalid()
      value = JSON.parse(value)
    }
    return value
  } catch {
    invalid()
  }
}

function money(value) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 100_000_000) return undefined
  return Math.round(value * 100) / 100
}

function signedMoney(value) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < -100_000_000 || value > 100_000_000) return undefined
  return Math.round(value * 100) / 100
}

function whole(value, max) {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > max) return undefined
  return value
}

function dateOrNull(value) {
  if (value == null || value === '') return null
  if (typeof value !== 'string' || !DATE_PATTERN.test(value)) return undefined
  const [year, month, day] = value.split('-').map(Number)
  const utc = new Date(Date.UTC(year, month - 1, day))
  if (utc.getUTCFullYear() !== year || utc.getUTCMonth() !== month - 1 || utc.getUTCDate() !== day) return undefined
  return value
}

function text(value, max, required) {
  if (value == null || value === '') return required ? undefined : ''
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  if (!trimmed) return required ? undefined : ''
  if (trimmed.length > max) return undefined
  return trimmed
}

export function validateBillingClient(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) invalid()
  const client = text(input.client, 200, true)
  const qb = text(input.qb_customer_id, 80, false)
  const monthly = money(input.monthly_recurring_amount)
  const months = whole(input.months_billed_last_12, 12)
  const lastInvoice = dateOrNull(input.last_invoice_date)
  const lastPayment = dateOrNull(input.last_payment_date)
  const days = input.days_since_last_payment == null || input.days_since_last_payment === ''
    ? null
    : whole(input.days_since_last_payment, 36500)
  const open = money(input.open_balance)
  const overdue = money(input.overdue_balance)
  const notes = text(input.notes, 500, false)
  if (
    client === undefined ||
    qb === undefined ||
    monthly === undefined ||
    months === undefined ||
    lastInvoice === undefined ||
    lastPayment === undefined ||
    days === undefined ||
    open === undefined ||
    overdue === undefined ||
    typeof input.unpaid_90_days_flag !== 'boolean' ||
    notes === undefined
  ) {
    invalid()
  }
  return {
    client,
    qb_customer_id: qb,
    monthly_recurring_amount: monthly,
    months_billed_last_12: months,
    last_invoice_date: lastInvoice,
    last_payment_date: lastPayment,
    days_since_last_payment: days,
    open_balance: open,
    overdue_balance: overdue,
    unpaid_90_days_flag: input.unpaid_90_days_flag,
    notes,
    open_invoices: openInvoices(input.open_invoices),
  }
}

export function validateBillingAlert(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) invalid()
  const client = text(input.client, 200, true)
  const detail = text(input.detail, 500, false)
  const amount = money(input.amount)
  const since = dateOrNull(input.since_date)
  if (
    !ALERT_TYPE_SET.has(input.type) ||
    client === undefined ||
    detail === undefined ||
    amount === undefined ||
    since === undefined
  ) {
    invalid()
  }
  return {
    type: input.type,
    client,
    amount,
    detail,
    since_date: since,
  }
}

export function validateNonRecurringUnpaid(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) invalid()
  const client = text(input.client, 200, true)
  const overdue = money(input.overdue_amount)
  const lastPayment = dateOrNull(input.last_payment_date)
  const days = input.days_since_payment == null || input.days_since_payment === ''
    ? null
    : whole(input.days_since_payment, 36500)
  const notes = text(input.notes, 500, false)
  if (
    client === undefined ||
    overdue === undefined ||
    lastPayment === undefined ||
    days === undefined ||
    notes === undefined
  ) {
    invalid()
  }
  return {
    client,
    overdue_amount: overdue,
    last_payment_date: lastPayment,
    days_since_payment: days,
    notes,
    open_invoices: openInvoices(input.open_invoices),
  }
}

const MAX_INVOICES = 200

export function validateOpenInvoice(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) invalid()
  const due = dateOrNull(input.due_date)
  const balance = signedMoney(input.balance)
  const invoiceDate = dateOrNull(input.invoice_date)
  const number = text(input.invoice_number, 40, false)
  if (due === undefined || balance === undefined || balance === 0 || invoiceDate === undefined || number === undefined) invalid()
  if (balance > 0 && !due) invalid()
  return {
    due_date: due,
    balance,
    invoice_date: invoiceDate,
    invoice_number: number,
  }
}

export function validateOtherOpen(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) invalid()
  const client = text(input.client, 200, true)
  const notes = text(input.notes, 500, false)
  const open = input.open_balance == null || input.open_balance === '' ? 0 : money(input.open_balance)
  if (client === undefined || notes === undefined || open === undefined) invalid()
  return {
    client,
    notes,
    open_balance: open,
    open_invoices: openInvoices(input.open_invoices),
  }
}

function openInvoices(value) {
  if (value == null) return []
  if (!Array.isArray(value) || value.length > MAX_INVOICES) invalid()
  return value.map(validateOpenInvoice)
}

function optionalTimestamp(value) {
  if (typeof value !== 'string' || !value.trim()) return null
  const time = Date.parse(value)
  if (Number.isNaN(time)) return null
  return new Date(time).toISOString()
}

function listOf(value, validate) {
  const rows = value ?? []
  if (!Array.isArray(rows) || rows.length > MAX_ROWS) invalid()
  return rows.map(validate)
}

export function parseBillingClients(raw) {
  return parseBillingDataset(raw).clients
}

export function parseBillingDataset(raw) {
  const parsed = parseJson(raw)
  if (Array.isArray(parsed)) {
    if (parsed.length > MAX_ROWS) invalid()
    return {
      clients: parsed.map(validateBillingClient),
      alerts: [],
      non_recurring_unpaid: [],
      other_open: [],
      updated_at: null,
    }
  }
  if (!parsed || typeof parsed !== 'object') invalid()
  const clients = parsed.clients
  if (!Array.isArray(clients) || clients.length > MAX_ROWS) invalid()
  return {
    clients: clients.map(validateBillingClient),
    alerts: listOf(parsed.alerts, validateBillingAlert),
    non_recurring_unpaid: listOf(parsed.non_recurring_unpaid, validateNonRecurringUnpaid),
    other_open: listOf(parsed.other_open, validateOtherOpen),
    updated_at: optionalTimestamp(parsed.updated_at),
  }
}

export function summarizeBilling(clients) {
  const sum = (key) => Math.round(clients.reduce((total, row) => total + row[key], 0) * 100) / 100
  return {
    mrr: sum('monthly_recurring_amount'),
    client_count: clients.length,
    open_balance: sum('open_balance'),
    overdue_balance: sum('overdue_balance'),
    no_payment_90_count: clients.filter((row) => row.unpaid_90_days_flag).length,
  }
}

export function emptyBillingSummary() {
  return {
    mrr: 0,
    client_count: 0,
    open_balance: 0,
    overdue_balance: 0,
    no_payment_90_count: 0,
  }
}

export function loadBillingDataset(env) {
  const raw = env?.BILLING_CLIENTS_JSON
  if (typeof raw === 'string' && raw.trim()) {
    return { source: 'env', ...parseBillingDataset(raw) }
  }
  if (String(env?.VERCEL_ENV || '') === 'production') {
    return { source: 'missing', clients: null, alerts: null, non_recurring_unpaid: null, other_open: null, updated_at: null }
  }
  const sample = sampleBillingDataset()
  return {
    source: 'sample',
    clients: sample.clients.map(validateBillingClient),
    alerts: sample.alerts.map(validateBillingAlert),
    non_recurring_unpaid: sample.non_recurring_unpaid.map(validateNonRecurringUnpaid),
    other_open: (sample.other_open || []).map(validateOtherOpen),
    updated_at: optionalTimestamp(sample.updated_at),
  }
}
