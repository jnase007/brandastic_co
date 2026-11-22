import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { Buffer } from 'node:buffer'
import { describe, it } from 'node:test'
import { gzipSync } from 'node:zlib'
import { handleBilling } from '../server/billingHttp.js'
import {
  MAX_SUBSCRIPTIONS_DECODED_CHARS,
  MAX_SUBSCRIPTIONS_ENCODED_CHARS,
  loadBillingSubscriptions,
  parseBillingSubscriptions,
} from '../server/billingSubscriptions.js'
import {
  SUBSCRIPTIONS_EMPTY_MESSAGE,
  filterSubscriptionItems,
  sortSubscriptionItems,
  subscriptionKey,
  subscriptionSavings,
  contractTermOf,
  daysRemainingLabel,
  renewalBadgeLabel,
  renewalTiming,
  summarizeSavings,
  subscriptionGuardNote,
  subscriptionsEmptyState,
  upcomingContractRenewals,
  topSubscriptionsByMonthly,
  AUTHORIZE_NET_NOTE,
} from '../src/lib/billingSubscriptionsView.js'

const JUSTIN = 'justin.sample@example.test'
const SANDY = 'sandy.sample@example.test'
const ALLOWED = `${JUSTIN}, ${SANDY}`
const FIXTURE_PATH = new URL('./fixtures/billing-subscriptions.json', import.meta.url)

function allow(email) {
  return async () => ({ email })
}

function gzipValue(value) {
  const json = typeof value === 'string' ? value : JSON.stringify(value)
  return `gz:${gzipSync(Buffer.from(json)).toString('base64')}`
}

const SLIM = {
  updated_at: '2026-11-01T18:00:00.000Z',
  source_window: { start: '2025-11-01', end: '2026-10-31' },
  source: 'Fake fixture',
  subscriptions: [{
    vendor: 'Example SaaS A',
    group: 'software_saas',
    typical_monthly_amount: 49,
    latest_charge: null,
    average_monthly_amount: null,
    first_seen: '',
    last_charged_date: '2026-10-04',
    charge_count_in_window: null,
    payment_account: '',
    payment_account_last4: '4242',
    next_expected_date: '',
    amount_changed_recently: null,
    possible_duplicate_or_overlap: '',
    reason_possible: '',
    notes: 'Fake fixture. charges omitted.',
  }],
  totals: {
    monthly_run_rate: 49,
    annualized_cost: 588,
    note: 'Fake totals',
  },
}

describe('subscription parser', () => {
  it('accepts a gz: payload and keeps charges omitted', () => {
    const parsed = parseBillingSubscriptions(gzipValue(SLIM))
    assert.equal(parsed.configured, true)
    assert.equal(parsed.items.length, 1)
    assert.equal(parsed.items[0].vendor, 'Example SaaS A')
    assert.equal(parsed.items[0].status, 'active')
    assert.equal(parsed.items[0].typical_monthly_amount, 49)
    assert.equal(parsed.items[0].latest_charge, null)
    assert.equal(parsed.items[0].next_expected_date, null)
    assert.deepEqual(parsed.items[0].charges, [])
    assert.equal(parsed.totals.monthly_run_rate, 49)
    assert.equal(parsed.totals.subscription_count, 1)
    assert.equal(JSON.stringify(parsed).includes('gz:'), false)
  })

  it('accepts plain JSON and the same document after gzip', () => {
    const raw = readFileSync(FIXTURE_PATH, 'utf8')
    const plain = parseBillingSubscriptions(raw)
    const zipped = parseBillingSubscriptions(gzipValue(raw))
    assert.equal(plain.configured, true)
    assert.deepEqual(zipped.items.map((item) => item.vendor), plain.items.map((item) => item.vendor))
    const saas = plain.items.find((item) => item.vendor === 'Example SaaS A')
    assert.equal(saas.charges.length, 3)
    assert.equal(saas.amount_changed_recently, true)
    const blank = plain.items.find((item) => item.vendor === 'Example Blank Fields')
    assert.equal(blank.typical_monthly_amount, null)
    assert.equal(blank.notes, '')
    assert.equal(blank.note, '')
    assert.equal(blank.payment_account_last4, '')
    const authorize = plain.items.find((item) => item.vendor === 'Authorize.net')
    assert.equal(authorize.note, 'Fake fixture note.')
    assert.equal(authorize.group, 'payment_processing')
    assert.equal(authorize.typical_monthly_amount, null)
    assert.equal(subscriptionGuardNote(authorize), AUTHORIZE_NET_NOTE)
    assert.equal(subscriptionGuardNote({ vendor: 'AuthorizeNet' }), AUTHORIZE_NET_NOTE)
    assert.equal(subscriptionGuardNote({ vendor: 'authorizenet' }), AUTHORIZE_NET_NOTE)
    assert.equal(subscriptionGuardNote({ name: 'Authorize.net fees' }), AUTHORIZE_NET_NOTE)
    assert.equal(subscriptionGuardNote({ vendor: 'Example Payments Co', vendor_name_variants: ['Authorize Net'] }), '')
    assert.equal(subscriptionGuardNote(saas), '')
    assert.equal(plain.totals.subscription_count, 12)
    assert.equal(plain.totals.possible_count, 4)
    assert.equal(plain.totals.annual_count, 2)
    assert.equal(plain.totals.stopped_count, 2)
    assert.equal(plain.totals.price_increase_count, 2)
    assert.equal(plain.totals.overlap_count, 1)
    assert.equal(plain.totals.monthly_run_rate, 497.99)
    assert.equal(JSON.stringify(plain).includes('do-not-return-this-account'), false)
    assert.equal(JSON.stringify(plain).includes('do-not-return-this-card'), false)
    assert.ok(MAX_SUBSCRIPTIONS_DECODED_CHARS >= raw.length)
    assert.ok(MAX_SUBSCRIPTIONS_ENCODED_CHARS >= gzipValue(raw).length)
  })

  it('keeps only the last four payment digits', () => {
    const parsed = parseBillingSubscriptions(JSON.stringify({
      subscriptions: [{
        vendor: 'Example SaaS A',
        group: 'software_saas',
        typical_monthly_amount: 10,
        payment_account: 'Example Card 0000000000004242',
        payment_account_last4: '0000000000004242',
        notes: 'Fake fixture',
      }],
    }))
    assert.equal(parsed.items[0].payment_account_last4, '4242')
    assert.equal(parsed.items[0].payment_account.includes('0000000000004242'), false)
    assert.equal(JSON.stringify(parsed).includes('0000000000004242'), false)
  })

  it('keeps an optional note and leaves it blank when absent', () => {
    const parsed = parseBillingSubscriptions(JSON.stringify({
      subscriptions: [
        { vendor: 'Example Noted Co', note: '  Fake note to keep.  ' },
        { vendor: 'Example Quiet Co' },
        { vendor: 'Example Long Note Co', note: `Fake ${'n'.repeat(600)}` },
      ],
    }))
    assert.equal(parsed.items[0].note, 'Fake note to keep.')
    assert.equal(parsed.items[1].note, '')
    assert.equal(parsed.items[2].note.length, 500)
    assert.equal(subscriptionGuardNote(parsed.items[0]), '')
  })

  it('drops unknown item fields and unknown groups without throwing', () => {
    const parsed = parseBillingSubscriptions(JSON.stringify({
      subscriptions: [{
        vendor: 'Example SaaS B',
        group: 'not_a_real_group',
        typical_monthly_amount: null,
        secret_field: 'hidden-fake',
      }],
    }))
    assert.equal(parsed.items[0].group, '')
    assert.equal(parsed.items[0].typical_monthly_amount, null)
    assert.equal(parsed.items[0].secret_field, undefined)
    assert.equal(JSON.stringify(parsed).includes('hidden-fake'), false)
  })

  it('returns the empty report for missing, invalid, and oversized input', () => {
    const canary = 'SECRET-SHOULD-NOT-LEAK'
    assert.equal(loadBillingSubscriptions({}).configured, false)
    assert.equal(loadBillingSubscriptions({ BILLING_SUBSCRIPTIONS_JSON: '   ' }).configured, false)
    assert.equal(parseBillingSubscriptions(`{${canary}`).configured, false)
    assert.equal(parseBillingSubscriptions(`gz:${canary}`).configured, false)
    assert.equal(parseBillingSubscriptions('[1,2,3]').configured, false)
    assert.equal(JSON.stringify(parseBillingSubscriptions(`gz:${canary}`)).includes(canary), false)
    const huge = `{${' '.repeat(MAX_SUBSCRIPTIONS_DECODED_CHARS)}}`
    assert.equal(parseBillingSubscriptions(huge).configured, false)
    assert.doesNotThrow(() => parseBillingSubscriptions('gz:@@@not-base64@@@'))
  })
})

describe('subscription empty state', () => {
  it('asks for data when nothing is loaded and stays quiet when the file is empty', () => {
    assert.equal(subscriptionsEmptyState(null).message, SUBSCRIPTIONS_EMPTY_MESSAGE)
    assert.equal(subscriptionsEmptyState({ configured: false }).loaded, false)
    assert.equal(subscriptionsEmptyState({ configured: true, items: [] }).loaded, true)
    assert.equal(subscriptionsEmptyState({ configured: true, items: [] }).message, null)
    const screen = readFileSync(new URL('../src/pages/BillingSubscriptions.jsx', import.meta.url), 'utf8')
    assert.equal(screen.includes('SUBSCRIPTIONS_EMPTY_MESSAGE'), true)
    assert.equal(screen.includes('gunzip'), false)
    assert.equal(screen.includes('zlib'), false)
  })

  it('filters and sorts fake rows', () => {
    const items = [
      { vendor: 'Example SaaS A', status: 'active', group: 'software_saas', typical_monthly_amount: 49, amount_changed_recently: true, possible_duplicate_or_overlap: '' },
      { vendor: 'Example Personal Shop', status: 'active', group: 'maybe_personal', typical_monthly_amount: 14.99, amount_changed_recently: false, possible_duplicate_or_overlap: '' },
      { vendor: 'Example Design SaaS', status: 'active', group: 'software_saas', typical_monthly_amount: 35, amount_changed_recently: false, possible_duplicate_or_overlap: 'Fake overlap' },
      { vendor: 'Example Ads Network', status: 'possible', group: 'ads_media', typical_monthly_amount: 400, amount_changed_recently: false, possible_duplicate_or_overlap: '' },
      { vendor: 'Example Stopped Tool', status: 'stopped', group: 'software_saas', typical_monthly_amount: 15, amount_changed_recently: false, possible_duplicate_or_overlap: '' },
      { vendor: 'Example Blank Fields', status: 'active', group: 'software_saas', typical_monthly_amount: null, amount_changed_recently: null, possible_duplicate_or_overlap: '' },
    ]
    assert.deepEqual(filterSubscriptionItems(items, 'price_up').map((item) => item.vendor), ['Example SaaS A'])
    assert.deepEqual(filterSubscriptionItems(items, 'personal').map((item) => item.vendor), ['Example Personal Shop'])
    assert.deepEqual(filterSubscriptionItems(items, 'overlap').map((item) => item.vendor), ['Example Design SaaS'])
    assert.deepEqual(filterSubscriptionItems(items, 'stopped').map((item) => item.vendor), ['Example Stopped Tool'])
    const sorted = sortSubscriptionItems(items, 'monthly', 'desc')
    assert.equal(sorted[0].vendor, 'Example Ads Network')
    assert.equal(sorted.at(-1).vendor, 'Example Blank Fields')
    assert.equal(topSubscriptionsByMonthly(items, 15).some((item) => item.vendor === 'Example Stopped Tool'), false)
  })
})

describe('subscription savings', () => {
  const rows = [
    { vendor: 'Example SaaS A', status: 'active', group: 'software_saas', typical_monthly_amount: 49, latest_charge: 49, payment_account_last4: '4242', last_charged_date: '2026-10-04' },
    { vendor: 'Example Annual Tool', status: 'annual', group: 'software_saas', typical_monthly_amount: 20, latest_charge: 240, payment_account_last4: '4242', last_charged_date: '2026-01-15' },
    { vendor: 'Example Yearly Only', status: 'annual', group: 'software_saas', typical_monthly_amount: 240, latest_charge: null, payment_account_last4: '1111', last_charged_date: '2026-02-01' },
    { vendor: 'Example Stopped Tool', status: 'stopped', group: 'software_saas', typical_monthly_amount: 15, latest_charge: 15, payment_account_last4: '4242', last_charged_date: '2026-04-03' },
  ]

  it('turns an annual charge into a monthly amount and shows both', () => {
    const paired = subscriptionSavings(rows[1])
    assert.equal(paired.monthly, 20)
    assert.equal(paired.annual, 240)
    const yearlyOnly = subscriptionSavings(rows[2])
    assert.equal(yearlyOnly.annual, 240)
    assert.equal(yearlyOnly.monthly, 20)
    assert.deepEqual(subscriptionSavings(rows[3]), { monthly: 0, annual: 0, included: false })
  })

  it('keeps a selection across the whole list and skips stopped rows', () => {
    const keys = new Set([
      subscriptionKey(rows[0]),
      subscriptionKey(rows[1]),
      subscriptionKey(rows[3]),
    ])
    const summary = summarizeSavings(rows, keys, 497.99)
    assert.equal(summary.count, 2)
    assert.equal(summary.monthly, 69)
    assert.equal(summary.annual, 828)
    assert.equal(summary.percent, 13.86)
    assert.equal(summary.after, 428.99)
    const stillThere = filterSubscriptionItems(rows, 'stopped')
    assert.equal(stillThere.length, 1)
    assert.equal(summarizeSavings(rows, keys, 497.99).count, 2)
  })
})

describe('subscription HTTP gate', () => {
  const client = {
    client: 'Fictional Env Sample',
    qb_customer_id: 'SAMPLE-ENV',
    monthly_recurring_amount: 10,
    months_billed_last_12: 1,
    last_invoice_date: '2026-01-01',
    last_payment_date: '2026-01-02',
    days_since_last_payment: 3,
    open_balance: 0,
    overdue_balance: 0,
    unpaid_90_days_flag: false,
    notes: 'FICTIONAL SAMPLE from env',
  }

  it('returns 401 when signed out and does not include subscription rows', async () => {
    const result = await handleBilling(
      {
        BILLING_ALLOWED_EMAILS: ALLOWED,
        VERCEL_ENV: 'production',
        BILLING_SUBSCRIPTIONS_JSON: gzipValue(SLIM),
      },
      '',
      'data',
      { resolveUser: allow(JUSTIN) },
    )
    assert.equal(result.status, 401)
    assert.deepEqual(result.body, { error: 'Sign in required' })
    assert.equal(JSON.stringify(result.body).includes('Example SaaS'), false)
    assert.equal(Object.hasOwn(result.body, 'subscriptions'), false)
  })

  it('returns parsed subscriptions for an allowlisted email', async () => {
    const result = await handleBilling(
      {
        BILLING_ALLOWED_EMAILS: ALLOWED,
        VERCEL_ENV: 'production',
        BILLING_CLIENTS_JSON: JSON.stringify([client]),
        BILLING_SUBSCRIPTIONS_JSON: gzipValue(SLIM),
      },
      'token',
      'data',
      { resolveUser: allow(SANDY) },
    )
    assert.equal(result.status, 200)
    assert.equal(result.body.clients[0].client, 'Fictional Env Sample')
    assert.equal(result.body.subscriptions.configured, true)
    assert.equal(result.body.subscriptions.items[0].vendor, 'Example SaaS A')
    assert.equal(JSON.stringify(result.body).includes('gz:'), false)
  })

  it('keeps the client report when subscription JSON is invalid', async () => {
    const canary = 'SECRET-SHOULD-NOT-LEAK'
    const result = await handleBilling(
      {
        BILLING_ALLOWED_EMAILS: ALLOWED,
        VERCEL_ENV: 'production',
        BILLING_CLIENTS_JSON: JSON.stringify([client]),
        BILLING_SUBSCRIPTIONS_JSON: `gz:${canary}`,
      },
      'token',
      'data',
      { resolveUser: allow(JUSTIN) },
    )
    assert.equal(result.status, 200)
    assert.equal(result.body.configured, true)
    assert.equal(result.body.clients.length, 1)
    assert.equal(result.body.subscriptions.configured, false)
    assert.equal(JSON.stringify(result.body).includes(canary), false)
  })

  it('still refuses invalid client JSON even when subscriptions are valid', async () => {
    const result = await handleBilling(
      {
        BILLING_ALLOWED_EMAILS: ALLOWED,
        VERCEL_ENV: 'production',
        BILLING_CLIENTS_JSON: '{',
        BILLING_SUBSCRIPTIONS_JSON: gzipValue(SLIM),
      },
      'token',
      'data',
      { resolveUser: allow(JUSTIN) },
    )
    assert.equal(result.status, 500)
    assert.deepEqual(result.body, { error: 'Could not load billing' })
    assert.equal(JSON.stringify(result.body).includes('Example SaaS'), false)
  })
})

describe('subscription renewal fields', () => {
  const NOW = new Date('2026-11-19T15:00:00.000Z')

  it('reads optional renewal fields and drops anything that is not a real date or term', () => {
    const parsed = parseBillingSubscriptions(JSON.stringify({
      subscriptions: [
        { vendor: 'Example Calendar Co', renewalDate: '2027-04-19', renewalNote: 'Fake note for a later renewal.', contractTerm: 'annual' },
        { vendor: 'Example Month Co', renewalDate: '2026-12-01', renewalNote: 'Fake note that should not flag.', contractTerm: 'monthly' },
        { vendor: 'Example No Date Co' },
        { vendor: 'Example Bad Date Co', renewalDate: '2027-02-31', renewalNote: 12, contractTerm: 'weekly' },
      ],
    }))
    const calendar = parsed.items.find((item) => item.vendor === 'Example Calendar Co')
    assert.equal(calendar.renewalDate, '2027-04-19')
    assert.equal(calendar.renewalNote, 'Fake note for a later renewal.')
    assert.equal(calendar.contractTerm, 'annual')
    const month = parsed.items.find((item) => item.vendor === 'Example Month Co')
    assert.equal(month.contractTerm, 'monthly')
    assert.equal(renewalBadgeLabel(month, NOW), '')
    const blank = parsed.items.find((item) => item.vendor === 'Example No Date Co')
    assert.equal(blank.renewalDate, null)
    assert.equal(blank.renewalNote, '')
    assert.equal(blank.contractTerm, '')
    assert.equal(renewalBadgeLabel(blank, NOW), '')
    const bad = parsed.items.find((item) => item.vendor === 'Example Bad Date Co')
    assert.equal(bad.renewalDate, null)
    assert.equal(bad.contractTerm, '')
  })

  it('flags only annual contracts and lists them soonest first', () => {
    const items = [
      { vendor: 'Example Later Co', contractTerm: 'annual', renewalDate: '2027-04-19', renewalNote: 'Fake later note' },
      { vendor: 'Example Soon Co', contractTerm: 'annual', renewalDate: '2026-12-01', renewalNote: 'Fake soon note' },
      { vendor: 'Example Past Co', contractTerm: 'annual', renewalDate: '2026-11-01', renewalNote: '' },
      { vendor: 'Example Month Co', contractTerm: 'monthly', renewalDate: '2026-11-20', renewalNote: 'Fake monthly note' },
      { vendor: 'Example Open Co', contractTerm: 'annual' },
    ]
    assert.equal(contractTermOf(items[0]), 'annual')
    assert.equal(renewalTiming('2026-12-01', NOW).days, 12)
    assert.equal(renewalTiming('2026-12-01', NOW).urgent, true)
    assert.equal(renewalTiming('2027-04-19', NOW).urgent, false)
    assert.equal(renewalBadgeLabel(items[1], NOW), 'Renews in 12 days')
    assert.equal(renewalBadgeLabel(items[0], NOW), 'Annual contract · renews Apr 19, 2027')
    assert.equal(renewalBadgeLabel(items[2], NOW), 'Past due by 18 days')
    assert.equal(renewalBadgeLabel(items[3], NOW), '')
    assert.equal(renewalBadgeLabel(items[4], NOW), '')
    assert.equal(daysRemainingLabel(12), '12 days')
    assert.equal(daysRemainingLabel(-18), '18 days ago')
    const upcoming = upcomingContractRenewals(items, NOW)
    assert.deepEqual(upcoming.map((row) => row.item.vendor), ['Example Past Co', 'Example Soon Co', 'Example Later Co'])
    assert.equal(upcoming[0].urgent, true)
    assert.equal(upcoming[2].urgent, false)
  })
})

describe('subscription client sources', () => {
  it('does not decode gzip in the browser sources', () => {
    const files = [
      'src/pages/BillingSubscriptions.jsx',
      'src/pages/BillingSubscriptionsPreview.jsx',
      'src/lib/billingSubscriptionsView.js',
      'src/lib/billingApi.js',
      'src/pages/BillingScreen.jsx',
    ]
    for (const file of files) {
      const source = readFileSync(new URL(`../${file}`, import.meta.url), 'utf8')
      assert.equal(source.includes('gunzip'), false, file)
      assert.equal(source.includes('zlib'), false, file)
      assert.equal(source.includes('gz:'), false, file)
      assert.equal(source.includes('Example SaaS A'), false, file)
    }
  })
})
