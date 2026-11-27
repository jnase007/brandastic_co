import { isRankingKeyword } from './rankPages.js'

// Everything here is computed from the live analytics report. Nothing is hardcoded.

export function neverChecked(row) {
  if (!row) return false
  if (row.checked === false) return true
  return row.position == null && !row.lastChecked && !(row.history || []).length
}

export function rankStatusLabel(row) {
  if (isRankingKeyword(row)) return null
  return neverChecked(row) ? 'not checked yet' : 'not in top 40'
}

function byPosition(a, b) {
  return Number(a.position) - Number(b.position) || String(a.keyword).localeCompare(String(b.keyword))
}

export function topTenKeywords(rows) {
  return (rows || []).filter((row) => isRankingKeyword(row) && row.position <= 10).slice().sort(byPosition)
}

export function rankGains(rows, limit = 8) {
  return (rows || [])
    .filter((row) => isRankingKeyword(row) && Number(row.change) > 0 && row.previousPosition != null)
    .slice()
    .sort((a, b) => Number(b.change) - Number(a.change) || byPosition(a, b))
    .slice(0, limit)
}

export function isSeniorLocalKeyword(row) {
  return row?.category === 'senior' && /\b(orange county|irvine|newport beach|costa mesa|\boc\b)\b/i.test(String(row.keyword || ''))
}

export function seniorLocalKeywords(rows) {
  return (rows || []).filter(isSeniorLocalKeyword).slice().sort((a, b) => {
    const ar = isRankingKeyword(a)
    const br = isRankingKeyword(b)
    if (ar && br) return byPosition(a, b)
    if (ar) return -1
    if (br) return 1
    return String(a.keyword).localeCompare(String(b.keyword))
  })
}

// Count keywords in the top 10 at each completed check, oldest first, from each row's history.
export function topTenTrend(rows) {
  const byCheck = new Map()
  for (const row of rows || []) {
    for (const point of row.history || []) {
      const day = String(point.checkedAt || '').slice(0, 10)
      if (!day) continue
      if (!byCheck.has(day)) byCheck.set(day, { date: day, top10: 0, top3: 0 })
      const position = Number(point.position)
      if (point.position != null && position >= 1 && position <= 10) {
        const bucket = byCheck.get(day)
        bucket.top10 += 1
        if (position <= 3) bucket.top3 += 1
      }
    }
  }
  return [...byCheck.values()].sort((a, b) => a.date.localeCompare(b.date))
}

export function bestSearchQueries(rows, limit = 10) {
  return (rows || [])
    .filter((row) => row?.key && row.position != null && row.position <= 10)
    .slice()
    .sort((a, b) => a.position - b.position || b.impressions - a.impressions)
    .slice(0, limit)
}

export function winsSummary(report) {
  const rows = report?.keywords?.rows || []
  const top10 = topTenKeywords(rows)
  const gains = rankGains(rows, 1000)
  return {
    top3: top10.filter((row) => row.position <= 3).length,
    top10: top10.length,
    improved: gains.length,
    tracked: rows.length,
    gscTop10: bestSearchQueries(report?.searchExtras?.best || [], 1000).length,
  }
}
