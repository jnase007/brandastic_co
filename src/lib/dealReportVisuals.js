import { PIPELINE_STAGES, dealAmount, stageFromLead } from './dealPipeline.js'
import {
  REPORT_MONTHS,
  REPORT_YEAR,
  dealsCreatedOverTime,
  filterDealsByLeadMonth,
  percent,
  stageConversion,
  wonLostOverTime,
} from './dealReports.js'
import { isClosedWon, meetingCloseRate } from './meetingCloseRate.js'

const OPEN_STAGE_IDS = ['lead', 'kickoff', 'proposal', 'contract']
const WEIGHTS = Object.fromEntries(PIPELINE_STAGES.map((stage) => [stage.id, stage.weight]))
const OWNERS = Object.fromEntries(PIPELINE_STAGES.map((stage) => [stage.id, stage.owner]))

function roundMoney(value) {
  return Math.round(value * 100) / 100
}

function sourceLabel(row) {
  const source = String(row?.source || '').trim()
  return source || '(No value)'
}

function monthNumber(monthView) {
  if (monthView == null || monthView === 'all' || monthView === '') return null
  const month = Number(monthView)
  return month >= 1 && month <= 12 ? month : null
}

function byValue(rows) {
  return rows
    .map((row) => ({ ...row, value: roundMoney(row.value) }))
    .sort((a, b) => b.value - a.value || b.count - a.count || a.label.localeCompare(b.label))
}

/** Amounts and rates for one set of deals. Uses the same amount as the deal board. */
export function dealVisualMetrics(rows) {
  const list = Array.isArray(rows) ? rows : []
  let openValue = 0
  let weightedValue = 0
  let wonCount = 0
  let lostCount = 0
  let wonValue = 0
  let lostValue = 0
  const valueByStage = Object.fromEntries(PIPELINE_STAGES.map((stage) => [stage.id, 0]))
  const countByStage = Object.fromEntries(PIPELINE_STAGES.map((stage) => [stage.id, 0]))
  const owners = new Map()
  const sources = new Map()
  const lostReasons = new Map()
  let lostWithoutReason = 0

  for (const row of list) {
    const stage = stageFromLead(row)
    const amount = dealAmount(row)
    if (Object.prototype.hasOwnProperty.call(valueByStage, stage)) {
      valueByStage[stage] += amount
      countByStage[stage] += 1
    }
    const won = isClosedWon(row)
    if (OPEN_STAGE_IDS.includes(stage)) {
      openValue += amount
      weightedValue += amount * (Number(WEIGHTS[stage]) || 0)
      const owner = OWNERS[stage] || 'Unassigned'
      const ownerRow = owners.get(owner) || { label: owner, value: 0, count: 0 }
      ownerRow.value += amount
      ownerRow.count += 1
      owners.set(owner, ownerRow)
      const source = sourceLabel(row)
      const sourceRow = sources.get(source) || { label: source, value: 0, count: 0 }
      sourceRow.value += amount
      sourceRow.count += 1
      sources.set(source, sourceRow)
    }
    if (won) {
      wonCount += 1
      wonValue += amount
    } else if (stage === 'lost') {
      lostCount += 1
      lostValue += amount
      const reason = String(row?.lost_reason || '').trim()
      if (!reason) lostWithoutReason += 1
      else lostReasons.set(reason, (lostReasons.get(reason) || 0) + 1)
    }
  }

  const conversion = stageConversion(list)
  const stages = PIPELINE_STAGES.filter((stage) => stage.id !== 'lost').map((stage) => {
    const step = conversion.steps.find((item) => item.id === stage.id)
    return {
      id: stage.id,
      title: stage.title,
      count: countByStage[stage.id] || 0,
      value: roundMoney(valueByStage[stage.id] || 0),
      conversionFromPrevious: step?.conversionFromPrevious ?? null,
    }
  })

  return {
    openValue: roundMoney(openValue),
    weightedValue: roundMoney(weightedValue),
    winRate: percent(wonCount, wonCount + lostCount),
    wonCount,
    lostCount,
    wonValue: roundMoney(wonValue),
    lostValue: roundMoney(lostValue),
    averageDealSize: wonCount ? roundMoney(wonValue / wonCount) : null,
    meeting: meetingCloseRate(list, { monthView: 'all' }),
    stages,
    owners: byValue([...owners.values()]),
    sources: byValue([...sources.values()]),
    lostReasons: [...lostReasons.entries()]
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count || a.reason.localeCompare(b.reason)),
    lostWithoutReason,
    hasLostReasons: lostReasons.size > 0,
  }
}

function spark(values) {
  const series = (values || []).filter((value) => value != null && Number.isFinite(Number(value)))
  return series.length ? series : undefined
}

/**
 * Visual snapshot for /deals/reporting.
 * Headline numbers follow the lead-month filter, except new deals, which use created date.
 * Sparklines and the activity chart always cover the report year.
 */
export function buildDealReportVisual(rows, { monthView = 'all', year = REPORT_YEAR } = {}) {
  const list = Array.isArray(rows) ? rows : []
  const selectedMonth = monthNumber(monthView)
  const filtered = filterDealsByLeadMonth(list, { year, monthView: selectedMonth ? String(selectedMonth) : 'all' })
  const current = dealVisualMetrics(filtered)
  const compareMonth = selectedMonth && selectedMonth > 1 ? selectedMonth - 1 : null
  const previousMetrics = compareMonth ? dealVisualMetrics(filterDealsByLeadMonth(list, { year, monthView: String(compareMonth) })) : null
  const created = dealsCreatedOverTime(list, { year })
  const closed = wonLostOverTime(list, { year })
  const newDeals = selectedMonth
    ? created.months[selectedMonth - 1].count
    : created.months.reduce((sum, month) => sum + month.count, 0)

  const monthly = REPORT_MONTHS.map((month, index) => {
    const slice = dealVisualMetrics(filterDealsByLeadMonth(list, { year, monthView: String(month.id) }))
    return {
      month: month.id,
      label: month.label,
      openValue: slice.openValue,
      weightedValue: slice.weightedValue,
      winRate: slice.winRate,
      averageDealSize: slice.averageDealSize,
      meetingRate: slice.meeting.rate,
      created: created.months[index].count,
      won: closed.months[index].won,
      lost: closed.months[index].lost,
    }
  })

  return {
    ...current,
    meetingRate: current.meeting.rate,
    meetings: current.meeting.meetings,
    meetingsClosed: current.meeting.closed,
    newDeals,
    selectedMonth,
    compareMonth,
    previousLabel: compareMonth ? REPORT_MONTHS[compareMonth - 1].label : null,
    newDealsHint: selectedMonth ? `Created in ${REPORT_MONTHS[selectedMonth - 1].label}` : `Created in ${year}`,
    previous: previousMetrics
      ? {
          openValue: previousMetrics.openValue,
          weightedValue: previousMetrics.weightedValue,
          winRate: previousMetrics.winRate,
          averageDealSize: previousMetrics.averageDealSize,
          meetingRate: previousMetrics.meeting.rate,
          newDeals: created.months[compareMonth - 1].count,
        }
      : null,
    series: {
      openValue: spark(monthly.map((month) => month.openValue)),
      weightedValue: spark(monthly.map((month) => month.weightedValue)),
      winRate: spark(monthly.map((month) => month.winRate)),
      newDeals: spark(monthly.map((month) => month.created)),
      averageDealSize: spark(monthly.map((month) => month.averageDealSize)),
      meetingRate: spark(monthly.map((month) => month.meetingRate)),
    },
    activity: monthly.map((month) => ({
      month: month.month,
      label: month.label,
      created: month.created,
      won: month.won,
      lost: month.lost,
    })),
    activityNote: 'Created deals use the created date. Won and lost use the lead month, because a close date is not stored.',
  }
}
