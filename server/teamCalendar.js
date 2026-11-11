import { parseICS } from 'node-ical'
import { addDays, losAngelesToday } from '../src/lib/announcements.js'

const CACHE_MS = 5 * 60 * 1000
let cache = { at: 0, data: null }

function textValue(value) {
  if (!value) return ''
  if (typeof value === 'string') return value
  return value.val || ''
}

function dateOnlyIso(date) {
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function outingFrom(event, when) {
  const title = textValue(event.summary).replace(/\s+/g, ' ').trim()
  if (!title.toLowerCase().includes('outing')) return null
  const allDay = Boolean(event.datetype === 'date' || when?.dateOnly || event.start?.dateOnly)
  const start = allDay ? dateOnlyIso(when) : when.toISOString()
  return {
    title,
    start,
    location: textValue(event.location).replace(/\s+/g, ' ').trim(),
    allDay,
  }
}

export async function loadTeamOutings(env, now = new Date()) {
  if (cache.data && Date.now() - cache.at < CACHE_MS) return cache.data
  const data = await loadFresh(env, now)
  cache = { at: Date.now(), data }
  return data
}

async function loadFresh(env, now) {
  const url = env.TEAM_CALENDAR_ICS_URL
  if (!url) throw new Error('Team calendar is not configured')
  const response = await fetch(url)
  if (!response.ok) throw new Error('Could not read the team calendar')
  const parsed = parseICS(await response.text())
  const today = losAngelesToday(now)
  const end = addDays(today, 30)
  const from = new Date(now.getTime() - 36 * 60 * 60 * 1000)
  const to = new Date(now.getTime() + 32 * 24 * 60 * 60 * 1000)
  const outings = []
  const seen = new Set()
  for (const event of Object.values(parsed)) {
    if (!event || event.type !== 'VEVENT' || event.status === 'CANCELLED') continue
    let moments = [event.start]
    if (event.rrule) {
      try {
        moments = event.rrule.between(from, to, true)
      } catch {
        moments = [event.start]
      }
    }
    for (const moment of moments) {
      if (!moment) continue
      const outing = outingFrom(event, moment)
      if (!outing) continue
      const day = outing.allDay ? outing.start : losAngelesToday(new Date(outing.start))
      if (day < today || day > end) continue
      const key = `${outing.title}|${outing.start}`
      if (seen.has(key)) continue
      seen.add(key)
      outings.push(outing)
    }
  }
  outings.sort((a, b) => String(a.start).localeCompare(String(b.start)) || a.title.localeCompare(b.title))
  return { generatedAt: new Date().toISOString(), outings }
}
