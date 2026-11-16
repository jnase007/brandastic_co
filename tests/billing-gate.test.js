import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'
import { isAllowedEmail, parseAllowlist } from '../server/billingGate.js'
import { loadBillingDataset, parseBillingClients, parseBillingDataset, validateBillingClient } from '../server/billingData.js'
import { handleBilling } from '../server/billingHttp.js'
import { sampleBillingClients } from '../server/billingSample.js'

const JUSTIN = 'justin.sample@example.test'
const SANDY = 'sandy.sample@example.test'
const ALLOWED = `${JUSTIN}, ${SANDY}`

function allow(email) {
  return async () => ({ email })
}

describe('billing allowlist', () => {
  it('accepts exactly two emails and ignores case', () => {
    const list = parseAllowlist('  Sandy.Sample@Example.TEST, justin.sample@example.test ')
    assert.deepEqual(list, [SANDY, JUSTIN])
    assert.equal(isAllowedEmail(list, 'JUSTIN.SAMPLE@example.test'), true)
    assert.equal(isAllowedEmail(list, 'someone.else@example.test'), false)
  })

  it('denies when the list is missing, short, long, or duplicated', () => {
    assert.equal(parseAllowlist(''), null)
    assert.equal(parseAllowlist(JUSTIN), null)
    assert.equal(parseAllowlist(`${JUSTIN},${SANDY},extra.sample@example.test`), null)
    assert.equal(parseAllowlist(`${JUSTIN},${JUSTIN}`), null)
    assert.equal(isAllowedEmail(null, JUSTIN), false)
    assert.equal(isAllowedEmail([JUSTIN], JUSTIN), false)
  })
})

describe('billing data', () => {
  it('keeps only the typed fields', () => {
    const [row] = parseBillingClients(JSON.stringify([
      {
        ...sampleBillingClients()[0],
        secret_note: 'do-not-return',
        internal_account: 'hidden',
      },
    ]))
    assert.equal(row.secret_note, undefined)
    assert.equal(row.internal_account, undefined)
    assert.equal(Object.keys(row).includes('client'), true)
  })

  it('rejects a payload that is not the schema', () => {
    assert.throws(() => parseBillingClients('{"client":"Nope"}'), /invalid billing data/)
    assert.throws(() => validateBillingClient({ client: 'X' }), /invalid billing data/)
  })

  it('does not echo invalid source text', () => {
    const canary = 'SECRET-CLIENT-NAME-SHOULD-NOT-LEAK'
    assert.throws(
      () => parseBillingClients(`[{${canary}`),
      (error) => {
        assert.equal(error.message, 'invalid billing data')
        assert.equal(String(error.stack).includes(canary), false)
        return true
      },
    )
  })

  it('uses fictional sample data only outside production', () => {
    const preview = loadBillingDataset({ VERCEL_ENV: 'preview' })
    assert.equal(preview.source, 'sample')
    assert.ok(preview.clients.every((row) => row.client.includes('Fictional') && row.notes.includes('FICTIONAL SAMPLE')))
    assert.ok(preview.clients.some((row) => row.unpaid_90_days_flag))
    assert.equal(preview.updated_at, '2026-11-16T18:41:00.000Z')
    assert.ok(preview.alerts.some((row) => row.type === 'overdue'))
    assert.ok(preview.alerts.some((row) => row.type === 'no_payment_90'))
    assert.ok(preview.alerts.some((row) => row.type === 'payment_not_applied'))
    assert.ok(preview.alerts.some((row) => row.type === 'credit_mismatch'))
    assert.ok(preview.non_recurring_unpaid.every((row) => row.client.includes('Fictional') && row.notes.includes('FICTIONAL SAMPLE')))
    const overdue = preview.alerts.filter((row) => row.type === 'overdue')
    assert.ok(overdue[0].amount >= overdue[1].amount)

    const local = loadBillingDataset({})
    assert.equal(local.source, 'sample')

    const production = loadBillingDataset({ VERCEL_ENV: 'production' })
    assert.equal(production.source, 'missing')
    assert.equal(production.clients, null)
    assert.equal(production.alerts, null)
  })

  it('prefers the env JSON over the sample, including in production', () => {
    const raw = JSON.stringify([
      {
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
      },
    ])
    const loaded = loadBillingDataset({ VERCEL_ENV: 'production', BILLING_CLIENTS_JSON: raw })
    assert.equal(loaded.source, 'env')
    assert.equal(loaded.clients[0].client, 'Fictional Env Sample')
    assert.equal(loaded.clients[0].monthly_recurring_amount, 10)
    assert.deepEqual(loaded.alerts, [])
    assert.deepEqual(loaded.non_recurring_unpaid, [])
  })

  it('keeps alert and non-recurring fields and drops extras', () => {
    const parsed = parseBillingDataset(JSON.stringify({
      clients: [sampleBillingClients()[0]],
      alerts: [{
        type: 'overdue',
        client: 'Fictional Env Sample',
        amount: 12,
        detail: 'FICTIONAL SAMPLE',
        since_date: '2026-01-01',
        secret: 'hidden',
      }],
      non_recurring_unpaid: [{
        client: 'Fictional One Time Sample',
        overdue_amount: 4,
        last_payment_date: null,
        days_since_payment: null,
        notes: 'FICTIONAL SAMPLE',
        secret: 'hidden',
      }],
    }))
    assert.equal(parsed.alerts[0].secret, undefined)
    assert.equal(parsed.alerts[0].type, 'overdue')
    assert.deepEqual(Object.keys(parsed.alerts[0]).sort(), ['amount', 'client', 'detail', 'since_date', 'type'])
    assert.equal(parsed.non_recurring_unpaid[0].secret, undefined)
    assert.equal(parsed.non_recurring_unpaid[0].overdue_amount, 4)
    assert.equal(parseBillingClients(JSON.stringify([sampleBillingClients()[0]])).length, 1)
  })
})

describe('billing HTTP gate', () => {
  const env = { BILLING_ALLOWED_EMAILS: ALLOWED, VERCEL_ENV: 'preview' }

  it('requires a session', async () => {
    const result = await handleBilling(env, '', 'data', { resolveUser: allow(JUSTIN) })
    assert.equal(result.status, 401)
    assert.deepEqual(result.body, { error: 'Sign in required' })
  })

  it('denies everyone when the allowlist is not exactly two emails', async () => {
    const result = await handleBilling(
      { BILLING_ALLOWED_EMAILS: JUSTIN, VERCEL_ENV: 'preview' },
      'token',
      'data',
      { resolveUser: allow(JUSTIN) },
    )
    assert.equal(result.status, 403)
    assert.deepEqual(result.body, { error: 'not_configured' })
    assert.equal(JSON.stringify(result.body).includes('Fictional'), false)
    assert.equal(JSON.stringify(result.body).includes('monthly_recurring_amount'), false)
  })

  it('returns 403 with no rows for a signed-in person who is not on the list', async () => {
    const result = await handleBilling(env, 'token', 'data', { resolveUser: allow('other.sample@example.test') })
    assert.equal(result.status, 403)
    assert.deepEqual(result.body, { error: 'forbidden' })
    assert.equal(Object.hasOwn(result.body, 'clients'), false)
  })

  it('returns fictional preview rows only for an allowlisted email', async () => {
    const sandy = await handleBilling(env, 'token', 'data', { resolveUser: allow('Sandy.Sample@Example.TEST') })
    assert.equal(sandy.status, 200)
    assert.equal(sandy.body.sample, true)
    assert.equal(sandy.body.configured, true)
    assert.ok(sandy.body.summary.mrr > 0)
    assert.ok(sandy.body.clients.every((row) => row.client.startsWith('Fictional')))
    assert.ok(sandy.body.alerts.length > 0)
    assert.ok(sandy.body.non_recurring_unpaid.length > 0)

    const access = await handleBilling(env, 'token', 'access', { resolveUser: allow(JUSTIN) })
    assert.deepEqual(access.body, { allowed: true })
  })

  it('does not send sample rows from production when the env JSON is missing', async () => {
    const result = await handleBilling(
      { BILLING_ALLOWED_EMAILS: ALLOWED, VERCEL_ENV: 'production' },
      'token',
      'data',
      { resolveUser: allow(SANDY) },
    )
    assert.equal(result.status, 200)
    assert.equal(result.body.configured, false)
    assert.deepEqual(result.body.clients, [])
    assert.deepEqual(result.body.alerts, [])
    assert.deepEqual(result.body.non_recurring_unpaid, [])
    assert.equal(result.body.summary.mrr, 0)
  })

  it('hides invalid billing JSON from the response', async () => {
    const canary = 'SECRET-CLIENT-NAME-SHOULD-NOT-LEAK'
    const result = await handleBilling(
      { BILLING_ALLOWED_EMAILS: ALLOWED, VERCEL_ENV: 'production', BILLING_CLIENTS_JSON: `[{${canary}` },
      'token',
      'data',
      { resolveUser: allow(JUSTIN) },
    )
    assert.equal(result.status, 500)
    assert.deepEqual(result.body, { error: 'Could not load billing' })
    assert.equal(JSON.stringify(result.body).includes(canary), false)
  })
})

describe('client bundle sources', () => {
  it('does not embed sample clients in the pages that ship to the browser', () => {
    const files = [
      'src/pages/Billing.jsx',
      'src/pages/BillingScreen.jsx',
      'src/pages/BillingCharts.jsx',
      'src/lib/billingApi.js',
      'src/hooks/useBillingAllowed.js',
    ]
    for (const file of files) {
      const source = readFileSync(new URL(`../${file}`, import.meta.url), 'utf8')
      assert.equal(source.includes('Fictional'), false, file)
      assert.equal(source.includes('SAMPLE-1001'), false, file)
      assert.equal(source.includes('FICTIONAL SAMPLE'), false, file)
    }
  })
})
