const PROFIT_KEY = 'brd-profit-data-v1'
const TEAM_KEY = 'brd-team-data-v1'

function readCache(key) {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || '')
    if (!parsed?.data) return null
    return parsed.data
  } catch {
    return null
  }
}

function writeCache(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify({ at: Date.now(), data }))
  } catch {
    /* quota */
  }
}

export function cachedProfitability() {
  return readCache(PROFIT_KEY)
}

export function cachedTeam() {
  return readCache(TEAM_KEY)
}

export async function fetchProfitability() {
  const res = await fetch('https://dash.brandastic.com/api/profitability-data')
  const body = await res.json()
  if (!res.ok) throw new Error(body.error || 'Could not load profitability')
  writeCache(PROFIT_KEY, body)
  return body
}

export async function fetchTeam() {
  const res = await fetch('https://dash.brandastic.com/api/team-performance-data')
  const body = await res.json()
  if (!res.ok) throw new Error(body.error || 'Could not load team')
  writeCache(TEAM_KEY, body)
  return body
}
