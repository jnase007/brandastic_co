export const ANALYTICS_RANGES = [
  { id: '7', label: 'Last 7 days', days: 7, openseo: 'last_7_days' },
  { id: '28', label: 'Last 28 days', days: 28, openseo: 'last_28_days' },
  { id: '90', label: 'Last 3 months', days: 90, openseo: 'last_3_months' },
]

export function resolveAnalyticsRange(id, now = new Date()) {
  const range = ANALYTICS_RANGES.find((item) => item.id === String(id)) || ANALYTICS_RANGES[1]
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  const start = new Date(end)
  start.setUTCDate(start.getUTCDate() - (range.days - 1))
  return {
    id: range.id,
    label: range.label,
    days: range.days,
    openseo: range.openseo,
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
  }
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
