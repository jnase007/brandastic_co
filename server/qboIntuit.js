import { Buffer } from 'node:buffer'
import { assertSlotMatchesHost, qboApiHost, redirectUri } from './qboConfig.js'

const TOKEN_URL = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer'
const MINOR_VERSION = '75'
const PAGE = 1000
const MAX_PAGES = 20

export class QboError extends Error {
  constructor(code) {
    super(code)
    this.code = code
    this.name = 'QboError'
  }
}

function basicAuth(env) {
  const id = String(env.QBO_CLIENT_ID || '').trim()
  const secret = String(env.QBO_CLIENT_SECRET || '').trim()
  if (!id || !secret) throw new QboError('not_configured')
  return `Basic ${Buffer.from(`${id}:${secret}`).toString('base64')}`
}

async function readJson(response) {
  const text = await response.text()
  if (!response.ok) {
    if (text.includes('invalid_grant')) throw new QboError('expired')
    throw new QboError('intuit_rejected')
  }
  try {
    return JSON.parse(text)
  } catch {
    throw new QboError('intuit_rejected')
  }
}

async function tokenRequest(env, body, fetchImpl) {
  const fetchFn = fetchImpl || fetch
  let response
  try {
    response = await fetchFn(TOKEN_URL, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        Authorization: basicAuth(env),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams(body),
    })
  } catch {
    throw new QboError('intuit_rejected')
  }
  const parsed = await readJson(response)
  if (!parsed?.access_token) throw new QboError('intuit_rejected')
  return {
    accessToken: parsed.access_token,
    refreshToken: parsed.refresh_token || '',
  }
}

export function authorizeUrl(env, state) {
  const redirect = redirectUri(env)
  const clientId = String(env?.QBO_CLIENT_ID || '').trim()
  if (!redirect || !clientId) throw new QboError('not_configured')
  const url = new URL('https://appcenter.intuit.com/connect/oauth2')
  url.searchParams.set('client_id', clientId)
  url.searchParams.set('redirect_uri', redirect)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('scope', 'com.intuit.quickbooks.accounting')
  url.searchParams.set('state', state)
  return url.toString()
}

export function exchangeCode(env, code, fetchImpl) {
  const redirect = redirectUri(env)
  if (!redirect || !code) throw new QboError('not_configured')
  return tokenRequest(env, {
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirect,
  }, fetchImpl)
}

export function refreshAccessToken(env, refreshToken, fetchImpl) {
  if (!refreshToken) throw new QboError('disconnected')
  return tokenRequest(env, {
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
  }, fetchImpl)
}

function assertRealm(realmId) {
  if (!/^\d{5,20}$/.test(String(realmId || ''))) throw new QboError('intuit_rejected')
}

async function qboGet(env, realmId, path, accessToken, fetchImpl) {
  assertSlotMatchesHost(env)
  assertRealm(realmId)
  const fetchFn = fetchImpl || fetch
  const url = `${qboApiHost(env)}/v3/company/${realmId}/${path}${path.includes('?') ? '&' : '?'}minorversion=${MINOR_VERSION}`
  let response
  try {
    response = await fetchFn(url, {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
    })
  } catch {
    throw new QboError('intuit_rejected')
  }
  return readJson(response)
}

async function queryAll(env, realmId, accessToken, sql, entity, fetchImpl) {
  const rows = []
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const start = page * PAGE + 1
    const statement = `${sql} startposition ${start} maxresults ${PAGE}`
    const body = await qboGet(env, realmId, `query?query=${encodeURIComponent(statement)}`, accessToken, fetchImpl)
    const list = body?.QueryResponse?.[entity]
    const pageRows = Array.isArray(list) ? list : []
    rows.push(...pageRows)
    if (pageRows.length < PAGE) return rows
  }
  throw new QboError('intuit_rejected')
}

function monthsAgo(iso, months) {
  const [year, month] = iso.split('-').map(Number)
  const utc = new Date(Date.UTC(year, month - 1 - months, 1))
  return utc.toISOString().slice(0, 10)
}

export async function pullReceivables(env, { realmId, accessToken, asOf }, fetchImpl) {
  const invoiceStart = monthsAgo(asOf, 11)
  const paymentStart = monthsAgo(asOf, 60)
  const [customers, openInvoices, recentInvoices, payments, creditMemos, agedReport] = await Promise.all([
    queryAll(env, realmId, accessToken, 'select * from Customer', 'Customer', fetchImpl),
    queryAll(env, realmId, accessToken, "select * from Invoice where Balance != '0'", 'Invoice', fetchImpl),
    queryAll(env, realmId, accessToken, `select * from Invoice where TxnDate >= '${invoiceStart}'`, 'Invoice', fetchImpl),
    queryAll(env, realmId, accessToken, `select * from Payment where TxnDate >= '${paymentStart}'`, 'Payment', fetchImpl),
    queryAll(env, realmId, accessToken, "select * from CreditMemo where RemainingCredit > '0'", 'CreditMemo', fetchImpl),
    qboGet(env, realmId, 'reports/AgedReceivables', accessToken, fetchImpl),
  ])
  const invoices = []
  const seen = new Set()
  for (const invoice of [...openInvoices, ...recentInvoices]) {
    const id = invoice?.Id == null ? '' : String(invoice.Id)
    if (id && seen.has(id)) continue
    if (id) seen.add(id)
    invoices.push(invoice)
  }
  return { customers, invoices, payments, creditMemos, agedReport }
}
