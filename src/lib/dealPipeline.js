/**
 * Brandastic sales process on /deals.
 * Stored stage ids stay lead, kickoff, proposal, contract, won, lost.
 * Display names follow Justin's pipeline diagram. Nothing here sends email or Slack.
 *
 * Stage mapping:
 * - lead, kickoff, proposal, contract, won, lost map directly onto the diagram.
 * - A blank stage with quality Closed is Deal Won, matching the existing board.
 * - A blank stage with quality Proposal sent is Proposal Sent.
 * - Any other blank or unknown stage stays in Lead.
 * - Quality "No response from emails & calls" is not Deal Lost unless pipeline_stage is already lost.
 */

/** In-app timers, badges, the alerts panel, and Deal Lost prompts. Off until turned back on. */
export const PIPELINE_ALERTS_ENABLED = false

export const DEFAULT_LOST_REASON = 'Other'

export const OPTIONAL_DEAL_COLUMNS = ['lost_reason', 'lost_note', 'follow_up_recommendation', 'won_checklist']

export const LOST_REASONS = [
  'No Response',
  'Budget',
  'Timing',
  'Lost to Competitor',
  'Not Qualified',
  'Scope Misalignment',
  'Internal Priorities',
  'Spam',
  'Other',
]

export const PIPELINE_STAGES = [
  { id: 'lead', title: 'Lead', owner: 'Erin', quality: 'Good Lead', weight: 0.1, color: 'bg-gray-400' },
  { id: 'kickoff', title: 'Kick-Off Meeting', owner: 'Erin', quality: 'Good Lead', weight: 0.3, color: 'bg-blue-500' },
  { id: 'proposal', title: 'Proposal Sent', owner: 'Justin', quality: 'Proposal sent', weight: 0.6, color: 'bg-purple-500' },
  { id: 'contract', title: 'Buy-In / Contract Sent', owner: 'Justin', quality: 'Proposal sent', weight: 0.9, color: 'bg-orange-500' },
  { id: 'won', title: 'Deal Won', owner: 'Justin', quality: 'Closed', weight: 1, color: 'bg-green-500' },
  { id: 'lost', title: 'Deal Lost', owner: 'Erin or Justin', quality: 'No response from emails & calls', weight: 0, color: 'bg-red-500' },
]

export const FUNNEL_STAGE_IDS = ['lead', 'kickoff', 'proposal', 'contract', 'won']

const STAGE_IDS = new Set(PIPELINE_STAGES.map((stage) => stage.id))

/** Drop optional columns named in a Postgres/PostgREST error so the stage move can still save. */
export function dropUnavailableDealColumns(patch, message) {
  const text = String(message || '')
  const missing = OPTIONAL_DEAL_COLUMNS.filter((column) => text.includes(column))
  if (!missing.length) return null
  const next = { ...patch }
  for (const column of missing) delete next[column]
  return next
}

export function stageTitle(id) {
  return PIPELINE_STAGES.find((stage) => stage.id === id)?.title || id
}

export function stageFromLead(row) {
  const stage = String(row?.pipeline_stage || '').toLowerCase()
  if (STAGE_IDS.has(stage)) return stage
  if (row?.quality === 'Closed') return 'won'
  if (row?.quality === 'Proposal sent') return 'proposal'
  return 'lead'
}

export function contractMonths(row) {
  const months = Number(row?.contract_months)
  return months > 0 ? months : 12
}

/** Same amount the deal board shows: close amount for wins, otherwise the 2026 value. */
export function dealAmount(row) {
  const stage = stageFromLead(row)
  if (stage === 'won') return Number(row?.close_amount || row?.value_2026) || 0
  const estimate = Number(row?.value_2026) || 0
  if (row?.deal_type === 'Monthly') return estimate * contractMonths(row)
  return estimate
}

export function parseUtcDay(value) {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!match) return null
  const time = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  return Number.isFinite(time) ? time : null
}

function dayValue(now) {
  if (now instanceof Date) return now.toISOString().slice(0, 10)
  return now
}

export function calendarDaysSince(value, now) {
  const start = parseUtcDay(value)
  const end = parseUtcDay(dayValue(now))
  if (start == null || end == null || end < start) return null
  return Math.round((end - start) / 86400000)
}

export function businessDaysSince(value, now) {
  const start = parseUtcDay(value)
  const end = parseUtcDay(dayValue(now))
  if (start == null || end == null || end < start) return null
  let count = 0
  for (let time = start + 86400000; time <= end; time += 86400000) {
    const weekday = new Date(time).getUTCDay()
    if (weekday !== 0 && weekday !== 6) count += 1
  }
  return count
}

export function wonChecklist(row) {
  let raw = row?.won_checklist
  if (typeof raw === 'string') {
    try {
      raw = JSON.parse(raw)
    } catch {
      raw = null
    }
  }
  return {
    signed: Boolean(raw?.signed),
    onboarding: Boolean(raw?.onboarding),
    teamKickoff: Boolean(raw?.teamKickoff),
  }
}

export function qualityForLostReason(reason, currentQuality) {
  if (reason === 'No Response') return 'No response from emails & calls'
  if (reason === 'Spam') return 'Spam'
  if (currentQuality === 'Closed') return ''
  return currentQuality || ''
}

function leadAnchor(row) {
  return row?.first_contact_date || row?.created_at || null
}

function activityAnchor(row) {
  return row?.updated_at || row?.created_at || row?.first_contact_date || null
}

export function dealAlert(row, now) {
  const stage = stageFromLead(row)
  if (stage === 'lead') {
    const anchor = leadAnchor(row)
    if (!anchor) {
      return {
        stage,
        kind: 'unknown',
        owner: 'Erin',
        badge: 'No lead date',
        detail: 'No first contact date is stored, so the 45-day Lead check cannot run.',
      }
    }
    const days = calendarDaysSince(anchor, now)
    if (days == null || days < 45) return null
    return {
      stage,
      kind: 'suggest-lost',
      owner: 'Erin',
      days,
      basis: 'first contact',
      badge: `${days} days · suggest Deal Lost`,
      detail: `${days} days since first contact with no Kick-Off. Suggest moving to Deal Lost. Erin needs a lost reason and a note.`,
    }
  }
  if (stage === 'kickoff') {
    const anchor = activityAnchor(row)
    if (!anchor) {
      return {
        stage,
        kind: 'unknown',
        owner: 'Justin',
        badge: 'No activity date',
        detail: 'No update date is stored, so the 30, 60, and 90 day Kick-Off checks cannot run.',
      }
    }
    const days = calendarDaysSince(anchor, now)
    if (days == null || days < 30) return null
    if (days >= 90) {
      return {
        stage,
        kind: 'suggest-lost',
        owner: 'Justin',
        days,
        level: 90,
        basis: 'last update',
        badge: `${days} days inactive · suggest Deal Lost`,
        detail: `Notify Justin to re-engage. ${days} days since the last update. Suggest Deal Lost.`,
      }
    }
    const level = days >= 60 ? 60 : 30
    return {
      stage,
      kind: 'reengage',
      owner: 'Justin',
      days,
      level,
      basis: 'last update',
      badge: `${days} days inactive · re-engage`,
      detail: `Notify Justin to re-engage. ${days} days since the last update (${level}-day mark).`,
    }
  }
  if (stage === 'proposal') {
    const anchor = activityAnchor(row)
    if (!anchor) {
      return {
        stage,
        kind: 'unknown',
        owner: 'Justin',
        badge: 'No activity date',
        detail: 'No update date is stored, so the Proposal Sent reminders cannot run.',
      }
    }
    const days = calendarDaysSince(anchor, now)
    const business = businessDaysSince(anchor, now)
    if (days != null && days >= 60) {
      return {
        stage,
        kind: 'suggest-lost',
        owner: 'Justin',
        days,
        basis: 'last update',
        badge: `${days} days inactive · suggest Deal Lost`,
        detail: `${days} days since the last update. Suggest Deal Lost.`,
      }
    }
    if (business != null && business >= 5) {
      return {
        stage,
        kind: 'reminder',
        owner: 'Justin',
        days,
        businessDays: business,
        basis: 'last update',
        badge: `${business} business days · reminder`,
        detail: `Reminder for Justin. ${business} business days since the last update. First reminder is at 5 business days, then every 14 days.`,
      }
    }
    return null
  }
  if (stage === 'contract') {
    return {
      stage,
      kind: 'priority',
      owner: 'Justin',
      badge: 'Highest priority',
      detail: 'Highest priority. Justin manages this stage. No auto-cadence.',
    }
  }
  if (stage === 'won') {
    const list = wonChecklist(row)
    const open = !list.signed || !list.onboarding || !list.teamKickoff
    return {
      stage,
      kind: open ? 'checklist' : 'checklist-done',
      owner: 'Justin',
      open,
      badge: open ? 'Kickoff checklist' : 'Checklist complete',
      detail: 'Confirm the signed agreement, trigger onboarding, and check off telling the team about kickoff. Nothing is sent.',
    }
  }
  if (stage === 'lost' && !String(row?.lost_reason || '').trim()) {
    return {
      stage,
      kind: 'reason-needed',
      owner: 'Erin or Justin',
      badge: 'Lost reason needed',
      detail: 'Deal Lost needs a lost reason, an internal note, and a follow-up recommendation.',
    }
  }
  return null
}

export function summarizeAlerts(rows, now) {
  const items = []
  let priority = 0
  let undated = 0
  for (const row of Array.isArray(rows) ? rows : []) {
    const alert = dealAlert(row, now)
    if (!alert) continue
    if (alert.kind === 'priority') {
      priority += 1
      continue
    }
    if (alert.kind === 'unknown') {
      undated += 1
      continue
    }
    if (alert.kind === 'checklist-done') continue
    items.push({
      id: row.id,
      company: row.company || row.name || 'Untitled',
      ...alert,
    })
  }
  return { items, priority, undated }
}
