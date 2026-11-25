import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { assignKeywordCategory } from '../server/keywordCategories.js'
import { aiRankingsFromResults, applyRankHistory, normalizeAi, normalizeGa4, normalizeKeywords, normalizeSearch } from '../server/analyticsNormalize.js'
import { openseoTool, readMcpToolResult } from '../server/openseo.js'
import { handleAnalytics } from '../server/analyticsHttp.js'
import { cooldownDecision, startRankCheck } from '../server/analyticsRankCheck.js'
import { salesSnapshot } from '../src/lib/analyticsSales.js'
import { comparisonWindow, formatComparisonDates, resolveAnalyticsRange } from '../src/lib/analyticsRange.js'
import { loadOpenSeo } from '../server/analyticsReads.js'
import { engineAppearances, groupAiPrompts } from '../src/lib/aiCards.js'
import { averageRank, isRankingKeyword, rankMeaning, rankSummary } from '../src/lib/rankPages.js'

const JUSTIN = 'justin.sample@example.test'
const SANDY = 'sandy.sample@example.test'
const ALLOWED = `${JUSTIN}, ${SANDY}`

function allow(email) {
  return async () => ({ email })
}

describe('keyword categories', () => {
  it('assigns the education, brand, local, seo, social, and other rules', () => {
    assert.equal(assignKeywordCategory('school marketing agency california'), 'education')
    assert.equal(assignKeywordCategory('private school marketing agency orange county'), 'education')
    assert.equal(assignKeywordCategory('brandastic'), 'brand')
    assert.equal(assignKeywordCategory('brandtastic seo'), 'brand')
    assert.equal(assignKeywordCategory('what is tiktok'), 'social')
    assert.equal(assignKeywordCategory('why is tiktok so popular'), 'social')
    assert.equal(assignKeywordCategory('what is a link profile'), 'seo')
    assert.equal(assignKeywordCategory('organic search engine optimisation'), 'seo')
    assert.equal(assignKeywordCategory('advertising agency in orange county'), 'digital')
    assert.equal(assignKeywordCategory('social media agency costa mesa'), 'digital')
    assert.equal(assignKeywordCategory('osi express'), 'other')
  })

  it('lets the mapping file override a rule', () => {
    assert.equal(assignKeywordCategory('osi express', { 'osi express': 'brand' }), 'brand')
  })
})

describe('rank rows', () => {
  it('keeps only a found position and drops a not-checked keyword that still has a stale rank', () => {
    const parsed = normalizeKeywords({
      rows: [
        { trackingKeywordId: 'a', keyword: 'ad agency in orange county', searchVolume: 90, keywordDifficulty: 4, cpc: 3.5, mobile: { position: 7, previousPosition: 9, rankingUrl: 'https://brandastic.com/', checkedAt: '2026-11-21T21:47:42.987Z', history: [{ checkedAt: '2026-11-20', position: 8 }, { checkedAt: '2026-11-21', position: 7 }] } },
        { trackingKeywordId: 'b', keyword: 'private school seo', mobile: { position: null, previousPosition: null, checkedAt: '2026-11-21T21:47:42.987Z' } },
        { trackingKeywordId: 'c', keyword: 'what is tiktok', mobile: { position: 5, previousPosition: 5, checkedAt: '2026-11-20T00:00:00.000Z' } },
      ],
      run: { status: 'completed', completedAt: '2026-11-21T21:47:42.987Z', errorMessage: 'Checked 2 of 3 keyword(s). Not checked: "what is tiktok".' },
    })
    assert.equal(parsed.tracked, 3)
    assert.equal(parsed.ranking, 1)
    const ranking = parsed.rows.find((row) => row.keyword.startsWith('ad agency'))
    assert.equal(ranking.category, 'digital')
    assert.equal(ranking.position, 7)
    assert.equal(ranking.change, 2)
    assert.equal(ranking.bestPosition, 7)
    assert.equal(ranking.volume, 90)
    assert.equal(parsed.rows.find((row) => row.keyword === 'what is tiktok').ranking, false)
    assert.equal(parsed.rows.find((row) => row.keyword === 'what is tiktok').position, null)
  })

  it('fills a blank tracker position from the completed rank history', () => {
    const parsed = normalizeKeywords({
      rows: [
        { trackingKeywordId: 'a', keyword: 'ad agency in orange county', searchVolume: 90, mobile: { position: null, checked: false } },
      ],
      run: { status: 'partial', errorMessage: 'Not checked: "ad agency in orange county".' },
    })
    const withHistory = applyRankHistory(parsed, {
      device: 'mobile',
      runs: [{ runId: 'run-1', checkedAt: '2026-11-21T21:31:00.000Z' }],
      rows: [{
        trackingKeywordId: 'a',
        keyword: 'ad agency in orange county',
        history: [
          { checkedAt: '2026-11-21T21:31:00.000Z', position: 7, checked: true },
          { checkedAt: '2026-11-21T17:06:00.000Z', position: 5, checked: true },
        ],
      }],
    })
    const row = withHistory.rows[0]
    assert.equal(row.position, 7)
    assert.equal(row.previousPosition, 5)
    assert.equal(row.change, -2)
    assert.equal(row.ranking, true)
    assert.equal(row.checked, true)
  })
})

describe('rank page labels', () => {
  it('maps a Google position to the page it lands on', () => {
    assert.equal(rankMeaning(1), 'Page 1, top 3')
    assert.equal(rankMeaning(3), 'Page 1, top 3')
    assert.equal(rankMeaning(4), 'Page 1')
    assert.equal(rankMeaning(10), 'Page 1')
    assert.equal(rankMeaning(11), 'Page 2')
    assert.equal(rankMeaning(20), 'Page 2')
    assert.equal(rankMeaning(21), 'Page 3')
    assert.equal(rankMeaning(30), 'Page 3')
    assert.equal(rankMeaning(31), 'Page 4')
    assert.equal(rankMeaning(40), 'Page 4')
    assert.equal(rankMeaning(null), 'Not in top 4 pages')
  })

  it('counts the summary buckets without overlap', () => {
    const summary = rankSummary([
      { position: 2 },
      { position: 8 },
      { position: 14 },
      { position: 25 },
      { position: 36 },
      { position: null },
    ])
    assert.deepEqual(summary.map((item) => [item.label, item.count]), [
      ['Page 1, top 3', 1],
      ['Page 1', 1],
      ['Page 2', 1],
      ['Pages 3-4', 2],
      ['Not ranking', 1],
    ])
  })

  it('keeps only a top-40 position in the default list and averages those ranks', () => {
    const rows = [
      { keyword: 'ranked', position: 7 },
      { keyword: 'deep', position: 41 },
      { keyword: 'missing', position: null },
    ]
    assert.equal(rows.filter(isRankingKeyword).length, 1)
    assert.equal(averageRank(rows), 7)
    assert.equal(averageRank([{ position: 4 }, { position: 8 }]), 6)
    assert.equal(averageRank([{ position: null }]), null)
  })
})

describe('organic comparison ranges', () => {
  const now = new Date('2026-11-25T18:00:00.000Z')

  it('uses the nine preset windows', () => {
    assert.deepEqual(resolveAnalyticsRange('7', now), expectRange('7', 'Last 7 days', '2026-11-19', '2026-11-25'))
    assert.equal(resolveAnalyticsRange('30', now).startDate, '2026-10-27')
    assert.equal(resolveAnalyticsRange('60', now).days, 60)
    assert.equal(resolveAnalyticsRange('this-month', now).startDate, '2026-11-01')
    assert.equal(resolveAnalyticsRange('last-month', now).endDate, '2026-10-31')
    assert.equal(resolveAnalyticsRange('ytd', now).startDate, '2026-01-01')
    assert.equal(resolveAnalyticsRange('12', now).startDate, '2025-11-25')
    assert.equal(resolveAnalyticsRange('custom', now, { start: '2026-10-01', end: '2026-10-15' }).days, 15)
  })

  it('compares a preset with the previous period, previous month, and last year', () => {
    const range = resolveAnalyticsRange('30', now)
    assert.equal(comparisonWindow(range, 'period').endDate, '2026-10-26')
    assert.equal(comparisonWindow(range, 'month').startDate, '2026-09-27')
    assert.equal(comparisonWindow(range, 'year').startDate, '2025-10-27')
    assert.equal(comparisonWindow(range, 'year').endDate, '2025-11-25')
    assert.equal(formatComparisonDates('2025-10-26', '2025-11-22'), 'Oct 26-Nov 22, 2025')
  })

  it('re-fetches a different window for each comparison and says when last year is missing', async () => {
    const now = new Date('2026-11-25T18:00:00.000Z')
    const range = resolveAnalyticsRange('30', now)
    const calls = []
    const fetchImpl = async (_url, init) => {
      const body = JSON.parse(init.body)
      const args = body.params.arguments
      calls.push({ name: body.params.name, startDate: args.startDate, endDate: args.endDate })
      const sessions = { '2026-10-27': 464, '2026-09-27': 636, '2026-09-27-month': 620, '2025-10-27': 654 }[args.endDate === '2026-10-25' ? '2026-09-27-month' : args.startDate] || 1
      const payload = body.params.name === 'get_google_analytics_organic_overview'
        ? { current: { sessions, activeUsers: 10 }, trend: [{ date: String(args.startDate || '').replaceAll('-', ''), sessions: 4, activeUsers: 2 }, { date: String(args.endDate || '').replaceAll('-', ''), sessions: 5, activeUsers: 3 }] }
        : body.params.name === 'get_search_console_performance'
          ? { ok: true, rows: [{ keys: [args.startDate], clicks: sessions, impressions: 100, ctr: 0.1, position: 8 }, { keys: [args.endDate], clicks: 2, impressions: 80, ctr: 0.02, position: 9 }] }
          : {}
      return { status: 200, text: async () => JSON.stringify({ jsonrpc: '2.0', id: 1, result: { structuredContent: payload } }) }
    }
    const config = { configured: true, apiKey: 'oseo_test', mcpUrl: 'https://example.test/mcp', projectId: 'p', trackerId: 't' }
    const period = await loadOpenSeo(config, range, { fetchImpl, compare: 'period', now: now.getTime(), cacheMs: 0, overrides: {} })
    const month = await loadOpenSeo(config, range, { fetchImpl, compare: 'month', now: now.getTime(), cacheMs: 0, overrides: {} })
    const year = await loadOpenSeo(config, range, { fetchImpl, compare: 'year', now: now.getTime(), cacheMs: 0, overrides: {} })
    assert.equal(period.ga4.organic.compare.sessions, 636)
    assert.equal(period.ga4.organic.compare.dates, 'Sep 27-Oct 26, 2026')
    assert.equal(month.ga4.organic.compare.sessions, 620)
    assert.equal(month.ga4.organic.compare.dates, 'Sep 27-Oct 25, 2026')
    assert.equal(year.ga4.organic.compare.sessions, 654)
    assert.equal(year.ga4.organic.compare.dates, 'Oct 27-Nov 25, 2025')
    assert.equal(year.search.previous.clicks > 0, true)
    assert.equal(calls.some((call) => call.name === 'get_google_analytics_organic_overview' && call.startDate === '2025-10-27'), true)
    const old = resolveAnalyticsRange('12', now)
    calls.length = 0
    const missing = await loadOpenSeo(config, old, { fetchImpl, compare: 'year', now: now.getTime(), cacheMs: 0, overrides: {} })
    assert.equal(missing.ga4.organic.compare.available, false)
    assert.equal(missing.ga4.organic.compare.sessions, null)
    assert.equal(missing.ga4.organic.compare.note, 'No data for last year')
    assert.equal(calls.some((call) => call.startDate && call.startDate < '2025-09-25'), false)
  })
})

function expectRange(id, label, startDate, endDate) {
  const range = resolveAnalyticsRange(id, new Date('2026-11-25T18:00:00.000Z'))
  assert.equal(range.id, id)
  assert.equal(range.label, label)
  assert.equal(range.startDate, startDate)
  assert.equal(range.endDate, endDate)
  return range
}

describe('search console normalize', () => {
  it('returns an empty state instead of zeroes when Search Console is not connected', () => {
    const parsed = normalizeSearch({ connected: false })
    assert.equal(parsed.connected, false)
    assert.equal(parsed.totals, null)
    assert.deepEqual(parsed.series, [])
  })
})

describe('ai visibility normalize', () => {
  it('reads prompts and answers wrapped by the OpenSEO success envelope', () => {
    const tracker = readMcpToolResult({
      result: {
        structuredContent: {
          status: 'success',
          data: {
            prompts: [{ id: 'p1', text: 'best school marketing agency in California', topic: 'Education', paused: true }],
            recentRuns: [{ id: 'run-1', status: 'completed', trigger: 'manual' }],
          },
        },
      },
    })
    const results = readMcpToolResult({
      result: {
        structuredContent: {
          status: 'success',
          data: {
            rows: [{
              id: 'obs-1',
              promptId: 'p1',
              prompt: 'best school marketing agency in California',
              engine: 'chatgpt',
              answerStatus: 'answered',
              collectedAt: '2026-11-22T17:28:19.000Z',
              brands: [
                { name: 'Brandastic', own: true, mentioned: true, cited: true, firstMention: 14 },
                { name: 'Finalsite', own: false, mentioned: true, cited: false, firstMention: 80 },
              ],
            }],
            summaries: [{ name: 'Brandastic', mentions: 9, own: true }],
          },
        },
      },
    })
    const parsed = aiRankingsFromResults({ tracker, rows: results.rows, summaries: results.summaries, trend: { mentions: { current: 9.3 }, citations: { current: 12.7 }, comparison: 'no_previous' }, citedUrls: { 'obs-1': 'https://brandastic.com/' } })
    assert.equal(parsed.connected, true)
    assert.equal(parsed.prompts.length, 1)
    assert.equal(parsed.prompts[0].appears, true)
    assert.equal(parsed.prompts[0].rank, 1)
    assert.equal(parsed.prompts[0].citedUrl, 'https://brandastic.com/')
    assert.equal(parsed.prompts[0].engine, 'ChatGPT')
    assert.equal(parsed.voices[0].mentions, 9)
    assert.equal(parsed.score, 9.3)
    const cards = groupAiPrompts([
      ...parsed.prompts,
      { prompt: parsed.prompts[0].prompt, engine: 'Perplexity', appears: false, rank: null, answerStatus: 'answered', competitors: ['Finalsite'], citedUrl: null },
      { prompt: 'paused prompt', topic: 'Education', paused: true, engine: 'ChatGPT', appears: null, answerStatus: 'not_checked' },
      { prompt: 'unmentioned prompt', topic: 'SEO agency', engine: 'ChatGPT', appears: false, rank: null, answerStatus: 'answered' },
    ])
    assert.equal(cards.length, 3)
    assert.equal(cards[0].prompt, parsed.prompts[0].prompt)
    assert.equal(cards[0].engines.length, 2)
    assert.deepEqual(cards[0].citedUrls, ['https://brandastic.com/'])
    assert.equal(cards.filter((card) => card.paused).length, 2)
    assert.deepEqual(engineAppearances(cards).map((row) => row.label), ['ChatGPT'])
  })

  it('does not treat a missing answer as a no', () => {
    const parsed = normalizeAi(
      { configured: true, tracker: { scheduleInterval: 'weekly' }, prompts: [{ id: 'p1', text: 'best school marketing agency in California', topic: 'Education', paused: true }] },
      { rows: [], summaries: [] },
    )
    assert.equal(parsed.prompts[0].engines.length, 0)
    assert.equal(parsed.prompts[0].paused, true)
    assert.equal(parsed.score, null)
  })
})

describe('analytics gate', () => {
  const env = { BILLING_ALLOWED_EMAILS: ALLOWED }

  it('requires a session and hides OpenSEO data', async () => {
    const result = await handleAnalytics(env, '', '28', { resolveUser: allow(JUSTIN) })
    assert.equal(result.status, 401)
    assert.equal(JSON.stringify(result.body).includes('brandastic.com/'), false)
  })

  it('denies a signed-in person who is not on the billing allowlist', async () => {
    const result = await handleAnalytics(env, 'token', '28', { resolveUser: allow('other.sample@example.test') })
    assert.equal(result.status, 403)
    assert.deepEqual(result.body, { error: 'forbidden' })
  })

  it('returns a not-connected report with no invented metrics', async () => {
    const result = await handleAnalytics(env, 'token', '28', { resolveUser: allow(JUSTIN) })
    assert.equal(result.status, 200)
    assert.equal(result.body.search.connected, false)
    assert.equal(result.body.search.totals, null)
    assert.equal(result.body.keywords.tracked, 0)
    assert.equal(result.body.ai.score, null)
    assert.equal(result.body.ga4.connected, false)
    assert.equal(result.body.ga4.reason, 'not_configured')
    assert.equal(result.body.ga4.sessions, null)
    assert.equal(JSON.stringify(result.body).includes('140'), false)
  })
})

describe('google analytics', () => {
  it('sums all-channel totals and keeps the organic daily series', () => {
    const parsed = normalizeGa4({
      overview: {
        status: 'ok',
        source: { propertyDisplayName: 'brandastic.com' },
        current: { sessions: 10, activeUsers: 8, engagedSessions: 7, keyEvents: 1 },
        previous: { sessions: 12, activeUsers: 9, engagedSessions: 8, keyEvents: 2 },
        trend: [{ date: '20261101', sessions: 4, activeUsers: 3 }, { date: '20261102', sessions: 6, activeUsers: 5 }],
      },
      channels: {
        status: 'ok',
        rows: [
          { sessionDefaultChannelGroup: 'Direct', sessions: 30, activeUsers: 20, engagedSessions: 18, keyEvents: 2 },
          { sessionDefaultChannelGroup: 'Organic Search', sessions: 10, activeUsers: 8, engagedSessions: 7, keyEvents: 1 },
        ],
        comparison: {
          rows: [
            { metrics: { sessions: { current: 30, previous: 40 }, activeUsers: { current: 20, previous: 22 }, engagedSessions: { current: 18, previous: 16 }, keyEvents: { current: 2, previous: 1 } } },
            { metrics: { sessions: { current: 10, previous: 12 }, activeUsers: { current: 8, previous: 9 }, engagedSessions: { current: 7, previous: 8 }, keyEvents: { current: 1, previous: 2 } } },
          ],
        },
      },
      pages: { rows: [{ hostName: 'brandastic.com', pagePath: '/', screenPageViews: 80 }] },
      devices: { rows: [{ deviceCategory: 'mobile', sessions: 24 }] },
      countries: { rows: [{ country: 'United States', sessions: 40 }] },
      events: { rows: [{ eventName: 'generate_lead', keyEvents: 3 }] },
    })
    assert.equal(parsed.connected, true)
    assert.equal(parsed.sessions, 40)
    assert.equal(parsed.users, 28)
    assert.equal(parsed.previous.sessions, 52)
    assert.equal(parsed.series[0].date, '2026-11-01')
    assert.equal(parsed.channels[0].label, 'Direct')
    assert.equal(parsed.pages[0].label, 'brandastic.com/')
    assert.equal(parsed.devices[0].label, 'mobile')
    assert.equal(parsed.countries[0].label, 'United States')
    assert.equal(parsed.events[0].label, 'generate_lead')
  })

  it('says the property is not connected instead of inventing sessions', () => {
    const parsed = normalizeGa4({
      overview: { status: 'error', error: { code: 'ga4_not_connected', message: 'Google Analytics is not connected for this project.' } },
    })
    assert.equal(parsed.connected, false)
    assert.equal(parsed.reason, 'ga4_not_connected')
    assert.equal(parsed.sessions, null)
  })

  it('refuses to call anything except the GA4 read tools', async () => {
    await assert.rejects(
      () => openseoTool({ configured: true, apiKey: 'oseo_test', mcpUrl: 'https://example.test/mcp' }, 'run_rank_tracker', {}, { fetchImpl: async () => { throw new Error('should not fetch') } }),
      (error) => error.code === 'tool_not_allowed',
    )
  })
})

describe('rank check', () => {
  it('blocks a second check inside an hour and never posts', async () => {
    const calls = []
    const now = new Date('2026-11-25T16:00:00.000Z')
    const memory = new Map([['679c3842-3d4c-4ede-967d-a9434b5c61dd', now.getTime()]])
    const result = await startRankCheck(
      { BILLING_ALLOWED_EMAILS: ALLOWED, OPENSEO_API_KEY: 'oseo_test_key' },
      'token',
      {
        now,
        memory,
        resolveUser: allow(JUSTIN),
        fetchImpl: async (url, init) => {
          calls.push({ url, method: init.method, body: init.body })
          return { status: 200, text: async () => JSON.stringify({ ok: true, data: { connected: false, rows: [] } }) }
        },
      },
    )
    assert.equal(result.status, 429)
    assert.equal(result.body.error, 'cooldown')
    assert.equal(calls.some((call) => String(call.url).includes('/runs')), false)
  })

  it('posts an empty check and does not send tracker settings', async () => {
    const calls = []
    const now = new Date('2026-11-25T16:00:00.000Z')
    const result = await startRankCheck(
      { BILLING_ALLOWED_EMAILS: ALLOWED, OPENSEO_API_KEY: 'oseo_test_key' },
      'token',
      {
        now,
        memory: new Map(),
        resolveUser: allow(SANDY),
        fetchImpl: async (url, init) => {
          calls.push({ url: String(url), method: init.method, body: init.body })
          if (init.method === 'POST') {
            return { status: 202, text: async () => JSON.stringify({ ok: true, data: { runId: 'run-1', status: 'pending' } }) }
          }
          return { status: 200, text: async () => JSON.stringify({ ok: true, data: { connected: false, rows: [], run: null } }) }
        },
      },
    )
    const post = calls.filter((call) => call.method === 'POST' && String(call.url).includes('/runs'))
    assert.equal(post.length, 1)
    assert.equal(post[0].url.endsWith('/trackers/679c3842-3d4c-4ede-967d-a9434b5c61dd/runs'), true)
    assert.equal(post[0].body, '{}')
    assert.equal(post[0].body.includes('schedule'), false)
    assert.equal(post[0].body.includes('keyword'), false)
    assert.equal(result.status, 202)
    assert.equal(result.body.runId, 'run-1')
  })

  it('treats a running check as not allowed', () => {
    const decision = cooldownDecision({ trackerId: 'tracker', now: Date.now(), latestTime: null, latestStatus: 'running', memory: new Map() })
    assert.equal(decision.allowed, false)
    assert.equal(decision.reason, 'running')
  })
})

describe('sales snapshot', () => {
  it('uses the deal board amount and does not invent days to close', () => {
    const range = resolveAnalyticsRange('90', new Date('2026-11-25T00:00:00.000Z'))
    const snapshot = salesSnapshot([
      { pipeline_stage: 'proposal', value_2026: 1000, deal_type: 'Project', first_contact_date: '2026-11-02', created_at: '2026-11-02' },
      { pipeline_stage: 'won', close_amount: 4000, first_contact_date: '2026-11-10', created_at: '2026-10-01', quality: 'Closed' },
      { pipeline_stage: 'lost', value_2026: 500, lost_reason: 'Budget', first_contact_date: '2026-11-12', created_at: '2026-11-12' },
    ], range, new Date('2026-11-25T00:00:00.000Z'))
    assert.equal(snapshot.openValue, 1000)
    assert.equal(snapshot.weightedValue, 600)
    assert.equal(snapshot.wonCount, 1)
    assert.equal(snapshot.wonValue, 4000)
    assert.equal(snapshot.lostReasons[0].reason, 'Budget')
    assert.equal(snapshot.cycle.enough, false)
    assert.equal(snapshot.averageDealSize, 4000)
    assert.equal(snapshot.conversion.steps.find((step) => step.id === 'proposal').count >= 1, true)
  })
})
