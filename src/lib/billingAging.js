const DAY_MS = 24 * 60 * 60 * 1000

export function asOfDate(updatedAt) {
  const date = updatedAt ? new Date(updatedAt) : new Date()
  const valid = Number.isNaN(date.getTime()) ? new Date() : date
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles' }).format(valid)
}

export function daysPastDue(dueDate, asOf) {
  const due = Date.parse(`${dueDate}T00:00:00Z`)
  const end = Date.parse(`${asOf}T00:00:00Z`)
  if (Number.isNaN(due) || Number.isNaN(end)) return null
  return Math.floor((end - due) / DAY_MS)
}

function bucketKey(days) {
  if (days <= 0) return 'current'
  if (days <= 30) return 'd30'
  if (days <= 60) return 'd60'
  if (days <= 90) return 'd90'
  return 'late'
}

function roundMoney(value) {
  return Math.round(value * 100) / 100
}

function emptyBuckets() {
  return { current: 0, d30: 0, d60: 0, d90: 0, late: 0, total: 0 }
}

function oldestRank(row) {
  if (row.unallocated) return 5
  if (row.late > 0) return 0
  if (row.d90 > 0) return 1
  if (row.d60 > 0) return 2
  if (row.d30 > 0) return 3
  return 4
}

export function buildAgingReport(parties, asOf) {
  const rows = []
  let missingInvoices = false
  for (const party of parties || []) {
    const invoices = Array.isArray(party.open_invoices) ? party.open_invoices : []
    const stated = typeof party.open_balance === 'number' ? party.open_balance : 0
    if (!invoices.length) {
      if (stated <= 0) continue
      missingInvoices = true
      rows.push({ client: party.client, ...emptyBuckets(), total: roundMoney(stated), unallocated: true })
      continue
    }
    const buckets = emptyBuckets()
    for (const invoice of invoices) {
      const balance = invoice.balance || 0
      if (!balance) continue
      if (!invoice.due_date) {
        if (balance < 0) buckets.current += balance
        continue
      }
      const days = daysPastDue(invoice.due_date, asOf)
      if (days == null) continue
      buckets[bucketKey(days)] += balance
    }
    const parts = [buckets.current, buckets.d30, buckets.d60, buckets.d90, buckets.late]
    if (!parts.some((value) => value !== 0)) continue
    const total = roundMoney(parts.reduce((sum, value) => sum + value, 0))
    rows.push({
      client: party.client,
      current: roundMoney(buckets.current),
      d30: roundMoney(buckets.d30),
      d60: roundMoney(buckets.d60),
      d90: roundMoney(buckets.d90),
      late: roundMoney(buckets.late),
      total,
      unallocated: false,
    })
  }
  rows.sort((a, b) => oldestRank(a) - oldestRank(b) || b.total - a.total || a.client.localeCompare(b.client))
  const totals = rows.reduce((sum, row) => {
    sum.current += row.current
    sum.d30 += row.d30
    sum.d60 += row.d60
    sum.d90 += row.d90
    sum.late += row.late
    sum.total += row.total
    return sum
  }, emptyBuckets())
  for (const key of Object.keys(totals)) totals[key] = roundMoney(totals[key])
  return { asOf, rows, totals, missingInvoices }
}
