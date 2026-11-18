import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'
import {
  hasJiraTicket,
  meetingCloseRate,
  meetingCloseRateByMonth,
  meetingCloseRateBySource,
} from '../src/lib/meetingCloseRate.js'

const leads = JSON.parse(readFileSync(new URL('./fixtures/meeting-close-rate.json', import.meta.url), 'utf8'))

describe('meeting close rate', () => {
  it('counts a Jira ticket as a meeting and Closed or won as closed', () => {
    assert.equal(hasJiraTicket(leads[0]), true)
    assert.equal(hasJiraTicket(leads[3]), false)
    assert.equal(hasJiraTicket({ jira_key: 'not a ticket' }), false)
    const all = meetingCloseRate(leads, { year: 2026, monthView: 'all' })
    assert.equal(all.meetings, 5)
    assert.equal(all.closed, 3)
    assert.equal(all.rate, 60)
  })

  it('follows the financials month filter and ignores leads with no ticket', () => {
    const march = meetingCloseRate(leads, { year: 2026, monthView: '3' })
    assert.equal(march.meetings, 2)
    assert.equal(march.closed, 1)
    assert.equal(march.rate, 50)
    const empty = meetingCloseRate(leads, { year: 2026, monthView: '12' })
    assert.equal(empty.meetings, 0)
    assert.equal(empty.rate, null)
  })

  it('breaks the fake fixture down by source and month', () => {
    const sources = meetingCloseRateBySource(leads, { year: 2026, monthView: 'all' })
    const direct = sources.find((row) => row.source === 'Direct')
    assert.equal(direct.meetings, 3)
    assert.equal(direct.closed, 2)
    const months = meetingCloseRateByMonth(leads, { year: 2026 })
    assert.equal(months[0].closed, 1)
    assert.equal(months[0].meetings, 1)
    assert.equal(months[2].meetings, 2)
    assert.equal(months[5].closed, 1)
  })
})
