/* eslint-env node */
import { createClient } from '@supabase/supabase-js'
import { isAllowedEmail, parseAllowlist } from './billingGate.js'
import { emptySearch, emptyGa4 } from './analyticsNormalize.js'
import { loadOpenSeo } from './analyticsReads.js'
import { clearOpenseoCache, openseoConfig } from './openseo.js'
import { resolveAnalyticsRange } from '../src/lib/analyticsRange.js'

const CACHE_MS = 120000

export function analyticsResponseHeaders() {
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
    const supabase = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } })
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

function disconnected(reason) {
  return {
    search: emptySearch(reason),
    keywords: { connected: false, reason, rows: [], tracked: 0, ranking: 0, device: 'mobile', lastCheckedAt: null, runStatus: null },
    ai: { connected: false, reason, score: null, trend: null, prompts: [], voices: [], citationRate: null, lastChecked: null },
    ga4: emptyGa4(reason),
    searchExtras: { connected: false, best: [], senior: [] },
  }
}

export async function loadAnalytics(env, rangeId, options = {}) {
  const now = options.now || new Date()
  const range = resolveAnalyticsRange(rangeId, now, { start: options.start, end: options.end })
  const config = options.config || openseoConfig(env)
  if (!config.configured) {
    return { range, fetchedAt: now.toISOString(), ...disconnected('not_configured') }
  }
  const loaded = await loadOpenSeo(config, range, {
    fetchImpl: options.fetchImpl,
    cacheMs: options.cacheMs ?? CACHE_MS,
    now: now.getTime(),
    compare: options.compare,
    overrides: options.overrides,
    overridesPath: options.overridesPath,
  })
  return { range, fetchedAt: now.toISOString(), ...loaded }
}

export async function handleAnalytics(env, token, rangeId, options = {}) {
  if (!token) return denied(401, 'Sign in required')
  const resolveUser = options.resolveUser || resolveSupabaseUser
  const user = await resolveUser(env, token)
  if (user?.misconfigured) return denied(403, 'not_configured')
  if (!user?.email) return denied(401, 'Sign in required')
  const allowlist = parseAllowlist(env?.BILLING_ALLOWED_EMAILS)
  if (!allowlist) return denied(403, 'not_configured')
  if (!isAllowedEmail(allowlist, user.email)) return denied(403, 'forbidden')
  try {
    const body = await loadAnalytics(env, rangeId, options)
    return { status: 200, body }
  } catch {
    return denied(500, 'Could not load analytics')
  }
}

export function invalidateAnalyticsCache() {
  clearOpenseoCache()
}

export async function runAnalyticsRequest(env, { method, token, range, start, end, compare }) {
  if (method !== 'GET') return denied(405, 'method_not_allowed')
  const mode = ['period', 'month', 'year'].includes(compare) ? compare : 'period'
  return handleAnalytics(env, token, range, { start, end, compare: mode })
}
