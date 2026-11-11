import { findCostRate, formatMoney, formatPct } from './profitability'
import { supabase } from './supabase'

export async function fetchWebsites() {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new Error('Sign in required')
  const response = await fetch('/api/websites-data', {
    headers: { Authorization: `Bearer ${token}` },
  })
  const body = await response.json()
  if (!response.ok) throw new Error(body.error || 'Could not load websites')
  return body
}

export function websiteRows(builds, rates) {
  return (builds || []).map((build) => {
    const budgetAmount = build.contractAmount != null
      ? build.contractAmount
      : build.rate != null && build.contractedHours != null
        ? build.rate * build.contractedHours
        : null
    const budgetHours = build.contractedHours != null
      ? build.contractedHours
      : build.contractAmount != null && build.rate
        ? build.contractAmount / build.rate
        : null
    const loggedHours = (build.loggedMinutes || 0) / 60
    const ratesReady = Array.isArray(rates)
    const people = (build.people || []).map((person) => {
      const rate = ratesReady ? findCostRate(person.name, rates) : null
      const hours = person.minutes / 60
      return {
        name: person.name,
        hours,
        labor: rate ? hours * rate.hourly : null,
      }
    })
    const labor = ratesReady ? people.reduce((sum, person) => sum + (person.labor || 0), 0) : null
    const uncostedHours = ratesReady ? people.filter((person) => person.labor == null).reduce((sum, person) => sum + person.hours, 0) : 0
    const percent = budgetHours ? (loggedHours / budgetHours) * 100 : null
    return {
      ...build,
      budgetAmount,
      budgetHours,
      loggedHours,
      hoursLeft: budgetHours == null ? null : budgetHours - loggedHours,
      percent,
      tone: percent == null ? null : percent > 100 ? 'over' : percent >= 75 ? 'warn' : 'ok',
      labor: people.length ? labor : 0,
      uncostedHours,
      margin: budgetAmount == null || labor == null ? null : budgetAmount - labor,
      ready: budgetAmount != null || budgetHours != null,
      people,
    }
  })
}

export function formatHours(value) {
  if (value == null || Number.isNaN(value)) return '—'
  const rounded = Math.round(value * 10) / 10
  const text = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1)
  return `${text}h`
}

export { formatMoney, formatPct }
