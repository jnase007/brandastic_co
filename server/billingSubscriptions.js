/**
 * Subscription rows are loaded on the server from BILLING_SUBSCRIPTIONS_JSON.
 * That variable is a Vercel project env value (sensitive, server-only, never committed).
 * The client never sees the raw value and never gunzips it.
 *
 * Two forms are accepted:
 * - Plain JSON. After trimming, the value starts with "{".
 * - Gzip, then base64. The value starts with "gz:". The rest is
 *   zlib.gunzipSync(Buffer.from(rest, "base64")).
 *
 * A ~104 KB raw document fits in the decoded limit below. The gz: form is what
 * fits in a Vercel env var. charges[] may be omitted. Missing or invalid input
 * returns an empty report and does not throw.
 *
 * The code accepts an env value of up to 500,000 characters. After gz: decoding,
 * the JSON text may also be up to 500,000 characters. Anything larger, or any
 * gzip output past that byte cap, becomes the empty report.
 */

import { Buffer } from 'node:buffer'
import { gunzipSync } from 'node:zlib'

export const BILLING_SUBSCRIPTIONS_STORE = 'BILLING_SUBSCRIPTIONS_JSON'
export const MAX_SUBSCRIPTIONS_ENCODED_CHARS = 500_000
export const MAX_SUBSCRIPTIONS_DECODED_CHARS = 500_000

export const SUBSCRIPTION_GROUPS = [
  'software_saas',
  'hosting_domains',
  'stock_media',
  'wp_plugins_themes',
  'ads_media',
  'phone_internet',
  'insurance',
  'payroll_platform_fee',
  'payment_processing',
  'maybe_personal',
]

const GROUP_SET = new Set(SUBSCRIPTION_GROUPS)
const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})/
const MAX_ITEMS = 500
const MAX_CHARGES = 240
const LISTS = [
  ['subscriptions', 'active'],
  ['possible', 'possible'],
  ['annual', 'annual'],
  ['stopped', 'stopped'],
]

export function emptySubscriptionTotals() {
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

export function emptySubscriptions() {
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

function clip(value, max) {
  if (value == null) return ''
  const text = typeof value === 'string'
    ? value.trim()
    : (typeof value === 'number' && Number.isFinite(value) ? String(value) : '')
  if (!text) return ''
  return text.length > max ? text.slice(0, max) : text
}

function nullableMoney(value) {
  if (value == null || value === '') return null
  let number = value
  if (typeof value === 'string') {
    const cleaned = value.replace(/[$,\s]/g, '').trim()
    if (!cleaned) return null
    number = Number(cleaned)
  }
  if (typeof number !== 'number' || !Number.isFinite(number)) return null
  if (number < -100_000_000 || number > 100_000_000) return null
  return Math.round(number * 100) / 100
}

function nullableWhole(value, max) {
  if (value == null || value === '') return null
  const number = typeof value === 'string' ? Number(value) : value
  if (typeof number !== 'number' || !Number.isInteger(number) || number < 0 || number > max) return null
  return number
}

function nullableBool(value) {
  if (value === true || value === false) return value
  if (value == null || value === '') return null
  if (value === 'true') return true
  if (value === 'false') return false
  return null
}

function nullableDate(value) {
  if (value == null || value === '') return null
  if (typeof value !== 'string') return null
  const match = DATE_PATTERN.exec(value.trim())
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const utc = new Date(Date.UTC(year, month - 1, day))
  if (utc.getUTCFullYear() !== year || utc.getUTCMonth() !== month - 1 || utc.getUTCDate() !== day) return null
  return `${match[1]}-${match[2]}-${match[3]}`
}

function optionalTimestamp(value) {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed || trimmed.length > 40) return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return nullableDate(trimmed)
  const time = Date.parse(trimmed)
  if (Number.isNaN(time)) return null
  return new Date(time).toISOString()
}

function digitsLast4(value) {
  const digits = String(value ?? '').replace(/\D/g, '')
  if (digits.length < 4) return ''
  return digits.slice(-4)
}

function scrubAccount(value) {
  const text = clip(value, 160)
  if (!text) return ''
  return text.replace(/\d{5,}/g, (run) => run.slice(-4)).slice(0, 80)
}

function normalizeContractTerm(value) {
  if (typeof value !== 'string') return ''
  const term = value.trim().toLowerCase()
  return term === 'annual' || term === 'monthly' ? term : ''
}

function normalizeGroup(value) {
  if (typeof value !== 'string') return ''
  const slug = value.trim().toLowerCase()
  return GROUP_SET.has(slug) ? slug : ''
}

function stringList(value, maxItems, maxLen) {
  if (!Array.isArray(value)) return []
  const out = []
  for (const entry of value) {
    if (out.length >= maxItems) break
    const text = clip(entry, maxLen)
    if (text) out.push(text)
  }
  return out
}

function parseCharge(row) {
  if (!row || typeof row !== 'object' || Array.isArray(row)) return null
  const paymentAccount = scrubAccount(row.payment_account)
  return {
    date: nullableDate(row.date),
    amount: nullableMoney(row.amount),
    memo: clip(row.memo, 300),
    account: clip(row.account, 120),
    payment_account: paymentAccount,
    payment_account_last4: digitsLast4(row.payment_account_last4) || digitsLast4(row.payment_account),
    txn_type: clip(row.txn_type, 40),
    txn_id: clip(row.txn_id, 64),
  }
}

function parseCharges(value) {
  if (!Array.isArray(value)) return []
  const charges = []
  for (const row of value.slice(0, MAX_CHARGES)) {
    const charge = parseCharge(row)
    if (charge) charges.push(charge)
  }
  return charges
}

function parseItem(input, status) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null
  const paymentAccount = scrubAccount(input.payment_account)
  return {
    vendor: clip(input.vendor, 200),
    vendor_name_variants: stringList(input.vendor_name_variants, 12, 120),
    group: normalizeGroup(input.group),
    category_or_account: clip(input.category_or_account, 160),
    typical_monthly_amount: nullableMoney(input.typical_monthly_amount),
    latest_charge: nullableMoney(input.latest_charge),
    average_monthly_amount: nullableMoney(input.average_monthly_amount),
    first_seen: nullableDate(input.first_seen),
    last_charged_date: nullableDate(input.last_charged_date),
    charge_count_in_window: nullableWhole(input.charge_count_in_window, 100_000),
    payment_account: paymentAccount,
    payment_account_last4: digitsLast4(input.payment_account_last4) || digitsLast4(input.payment_account),
    next_expected_date: nullableDate(input.next_expected_date),
    amount_changed_recently: nullableBool(input.amount_changed_recently),
    possible_duplicate_or_overlap: clip(input.possible_duplicate_or_overlap, 500),
    reason_possible: clip(input.reason_possible, 500),
    notes: clip(input.notes, 2000),
    note: clip(input.note, 500),
    renewalDate: nullableDate(input.renewalDate),
    renewalNote: clip(input.renewalNote, 300),
    contractTerm: normalizeContractTerm(input.contractTerm),
    charges: parseCharges(input.charges),
    status,
  }
}

function round2(value) {
  return Math.round(value * 100) / 100
}

function buildTotals(input, items) {
  const totals = input && typeof input === 'object' && !Array.isArray(input) ? input : {}
  const activeAmounts = items
    .filter((item) => item.status === 'active' && typeof item.typical_monthly_amount === 'number')
    .map((item) => item.typical_monthly_amount)
  const fallbackRate = activeAmounts.length ? round2(activeAmounts.reduce((sum, value) => sum + value, 0)) : null
  const providedRate = nullableMoney(totals.monthly_run_rate)
  const monthly = providedRate != null ? providedRate : fallbackRate
  const providedAnnual = nullableMoney(totals.annualized_cost)
  return {
    subscription_count: items.filter((item) => item.status === 'active').length,
    possible_count: items.filter((item) => item.status === 'possible').length,
    annual_count: items.filter((item) => item.status === 'annual').length,
    stopped_count: items.filter((item) => item.status === 'stopped').length,
    monthly_run_rate: monthly,
    annualized_cost: providedAnnual != null ? providedAnnual : (monthly != null ? round2(monthly * 12) : null),
    note: clip(totals.note, 500),
    price_increase_count: items.filter((item) => item.amount_changed_recently === true).length,
    overlap_count: items.filter((item) => item.possible_duplicate_or_overlap).length,
  }
}

function parseWindow(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const start = nullableDate(value.start)
  const end = nullableDate(value.end)
  if (!start && !end) return null
  return { start, end }
}

function finalize(parsed) {
  const items = []
  for (const [key, status] of LISTS) {
    const list = parsed[key]
    if (!Array.isArray(list)) continue
    for (const row of list.slice(0, MAX_ITEMS)) {
      const item = parseItem(row, status)
      if (!item) continue
      item.id = `${status}-${items.length}`
      items.push(item)
    }
  }
  return {
    configured: true,
    updated_at: optionalTimestamp(parsed.updated_at),
    source_window: parseWindow(parsed.source_window),
    source: clip(parsed.source, 200),
    access_issues: stringList(parsed.access_issues, 20, 300),
    items,
    totals: buildTotals(parsed.totals, items),
  }
}

function stripBom(value) {
  return value.charCodeAt(0) === 0xfeff ? value.slice(1) : value
}

function decodeSubscriptionsPayload(raw) {
  const trimmed = stripBom(raw.trim())
  if (!trimmed || trimmed.length > MAX_SUBSCRIPTIONS_ENCODED_CHARS) return null
  let jsonText = trimmed
  if (trimmed.startsWith('gz:')) {
    try {
      jsonText = gunzipSync(Buffer.from(trimmed.slice(3), 'base64'), {
        maxOutputLength: MAX_SUBSCRIPTIONS_DECODED_CHARS,
      }).toString('utf8')
    } catch {
      return null
    }
    jsonText = stripBom(jsonText)
  } else if (!trimmed.startsWith('{')) {
    return null
  }
  if (!jsonText || jsonText.length > MAX_SUBSCRIPTIONS_DECODED_CHARS) return null
  return jsonText
}

export function parseBillingSubscriptions(raw) {
  if (typeof raw !== 'string') return emptySubscriptions()
  const jsonText = decodeSubscriptionsPayload(raw)
  if (jsonText == null) return emptySubscriptions()
  try {
    const parsed = JSON.parse(jsonText)
    if (Array.isArray(parsed)) return finalize({ subscriptions: parsed })
    if (!parsed || typeof parsed !== 'object') return emptySubscriptions()
    return finalize(parsed)
  } catch {
    return emptySubscriptions()
  }
}

export function loadBillingSubscriptions(env) {
  const raw = env?.BILLING_SUBSCRIPTIONS_JSON
  if (typeof raw !== 'string' || !raw.trim()) return emptySubscriptions()
  return parseBillingSubscriptions(raw)
}
