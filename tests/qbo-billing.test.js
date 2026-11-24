import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'
import { applyReadTimePaymentAges } from '../server/billingData.js'
import { handleBilling } from '../server/billingHttp.js'
import { qboApiHost, qboSlot } from '../server/qboConfig.js'
import { open, seal } from '../server/qboCrypto.js'
import { handleBillingRefresh, handleQboCallback, handleQboConnect, postHeaders } from '../server/qboHttp.js'
import { mapQuickBooksReceivables } from '../server/qboMap.js'
import { createMemoryQboStore } from '../server/qboStore.js'
import { billingSourceLabel } from '../src/lib/billingSource.js'

const JUSTIN = 'justin.sample@example.test'
const SANDY = 'sandy.sample@example.test'
const KEY = Buffer.alloc(32, 4).toString('base64')
const NOW = new Date('2026-11-24T20:00:00.000Z')

function allow(email) {
  return async () => ({ email })
}

function env(extra = {}) {
  return {
    VERCEL_ENV: 'preview',
    BILLING_ALLOWED_EMAILS: `${JUSTIN}, ${SANDY}`,
    QBO_CLIENT_ID: 'client-id',
    QBO_CLIENT_SECRET: 'client-secret',
    QBO_REDIRECT_URI: 'https://preview.example.test/api/qbo/callback',
    QBO_TOKEN_ENCRYPTION_KEY: KEY,
    ...extra,
  }
}

function headers(action) {
  return { ...postHeaders('preview.example.test'), 'x-billing-action': action }
}

function json(body, status = 200) {
  return {
    ok: status < 400,
    status,
    text: async () => JSON.stringify(body),
  }
}

function queryResponse(entity, rows) {
  return json({ QueryResponse: { [entity]: rows } })
}

const customers = [
  { Id: '10', DisplayName: 'Fictional Harbor Qbo', Balance: 200 },
  { Id: '11', DisplayName: 'Fictional Lighthouse Qbo', Balance: 50 },
  { Id: '12', DisplayName: 'Fictional Meadow Qbo', Balance: 30 },
  { Id: '13', DisplayName: 'Fictional Cedar Qbo', Balance: 0 },
  { Id: '14', DisplayName: 'Fictional Northwind Qbo', Balance: 25 },
]

function invoice(id, customerId, name, date, due, total, balance) {
  return {
    Id: id,
    DocNumber: `INV-${id}`,
    TxnDate: date,
    DueDate: due,
    TotalAmt: total,
    Balance: balance,
    CustomerRef: { value: customerId, name },
  }
}

const recentInvoices = [
  invoice('h6', '10', 'Fictional Harbor Qbo', '2026-06-01', '2026-06-15', 100, 0),
  invoice('h7', '10', 'Fictional Harbor Qbo', '2026-07-01', '2026-07-15', 100, 0),
  invoice('h8', '10', 'Fictional Harbor Qbo', '2026-08-01', '2026-08-15', 100, 0),
  invoice('h9', '10', 'Fictional Harbor Qbo', '2026-09-01', '2026-09-15', 100, 0),
  invoice('h10', '10', 'Fictional Harbor Qbo', '2026-10-01', '2026-10-15', 100, 100),
  invoice('h11', '10', 'Fictional Harbor Qbo', '2026-11-01', '2026-12-15', 100, 100),
  invoice('l1', '11', 'Fictional Lighthouse Qbo', '2026-06-01', '2026-06-15', 50, 50),
  invoice('m1', '12', 'Fictional Meadow Qbo', '2026-12-01', '2026-12-20', 40, 40),
  invoice('c6', '13', 'Fictional Cedar Qbo', '2026-06-01', '2026-06-15', 80, 0),
  invoice('c7', '13', 'Fictional Cedar Qbo', '2026-07-01', '2026-07-15', 80, 0),
  invoice('c8', '13', 'Fictional Cedar Qbo', '2026-08-01', '2026-08-15', 80, 0),
  invoice('c9', '13', 'Fictional Cedar Qbo', '2026-09-01', '2026-09-15', 80, 15),
  invoice('n6', '14', 'Fictional Northwind Qbo', '2026-06-01', '2026-06-15', 25, 0),
  invoice('n7', '14', 'Fictional Northwind Qbo', '2026-07-01', '2026-07-15', 25, 0),
  invoice('n8', '14', 'Fictional Northwind Qbo', '2026-08-01', '2026-08-15', 25, 0),
  invoice('n11', '14', 'Fictional Northwind Qbo', '2026-11-01', '2026-12-01', 25, 25),
]

const payments = [
  { Id: 'p10', TxnDate: '2026-08-01', TotalAmt: 100, UnappliedAmt: 0, CustomerRef: { value: '10', name: 'Fictional Harbor Qbo' } },
  { Id: 'p13', TxnDate: '2026-11-01', TotalAmt: 15, UnappliedAmt: 15, CustomerRef: { value: '13', name: 'Fictional Cedar Qbo' } },
  { Id: 'p14', TxnDate: '2026-11-01', TotalAmt: 25, UnappliedAmt: 0, CustomerRef: { value: '14', name: 'Fictional Northwind Qbo' } },
]

const creditMemos = [
  { Id: 'cr12', DocNumber: 'CR-12', TxnDate: '2026-11-02', RemainingCredit: 10, CustomerRef: { value: '12', name: 'Fictional Meadow Qbo' } },
]

const agedReport = {
  Columns: { Column: [{ ColTitle: 'Customer' }, { ColTitle: 'Current' }, { ColTitle: '1 - 30' }, { ColTitle: 'Total' }] },
  Rows: { Row: [{ ColData: [{ value: 'Fictional Harbor Qbo' }, { value: '100.00' }, { value: '100.00' }, { value: '200.00' }] }] },
}

function intuitFetch(url, options) {
  const parsed = new URL(url)
  if (parsed.origin === 'https://oauth.platform.intuit.com') {
    const params = new URLSearchParams(options.body)
    if (params.get('grant_type') === 'authorization_code') {
      return json({ access_token: 'access-token', refresh_token: 'saved-refresh-token' })
    }
    return json({ access_token: 'access-token', refresh_token: 'rotated-refresh-token' })
  }
  if (!parsed.hostname.includes('sandbox-quickbooks')) {
    return json({ Fault: { Error: [{ code: 'wrong-host' }] } }, 400)
  }
  const query = parsed.searchParams.get('query') || ''
  if (query.includes('from Customer')) return queryResponse('Customer', customers)
  if (query.includes('from Invoice') && query.includes('Balance')) return queryResponse('Invoice', recentInvoices.filter((row) => row.Balance > 0))
  if (query.includes('from Invoice')) return queryResponse('Invoice', recentInvoices)
  if (query.includes('from Payment')) return queryResponse('Payment', payments)
  if (query.includes('from CreditMemo')) return queryResponse('CreditMemo', creditMemos)
  if (parsed.pathname.includes('AgedReceivables')) return json(agedReport)
  return json({}, 404)
}

describe('quickbooks mapping', () => {
  it('maps fictional receivables into the billing contract', () => {
    const mapped = mapQuickBooksReceivables({
      customers,
      invoices: recentInvoices,
      payments,
      creditMemos,
      agedReport,
      asOf: '2026-11-24',
    })
    const harbor = mapped.clients.find((row) => row.client === 'Fictional Harbor Qbo')
    assert.equal(harbor.qb_customer_id, '10')
    assert.equal(harbor.months_billed_last_12, 6)
    assert.equal(harbor.monthly_recurring_amount, 100)
    assert.equal(harbor.open_balance, 200)
    assert.equal(harbor.overdue_balance, 100)
    assert.equal(harbor.last_payment_date, '2026-08-01')
    assert.equal(mapped.non_recurring_unpaid.some((row) => row.client === 'Fictional Lighthouse Qbo' && row.overdue_amount === 50), true)
    const meadow = mapped.other_open.find((row) => row.client === 'Fictional Meadow Qbo')
    assert.equal(meadow.open_balance, 30)
    assert.equal(meadow.open_invoices.some((row) => row.balance === -10), true)
    assert.equal(mapped.alerts.some((row) => row.client === 'Fictional Cedar Qbo' && row.type === 'payment_not_applied'), true)
    assert.equal(mapped.alerts.some((row) => row.client === 'Fictional Northwind Qbo' && row.type === 'credit_mismatch'), true)
    assert.equal(mapped.alerts.some((row) => row.type === 'overdue' && row.client === 'Fictional Harbor Qbo'), true)
    assert.equal(mapped.alerts.some((row) => row.type === 'no_payment_90'), true)
    assert.equal(JSON.stringify(mapped).includes('access_token'), false)
  })
})

describe('read-time payment age', () => {
  it('replaces a frozen day count with the date difference', () => {
    const aged = applyReadTimePaymentAges({
      clients: [{
        client: 'Fictional Env Sample',
        last_payment_date: '2026-01-02',
        days_since_last_payment: 3,
        open_balance: 10,
        overdue_balance: 0,
        unpaid_90_days_flag: false,
      }],
      non_recurring_unpaid: [{
        client: 'Fictional One Time Sample',
        last_payment_date: '2026-11-20',
        days_since_payment: 99,
        overdue_amount: 4,
      }],
    }, NOW)
    assert.ok(aged.clients[0].days_since_last_payment > 3)
    assert.equal(aged.clients[0].unpaid_90_days_flag, true)
    assert.ok(aged.non_recurring_unpaid[0].days_since_payment < 90)
  })
})

describe('quickbooks gate, fallback, and refresh', () => {
  it('keeps production snapshots away from preview and falls back to the env JSON', async () => {
    const store = createMemoryQboStore()
    await store.writeSlot('production', {
      token: { realmId: '462081636500000', refreshToken: 'production-refresh-token' },
      snapshot: {
        clients: [{
          client: 'Production Canary Sample',
          qb_customer_id: 'PROD',
          monthly_recurring_amount: 1,
          months_billed_last_12: 1,
          last_invoice_date: '2026-01-01',
          last_payment_date: '2026-01-02',
          days_since_last_payment: 1,
          open_balance: 0,
          overdue_balance: 0,
          unpaid_90_days_flag: false,
          notes: '',
        }],
        alerts: [],
        non_recurring_unpaid: [],
        other_open: [],
        updated_at: '2026-11-01T00:00:00.000Z',
      },
      refreshedAt: '2026-11-01T00:00:00.000Z',
      status: 'connected',
    })
    const manual = JSON.stringify([{
      client: 'Fictional Env Sample',
      qb_customer_id: 'SAMPLE-ENV',
      monthly_recurring_amount: 10,
      months_billed_last_12: 1,
      last_invoice_date: '2026-01-01',
      last_payment_date: '2026-01-02',
      days_since_last_payment: 3,
      open_balance: 10,
      overdue_balance: 0,
      unpaid_90_days_flag: false,
      notes: 'FICTIONAL SAMPLE from env',
    }])
    const preview = await handleBilling(
      env({ BILLING_CLIENTS_JSON: manual }),
      'token',
      'data',
      { resolveUser: allow(SANDY), store, now: NOW },
    )
    assert.equal(preview.status, 200)
    assert.equal(preview.body.qbo.source, 'manual')
    assert.equal(preview.body.qbo.slot, 'sandbox')
    assert.equal(preview.body.clients[0].client, 'Fictional Env Sample')
    assert.ok(preview.body.clients[0].days_since_last_payment > 3)
    assert.equal(JSON.stringify(preview.body).includes('Production Canary'), false)
    assert.equal(JSON.stringify(preview.body).includes('production-refresh-token'), false)
  })

  it('refuses people who are not allowlisted and rejects a cross-site post', async () => {
    const store = createMemoryQboStore()
    const outsider = await handleBillingRefresh(env(), {
      method: 'POST',
      token: 'token',
      headers: headers('refresh'),
    }, { resolveUser: allow('other.sample@example.test'), store, fetch: intuitFetch })
    assert.equal(outsider.status, 403)
    assert.equal(outsider.body.error, 'forbidden')

    const csrf = await handleQboConnect(env(), {
      method: 'POST',
      token: 'token',
      headers: { 'x-billing-action': 'connect', origin: 'https://evil.example.test', host: 'preview.example.test' },
    }, { resolveUser: allow(JUSTIN), store, fetch: intuitFetch })
    assert.equal(csrf.status, 403)
    assert.equal(csrf.body.error, 'csrf')
    assert.equal(await store.readSlot('sandbox'), null)
  })

  it('connects, rotates the refresh token, and serves the sandbox snapshot', async () => {
    const store = createMemoryQboStore()
    const options = { resolveUser: allow(JUSTIN), store, fetch: intuitFetch, now: NOW }
    const connect = await handleQboConnect(env(), {
      method: 'POST',
      token: 'token',
      headers: headers('connect'),
    }, options)
    assert.equal(connect.status, 200)
    const state = new URL(connect.body.url).searchParams.get('state')
    const callback = await handleQboCallback(env(), {
      method: 'GET',
      url: `/api/qbo/callback?code=fakecode123&state=${state}&realmId=4620816365`,
    }, options)
    assert.equal(callback.redirect, '/billing?qbo=connected')
    assert.equal(JSON.stringify(callback).includes('saved-refresh-token'), false)

    const refresh = await handleBillingRefresh(env(), {
      method: 'POST',
      token: 'token',
      headers: headers('refresh'),
    }, options)
    assert.equal(refresh.status, 200)
    assert.equal(refresh.body.slot, 'sandbox')
    assert.equal(JSON.stringify(refresh.body).includes('Fictional'), false)
    assert.equal(JSON.stringify(refresh.body).includes('rotated-refresh-token'), false)
    const saved = await store.readSlot('sandbox')
    assert.equal(saved.token.refreshToken, 'rotated-refresh-token')
    assert.equal(saved.token.realmId, '4620816365')

    const page = await handleBilling(env({
      BILLING_CLIENTS_JSON: JSON.stringify([{
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
        notes: '',
      }]),
    }), 'token', 'data', options)
    assert.equal(page.body.qbo.source, 'quickbooks')
    assert.equal(page.body.clients.some((row) => row.client === 'Fictional Harbor Qbo'), true)
    assert.equal(page.body.clients.some((row) => row.client === 'Fictional Env Sample'), false)
    const harbor = page.body.clients.find((row) => row.client === 'Fictional Harbor Qbo')
    assert.ok(harbor.days_since_last_payment >= 90)
  })

  it('marks an expired refresh token without echoing it', async () => {
    const store = createMemoryQboStore()
    await store.writeSlot('sandbox', {
      token: { realmId: '4620816365', refreshToken: 'old-refresh-token' },
      snapshot: null,
      status: 'connected',
    })
    const result = await handleBillingRefresh(env(), {
      method: 'POST',
      token: 'token',
      headers: headers('refresh'),
    }, {
      resolveUser: allow(JUSTIN),
      store,
      fetch: () => json({ error: 'invalid_grant' }, 400),
    })
    assert.equal(result.status, 409)
    assert.equal(result.body.error, 'expired')
    assert.equal(JSON.stringify(result.body).includes('old-refresh-token'), false)
    const saved = await store.readSlot('sandbox')
    assert.equal(saved.status, 'expired')
    assert.equal(saved.token, null)
  })

  it('does not call the live QuickBooks host from a preview', () => {
    assert.equal(qboSlot({ VERCEL_ENV: 'preview' }), 'sandbox')
    assert.equal(qboSlot({ VERCEL_ENV: 'production' }), 'production')
    assert.equal(qboApiHost({ VERCEL_ENV: 'preview' }).includes('sandbox-quickbooks'), true)
    assert.equal(qboApiHost({ VERCEL_ENV: 'production' }).includes('sandbox-quickbooks'), false)
    assert.equal(qboApiHost({ VERCEL_ENV: 'production', QBO_ENVIRONMENT: 'sandbox' }).includes('sandbox-quickbooks'), true)
  })
})

describe('token encryption', () => {
  it('round-trips a token and refuses the other slot', () => {
    const key = Buffer.from(KEY, 'base64')
    const secret = 'refresh-token-canary'
    const sealed = seal(secret, key, 'production:token')
    assert.equal(sealed.includes(secret), false)
    assert.equal(open(sealed, key, 'production:token'), secret)
    assert.throws(() => open(sealed, key, 'sandbox:token'))
  })
})

describe('billing source label', () => {
  it('describes a refresh and a manual snapshot differently', () => {
    assert.equal(billingSourceLabel({ source: 'quickbooks' }), 'Source: QuickBooks refresh')
    assert.equal(billingSourceLabel({ source: 'manual' }), 'Source: manual snapshot')
    assert.equal(billingSourceLabel({ source: 'sample' }), 'Source: sample data')
    assert.equal(billingSourceLabel(null), 'Source: manual snapshot')
  })
})

describe('quickbooks server files', () => {
  it('does not log', () => {
    const files = [
      'server/qboCrypto.js',
      'server/qboConfig.js',
      'server/qboMap.js',
      'server/qboIntuit.js',
      'server/qboStore.js',
      'server/qboSnapshot.js',
      'server/qboHttp.js',
    ]
    for (const file of files) {
      assert.equal(readFileSync(new URL(`../${file}`, import.meta.url), 'utf8').includes('console.'), false, file)
    }
  })
})
