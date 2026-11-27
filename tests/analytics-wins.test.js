import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { bestSearchQueries, neverChecked, rankGains, rankStatusLabel, seniorLocalKeywords, topTenKeywords, topTenTrend, winsSummary } from '../src/lib/analyticsWins.js'
import { mergeSearchQueries } from '../server/analyticsNormalize.js'

const rows = [
  { id: 'a', keyword: 'ad agency in orange county', category: 'digital', position: 2, previousPosition: 5, change: 3, lastChecked: '2026-11-27T15:00:00Z', checked: true, history: [{ checkedAt: '2026-11-27T15:00:00Z', position: 2 }, { checkedAt: '2026-11-26T17:10:00Z', position: 5 }] },
  { id: 'b', keyword: 'marketing orange county ca', category: 'digital', position: 9, previousPosition: 10, change: 1, lastChecked: '2026-11-27T15:00:00Z', checked: true, history: [{ checkedAt: '2026-11-27T15:00:00Z', position: 9 }, { checkedAt: '2026-11-26T17:10:00Z', position: 10 }] },
  { id: 'c', keyword: 'senior living marketing agency orange county', category: 'senior', position: 2, previousPosition: null, change: null, lastChecked: '2026-11-27T15:00:00Z', checked: true, history: [{ checkedAt: '2026-11-27T15:00:00Z', position: 2 }] },
  { id: 'd', keyword: 'senior living seo', category: 'senior', position: null, previousPosition: null, change: null, lastChecked: null, checked: false, history: [] },
  { id: 'e', keyword: 'senior living', category: 'senior', position: null, previousPosition: null, change: null, lastChecked: '2026-11-27T15:00:00Z', checked: true, history: [{ checkedAt: '2026-11-27T15:00:00Z', position: null }] },
  { id: 'f', keyword: 'seo topics', category: 'seo', position: 22, previousPosition: 30, change: 8, lastChecked: '2026-11-27T15:00:00Z', checked: true, history: [] },
]

describe('analytics wins', () => {
  it('labels never-checked rows separately from rows outside the top 40', () => {
    assert.equal(neverChecked(rows[3]), true)
    assert.equal(rankStatusLabel(rows[3]), 'not checked yet')
    assert.equal(rankStatusLabel(rows[4]), 'not in top 40')
    assert.equal(rankStatusLabel(rows[0]), null)
  })

  it('finds top 10 keywords, gains and Orange County senior terms from live rows', () => {
    assert.deepEqual(topTenKeywords(rows).map((row) => row.id), ['a', 'c', 'b'])
    assert.deepEqual(rankGains(rows).map((row) => row.id), ['f', 'a', 'b'])
    assert.deepEqual(seniorLocalKeywords(rows).map((row) => row.id), ['c'])
  })

  it('builds the top 10 trend from rank history', () => {
    assert.deepEqual(topTenTrend(rows), [
      { date: '2026-11-26', top10: 2, top3: 0 },
      { date: '2026-11-27', top10: 3, top3: 2 },
    ])
  })

  it('summarizes wins and keeps only Search Console queries in the top 10', () => {
    const best = [{ key: 'x', position: 12, impressions: 9, clicks: 0 }, { key: 'y', position: 3.4, impressions: 5, clicks: 0 }]
    assert.deepEqual(bestSearchQueries(best).map((row) => row.key), ['y'])
    assert.deepEqual(winsSummary({ keywords: { rows }, searchExtras: { best } }), { top3: 2, top10: 3, improved: 3, tracked: 6, gscTop10: 1 })
  })

  it('merges Search Console lists without duplicates', () => {
    const merged = mergeSearchQueries([
      { rows: [{ keys: ['senior living google ads'], clicks: 0, impressions: 7, ctr: 0, position: 8 }] },
      { rows: [{ keys: ['Senior Living Google Ads'], clicks: 0, impressions: 7, ctr: 0, position: 8 }, { keys: ['memory care marketing'], clicks: 0, impressions: 15, ctr: 0, position: 28.1 }] },
      null,
    ])
    assert.deepEqual(merged.map((row) => row.key), ['memory care marketing', 'senior living google ads'])
  })
})
