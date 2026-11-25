/* eslint-env node */
import { emptySearch, normalizeKeywords, searchFromPerformance, aiRankingsFromResults, applyRankHistory } from './analyticsNormalize.js'
import { loadGa4 } from './analyticsGa4.js'
import { loadKeywordOverrides } from './keywordCategories.js'
import { openseoTool, readMcpToolResult } from './openseo.js'
import { comparisonWindow, formatComparisonDates, historyCovers, recentMonths, GSC_HISTORY_MONTHS, GA4_HISTORY_MONTHS } from '../src/lib/analyticsRange.js'

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

async function rankHistory(config, options) {
  const rows = []
  let runs = []
  let device = 'mobile'
  let offset = 0
  for (let page = 0; page < 4; page += 1) {
    const data = await call(config, 'get_rank_history', {
      projectId: config.projectId,
      trackerId: config.trackerId,
      device: 'mobile',
      runs: 4,
      offset,
      limit: 100,
    }, options)
    rows.push(...(data?.rows || []))
    runs = data?.runs || runs
    device = data?.device || device
    if (data?.nextOffset == null || !(data?.rows || []).length) break
    offset = data.nextOffset
  }
  return { rows, runs, device }
}

function citedUrlMap(sources) {
  const urls = {}
  for (const source of sources || []) {
    const url = source?.url || (source?.domain ? `https://${source.domain}` : '')
    if (!url || !/brandastic\.com/i.test(`${url} ${source?.domain || ''}`)) continue
    for (const id of source.observationIds || []) {
      if (id && !urls[id]) urls[id] = url
    }
  }
  return urls
}

async function aiSources(config, runId, options) {
  if (!runId) return []
  const rows = []
  let cursor
  for (let page = 0; page < 8; page += 1) {
    const data = await call(config, 'get_ai_visibility_sources', {
      projectId: config.projectId,
      runId,
      branded: 'all',
      ownership: 'own',
      groupBy: 'url',
      limit: 50,
      ...(cursor ? { cursor } : {}),
    }, options)
    rows.push(...(data?.rows || []))
    if (!data?.nextCursor) break
    cursor = data.nextCursor
  }
  return rows
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

function asNumber(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) return Number(value)
  return null
}

function isoDay(value) {
  const raw = String(value || '')
  if (/^\d{8}$/.test(raw)) return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`
  return raw.slice(0, 10)
}

function organicPoints(data) {
  return (data?.trend || []).map((row) => ({
    date: isoDay(row.date),
    sessions: asNumber(row.sessions),
    users: asNumber(row.activeUsers),
  })).filter((row) => row.date)
}

function sumKey(series, key) {
  let total = 0
  let seen = false
  for (const row of series || []) {
    if (typeof row[key] !== 'number') continue
    total += row[key]
    seen = true
  }
  return seen ? total : null
}

function missingComparisonNote(mode, covered) {
  if (mode === 'year') return 'No data for last year'
  if (!covered) return 'This comparison is older than the available history, so it is not shown.'
  return 'No data for that comparison period.'
}

function monthValue(series, month, key) {
  let total = 0
  let seen = false
  for (const row of series || []) {
    if (!String(row.date || '').startsWith(month)) continue
    if (typeof row[key] !== 'number') continue
    total += row[key]
    seen = true
  }
  return seen ? total : null
}

export async function loadOpenSeo(config, range, options = {}) {
  const toolOptions = { fetchImpl: options.fetchImpl, cacheMs: options.cacheMs ?? 0, now: options.now }
  const compare = comparisonWindow(range, options.compare || 'period')
  const gscCompareOk = Boolean(compare) && historyCovers(compare.startDate, options.now ? new Date(options.now) : new Date(), GSC_HISTORY_MONTHS)
  const ga4CompareOk = Boolean(compare) && historyCovers(compare.startDate, options.now ? new Date(options.now) : new Date(), GA4_HISTORY_MONTHS)
  const historyStart = recentMonths(range.endDate, 13)[0] ? `${recentMonths(range.endDate, 13)[0]}-01` : range.startDate
  const [daily, queries, pages, previousDaily, historyDaily, organicNow, organicCompare, organicHistory, tracker, trend, ga4, ranked, history] = await Promise.all([
    call(config, 'get_search_console_performance', { projectId: config.projectId, dimensions: ['date'], startDate: range.startDate, endDate: range.endDate, rowLimit: 500 }, toolOptions),
    call(config, 'get_search_console_performance', { projectId: config.projectId, dimensions: ['query'], startDate: range.startDate, endDate: range.endDate, rowLimit: 15 }, toolOptions),
    call(config, 'get_search_console_performance', { projectId: config.projectId, dimensions: ['page'], startDate: range.startDate, endDate: range.endDate, rowLimit: 10 }, toolOptions),
    gscCompareOk ? call(config, 'get_search_console_performance', { projectId: config.projectId, dimensions: ['date'], startDate: compare.startDate, endDate: compare.endDate, rowLimit: 500 }, toolOptions) : Promise.resolve(null),
    historyCovers(historyStart, options.now ? new Date(options.now) : new Date(), GSC_HISTORY_MONTHS)
      ? call(config, 'get_search_console_performance', { projectId: config.projectId, dimensions: ['date'], startDate: historyStart, endDate: range.endDate, rowLimit: 500 }, toolOptions)
      : Promise.resolve(null),
    call(config, 'get_google_analytics_organic_overview', { projectId: config.projectId, startDate: range.startDate, endDate: range.endDate, trend: 'daily' }, toolOptions),
    ga4CompareOk ? call(config, 'get_google_analytics_organic_overview', { projectId: config.projectId, startDate: compare.startDate, endDate: compare.endDate, trend: 'daily' }, toolOptions) : Promise.resolve(null),
    call(config, 'get_google_analytics_organic_overview', { projectId: config.projectId, startDate: historyStart, endDate: range.endDate, trend: 'daily' }, toolOptions),
    call(config, 'get_ai_visibility_tracker', { projectId: config.projectId }, toolOptions),
    call(config, 'get_ai_visibility_trend', { projectId: config.projectId, days: 28 }, toolOptions),
    loadGa4(config, range, toolOptions),
    rankRows(config, toolOptions),
    rankHistory(config, toolOptions),
  ])
  const latestRun = (tracker?.recentRuns || []).find((run) => run.status === 'completed' || run.status === 'partial')
  const [aiPage, sources] = await Promise.all([
    aiRows(config, latestRun?.id, toolOptions),
    aiSources(config, latestRun?.id, toolOptions),
  ])
  const overrides = options.overrides || loadKeywordOverrides(options.overridesPath)
  const search = daily ? searchFromPerformance({ daily, queries, pages, previous: previousDaily }) : emptySearch('unavailable')
  const compareDates = formatComparisonDates(compare?.startDate, compare?.endDate)
  const searchAvailable = Boolean(gscCompareOk && previousDaily && previousDaily.ok !== false && (previousDaily.rows || []).length)
  search.compare = {
    mode: compare?.mode || 'period',
    label: compare?.label || 'Previous period',
    dates: compareDates,
    startDate: compare?.startDate || null,
    endDate: compare?.endDate || null,
    available: search.connected ? searchAvailable : false,
    note: search.connected && searchAvailable ? '' : missingComparisonNote(compare?.mode || 'period', gscCompareOk),
  }
  if (!searchAvailable) search.previous = null
  const organicSeries = organicPoints(organicNow)
  const organicCompareSeries = organicPoints(organicCompare)
  const historySessions = organicPoints(organicHistory)
  const historyClicks = (historyDaily?.rows || []).map((row) => ({ date: isoDay(row.keys?.[0]), clicks: asNumber(row.clicks) }))
  const months = recentMonths(range.endDate, 13).map((month) => ({
    month,
    sessions: monthValue(historySessions, month, 'sessions'),
    clicks: monthValue(historyClicks, month, 'clicks'),
  }))
  if (ga4) {
    ga4.organic = {
      sessions: asNumber(organicNow?.current?.sessions) ?? sumKey(organicSeries, 'sessions'),
      users: asNumber(organicNow?.current?.activeUsers) ?? sumKey(organicSeries, 'users'),
      series: organicSeries,
      compare: {
        mode: compare?.mode || 'period',
        label: compare?.label || 'Previous period',
        dates: compareDates,
        startDate: compare?.startDate || null,
        endDate: compare?.endDate || null,
        available: Boolean(ga4CompareOk && (asNumber(organicCompare?.current?.sessions) != null || organicCompareSeries.some((row) => row.sessions != null))),
        note: '',
        sessions: asNumber(organicCompare?.current?.sessions) ?? sumKey(organicCompareSeries, 'sessions'),
        users: asNumber(organicCompare?.current?.activeUsers) ?? sumKey(organicCompareSeries, 'users'),
        series: organicCompareSeries,
      },
    }
    ga4.organic.compare.note = ga4.organic.compare.available ? '' : missingComparisonNote(compare?.mode || 'period', ga4CompareOk)
    if (!ga4.organic.compare.available) {
      ga4.organic.compare.sessions = null
      ga4.organic.compare.users = null
      ga4.organic.compare.series = []
    }
    ga4.monthly = months
  }
  const keywords = applyRankHistory(
    ranked.rows.length || ranked.run
      ? normalizeKeywords({ rows: ranked.rows, run: ranked.run }, { device: 'mobile', overrides })
      : { connected: false, reason: 'unavailable', rows: [], tracked: 0, ranking: 0, device: 'mobile', lastCheckedAt: null, runStatus: null },
    history,
  )
  const ai = aiRankingsFromResults({ tracker, rows: aiPage.rows, summaries: aiPage.summaries, trend, citedUrls: citedUrlMap(sources) })
  return { search, keywords, ai, ga4 }
}
