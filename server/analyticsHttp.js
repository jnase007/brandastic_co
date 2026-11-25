/* eslint-env node */
import { createClient } from '@supabase/supabase-js'
import { isAllowedEmail, parseAllowlist } from './billingGate.js'
import { loadKeywordOverrides } from './keywordCategories.js'
import { normalizeAi, normalizeKeywords, normalizeSearch, emptySearch } from './analyticsNormalize.js'
import { clearOpenseoCache, openseoConfig, openseoFetch } from './openseo.js'
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
  }
}

async function safeGet(config, path, options) {
  try {
    return await openseoFetch(config, path, options)
  } catch (error) {
    if (error?.code === 'not_configured') throw error
    return { status: 0, payload: null }
  }
}

export async function loadAnalytics(env, rangeId, options = {}) {
  const now = options.now || new Date()
  const range = resolveAnalyticsRange(rangeId, now)
  const config = options.config || openseoConfig(env)
  if (!config.configured) {
    return { range, fetchedAt: now.toISOString(), ...disconnected('not_configured') }
  }
  const fetchImpl = options.fetchImpl || fetch
  const cacheMs = options.cacheMs ?? CACHE_MS
  const request = (path) => safeGet(config, path, { fetchImpl, cacheMs, now: now.getTime() })
  const device = 'mobile'
  const [report, queries, pages, tracker, aiSettings, aiResults] = await Promise.all([
    request(`/projects/${config.projectId}/search-performance?range=${range.openseo}`),
    request(`/projects/${config.projectId}/search-performance/table?range=${range.openseo}&dimension=query&size=25&page=1`),
    request(`/projects/${config.projectId}/search-performance/table?range=${range.openseo}&dimension=page&size=25&page=1`),
    request(`/trackers/${config.trackerId}/results?device=${device}`),
    request(`/projects/${config.projectId}/ai`),
    request(`/projects/${config.projectId}/ai/results`),
  ])
  const failed = [report, queries, pages, tracker, aiSettings, aiResults].every((item) => !item || item.status === 0 || item.status >= 400)
  if (failed) return { range, fetchedAt: now.toISOString(), ...disconnected('unavailable') }
  const overrides = options.overrides || loadKeywordOverrides(options.overridesPath)
  const search = report?.status >= 200 && report.status < 300 ? normalizeSearch(report.payload, queries?.payload, pages?.payload) : emptySearch('unavailable')
  const keywords = tracker?.status >= 200 && tracker.status < 300
    ? normalizeKeywords(tracker.payload, { device, overrides })
    : { connected: false, reason: 'unavailable', rows: [], tracked: 0, ranking: 0, device, lastCheckedAt: null, runStatus: null }
  const ai = aiSettings?.status >= 200 && aiSettings.status < 300
    ? normalizeAi(aiSettings.payload, aiResults?.status >= 200 && aiResults.status < 300 ? aiResults.payload : null)
    : { connected: false, reason: 'unavailable', score: null, trend: null, prompts: [], voices: [], citationRate: null, lastChecked: null }
  return { range, fetchedAt: now.toISOString(), search, keywords, ai }
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

export async function runAnalyticsRequest(env, { method, token, range }) {
  if (method !== 'GET') return denied(405, 'method_not_allowed')
  return handleAnalytics(env, token, range)
}
