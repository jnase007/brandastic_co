import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'
import {
  DEFAULT_LOST_REASON,
  PIPELINE_ALERTS_ENABLED,
  PIPELINE_STAGES,
  businessDaysSince,
  calendarDaysSince,
  dealAlert,
  dropUnavailableDealColumns,
  qualityForLostReason,
  stageFromLead,
  summarizeAlerts,
} from '../src/lib/dealPipeline.js'
import {
  averageTimeInStage,
  closedWonBySource,
  closedWonCycle,
  dealsCreatedOverTime,
  filterDealsByLeadMonth,
  stageConversion,
  stalledByStage,
  wonLostOverTime,
} from '../src/lib/dealReports.js'

const NOW = '2026-06-10'
const leads = JSON.parse(readFileSync(new URL('./fixtures/deal-reporting.json', import.meta.url), 'utf8'))

describe('deal pipeline stages and alerts', () => {
  it('keeps the stored stage ids and maps them onto the sales process', () => {
    assert.deepEqual(PIPELINE_STAGES.map((stage) => stage.id), ['lead', 'kickoff', 'proposal', 'contract', 'won', 'lost'])
    assert.equal(PIPELINE_STAGES.find((stage) => stage.id === 'lead').owner, 'Erin')
    assert.equal(PIPELINE_STAGES.find((stage) => stage.id === 'kickoff').owner, 'Erin')
    assert.equal(PIPELINE_STAGES.find((stage) => stage.id === 'proposal').owner, 'Justin')
    assert.equal(PIPELINE_STAGES.find((stage) => stage.id === 'contract').title, 'Buy-In / Contract Sent')
    assert.equal(PIPELINE_STAGES.find((stage) => stage.id === 'won').title, 'Deal Won')
    assert.equal(PIPELINE_STAGES.find((stage) => stage.id === 'lost').title, 'Deal Lost')
    assert.equal(stageFromLead({ pipeline_stage: 'contract' }), 'contract')
    assert.equal(stageFromLead({ quality: 'Closed' }), 'won')
    assert.equal(stageFromLead({ quality: 'Proposal sent' }), 'proposal')
    assert.equal(stageFromLead({ pipeline_stage: 'archive' }), 'lead')
    assert.equal(stageFromLead({ quality: 'No response from emails & calls' }), 'lead')
    assert.equal(stageFromLead({ pipeline_stage: 'lost', quality: 'Closed' }), 'lost')
  })

  it('flags the process timers without inventing a stage-entered date', () => {
    assert.equal(calendarDaysSince('2026-01-01', NOW), 160)
    assert.equal(businessDaysSince('2026-06-01', NOW), 7)
    const byId = Object.fromEntries(leads.map((row) => [row.id, dealAlert(row, NOW)]))
    assert.equal(byId['ea-lead-old'].kind, 'suggest-lost')
    assert.equal(byId['ea-lead-old'].owner, 'Erin')
    assert.equal(byId['ea-lead-new'], null)
    assert.equal(byId['ea-ko-30'].kind, 'reengage')
    assert.equal(byId['ea-ko-30'].level, 30)
    assert.equal(byId['ea-ko-90'].kind, 'suggest-lost')
    assert.equal(byId['ea-ko-90'].level, 90)
    assert.equal(byId['ea-prop-5'].kind, 'reminder')
    assert.match(byId['ea-prop-5'].detail, /5 business days/)
    assert.match(byId['ea-prop-5'].detail, /14 days/)
    assert.equal(byId['ea-prop-60'].kind, 'suggest-lost')
    assert.equal(byId['ea-contract'].kind, 'priority')
    assert.match(byId['ea-contract'].detail, /No auto-cadence/)
    assert.equal(byId['ea-won-1'].kind, 'checklist')
    assert.equal(byId['ea-won-2'].kind, 'checklist')
    assert.equal(byId['ea-lost-open'].kind, 'reason-needed')
    assert.equal(byId['ea-lost-done'], null)
    assert.equal(dealAlert({ pipeline_stage: 'lead' }, NOW).kind, 'unknown')
    const summary = summarizeAlerts(leads, NOW)
    assert.equal(summary.items.filter((item) => item.kind === 'suggest-lost').length, 3)
    assert.equal(summary.priority, 1)
    assert.equal(summary.undated, 0)
  })

  it('leaves alerts off and still moves a deal when the new columns are missing', () => {
    assert.equal(PIPELINE_ALERTS_ENABLED, false)
    assert.equal(DEFAULT_LOST_REASON, 'Other')
    const patch = { pipeline_stage: 'lost', quality: 'No response from emails & calls', lost_reason: 'Other', updated_at: '2026-06-10' }
    const next = dropUnavailableDealColumns(patch, "Could not find the 'lost_reason' column of 'sales_leads' in the schema cache")
    assert.equal(next.pipeline_stage, 'lost')
    assert.equal(next.quality, 'No response from emails & calls')
    assert.equal(next.lost_reason, undefined)
    assert.equal(dropUnavailableDealColumns(patch, 'permission denied'), null)
    const checklist = dropUnavailableDealColumns({ pipeline_stage: 'won', won_checklist: { signed: true } }, 'column won_checklist does not exist')
    assert.equal(checklist.pipeline_stage, 'won')
    assert.equal(checklist.won_checklist, undefined)
  })

  it('maps a lost reason onto an existing quality only when one already exists', () => {
    assert.equal(qualityForLostReason('No Response', 'Good Lead'), 'No response from emails & calls')
    assert.equal(qualityForLostReason('Spam', 'Good Lead'), 'Spam')
    assert.equal(qualityForLostReason('Budget', 'Closed'), '')
    assert.equal(qualityForLostReason('Budget', 'Good Lead'), 'Good Lead')
  })
})

describe('deal reports', () => {
  it('builds the funnel from the current stage and leaves lost off the conversion path', () => {
    const funnel = stageConversion(leads)
    const counts = Object.fromEntries(funnel.steps.map((step) => [step.id, step.count]))
    assert.deepEqual(counts, { lead: 3, kickoff: 2, proposal: 2, contract: 1, won: 2 })
    assert.equal(funnel.lost, 2)
    assert.equal(funnel.steps[1].conversionFromPrevious, 70)
    assert.equal(funnel.steps[2].conversionFromPrevious, 71.4)
    assert.equal(funnel.steps[3].conversionFromPrevious, 60)
    assert.equal(funnel.steps[4].conversionFromPrevious, 66.7)
  })

  it('counts closed won by source and refuses a made-up cycle time', () => {
    const sources = closedWonBySource(leads)
    assert.deepEqual(sources, [
      { source: 'Direct', count: 1 },
      { source: 'SEO (organic)', count: 1 },
    ])
    const cycle = closedWonCycle()
    assert.equal(cycle.enough, false)
    assert.match(cycle.reason, /Not enough data yet/)
    assert.equal(cycle.average, undefined)
  })

  it('averages time in stage and stalled counts from the dates that exist', () => {
    const time = averageTimeInStage(leads, NOW)
    assert.equal(time.enough, true)
    const averages = Object.fromEntries(time.bars.map((bar) => [bar.id, bar.average]))
    assert.deepEqual(averages, { lead: 57, kickoff: 84.5, proposal: 55, contract: 9 })
    const stalled = stalledByStage(leads, NOW)
    assert.equal(stalled.enough, true)
    assert.deepEqual(stalled.bars.map((bar) => bar.count), [1, 2, 2, 0])
    const undated = stalledByStage([{ pipeline_stage: 'lead' }], NOW)
    assert.equal(undated.enough, false)
  })

  it('groups won and lost by lead month and created deals by created_at', () => {
    const series = wonLostOverTime(leads)
    assert.equal(series.months[0].lost, 1)
    assert.equal(series.months[1].won, 1)
    assert.equal(series.months[2].lost, 1)
    assert.equal(series.months[3].won, 1)
    const created = dealsCreatedOverTime(leads)
    assert.equal(created.enough, true)
    assert.deepEqual(created.months.map((month) => month.count), [3, 1, 3, 2, 2, 1, 0, 0, 0, 0, 0, 0])
    const march = filterDealsByLeadMonth(leads, { monthView: '3' })
    assert.deepEqual(march.map((row) => row.id).sort(), ['ea-lost-open', 'ea-prop-60'])
    const noCreated = dealsCreatedOverTime([{ company: 'Example Only', pipeline_stage: 'lead', first_contact_date: '2026-03-01' }])
    assert.equal(noCreated.enough, false)
  })
})
