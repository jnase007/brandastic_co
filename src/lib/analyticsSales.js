import { PIPELINE_STAGES, dealAmount, stageFromLead } from './dealPipeline.js'
import { closedWonCycle, reportingKpis, stageConversion, stageDistribution } from './dealReports.js'
import { isClosedWon, meetingCloseRate } from './meetingCloseRate.js'
import { dateInRange } from './analyticsRange.js'

const OPEN_STAGES = new Set(['lead', 'kickoff', 'proposal', 'contract'])

function roundMoney(value) {
  return Math.round(value * 100) / 100
}

export function salesSnapshot(rows, range, now = new Date()) {
  const list = (Array.isArray(rows) ? rows : []).filter((row) => dateInRange(row?.first_contact_date, range))
  const created = (Array.isArray(rows) ? rows : []).filter((row) => dateInRange(row?.created_at, range))
  const kpis = reportingKpis(list, { monthView: 'all', now })
  const weights = Object.fromEntries(PIPELINE_STAGES.map((stage) => [stage.id, stage.weight]))
  let openValue = 0
  let weightedValue = 0
  let wonCount = 0
  let lostCount = 0
  let wonValue = 0
  let lostValue = 0
  const valueByStage = Object.fromEntries(PIPELINE_STAGES.map((stage) => [stage.id, 0]))
  const lostReasons = new Map()
  let lostWithoutReason = 0

  for (const row of list) {
    const stage = stageFromLead(row)
    const amount = dealAmount(row)
    if (Object.prototype.hasOwnProperty.call(valueByStage, stage)) valueByStage[stage] += amount
    if (OPEN_STAGES.has(stage)) {
      openValue += amount
      weightedValue += amount * (Number(weights[stage]) || 0)
    }
    const won = isClosedWon(row)
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

  const distribution = stageDistribution(list).map((stage) => ({
    ...stage,
    value: roundMoney(valueByStage[stage.id] || 0),
  }))

  return {
    leads: list,
    createdCount: created.length,
    openValue: roundMoney(openValue),
    weightedValue: roundMoney(weightedValue),
    wonCount,
    lostCount,
    wonValue: roundMoney(wonValue),
    lostValue: roundMoney(lostValue),
    winRate: kpis.winRate,
    averageDealSize: wonCount ? roundMoney(wonValue / wonCount) : null,
    cycle: closedWonCycle(),
    conversion: stageConversion(list),
    distribution,
    meeting: meetingCloseRate(list, { year: range.endDate.slice(0, 4), monthView: 'all' }),
    lostReasons: [...lostReasons.entries()]
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count || a.reason.localeCompare(b.reason)),
    lostWithoutReason,
    hasLostReasons: lostReasons.size > 0,
  }
}
