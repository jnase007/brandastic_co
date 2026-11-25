import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { assignKeywordCategory } from '../server/keywordCategories.js'
import { normalizeAi, normalizeGa4, normalizeKeywords, normalizeSearch } from '../server/analyticsNormalize.js'
import { openseoTool } from '../server/openseo.js'
import { handleAnalytics } from '../server/analyticsHttp.js'
import { cooldownDecision, startRankCheck } from '../server/analyticsRankCheck.js'
import { salesSnapshot } from '../src/lib/analyticsSales.js'
import { resolveAnalyticsRange } from '../src/lib/analyticsRange.js'

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
})

describe('search console normalize', () => {
  it('returns an empty state instead of zeroes when Search Console is not connected', () => {
    const parsed = normalizeSearch({ connected: false })
    assert.equal(parsed.connected, false)
    assert.equal(parsed.totals, null)
    assert.deepEqual(parsed.series, [])
  })
})

describe('ai visibility normalize', () => {
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
