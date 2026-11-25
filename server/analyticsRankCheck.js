/* eslint-env node */
import { handleAnalytics } from './analyticsHttp.js'
import { invalidateAnalyticsCache } from './analyticsHttp.js'
import { openseoConfig, openseoFetch, readEstimate } from './openseo.js'

const HOUR_MS = 60 * 60 * 1000
const startedAt = new Map()

function denied(status, error, extra = {}) {
  return { status, body: { error, ...extra } }
}

function stampOf(payload) {
  const data = payload?.ok === true && payload.data ? payload.data : payload
  const run = data?.run || data?.results?.run || (Array.isArray(data?.runs) ? data.runs[0] : null)
  const raw = run?.createdAt || run?.startedAt || data?.lastRunAt || null
  const time = raw ? Date.parse(raw) : NaN
  return {
    time: Number.isFinite(time) ? time : null,
    status: typeof run?.status === 'string' ? run.status : null,
    id: typeof run?.id === 'string' ? run.id : null,
  }
}

export function cooldownDecision({ trackerId, now, latestTime, latestStatus, memory = startedAt }) {
  if (latestStatus === 'pending' || latestStatus === 'running') {
    return { allowed: false, reason: 'running', nextAt: null, runId: null }
  }
  const local = memory.get(trackerId) || null
  const latest = [latestTime, local].filter((value) => Number.isFinite(value)).reduce((max, value) => Math.max(max, value), 0)
  if (latest && now - latest < HOUR_MS) {
    return { allowed: false, reason: 'cooldown', nextAt: new Date(latest + HOUR_MS).toISOString(), runId: null }
  }
  return { allowed: true, reason: null, nextAt: null, runId: null }
}

async function guard(env, token, options) {
  const access = await handleAnalytics(env, token, '28', { ...options, cacheMs: 0 })
  if (access.status !== 200) return access
  return null
}

export async function estimateRankCheck(env, token, options = {}) {
  const blocked = await guard(env, token, options)
  if (blocked) return blocked
  const config = options.config || openseoConfig(env)
  if (!config.configured) return { status: 200, body: { error: 'not_configured', estimate: null, allowed: false, reason: 'not_configured' } }
  const tracker = await openseoFetch(config, `/trackers/${config.trackerId}`, { fetchImpl: options.fetchImpl || fetch, cacheMs: 0 })
  const estimate = readEstimate(tracker.payload)
  const run = stampOf(tracker.payload)
  const decision = cooldownDecision({
    trackerId: config.trackerId,
    now: (options.now || new Date()).getTime(),
    latestTime: run.time,
    latestStatus: run.status,
    memory: options.memory || startedAt,
  })
  return {
    status: 200,
    body: {
      estimate,
      allowed: decision.allowed,
      reason: decision.reason,
      nextAt: decision.nextAt,
      trackerId: config.trackerId,
    },
  }
}

export async function startRankCheck(env, token, options = {}) {
  const blocked = await guard(env, token, options)
  if (blocked) return blocked
  const config = options.config || openseoConfig(env)
  if (!config.configured) return denied(409, 'not_configured')
  const now = options.now || new Date()
  const fetchImpl = options.fetchImpl || fetch
  const memory = options.memory || startedAt
  const tracker = await openseoFetch(config, `/trackers/${config.trackerId}`, { fetchImpl, cacheMs: 0 })
  const run = stampOf(tracker.payload)
  const decision = cooldownDecision({
    trackerId: config.trackerId,
    now: now.getTime(),
    latestTime: run.time,
    latestStatus: run.status,
    memory,
  })
  if (!decision.allowed) {
    return denied(429, decision.reason, { nextAt: decision.nextAt, runId: run.id })
  }
  const created = await openseoFetch(config, `/trackers/${config.trackerId}/runs`, {
    method: 'POST',
    body: {},
    fetchImpl,
    cacheMs: 0,
  })
  if (created.status === 409) {
    return denied(409, 'running', { runId: run.id })
  }
  if (created.status < 200 || created.status >= 300) {
    return denied(502, 'Could not start a rank check')
  }
  memory.set(config.trackerId, now.getTime())
  invalidateAnalyticsCache()
  const data = created.payload?.ok === true ? created.payload.data : created.payload
  const runId = data?.runId || data?.id || data?.run?.id || null
  return { status: 202, body: { runId, status: data?.status || 'pending' } }
}

export async function rankCheckStatus(env, token, runId, options = {}) {
  const blocked = await guard(env, token, options)
  if (blocked) return blocked
  if (!runId) return denied(400, 'missing_run')
  const config = options.config || openseoConfig(env)
  if (!config.configured) return denied(409, 'not_configured')
  const result = await openseoFetch(config, `/rank-runs/${encodeURIComponent(runId)}`, {
    fetchImpl: options.fetchImpl || fetch,
    cacheMs: 0,
  })
  if (result.status < 200 || result.status >= 300) return denied(502, 'Could not read the rank check')
  const data = result.payload?.ok === true ? result.payload.data : result.payload
  const status = data?.status || data?.run?.status || null
  if (status === 'completed' || status === 'failed' || status === 'cancelled') invalidateAnalyticsCache()
  return {
    status: 200,
    body: {
      runId,
      status,
      done: data?.done ?? null,
      total: data?.total ?? null,
      completedAt: data?.completedAt || data?.run?.completedAt || null,
    },
  }
}

export async function runRankCheckRequest(env, { method, token, action, runId, ...options }) {
  if (action === 'estimate' && method === 'GET') return estimateRankCheck(env, token, options)
  if (action === 'start' && method === 'POST') return startRankCheck(env, token, options)
  if (action === 'status' && method === 'GET') return rankCheckStatus(env, token, runId, options)
  return denied(405, 'method_not_allowed')
}
