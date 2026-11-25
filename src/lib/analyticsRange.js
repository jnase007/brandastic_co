export const ANALYTICS_RANGES = [
  { id: '7', label: 'Last 7 days', days: 7 },
  { id: '30', label: 'Last 30 days', days: 30 },
  { id: '60', label: 'Last 60 days', days: 60 },
  { id: '90', label: 'Last 90 days', days: 90 },
  { id: 'this-month', label: 'This month' },
  { id: 'last-month', label: 'Last month' },
  { id: 'ytd', label: 'Year to date' },
  { id: '12', label: 'Last 12 months' },
  { id: 'custom', label: 'Custom' },
]

export const COMPARE_MODES = [
  { id: 'period', label: 'vs previous period' },
  { id: 'month', label: 'vs previous month' },
  { id: 'year', label: 'vs same period last year' },
]

export const GSC_HISTORY_MONTHS = 16
export const GA4_HISTORY_MONTHS = 14

function utcToday(now) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
}

function iso(date) {
  return date.toISOString().slice(0, 10)
}

function parseIso(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) return null
  const date = new Date(`${value}T00:00:00.000Z`)
  return Number.isNaN(date.getTime()) || iso(date) !== value ? null : date
}

function shiftMonths(date, months) {
  const day = date.getUTCDate()
  const shifted = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1))
  const last = new Date(Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth() + 1, 0)).getUTCDate()
  shifted.setUTCDate(Math.min(day, last))
  return shifted
}

function shiftYears(date, years) {
  return shiftMonths(date, years * 12)
}

function daysBetween(start, end) {
  return Math.round((end.getTime() - start.getTime()) / 86400000) + 1
}

export function resolveAnalyticsRange(id, now = new Date(), custom = {}) {
  const today = utcToday(now)
  const preset = ANALYTICS_RANGES.find((item) => item.id === String(id)) || ANALYTICS_RANGES[1]
  let start = today
  let end = today
  if (preset.days) {
    end = today
    start = new Date(end)
    start.setUTCDate(start.getUTCDate() - (preset.days - 1))
  } else if (preset.id === 'this-month') {
    start = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1))
  } else if (preset.id === 'last-month') {
    start = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 1, 1))
    end = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 0))
  } else if (preset.id === 'ytd') {
    start = new Date(Date.UTC(today.getUTCFullYear(), 0, 1))
  } else if (preset.id === '12') {
    start = shiftMonths(today, -12)
  } else if (preset.id === 'custom') {
    const customStart = parseIso(custom.start)
    const customEnd = parseIso(custom.end)
    if (customStart && customEnd && customStart <= customEnd && customEnd <= today) {
      start = customStart
      end = customEnd
    } else {
      end = today
      start = new Date(end)
      start.setUTCDate(start.getUTCDate() - 29)
    }
  }
  return {
    id: preset.id,
    label: preset.label,
    days: daysBetween(start, end),
    startDate: iso(start),
    endDate: iso(end),
  }
}

export function comparisonWindow(range, mode = 'period') {
  const start = parseIso(range.startDate)
  const end = parseIso(range.endDate)
  if (!start || !end) return null
  let nextStart = start
  let nextEnd = end
  let label = 'Previous period'
  if (mode === 'month') {
    nextStart = shiftMonths(start, -1)
    nextEnd = shiftMonths(end, -1)
    label = 'Previous month'
  } else if (mode === 'year') {
    nextStart = shiftYears(start, -1)
    nextEnd = shiftYears(end, -1)
    label = 'Same period last year'
  } else {
    nextEnd = new Date(start)
    nextEnd.setUTCDate(nextEnd.getUTCDate() - 1)
    nextStart = new Date(nextEnd)
    nextStart.setUTCDate(nextStart.getUTCDate() - (daysBetween(start, end) - 1))
  }
  return { startDate: iso(nextStart), endDate: iso(nextEnd), label, mode: mode === 'month' || mode === 'year' ? mode : 'period' }
}

export function historyCovers(startDate, now = new Date(), months = 16) {
  const today = utcToday(now)
  const limit = shiftMonths(today, -months)
  return String(startDate) >= iso(limit)
}

export function recentMonths(endDate, count = 13) {
  const end = parseIso(endDate)
  if (!end) return []
  const months = []
  for (let index = count - 1; index >= 0; index -= 1) {
    const cursor = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() - index, 1))
    months.push(iso(cursor).slice(0, 7))
  }
  return months
}

export function previousAnalyticsRange(range) {
  const end = new Date(`${range.startDate}T00:00:00.000Z`)
  end.setUTCDate(end.getUTCDate() - 1)
  const start = new Date(end)
  start.setUTCDate(start.getUTCDate() - (range.days - 1))
  return {
    ...range,
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
  }
}

export function dateInRange(value, range) {
  const date = String(value || '').slice(0, 10)
  return /^\d{4}-\d{2}-\d{2}$/.test(date) && date >= range.startDate && date <= range.endDate
}
