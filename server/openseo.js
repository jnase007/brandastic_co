/* eslint-env node */

export const DEFAULT_OPENSEO_BASE = 'https://app.openseo.so/api'
export const DEFAULT_PROJECT_ID = 'd974cbde-2d68-4c91-92be-643de135d4ea'
export const DEFAULT_TRACKER_ID = '679c3842-3d4c-4ede-967d-a9434b5c61dd'

const cache = new Map()

const GA4_TOOLS = new Set([
  'get_google_analytics_organic_overview',
  'get_google_analytics_traffic_acquisition',
  'get_google_analytics_page_performance',
  'get_google_analytics_key_events',
  'get_google_analytics_audience_breakdown',
  'get_google_analytics_organic_landing_pages',
  'get_search_console_performance',
  'get_rank_tracker',
  'get_ai_visibility_tracker',
  'get_ai_visibility_results',
  'get_ai_visibility_trend',
])

export function openseoConfig(env = {}) {
  const apiKey = String(env.OPENSEO_API_KEY || '').trim()
  const base = String(env.OPENSEO_API_BASE || DEFAULT_OPENSEO_BASE).replace(/\/$/, '')
  return {
    apiKey,
    base,
    mcpUrl: String(env.OPENSEO_MCP_URL || (base.endsWith('/api') ? `${base.slice(0, -4)}/mcp` : `${base}/mcp`)).replace(/\/$/, ''),
    projectId: String(env.OPENSEO_PROJECT_ID || DEFAULT_PROJECT_ID).trim(),
    trackerId: String(env.OPENSEO_RANK_TRACKER_ID || DEFAULT_TRACKER_ID).trim(),
    configured: Boolean(apiKey),
  }
}

export function clearOpenseoCache() {
  cache.clear()
}

export async function openseoFetch(config, path, { method = 'GET', body, fetchImpl = fetch, cacheMs = 0, now = Date.now() } = {}) {
  if (!config?.configured) {
    const error = new Error('not_configured')
    error.code = 'not_configured'
    throw error
  }
  if (method !== 'GET' && method !== 'POST') {
    const error = new Error('method_not_allowed')
    error.code = 'method_not_allowed'
    throw error
  }
  const url = `${config.base}${path.startsWith('/') ? path : `/${path}`}`
  const cacheKey = `${method} ${url}`
  if (method === 'GET' && cacheMs > 0) {
    const hit = cache.get(cacheKey)
    if (hit && hit.expires > now) return hit.value
  }
  const response = await fetchImpl(url, {
    method,
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const raw = await response.text()
  let payload = null
  try {
    payload = raw ? JSON.parse(raw) : null
  } catch {
    payload = null
  }
  const value = { status: response.status, payload }
  if (method === 'GET' && response.ok && cacheMs > 0) {
    cache.set(cacheKey, { expires: now + cacheMs, value })
  }
  return value
}

export function readEstimate(payload) {
  const data = payload?.ok === true && payload.data ? payload.data : payload
  if (!data || typeof data !== 'object') return null
  const source = data.estimate || data.price || data.checkPrice || data.cost || data
  const min = number(source.min ?? source.minimum ?? source.costUsdMin)
  const max = number(source.max ?? source.maximum ?? source.costUsdMax ?? source.costUsd)
  const credits = number(source.costCredits ?? source.credits ?? data.costCredits)
  if (min == null && max == null && credits == null) return null
  return { min, max, credits }
}

function number(value) {
  const parsed = typeof value === 'string' ? Number(value) : value
  return typeof parsed === 'number' && Number.isFinite(parsed) ? parsed : null
}

export function parseMcpPayload(raw) {
  const text = String(raw || '').trim()
  if (!text) return null
  if (text.startsWith('{') || text.startsWith('[')) {
    try { return JSON.parse(text) } catch { return null }
  }
  const messages = text.split('\n').filter((line) => line.startsWith('data:')).map((line) => line.slice(5).trim()).filter((line) => line && line !== '[DONE]')
  const last = messages.at(-1)
  if (!last) return null
  try { return JSON.parse(last) } catch { return null }
}

export function readMcpToolResult(payload) {
  const result = payload?.result && typeof payload.result === 'object' ? payload.result : payload
  const structured = result?.structuredContent
  if (structured && typeof structured === 'object') return structured
  return null
}

export async function openseoTool(config, name, args, { fetchImpl = fetch, cacheMs = 0, now = Date.now() } = {}) {
  if (!GA4_TOOLS.has(name)) {
    const error = new Error('tool_not_allowed')
    error.code = 'tool_not_allowed'
    throw error
  }
  if (!config?.configured) {
    const error = new Error('not_configured')
    error.code = 'not_configured'
    throw error
  }
  const cacheKey = `MCP ${name} ${JSON.stringify(args)}`
  if (cacheMs > 0) {
    const hit = cache.get(cacheKey)
    if (hit && hit.expires > now) return hit.value
  }
  const response = await fetchImpl(config.mcpUrl, {
    method: 'POST',
    headers: {
      Accept: 'application/json, text/event-stream',
      'Content-Type': 'application/json',
      'MCP-Protocol-Version': '2025-03-26',
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } }),
  })
  const raw = await response.text()
  const value = { status: response.status, payload: parseMcpPayload(raw) }
  if (response.ok && cacheMs > 0) cache.set(cacheKey, { expires: now + cacheMs, value })
  return value
}
