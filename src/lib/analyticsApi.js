import { supabase } from './supabase'

async function token() {
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token || ''
}

function init(method, access) {
  return {
    method,
    cache: 'no-store',
    credentials: 'omit',
    referrerPolicy: 'no-referrer',
    headers: {
      Accept: 'application/json',
      ...(method === 'POST' ? { 'Content-Type': 'application/json' } : {}),
      Authorization: `Bearer ${access}`,
    },
  }
}

export async function fetchAnalytics(input = '30') {
  const access = await token()
  if (!access) return { status: 'unauthorized' }
  const query = typeof input === 'string' ? { range: input } : (input || {})
  const params = new URLSearchParams()
  params.set('range', query.range || '30')
  if (query.compare) params.set('compare', query.compare)
  if (query.start) params.set('start', query.start)
  if (query.end) params.set('end', query.end)
  const response = await fetch(`/api/analytics-data?${params.toString()}`, init('GET', access))
  if (response.status === 401) return { status: 'unauthorized' }
  if (response.status === 403) {
    const body = await response.json().catch(() => null)
    return { status: body?.error === 'not_configured' ? 'not_configured' : 'forbidden' }
  }
  if (!response.ok) return { status: 'error' }
  const body = await response.json().catch(() => null)
  if (!body?.range) return { status: 'error' }
  return { status: 'ready', report: body }
}

export async function estimateRankCheck() {
  const access = await token()
  if (!access) return { status: 'unauthorized' }
  const response = await fetch('/api/analytics-rank-check?action=estimate', init('GET', access))
  const body = await response.json().catch(() => null)
  if (!response.ok && response.status !== 200) return { status: 'error', body }
  return { status: 'ready', body }
}

export async function startRankCheck() {
  const access = await token()
  if (!access) return { status: 'unauthorized' }
  const response = await fetch('/api/analytics-rank-check?action=start', { ...init('POST', access), body: '{}' })
  const body = await response.json().catch(() => null)
  return { status: response.status, body }
}

export async function rankCheckStatus(runId) {
  const access = await token()
  if (!access) return { status: 'unauthorized' }
  const response = await fetch(`/api/analytics-rank-check?action=status&runId=${encodeURIComponent(runId)}`, init('GET', access))
  const body = await response.json().catch(() => null)
  return { status: response.status, body }
}
