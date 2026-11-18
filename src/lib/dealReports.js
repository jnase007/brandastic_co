import { matchesLeadMonth } from './meetingCloseRate.js'
import { isClosedWon } from './meetingCloseRate.js'
import {
  FUNNEL_STAGE_IDS,
  calendarDaysSince,
  dealAlert,
  stageFromLead,
  stageTitle,
} from './dealPipeline.js'

export const REPORT_YEAR = 2026

export const REPORT_MONTHS = [
  { id: 1, label: 'Jan' },
  { id: 2, label: 'Feb' },
  { id: 3, label: 'Mar' },
  { id: 4, label: 'Apr' },
  { id: 5, label: 'May' },
  { id: 6, label: 'Jun' },
  { id: 7, label: 'Jul' },
  { id: 8, label: 'Aug' },
  { id: 9, label: 'Sep' },
  { id: 10, label: 'Oct' },
  { id: 11, label: 'Nov' },
  { id: 12, label: 'Dec' },
]

export const REPORT_VIEWS = [
  { id: 'funnel', label: 'Stage conversion funnel' },
  { id: 'won-by-source', label: 'Closed won deals by source' },
  { id: 'cycle', label: 'Average closed-won cycle' },
  { id: 'time-in-stage', label: 'Average current time in stage' },
  { id: 'stalled', label: 'Stalled deals by stage' },
  { id: 'won-lost', label: 'Won vs lost over time' },
  { id: 'distribution', label: 'Current stage distribution' },
  { id: 'created', label: 'Deals created over time' },
]

const OPEN_STAGE_IDS = ['lead', 'kickoff', 'proposal', 'contract']

export function percent(part, whole) {
  if (!whole) return null
  return Math.round((part / whole) * 1000) / 10
}

export function filterDealsByLeadMonth(rows, { year = REPORT_YEAR, monthView = 'all' } = {}) {
  return (Array.isArray(rows) ? rows : []).filter((row) => matchesLeadMonth(row, monthView, year))
}

function sourceLabel(row) {
  const source = String(row?.source || '').trim()
  return source || '(No value)'
}

export function stageConversion(rows) {
  const counts = Object.fromEntries([...FUNNEL_STAGE_IDS, 'lost'].map((id) => [id, 0]))
  for (const row of rows || []) counts[stageFromLead(row)] += 1
  const steps = FUNNEL_STAGE_IDS.map((id, index) => {
    const reached = FUNNEL_STAGE_IDS.slice(index).reduce((sum, stageId) => sum + counts[stageId], 0)
    const previous = index === 0 ? null : FUNNEL_STAGE_IDS[index - 1]
    const previousReached = previous
      ? FUNNEL_STAGE_IDS.slice(index - 1).reduce((sum, stageId) => sum + counts[stageId], 0)
      : null
    return {
      id,
      title: stageTitle(id),
      count: counts[id],
      reached,
      conversionFromPrevious: previous ? percent(reached, previousReached) : null,
    }
  })
  return {
    steps,
    lost: counts.lost,
    note: 'Conversion is deals currently in this stage or a later funnel stage, divided by the previous stage on that same basis. Deal Lost is separate because the stage a lost deal left is not stored.',
  }
}

export function closedWonBySource(rows) {
  const groups = new Map()
  for (const row of (rows || []).filter(isClosedWon)) {
    const source = sourceLabel(row)
    groups.set(source, (groups.get(source) || 0) + 1)
  }
  return [...groups.entries()]
    .map(([source, count]) => ({ source, count }))
    .sort((a, b) => b.count - a.count || a.source.localeCompare(b.source))
}

export function closedWonCycle() {
  return {
    enough: false,
    reason: 'Not enough data yet. No close date is stored. The lead date is first_contact_date, and updated_at changes on any edit, so neither one is days to close.',
  }
}

function stageAnchor(row, stage) {
  if (stage === 'lead') return row?.first_contact_date || row?.created_at || null
  return row?.updated_at || row?.created_at || row?.first_contact_date || null
}

export function averageTimeInStage(rows, now) {
  const buckets = Object.fromEntries(OPEN_STAGE_IDS.map((id) => [id, []]))
  let undated = 0
  for (const row of rows || []) {
    const stage = stageFromLead(row)
    if (!OPEN_STAGE_IDS.includes(stage)) continue
    const days = calendarDaysSince(stageAnchor(row, stage), now)
    if (days == null) {
      undated += 1
      continue
    }
    buckets[stage].push(days)
  }
  const bars = OPEN_STAGE_IDS.filter((id) => buckets[id].length).map((id) => {
    const days = buckets[id]
    const average = Math.round((days.reduce((sum, value) => sum + value, 0) / days.length) * 10) / 10
    return { id, title: stageTitle(id), count: days.length, average }
  })
  return {
    enough: bars.length > 0,
    undated,
    bars,
    basis: 'Days since first contact for Lead, and days since the last update for the other open stages. A stage-entered date is not stored.',
    reason: bars.length ? '' : 'Not enough data yet. Open deals in this view have no date to measure.',
  }
}

export function stalledByStage(rows, now) {
  const counts = Object.fromEntries(OPEN_STAGE_IDS.map((id) => [id, 0]))
  let undated = 0
  let open = 0
  for (const row of rows || []) {
    const stage = stageFromLead(row)
    if (!OPEN_STAGE_IDS.includes(stage)) continue
    open += 1
    const alert = dealAlert(row, now)
    if (!alert || alert.kind === 'unknown') {
      undated += 1
      continue
    }
    if (alert.kind === 'suggest-lost' || alert.kind === 'reengage' || alert.kind === 'reminder') counts[stage] += 1
  }
  const stalled = OPEN_STAGE_IDS.reduce((sum, id) => sum + counts[id], 0)
  return {
    enough: open === 0 || undated < open,
    undated,
    bars: OPEN_STAGE_IDS.map((id) => ({ id, title: stageTitle(id), count: counts[id] })),
    stalled,
    basis: 'Lead at 45 days since first contact. Kick-Off at 30, 60, or 90 days since the last update. Proposal Sent at 5 business days, or 60 days, since the last update. Buy-In / Contract Sent has no auto-cadence.',
    reason: 'Not enough data yet. Open deals in this view have no date to judge against the timers.',
  }
}

export function wonLostOverTime(rows, { year = REPORT_YEAR } = {}) {
  const months = REPORT_MONTHS.map((month) => ({ month: month.id, label: month.label, won: 0, lost: 0 }))
  let skipped = 0
  for (const row of rows || []) {
    const won = isClosedWon(row)
    const lost = stageFromLead(row) === 'lost' && !won
    if (!won && !lost) continue
    const date = String(row?.first_contact_date || '')
    const month = Number(date.slice(5, 7))
    if (!date.startsWith(String(year)) || month < 1 || month > 12) {
      skipped += 1
      continue
    }
    if (won) months[month - 1].won += 1
    else months[month - 1].lost += 1
  }
  return {
    months,
    skipped,
    note: 'Grouped by first_contact_date, the lead month. A close date is not stored. A deal that is both Closed and Deal Lost is counted as won.',
  }
}

export function stageDistribution(rows) {
  const order = [...FUNNEL_STAGE_IDS, 'lost']
  const counts = Object.fromEntries(order.map((id) => [id, 0]))
  for (const row of rows || []) counts[stageFromLead(row)] += 1
  return order.map((id) => ({ id, title: stageTitle(id), count: counts[id] }))
}

export function dealsCreatedOverTime(rows, { year = REPORT_YEAR } = {}) {
  const months = REPORT_MONTHS.map((month) => ({ month: month.id, label: month.label, count: 0 }))
  let missing = 0
  let outside = 0
  for (const row of rows || []) {
    const date = String(row?.created_at || '')
    if (!date) {
      missing += 1
      continue
    }
    if (!date.startsWith(String(year))) {
      outside += 1
      continue
    }
    const month = Number(date.slice(5, 7))
    if (month < 1 || month > 12) {
      outside += 1
      continue
    }
    months[month - 1].count += 1
  }
  const total = months.reduce((sum, month) => sum + month.count, 0)
  return {
    enough: total > 0,
    months,
    missing,
    outside,
    reason: 'Not enough data yet. No created date in this view falls in 2026.',
  }
}
