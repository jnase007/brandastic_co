export const SUBSCRIPTIONS_EMPTY_MESSAGE = 'No subscription data loaded yet'
export const SUBSCRIPTIONS_INTRO = 'Recurring charges found in QuickBooks. Review what to keep, cancel, or downgrade.'

export const SUBSCRIPTION_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'active', label: 'Active' },
  { id: 'price_up', label: 'Price increases' },
  { id: 'overlap', label: 'Overlaps' },
  { id: 'personal', label: 'Maybe personal' },
  { id: 'stopped', label: 'Stopped' },
  { id: 'possible', label: 'Possible', title: 'Non-software recurring, such as ads, insurance, and processing fees' },
  { id: 'annual', label: 'Annual' },
]

export const GROUP_LABELS = {
  software_saas: 'Software / SaaS',
  hosting_domains: 'Hosting & domains',
  stock_media: 'Stock media',
  wp_plugins_themes: 'WP plugins & themes',
  ads_media: 'Ads & media',
  phone_internet: 'Phone & internet',
  insurance: 'Insurance',
  payroll_platform_fee: 'Payroll platform fee',
  payment_processing: 'Payment processing',
  maybe_personal: 'Maybe personal',
}

export const GROUP_COLORS = {
  software_saas: '#5b21b6',
  hosting_domains: '#0f766e',
  stock_media: '#0369a1',
  wp_plugins_themes: '#1d4ed8',
  ads_media: '#c2410c',
  phone_internet: '#4338ca',
  insurance: '#0e7490',
  payroll_platform_fee: '#7c3aed',
  payment_processing: '#b45309',
  maybe_personal: '#be123c',
  ungrouped: '#64748b',
}

export const STATUS_LABELS = {
  active: 'Active',
  stopped: 'Stopped',
  possible: 'Possible',
  annual: 'Annual',
}

export function groupLabel(group) {
  if (!group) return '—'
  return GROUP_LABELS[group] || String(group).replace(/_/g, ' ')
}

export function groupColor(group) {
  return GROUP_COLORS[group] || GROUP_COLORS.ungrouped
}

export function subscriptionsEmptyState(data) {
  const loaded = Boolean(data && data.configured === true && Array.isArray(data.items))
  if (!loaded) return { loaded: false, message: SUBSCRIPTIONS_EMPTY_MESSAGE }
  return { loaded: true, message: null }
}

export function subscriptionMonthly(item) {
  if (typeof item?.typical_monthly_amount === 'number') return item.typical_monthly_amount
  if (typeof item?.average_monthly_amount === 'number') return item.average_monthly_amount
  return null
}

export function countsTowardMonthlyChart(item) {
  if (!item || item.status === 'stopped') return false
  const amount = subscriptionMonthly(item)
  return typeof amount === 'number' && amount > 0
}

export function matchesSubscriptionFilter(item, filter) {
  if (!item) return false
  if (filter === 'active') return item.status === 'active'
  if (filter === 'stopped') return item.status === 'stopped'
  if (filter === 'possible') return item.status === 'possible'
  if (filter === 'annual') return item.status === 'annual'
  if (filter === 'price_up') return item.amount_changed_recently === true
  if (filter === 'overlap') return Boolean(String(item.possible_duplicate_or_overlap || '').trim())
  if (filter === 'personal') return item.group === 'maybe_personal'
  return true
}

export function filterSubscriptionItems(items, filter) {
  const rows = Array.isArray(items) ? items : []
  return rows.filter((item) => matchesSubscriptionFilter(item, filter))
}

function sortValue(item, key) {
  if (key === 'group') return groupLabel(item.group)
  if (key === 'monthly') return subscriptionMonthly(item)
  if (key === 'last_charged_date') return item.last_charged_date || null
  if (key === 'next_expected_date') return item.next_expected_date || null
  if (key === 'last4') return item.payment_account_last4 || null
  if (key === 'status') return STATUS_LABELS[item.status] || item.status || null
  return item.vendor || null
}

export function sortSubscriptionItems(items, key, dir) {
  const rows = Array.isArray(items) ? items : []
  const direction = dir === 'asc' ? 1 : -1
  return [...rows].sort((a, b) => {
    const av = sortValue(a, key)
    const bv = sortValue(b, key)
    if (av == null && bv == null) return String(a.vendor || '').localeCompare(String(b.vendor || ''))
    if (av == null) return 1
    if (bv == null) return -1
    const diff = typeof av === 'number' && typeof bv === 'number' ? av - bv : String(av).localeCompare(String(bv))
    if (diff === 0) return String(a.vendor || '').localeCompare(String(b.vendor || ''))
    return diff * direction
  })
}

export function sumMonthly(items) {
  let seen = false
  let total = 0
  for (const item of items || []) {
    const amount = subscriptionMonthly(item)
    if (typeof amount !== 'number') continue
    seen = true
    total += amount
  }
  if (!seen) return null
  return Math.round(total * 100) / 100
}

export function topSubscriptionsByMonthly(items, limit = 15) {
  return [...(items || [])]
    .filter(countsTowardMonthlyChart)
    .sort((a, b) => subscriptionMonthly(b) - subscriptionMonthly(a) || String(a.vendor || '').localeCompare(String(b.vendor || '')))
    .slice(0, limit)
}

export function monthlyCostByGroup(items) {
  const totals = new Map()
  for (const item of items || []) {
    if (!countsTowardMonthlyChart(item)) continue
    const key = item.group || 'ungrouped'
    const amount = subscriptionMonthly(item)
    totals.set(key, Math.round(((totals.get(key) || 0) + amount) * 100) / 100)
  }
  return [...totals.entries()]
    .map(([group, amount]) => ({ group, amount }))
    .sort((a, b) => b.amount - a.amount || a.group.localeCompare(b.group))
}

export function monthlyChargeSeries(charges) {
  if (!Array.isArray(charges)) return []
  const map = new Map()
  for (const charge of charges) {
    if (!charge || typeof charge.date !== 'string' || !/^\d{4}-\d{2}/.test(charge.date)) continue
    if (typeof charge.amount !== 'number') continue
    const month = charge.date.slice(0, 7)
    map.set(month, Math.round(((map.get(month) || 0) + charge.amount) * 100) / 100)
  }
  return [...map.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([month, amount]) => ({ month, amount }))
}

export function overallMonthlyTrend(items) {
  const charges = []
  for (const item of items || []) {
    if (Array.isArray(item.charges)) charges.push(...item.charges)
  }
  return monthlyChargeSeries(charges)
}

export function formatDay(value) {
  if (!value || typeof value !== 'string') return '—'
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value)
  if (!match) return '—'
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const utc = new Date(Date.UTC(year, month - 1, day))
  if (utc.getUTCFullYear() !== year || utc.getUTCMonth() !== month - 1 || utc.getUTCDate() !== day) return '—'
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(utc)
}

export function formatSubscriptionUpdated(value) {
  if (!value) return 'Updated time was not included.'
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return `Updated ${formatDay(value)}`
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Updated time was not included.'
  const formatted = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date)
  return `Updated ${formatted} PT`
}

export function formatSourceWindow(sourceWindow) {
  if (!sourceWindow || typeof sourceWindow !== 'object') return ''
  const start = sourceWindow.start ? formatDay(sourceWindow.start) : ''
  const end = sourceWindow.end ? formatDay(sourceWindow.end) : ''
  const hasStart = start && start !== '—'
  const hasEnd = end && end !== '—'
  if (hasStart && hasEnd) return `Source window ${start} – ${end}`
  if (hasStart) return `Source window from ${start}`
  if (hasEnd) return `Source window through ${end}`
  return ''
}

function round2(value) {
  return Math.round(value * 100) / 100
}

export function subscriptionKey(item) {
  return [
    item?.status || '',
    item?.vendor || '',
    item?.payment_account_last4 || '',
    item?.last_charged_date || '',
    item?.typical_monthly_amount ?? '',
    item?.latest_charge ?? '',
  ].join('|')
}

export function subscriptionSelectable(item) {
  return Boolean(item) && item.status !== 'stopped'
}

export function subscriptionSavings(item) {
  if (!subscriptionSelectable(item)) return { monthly: 0, annual: 0, included: false }
  if (item.status === 'annual') {
    const typical = typeof item.typical_monthly_amount === 'number' ? item.typical_monthly_amount : null
    const latest = typeof item.latest_charge === 'number' ? item.latest_charge : null
    const average = typeof item.average_monthly_amount === 'number' ? item.average_monthly_amount : null
    let annual = null
    let monthly = null
    if (typical != null && latest != null && typical > 0 && latest > typical * 6 && latest < typical * 18) {
      monthly = typical
      annual = latest
    } else {
      annual = latest ?? typical ?? average
      monthly = annual == null ? null : round2(annual / 12)
    }
    if (monthly == null) return { monthly: 0, annual: 0, included: false }
    return { monthly, annual: annual == null ? round2(monthly * 12) : annual, included: true }
  }
  const monthly = subscriptionMonthly(item)
  if (monthly == null) return { monthly: 0, annual: 0, included: false }
  return { monthly, annual: round2(monthly * 12), included: true }
}

export function summarizeSavings(items, selectedKeys, runRate) {
  const keys = selectedKeys instanceof Set ? selectedKeys : new Set(selectedKeys || [])
  let monthly = 0
  let annual = 0
  let count = 0
  for (const item of items || []) {
    if (!keys.has(subscriptionKey(item)) || !subscriptionSelectable(item)) continue
    const cost = subscriptionSavings(item)
    if (!cost.included) continue
    count += 1
    monthly += cost.monthly
    annual += cost.annual
  }
  monthly = round2(monthly)
  annual = round2(annual)
  const rate = typeof runRate === 'number' && Number.isFinite(runRate) && runRate > 0 ? runRate : null
  return {
    count,
    monthly,
    annual,
    percent: rate == null ? null : round2((monthly / rate) * 100),
    runRate: rate,
    after: rate == null ? null : round2(Math.max(0, rate - monthly)),
  }
}
