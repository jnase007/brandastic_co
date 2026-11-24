import { randomBytes } from 'node:crypto'
import { parseAllowlist } from './billingGate.js'
import { parseBillingDataset } from './billingData.js'
import { authorizeBilling } from './billingHttp.js'
import { qboClientReady, qboSlot, redirectUri } from './qboConfig.js'
import { emailHash } from './qboCrypto.js'
import { authorizeUrl, exchangeCode, pullReceivables, QboError, refreshAccessToken } from './qboIntuit.js'
import { mapQuickBooksReceivables } from './qboMap.js'
import { createSupabaseQboStore } from './qboStore.js'

const STATE_TTL_MS = 10 * 60 * 1000

function header(headers, name) {
  const value = headers?.[name] ?? headers?.[name.toLowerCase()]
  return Array.isArray(value) ? String(value[0] || '') : String(value || '')
}

function denied(status, error) {
  return { status, body: { error } }
}

export function assertBillingPost(headers) {
  const action = header(headers, 'x-billing-action')
  if (action !== 'refresh' && action !== 'connect') return false
  const origin = header(headers, 'origin')
  if (!origin || origin === 'null') return false
  let originHost = ''
  try {
    originHost = new URL(origin).host
  } catch {
    return false
  }
  const forwarded = header(headers, 'x-forwarded-host').split(',')[0].trim()
  const host = forwarded || header(headers, 'host')
  if (!host || originHost !== host) return false
  const site = header(headers, 'sec-fetch-site')
  if (site && site !== 'same-origin') return false
  return action
}

function storeFor(env, options) {
  if (options.store) return options.store
  if (!qboClientReady(env)) return null
  return createSupabaseQboStore(env)
}

function pacificDate(now) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles' }).format(now)
}

function safeCode(error) {
  const code = error?.code
  if (code === 'expired' || code === 'disconnected' || code === 'not_configured' || code === 'intuit_rejected' || code === 'unavailable' || code === 'invalid_snapshot') {
    return code
  }
  return 'intuit_rejected'
}

export async function handleQboConnect(env, { method, token, headers }, options = {}) {
  if (method !== 'POST') return denied(405, 'method_not_allowed')
  const auth = await authorizeBilling(env, token, options)
  if (auth.status !== 200) return auth
  if (assertBillingPost(headers) !== 'connect') return denied(403, 'csrf')
  if (!qboClientReady(env) || !redirectUri(env)) return denied(503, 'not_configured')
  const store = storeFor(env, options)
  if (!store) return denied(503, 'not_configured')
  const state = randomBytes(32).toString('base64url')
  const slot = qboSlot(env)
  try {
    await store.putState({
      state,
      slot,
      emailHash: emailHash(auth.email),
      expiresAt: new Date(Date.now() + STATE_TTL_MS).toISOString(),
    })
  } catch {
    return denied(503, 'unavailable')
  }
  return { status: 200, body: { url: authorizeUrl(env, state) } }
}

export async function handleQboCallback(env, { method, url }, options = {}) {
  if (method !== 'GET') return denied(405, 'method_not_allowed')
  const requestUrl = new URL(url || '/', 'http://localhost')
  const fail = (code) => ({ status: 302, redirect: `/billing?qbo=${code}`, body: {} })
  if (requestUrl.searchParams.get('error')) return fail('error')
  const code = requestUrl.searchParams.get('code') || ''
  const state = requestUrl.searchParams.get('state') || ''
  const realmId = requestUrl.searchParams.get('realmId') || ''
  if (!/^\d{5,20}$/.test(realmId) || state.length < 20 || state.length > 200 || code.length < 8 || code.length > 2000) {
    return fail('error')
  }
  const allowlist = parseAllowlist(env?.BILLING_ALLOWED_EMAILS)
  if (!allowlist || !qboClientReady(env)) return fail('error')
  const store = storeFor(env, options)
  if (!store) return fail('error')
  const saved = await store.takeState(state).catch(() => null)
  const allowedHashes = new Set(allowlist.map((email) => emailHash(email)))
  if (!saved || saved.slot !== qboSlot(env) || !allowedHashes.has(saved.emailHash)) return fail('denied')
  try {
    const tokens = await exchangeCode(env, code, options.fetch)
    if (!tokens.refreshToken) return fail('error')
    const existing = await store.readSlot(qboSlot(env)).catch(() => null)
    await store.writeSlot(qboSlot(env), {
      token: { realmId, refreshToken: tokens.refreshToken },
      snapshot: existing?.snapshot || null,
      refreshedAt: existing?.refreshedAt || null,
      connectedAt: new Date().toISOString(),
      status: 'connected',
    })
  } catch {
    return fail('error')
  }
  return fail('connected')
}

export async function handleBillingRefresh(env, { method, token, headers }, options = {}) {
  if (method !== 'POST') return denied(405, 'method_not_allowed')
  const auth = await authorizeBilling(env, token, options)
  if (auth.status !== 200) return auth
  if (assertBillingPost(headers) !== 'refresh') return denied(403, 'csrf')
  if (!qboClientReady(env)) return denied(503, 'not_configured')
  const store = storeFor(env, options)
  if (!store) return denied(503, 'not_configured')
  const slot = qboSlot(env)
  let current
  try {
    current = await store.readSlot(slot)
  } catch {
    return denied(503, 'unavailable')
  }
  if (!current?.token?.refreshToken || current.status === 'expired') {
    return denied(409, current?.status === 'expired' ? 'expired' : 'disconnected')
  }
  let tokens
  try {
    tokens = await refreshAccessToken(env, current.token.refreshToken, options.fetch)
  } catch (error) {
    const code = safeCode(error)
    if (code === 'expired') {
      await store.writeSlot(slot, { token: null, status: 'expired' }).catch(() => {})
    }
    return denied(code === 'expired' ? 409 : 502, code === 'expired' ? 'expired' : 'intuit_rejected')
  }
  const refreshToken = tokens.refreshToken || current.token.refreshToken
  try {
    await store.writeSlot(slot, {
      token: { realmId: current.token.realmId, refreshToken },
      status: 'connected',
      connectedAt: current.connectedAt || new Date().toISOString(),
    })
  } catch {
    return denied(503, 'unavailable')
  }
  const now = options.now instanceof Date ? options.now : new Date()
  const asOf = pacificDate(now)
  try {
    const pulled = await pullReceivables(env, {
      realmId: current.token.realmId,
      accessToken: tokens.accessToken,
      asOf,
    }, options.fetch)
    const mapped = mapQuickBooksReceivables({ ...pulled, asOf })
    mapped.updated_at = now.toISOString()
    const dataset = parseBillingDataset(mapped)
    await store.writeSlot(slot, {
      token: { realmId: current.token.realmId, refreshToken },
      snapshot: { ...dataset, updated_at: mapped.updated_at },
      refreshedAt: mapped.updated_at,
      connectedAt: current.connectedAt || mapped.updated_at,
      status: 'connected',
    })
    return { status: 200, body: { ok: true, refreshed_at: mapped.updated_at, slot } }
  } catch (error) {
    return denied(502, safeCode(error) === 'invalid_snapshot' ? 'invalid_snapshot' : 'intuit_rejected')
  }
}

export async function runQboRequest(env, request, options = {}) {
  const path = String(request.url || '').split('?')[0]
  const token = String(header(request.headers, 'authorization')).replace(/^Bearer\s+/i, '')
  try {
    if (path === '/api/qbo/connect') return await handleQboConnect(env, { ...request, token }, options)
    if (path === '/api/qbo/callback') return await handleQboCallback(env, request, options)
    if (path === '/api/billing-refresh') return await handleBillingRefresh(env, { ...request, token }, options)
    return denied(404, 'not_found')
  } catch (error) {
    if (error instanceof QboError) return denied(502, safeCode(error))
    return denied(500, 'intuit_rejected')
  }
}

export function postHeaders(host) {
  return {
    origin: `https://${host}`,
    host,
    'x-forwarded-host': host,
    'sec-fetch-site': 'same-origin',
  }
}
