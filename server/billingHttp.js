import { createClient } from '@supabase/supabase-js'
import { isAllowedEmail, parseAllowlist } from './billingGate.js'
import { applyReadTimePaymentAges, emptyBillingSummary, summarizeBilling } from './billingData.js'
import { emptySubscriptions, loadBillingSubscriptions } from './billingSubscriptions.js'
import { loadPreferredDataset } from './qboSnapshot.js'

export function billingResponseHeaders() {
  return {
    'Cache-Control': 'private, no-store, no-cache, must-revalidate',
    'CDN-Cache-Control': 'no-store',
    'Vercel-CDN-Cache-Control': 'no-store',
    Pragma: 'no-cache',
    Expires: '0',
    'X-Robots-Tag': 'noindex, nofollow, noarchive',
    'Referrer-Policy': 'no-referrer',
    'X-Content-Type-Options': 'nosniff',
    Vary: 'Authorization',
  }
}

async function resolveSupabaseUser(env, token) {
  const url = env.VITE_SUPABASE_URL || env.SUPABASE_URL
  const anon = env.VITE_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY
  if (!url || !anon) return { misconfigured: true }
  try {
    const supabase = createClient(url, anon, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const { data, error } = await supabase.auth.getUser(token)
    if (error || !data?.user?.email) return null
    return { email: data.user.email }
  } catch {
    return null
  }
}

function denied(status, error) {
  return { status, body: { error } }
}

function subscriptionsBody(env) {
  try {
    return loadBillingSubscriptions(env)
  } catch {
    return emptySubscriptions()
  }
}

function publicQbo(qbo) {
  return {
    source: qbo?.source || 'missing',
    refreshed_at: qbo?.refreshed_at || null,
    status: qbo?.status || 'unconfigured',
    slot: qbo?.slot === 'production' ? 'production' : 'sandbox',
  }
}

export async function authorizeBilling(env, token, options = {}) {
  if (!token) return denied(401, 'Sign in required')
  const resolveUser = options.resolveUser || resolveSupabaseUser
  const user = await resolveUser(env, token)
  if (user?.misconfigured) return denied(403, 'not_configured')
  if (!user?.email) return denied(401, 'Sign in required')
  const allowlist = parseAllowlist(env?.BILLING_ALLOWED_EMAILS)
  if (!allowlist) return denied(403, 'not_configured')
  if (!isAllowedEmail(allowlist, user.email)) return denied(403, 'forbidden')
  return { status: 200, email: user.email }
}

export async function handleBilling(env, token, kind, options = {}) {
  if (kind !== 'access' && kind !== 'data') return denied(404, 'not_found')
  const auth = await authorizeBilling(env, token, options)
  if (auth.status !== 200) return auth
  if (kind === 'access') return { status: 200, body: { allowed: true } }

  let preferred
  try {
    preferred = await loadPreferredDataset(env, options)
  } catch {
    return denied(500, 'Could not load billing')
  }

  let dataset = preferred.dataset
  const qbo = publicQbo(preferred.qbo)
  if (dataset?.clients) dataset = applyReadTimePaymentAges(dataset, options.now)

  if (!dataset?.clients) {
    return {
      status: 200,
      body: {
        configured: false,
        sample: false,
        clients: [],
        alerts: [],
        non_recurring_unpaid: [],
        other_open: [],
        updated_at: null,
        summary: emptyBillingSummary(),
        subscriptions: subscriptionsBody(env),
        qbo,
      },
    }
  }

  return {
    status: 200,
    body: {
      configured: true,
      sample: dataset.source === 'sample',
      clients: dataset.clients,
      alerts: dataset.alerts,
      non_recurring_unpaid: dataset.non_recurring_unpaid,
      other_open: dataset.other_open || [],
      updated_at: dataset.updated_at || null,
      summary: summarizeBilling(dataset.clients),
      subscriptions: subscriptionsBody(env),
      qbo,
    },
  }
}

export async function runBillingRequest(env, { method, token, kind }) {
  if (method !== 'GET') return denied(405, 'method_not_allowed')
  try {
    return await handleBilling(env, token, kind)
  } catch {
    return denied(500, 'Could not load billing')
  }
}
