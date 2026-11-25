/* eslint-env node */
import { emptyGa4, ga4ErrorCode, normalizeGa4 } from './analyticsNormalize.js'
import { openseoTool, readMcpToolResult } from './openseo.js'

function unwrap(result) {
  if (!result || result.status < 200 || result.status >= 300) return null
  return readMcpToolResult(result.payload)
}

export async function loadGa4(config, range, options = {}) {
  if (!config?.configured) return emptyGa4('not_configured')
  const fetchImpl = options.fetchImpl || fetch
  const call = (name, args) => openseoTool(config, name, { projectId: config.projectId, startDate: range.startDate, endDate: range.endDate, ...args }, {
    fetchImpl,
    cacheMs: options.cacheMs ?? 0,
    now: options.now,
  }).catch(() => null)
  try {
    const [overview, channels, pages, events, devices, countries] = await Promise.all([
      call('get_google_analytics_organic_overview', { trend: 'daily' }),
      call('get_google_analytics_traffic_acquisition', { breakdown: 'channel_group', comparePreviousPeriod: true, limit: 20 }),
      call('get_google_analytics_page_performance', { channel: 'all', limit: 8 }),
      call('get_google_analytics_key_events', { channel: 'all', breakdown: 'event', comparePreviousPeriod: true, limit: 8 }),
      call('get_google_analytics_audience_breakdown', { breakdown: 'device', channel: 'all', limit: 10 }),
      call('get_google_analytics_audience_breakdown', { breakdown: 'country', channel: 'all', limit: 8 }),
    ])
    const unpacked = {
      overview: unwrap(overview),
      channels: unwrap(channels),
      pages: unwrap(pages),
      events: unwrap(events),
      devices: unwrap(devices),
      countries: unwrap(countries),
    }
    const codes = Object.values(unpacked).map(ga4ErrorCode).filter(Boolean)
    if (codes.some((code) => code.startsWith('ga4_not') || code === 'ga4_property_inaccessible' || code === 'ga4_reconnect_required')) {
      return emptyGa4('ga4_not_connected')
    }
    return normalizeGa4(unpacked)
  } catch {
    return emptyGa4('unavailable')
  }
}
