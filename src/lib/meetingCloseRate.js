import { parseJiraKey } from './leads.js'

/**
 * A lead is one sales_leads row (the Score Card lead).
 * A Jira ticket is a jira_key that parseJiraKey accepts. That ticket means a meeting was set up.
 * Closed / won uses the same signal as the rest of this page: quality "Closed" or pipeline_stage "won".
 */
export function hasJiraTicket(row) {
  return Boolean(parseJiraKey(row?.jira_key))
}

export function isClosedWon(row) {
  return row?.quality === 'Closed' || row?.pipeline_stage === 'won'
}

export function matchesLeadMonth(row, monthView, year) {
  if (monthView == null || monthView === 'all' || monthView === '') return true
  const date = String(row?.first_contact_date || '')
  if (!date.startsWith(String(year))) return false
  return Number(date.slice(5, 7)) === Number(monthView)
}

export function meetingCloseRate(leads, { year = 2026, monthView = 'all' } = {}) {
  const meetings = (Array.isArray(leads) ? leads : []).filter(
    (row) => hasJiraTicket(row) && matchesLeadMonth(row, monthView, year),
  )
  const closed = meetings.filter(isClosedWon)
  const rate = meetings.length ? Math.round((closed.length / meetings.length) * 1000) / 10 : null
  return { meetings: meetings.length, closed: closed.length, rate }
}

export function meetingCloseRateBySource(leads, options) {
  const rows = (Array.isArray(leads) ? leads : []).filter(
    (row) => hasJiraTicket(row) && matchesLeadMonth(row, options?.monthView ?? 'all', options?.year ?? 2026),
  )
  const groups = new Map()
  for (const row of rows) {
    const source = row.source || 'Unknown'
    const current = groups.get(source) || { source, meetings: 0, closed: 0 }
    current.meetings += 1
    if (isClosedWon(row)) current.closed += 1
    groups.set(source, current)
  }
  return [...groups.values()]
    .map((group) => ({
      ...group,
      rate: group.meetings ? Math.round((group.closed / group.meetings) * 1000) / 10 : null,
    }))
    .sort((a, b) => b.meetings - a.meetings || a.source.localeCompare(b.source))
}

export function meetingCloseRateByMonth(leads, { year = 2026 } = {}) {
  return Array.from({ length: 12 }, (_, index) => {
    const month = index + 1
    const summary = meetingCloseRate(leads, { year, monthView: month })
    return { month, ...summary }
  })
}
