/* eslint-env node */
import { emptySearch, normalizeKeywords, searchFromPerformance, aiRankingsFromResults } from './analyticsNormalize.js'
import { loadGa4 } from './analyticsGa4.js'
import { loadKeywordOverrides } from './keywordCategories.js'
import { openseoTool, readMcpToolResult } from './openseo.js'
import { previousAnalyticsRange } from '../src/lib/analyticsRange.js'

async function call(config, name, args, options) {
  try {
    const result = await openseoTool(config, name, args, options)
    if (!result || result.status < 200 || result.status >= 300) return null
    return readMcpToolResult(result.payload)
  } catch (error) {
    if (error?.code === 'tool_not_allowed') throw error
    return null
  }
}

async function rankRows(config, options) {
  const rows = []
  let run = null
  let offset = 0
  for (let page = 0; page < 6; page += 1) {
    const data = await call(config, 'get_rank_tracker', {
      projectId: config.projectId,
      trackerId: config.trackerId,
      offset,
      limit: 100,
    }, options)
    const batch = data?.results?.rows || data?.rows || []
    rows.push(...batch)
    run = data?.results?.run || data?.run || run
    const next = data?.results?.nextOffset
    if (next == null || !batch.length) break
    offset = next
  }
  return { rows, run }
}

async function aiRows(config, runId, options) {
  const rows = []
  let summaries = []
  let cursor = undefined
  for (let page = 0; page < 6; page += 1) {
    const data = await call(config, 'get_ai_visibility_results', {
      projectId: config.projectId,
      runId: runId || null,
      branded: 'all',
      limit: 50,
      ...(cursor ? { cursor } : {}),
    }, options)
    rows.push(...(data?.rows || []))
    if (Array.isArray(data?.summaries) && data.summaries.length) summaries = data.summaries
    if (!data?.nextCursor) break
    cursor = data.nextCursor
  }
  return { rows, summaries }
}

export async function loadOpenSeo(config, range, options = {}) {
  const toolOptions = { fetchImpl: options.fetchImpl, cacheMs: options.cacheMs ?? 0, now: options.now }
  const previous = previousAnalyticsRange(range)
  const [daily, queries, pages, previousDaily, tracker, trend, ga4, ranked] = await Promise.all([
    call(config, 'get_search_console_performance', { projectId: config.projectId, dimensions: ['date'], dateRange: range.openseo, rowLimit: 120 }, toolOptions),
    call(config, 'get_search_console_performance', { projectId: config.projectId, dimensions: ['query'], dateRange: range.openseo, rowLimit: 15 }, toolOptions),
    call(config, 'get_search_console_performance', { projectId: config.projectId, dimensions: ['page'], dateRange: range.openseo, rowLimit: 10 }, toolOptions),
    call(config, 'get_search_console_performance', { projectId: config.projectId, dimensions: ['date'], startDate: previous.startDate, endDate: previous.endDate, rowLimit: 120 }, toolOptions),
    call(config, 'get_ai_visibility_tracker', { projectId: config.projectId }, toolOptions),
    call(config, 'get_ai_visibility_trend', { projectId: config.projectId, days: 28 }, toolOptions),
    loadGa4(config, range, toolOptions),
    rankRows(config, toolOptions),
  ])
  const latestRun = (tracker?.recentRuns || []).find((run) => run.status === 'completed' || run.status === 'partial')
  const aiPage = await aiRows(config, latestRun?.id, toolOptions)
  const overrides = options.overrides || loadKeywordOverrides(options.overridesPath)
  const search = daily ? searchFromPerformance({ daily, queries, pages, previous: previousDaily }) : emptySearch('unavailable')
  const keywords = ranked.rows.length || ranked.run
    ? normalizeKeywords({ rows: ranked.rows, run: ranked.run }, { device: 'mobile', overrides })
    : { connected: false, reason: 'unavailable', rows: [], tracked: 0, ranking: 0, device: 'mobile', lastCheckedAt: null, runStatus: null }
  const ai = aiRankingsFromResults({ tracker, rows: aiPage.rows, summaries: aiPage.summaries, trend })
  return { search, keywords, ai, ga4 }
}
