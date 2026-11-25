/* eslint-env node */
import { assignKeywordCategory } from './keywordCategories.js'

const ENGINE_LABELS = {
  chatgpt: 'ChatGPT',
  gemini: 'Gemini',
  google_ai_overview: 'Google AI Overviews',
  google_ai_mode: 'Google AI Mode',
  claude: 'Claude',
  perplexity: 'Perplexity',
}

function unwrap(payload) {
  if (!payload || typeof payload !== 'object') return null
  if (payload.ok === true && payload.data && typeof payload.data === 'object') return payload.data
  return payload
}

function num(value) {
  const number = typeof value === 'string' && value.trim() !== '' ? Number(value) : value
  return typeof number === 'number' && Number.isFinite(number) ? number : null
}

function text(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function round1(value) {
  return value == null ? null : Math.round(value * 10) / 10
}

export function emptyGa4(reason) {
  return {
    connected: false,
    reason,
    property: null,
    users: null,
    sessions: null,
    engagedSessions: null,
    keyEvents: null,
    previous: null,
    series: [],
    channels: [],
    pages: [],
    devices: [],
    countries: [],
    events: [],
  }
}

function ga4Date(value) {
  const raw = text(value)
  if (!raw) return null
  if (/^\d{8}$/.test(raw)) return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`
  return raw.slice(0, 10)
}

function metric(row, key) {
  if (!row || typeof row !== 'object') return null
  const direct = num(row[key])
  if (direct != null) return direct
  const nested = row.metrics?.[key]
  if (nested && typeof nested === 'object') return num(nested.current ?? nested.value)
  return num(nested)
}

function previousMetric(row, key) {
  const nested = row?.metrics?.[key]
  if (nested && typeof nested === 'object') return num(nested.previous)
  return null
}

function labelOf(row, keys) {
  const host = text(row?.hostName) || text(row?.dimensions?.hostName)
  const path = text(row?.pagePath) || text(row?.landingPage) || text(row?.dimensions?.pagePath) || text(row?.dimensions?.landingPage)
  if (host && path) return `${host}${path.startsWith('/') ? path : `/${path}`}`
  for (const key of keys) {
    const value = text(row?.[key]) || text(row?.dimensions?.[key])
    if (value) return value
  }
  return host || path || null
}

function reportRows(data) {
  if (!data || data.status === 'error') return []
  if (Array.isArray(data.rows)) return data.rows
  if (Array.isArray(data.trend)) return data.trend
  return []
}

export function ga4ErrorCode(data) {
  if (!data || typeof data !== 'object') return null
  return text(data.error?.code) || text(data.code) || (data.status === 'error' ? 'ga4_unavailable' : null)
}

export function normalizeGa4({ overview, channels, pages, events, devices, countries } = {}) {
  const parts = [overview, channels, pages, events, devices, countries].filter(Boolean)
  const codes = parts.map(ga4ErrorCode).filter(Boolean)
  if (codes.some((code) => code === 'ga4_not_connected' || code === 'ga4_property_inaccessible' || code === 'ga4_reconnect_required')) {
    return emptyGa4('ga4_not_connected')
  }
  if (!overview && !channels) return emptyGa4('unavailable')
  const current = overview?.current || overview?.totals || null
  const previousRow = overview?.previous || overview?.prevTotals || null
  const channelRows = reportRows(channels)
  const compared = Array.isArray(channels?.comparison?.rows) ? channels.comparison.rows : []
  const sum = (rows, key) => {
    let total = 0
    let seen = false
    for (const row of rows) {
      const value = metric(row, key)
      if (value != null) {
        total += value
        seen = true
      }
    }
    return seen ? total : null
  }
  const sumPrevious = (key) => {
    let total = 0
    let seen = false
    for (const row of compared) {
      const value = previousMetric(row, key)
      if (value != null) {
        total += value
        seen = true
      }
    }
    return seen ? total : null
  }
  const users = sum(channelRows, 'activeUsers') ?? metric(current, 'activeUsers')
  const sessions = sum(channelRows, 'sessions') ?? metric(current, 'sessions')
  const engagedSessions = sum(channelRows, 'engagedSessions') ?? metric(current, 'engagedSessions')
  const keyEvents = sum(channelRows, 'keyEvents') ?? metric(current, 'keyEvents')
  const previous = {
    users: sumPrevious('activeUsers') ?? metric(previousRow, 'activeUsers'),
    sessions: sumPrevious('sessions') ?? metric(previousRow, 'sessions'),
    engagedSessions: sumPrevious('engagedSessions') ?? metric(previousRow, 'engagedSessions'),
    keyEvents: sumPrevious('keyEvents') ?? metric(previousRow, 'keyEvents'),
  }
  const series = (Array.isArray(overview?.trend) ? overview.trend : []).map((row) => ({
    date: ga4Date(row.date || row.dimensions?.date),
    sessions: metric(row, 'sessions'),
    users: metric(row, 'activeUsers'),
    engagedSessions: metric(row, 'engagedSessions'),
    keyEvents: metric(row, 'keyEvents'),
  })).filter((row) => row.date)
  const channelsOut = channelRows.map((row) => ({
    label: labelOf(row, ['sessionDefaultChannelGroup', 'channel']),
    sessions: metric(row, 'sessions') ?? 0,
    users: metric(row, 'activeUsers'),
    keyEvents: metric(row, 'keyEvents'),
  })).filter((row) => row.label).slice(0, 12)
  const pagesOut = reportRows(pages).map((row) => ({
    label: labelOf(row, ['pagePath', 'landingPage', 'page']),
    value: metric(row, 'screenPageViews') ?? metric(row, 'sessions') ?? 0,
  })).filter((row) => row.label).slice(0, 8)
  const devicesOut = reportRows(devices).map((row) => ({
    label: labelOf(row, ['deviceCategory', 'device']),
    value: metric(row, 'sessions') ?? metric(row, 'activeUsers') ?? 0,
  })).filter((row) => row.label)
  const countriesOut = reportRows(countries).map((row) => ({
    label: labelOf(row, ['country']),
    value: metric(row, 'sessions') ?? metric(row, 'activeUsers') ?? 0,
  })).filter((row) => row.label).slice(0, 8)
  const eventsOut = reportRows(events).map((row) => ({
    label: labelOf(row, ['eventName', 'event']),
    value: metric(row, 'keyEvents') ?? 0,
  })).filter((row) => row.label).slice(0, 8)
  const connected = users != null || sessions != null || series.length > 0 || channelsOut.length > 0
  if (!connected) return emptyGa4(codes.length ? 'unavailable' : 'ga4_not_connected')
  return {
    connected: true,
    reason: null,
    property: text(overview?.source?.propertyDisplayName) || text(overview?.source?.propertyId),
    users,
    sessions,
    engagedSessions,
    keyEvents,
    previous,
    series,
    channels: channelsOut,
    pages: pagesOut,
    devices: devicesOut,
    countries: countriesOut,
    events: eventsOut,
  }
}

export function emptySearch(reason) {
  return {
    connected: false,
    reason,
    totals: null,
    previous: null,
    series: [],
    queries: [],
    pages: [],
  }
}

function metricRow(row) {
  if (!row || typeof row !== 'object') return null
  const key = text(row.key) || text(row.query) || text(row.page) || text(row.keys?.[0])
  if (!key) return null
  return {
    key,
    clicks: num(row.clicks) ?? 0,
    impressions: num(row.impressions) ?? 0,
    ctr: num(row.ctr),
    position: num(row.position),
  }
}

export function normalizeSearch(report, queries, pages) {
  const data = unwrap(report)
  if (!data || data.connected === false) return emptySearch('not_connected')
  const totals = data.totals && typeof data.totals === 'object' ? data.totals : null
  const prev = data.prevTotals && typeof data.prevTotals === 'object' ? data.prevTotals : null
  const series = Array.isArray(data.trend) ? data.trend.map((row) => ({
    date: text(row.date),
    clicks: num(row.clicks) ?? 0,
    impressions: num(row.impressions) ?? 0,
    ctr: num(row.ctr),
    position: num(row.position),
  })).filter((row) => row.date) : []
  if (!totals && !series.length) return emptySearch('not_connected')
  const queryRows = unwrap(queries)
  const pageRows = unwrap(pages)
  return {
    connected: true,
    reason: null,
    totals: totals ? {
      clicks: num(totals.clicks) ?? 0,
      impressions: num(totals.impressions) ?? 0,
      ctr: num(totals.ctr),
      position: num(totals.position),
    } : null,
    previous: prev ? {
      clicks: num(prev.clicks) ?? 0,
      impressions: num(prev.impressions) ?? 0,
      ctr: num(prev.ctr),
      position: num(prev.position),
    } : null,
    series,
    queries: (Array.isArray(queryRows?.rows) ? queryRows.rows : []).map(metricRow).filter(Boolean).slice(0, 25),
    pages: (Array.isArray(pageRows?.rows) ? pageRows.rows : []).map(metricRow).filter(Boolean).slice(0, 25),
  }
}

function historyPoints(value) {
  if (!Array.isArray(value)) return []
  return value.slice(0, 12).map((point) => ({
    checkedAt: text(point?.checkedAt) || text(point?.date),
    position: num(point?.position),
    checked: point?.checked !== false,
  })).filter((point) => point.checkedAt || point.position != null)
}

function notCheckedNames(run) {
  const message = String(run?.errorMessage || '')
  const tail = message.split(/not checked:/i)[1] || ''
  return new Set([...tail.matchAll(/"([^"]+)"/g)].map((match) => match[1].trim().toLowerCase()))
}

function deviceBlock(row, device) {
  const block = row?.[device] && typeof row[device] === 'object' ? row[device] : row
  return {
    position: num(block?.position),
    previous: num(block?.previousPosition ?? block?.previous),
    url: text(block?.rankingUrl) || text(block?.url) || text(row?.rankingUrl) || text(row?.url),
    checkedAt: text(block?.checkedAt) || text(row?.checkedAt) || text(row?.lastCheckedAt),
    checked: block?.checked !== false && row?.checked !== false,
    history: historyPoints(block?.history || row?.history),
  }
}

export function normalizeKeywords(payload, { device = 'mobile', overrides = {} } = {}) {
  const data = unwrap(payload)
  if (!data) return { connected: false, reason: 'unavailable', rows: [], tracked: 0, ranking: 0 }
  const source = Array.isArray(data) ? data : data.results?.rows || data.rows || data.keywords || []
  if (!Array.isArray(source)) return { connected: false, reason: 'unavailable', rows: [], tracked: 0, ranking: 0 }
  const run = data.results?.run || data.run || null
  const skipped = notCheckedNames(run)
  const rows = source.map((row) => {
    const keyword = text(row?.keyword)
    if (!keyword) return null
    const stats = deviceBlock(row, device)
    const notChecked = row?.checked === false || row?.[device]?.checked === false || skipped.has(keyword.toLowerCase())
    const ranking = !notChecked && stats.position != null && stats.position > 0
    const best = stats.history.map((point) => point.position).filter((position) => position != null && position > 0)
    const change = stats.position != null && stats.previous != null ? round1(stats.previous - stats.position) : null
    const tags = Array.isArray(row.tags) ? row.tags.filter((tag) => typeof tag === 'string' && tag.trim()).slice(0, 8) : []
    return {
      id: text(row.trackingKeywordId) || text(row.id) || keyword,
      keyword,
      category: assignKeywordCategory(keyword, overrides),
      tags,
      rankingUrl: stats.url,
      position: ranking ? stats.position : null,
      previousPosition: notChecked ? null : stats.previous,
      change: ranking ? change : null,
      bestPosition: best.length ? Math.min(...best) : null,
      volume: num(row.searchVolume ?? row.volume),
      kd: num(row.keywordDifficulty ?? row.difficulty ?? row.kd),
      cpc: num(row.cpc),
      lastChecked: stats.checkedAt,
      history: stats.history,
      ranking,
      checked: !notChecked,
    }
  }).filter(Boolean)
  return {
    connected: true,
    reason: null,
    device,
    tracked: rows.length,
    ranking: rows.filter((row) => row.ranking).length,
    lastCheckedAt: text(run?.lastCheckedAt) || text(run?.completedAt) || rows.find((row) => row.lastChecked)?.lastChecked || null,
    runStatus: text(run?.status),
    rows,
  }
}

function ownBrand(brands) {
  if (!Array.isArray(brands)) return null
  return brands.find((brand) => brand?.own === true) || brands.find((brand) => /brandastic/i.test(String(brand?.name || brand?.domain || ''))) || null
}

function observationRows(data) {
  if (Array.isArray(data?.rows)) return data.rows
  if (Array.isArray(data?.observations)) return data.observations
  if (Array.isArray(data?.cells)) return data.cells
  if (Array.isArray(data?.result?.rows)) return data.result.rows
  return []
}

function promptList(data) {
  const prompts = data?.prompts || data?.tracker?.prompts || data?.result?.prompts || []
  return Array.isArray(prompts) ? prompts : []
}

export function normalizeAi(settingsPayload, resultsPayload) {
  const settings = unwrap(settingsPayload) || {}
  const results = unwrap(resultsPayload) || {}
  const configured = settings.configured !== false && settings.tracker?.enabled !== false
  if (settings.configured === false) {
    return { connected: false, reason: 'not_connected', score: null, trend: null, prompts: [] }
  }
  const prompts = new Map()
  for (const prompt of promptList(settings).concat(promptList(results))) {
    const id = text(prompt.id) || text(prompt.promptId)
    const textValue = text(prompt.text) || text(prompt.prompt)
    if (!textValue) continue
    const key = id || textValue
    prompts.set(key, {
      id: key,
      prompt: textValue,
      topic: text(prompt.topic),
      paused: prompt.paused === true || prompt.active === false,
      engines: [],
    })
  }
  for (const row of observationRows(results)) {
    const promptText = text(row.prompt) || text(row.text)
    const promptId = text(row.promptId) || promptText
    if (!promptId && !promptText) continue
    const key = [...prompts.keys()].find((id) => id === promptId || prompts.get(id)?.prompt === promptText) || promptId || promptText
    if (!prompts.has(key)) {
      prompts.set(key, { id: key, prompt: promptText || key, topic: text(row.topic), paused: false, engines: [] })
    }
    const own = ownBrand(row.brands)
    const mentioned = own ? own.mentioned === true : row.mentioned === true ? true : row.mentioned === false ? false : null
    const cited = own ? own.cited === true : row.cited === true ? true : row.cited === false ? false : null
    const engine = text(row.engine) || 'chatgpt'
    const position = num(row.position ?? row.rank ?? own?.position)
    prompts.get(key).engines.push({
      engine,
      label: ENGINE_LABELS[engine] || engine,
      mentioned,
      cited,
      citedUrl: text(row.citedUrl) || text(row.citationUrl) || text(own?.citedUrl) || text(own?.url),
      position: position != null && position > 0 && position <= 20 ? position : null,
      checkedAt: text(row.collectedAt) || text(row.checkedAt) || text(results.run?.completedAt),
      status: text(row.answerStatus) || text(row.status) || 'completed',
    })
  }
  const summary = Array.isArray(results.summaries) ? results.summaries.find((item) => item?.own === true) : null
  const mentions = results.mentions || results.comparison || null
  const score = num(mentions?.current ?? mentions?.mentionRate ?? (summary && summary.answers ? (summary.mentions / summary.answers) * 100 : null))
  const comparable = results.comparison === 'comparable' || mentions?.status === 'comparable' || (mentions && mentions.change != null)
  const trend = comparable ? num(mentions?.change ?? mentions?.mentionChange) : null
  const list = [...prompts.values()]
  const checked = list.some((prompt) => prompt.engines.length > 0)
  return {
    connected: configured || checked || list.length > 0,
    reason: list.length || checked ? null : 'empty',
    score: score == null ? null : round1(score),
    citationRate: num(results.citations?.current ?? null),
    trend,
    trendStatus: text(results.comparison) || (trend == null ? 'no_previous' : 'comparable'),
    lastChecked: text(results.run?.completedAt) || list.flatMap((prompt) => prompt.engines).map((engine) => engine.checkedAt).filter(Boolean).sort().at(-1) || null,
    schedule: text(settings.tracker?.scheduleInterval),
    nextCheckAt: text(settings.tracker?.nextCheckAt),
    prompts: list,
    voices: (Array.isArray(results.summaries) ? results.summaries : [])
      .filter((item) => item && (item.name || item.domain))
      .map((item) => ({
        name: text(item.name) || text(item.domain),
        mentions: num(item.mentions) ?? 0,
        citations: num(item.citations) ?? 0,
        own: item.own === true,
      })),
  }
}
