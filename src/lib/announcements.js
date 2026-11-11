const TYPE_ORDER = { birthday: 0, anniversary: 1, holiday: 2, outing: 3 }

export function losAngelesToday(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)
}

export function addDays(iso, days) {
  const [year, month, day] = iso.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day + days))
  return date.toISOString().slice(0, 10)
}

function weekdayIndex(iso) {
  const [year, month, day] = iso.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay()
}

export function mondayOf(iso) {
  const day = weekdayIndex(iso)
  return addDays(iso, day === 0 ? -6 : 1 - day)
}

export function weekdayDate(iso) {
  const [year, month, day] = iso.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day, 12))
  const weekday = new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: 'UTC' }).format(date)
  return `${weekday} ${month}/${day}`
}

function isLeap(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0
}

function occurrence(month, day, year) {
  const useDay = month === 2 && day === 29 && !isLeap(year) ? 28 : day
  return `${year}-${String(month).padStart(2, '0')}-${String(useDay).padStart(2, '0')}`
}

function datesInWindow(month, day, start, end) {
  const years = new Set([Number(start.slice(0, 4)), Number(end.slice(0, 4))])
  return [...years]
    .map((year) => occurrence(month, day, year))
    .filter((date) => date >= start && date <= end)
}

function inThisWeek(date, today) {
  const monday = mondayOf(today)
  return date >= monday && date <= addDays(monday, 6)
}

function timeLabel(value) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const parts = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: 'America/Los_Angeles',
  }).formatToParts(date)
  const hour = parts.find((part) => part.type === 'hour')?.value || ''
  const minute = parts.find((part) => part.type === 'minute')?.value || '00'
  const period = (parts.find((part) => part.type === 'dayPeriod')?.value || '').toLowerCase()
  return minute === '00' ? `${hour}${period}` : `${hour}:${minute}${period}`
}

function calendarDate(start, allDay) {
  const text = String(start || '')
  if (!text) return ''
  if (allDay || text.length <= 10) return text.slice(0, 10)
  const date = new Date(text)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date)
}

function holidayDetail(holiday) {
  const start = holiday.startDate
  const end = holiday.endDate && holiday.endDate > start ? holiday.endDate : ''
  const range = end ? `${weekdayDate(start)}–${weekdayDate(end)}` : weekdayDate(start)
  const notes = String(holiday.notes || '').trim()
  return notes ? `${notes} ${range}` : range
}

function isoDate(year, month, day) {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function daysInMonth(year, month) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

function fixedDate(year, month, day) {
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) return ''
  return isoDate(year, month, day)
}

function nthWeekday(year, month, weekday, nth) {
  if (month < 1 || month > 12 || weekday < 0 || weekday > 6 || nth < 1 || nth > 4) return ''
  const firstWeekday = new Date(Date.UTC(year, month - 1, 1)).getUTCDay()
  const day = 1 + ((weekday - firstWeekday + 7) % 7) + (nth - 1) * 7
  if (day > daysInMonth(year, month)) return ''
  return isoDate(year, month, day)
}

function lastWeekdayOfMonth(year, month, weekday) {
  if (month < 1 || month > 12 || weekday < 0 || weekday > 6) return ''
  const lastDay = daysInMonth(year, month)
  const lastIndex = new Date(Date.UTC(year, month - 1, lastDay)).getUTCDay()
  return isoDate(year, month, lastDay - ((lastIndex - weekday + 7) % 7))
}

function optionalInt(value) {
  if (value === '' || value == null) return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function holidayRule(holiday) {
  const lengthDays = Math.max(1, Number(holiday.lengthDays ?? holiday.length_days) || 1)
  return {
    name: String(holiday.name || '').trim() || 'Holiday',
    notes: holiday.notes || '',
    repeatRule: holiday.repeatRule || holiday.repeat_rule || 'none',
    startDate: String(holiday.startDate || holiday.start_date || '').slice(0, 10),
    endDate: String(holiday.endDate || holiday.end_date || '').slice(0, 10),
    month: optionalInt(holiday.month),
    day: optionalInt(holiday.day),
    weekday: optionalInt(holiday.weekday),
    nth: optionalInt(holiday.nth),
    lengthDays,
  }
}

function oneTimeEnd(rule) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(rule.endDate) && rule.endDate >= rule.startDate) return rule.endDate
  return addDays(rule.startDate, rule.lengthDays - 1)
}

function startInYear(rule, year) {
  if (rule.repeatRule === 'fixed') return fixedDate(year, rule.month, rule.day)
  if (rule.repeatRule === 'nth_weekday') return nthWeekday(year, rule.month, rule.weekday, rule.nth)
  if (rule.repeatRule === 'last_weekday') return lastWeekdayOfMonth(year, rule.month, rule.weekday)
  return ''
}

function yearsCovering(fromDate, toDate) {
  const first = Number(fromDate.slice(0, 4)) - 1
  const last = Number(toDate.slice(0, 4))
  const years = []
  for (let year = first; year <= last; year += 1) years.push(year)
  return years
}

export function expandHolidays(holidays, fromDate, toDate) {
  const ranges = []
  for (const holiday of holidays) {
    const rule = holidayRule(holiday)
    if (rule.repeatRule === 'none') {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(rule.startDate)) continue
      const endDate = oneTimeEnd(rule)
      if (endDate < fromDate || rule.startDate > toDate) continue
      ranges.push({ name: rule.name, notes: rule.notes, startDate: rule.startDate, endDate })
      continue
    }
    for (const year of yearsCovering(fromDate, toDate)) {
      const startDate = startInYear(rule, year)
      if (!startDate) continue
      const endDate = addDays(startDate, rule.lengthDays - 1)
      if (endDate < fromDate || startDate > toDate) continue
      ranges.push({ name: rule.name, notes: rule.notes, startDate, endDate })
    }
  }
  return ranges.sort((a, b) => a.startDate.localeCompare(b.startDate) || a.name.localeCompare(b.name))
}

function longDate(iso) {
  const [year, month, day] = iso.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day, 12))
  const parts = new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).formatToParts(date)
  const value = (type) => parts.find((part) => part.type === type)?.value || ''
  return `${value('weekday')} ${value('month')} ${value('day')}, ${value('year')}`
}

function previewReady(rule) {
  const monthOk = rule.month >= 1 && rule.month <= 12
  const weekdayOk = rule.weekday >= 0 && rule.weekday <= 6
  if (rule.repeatRule === 'none') return /^\d{4}-\d{2}-\d{2}$/.test(rule.startDate)
  if (rule.repeatRule === 'fixed') return monthOk && rule.day >= 1 && rule.day <= 31
  if (rule.repeatRule === 'nth_weekday') return monthOk && weekdayOk && rule.nth >= 1 && rule.nth <= 4
  if (rule.repeatRule === 'last_weekday') return monthOk && weekdayOk
  return false
}

export function holidayPreview(holiday, today) {
  const rule = holidayRule(holiday)
  if (!previewReady(rule)) return ''
  const year = Number(today.slice(0, 4))
  const spans = rule.repeatRule === 'none'
    ? [{ startDate: rule.startDate, endDate: oneTimeEnd(rule) }]
    : [year - 1, year, year + 1]
      .map((item) => startInYear(rule, item))
      .filter(Boolean)
      .map((startDate) => ({ startDate, endDate: addDays(startDate, rule.lengthDays - 1) }))
  const upcoming = spans.find((span) => span.endDate >= today)
  const chosen = upcoming || spans[spans.length - 1]
  if (!chosen) return "That date doesn't exist."
  const label = chosen.endDate > chosen.startDate ? `${longDate(chosen.startDate)} – ${longDate(chosen.endDate)}` : longDate(chosen.startDate)
  return chosen.endDate >= today ? `Next: ${label}` : `Past: ${label}`
}

export function buildAnnouncements(today, { people = [], holidays = [], outings = [] } = {}) {
  const end = addDays(today, 30)
  const items = []

  for (const person of people) {
    if (person.showOnAnnouncements !== true) continue
    const name = String(person.name || '').trim()
    if (!name || name.toLowerCase() === 'unassigned') continue
    const birthday = String(person.birthday || '')
    if (/^\d{4}-\d{2}-\d{2}/.test(birthday)) {
      const [, month, day] = birthday.slice(0, 10).split('-').map(Number)
      for (const date of datesInWindow(month, day, today, end)) {
        items.push({ type: 'birthday', date, title: name, detail: '' })
      }
    }
    const startDate = String(person.startDate || '')
    if (/^\d{4}-\d{2}-\d{2}/.test(startDate)) {
      const [startYear, month, day] = startDate.slice(0, 10).split('-').map(Number)
      for (const date of datesInWindow(month, day, today, end)) {
        const years = Number(date.slice(0, 4)) - startYear
        if (years < 1) continue
        items.push({ type: 'anniversary', date, title: name, detail: years === 1 ? '1 year' : `${years} years` })
      }
    }
  }

  for (const holiday of expandHolidays(holidays, today, end)) {
    const date = holiday.startDate < today ? today : holiday.startDate
    items.push({
      type: 'holiday',
      date,
      rangeStart: holiday.startDate,
      rangeEnd: holiday.endDate,
      title: holiday.name,
      detail: holidayDetail({ ...holiday, endDate: holiday.endDate === holiday.startDate ? '' : holiday.endDate }),
    })
  }

  for (const outing of outings) {
    const date = calendarDate(outing.start, outing.allDay)
    if (!date || date < today || date > end) continue
    const title = String(outing.title || '').trim()
    if (!title) continue
    const time = outing.allDay ? '' : timeLabel(outing.start)
    const location = String(outing.location || '').trim()
    const when = time ? `${weekdayDate(date)} at ${time}` : weekdayDate(date)
    items.push({
      type: 'outing',
      date,
      title,
      detail: location ? `${when} (${location})` : when,
    })
  }

  return items.sort((a, b) => a.date.localeCompare(b.date) || TYPE_ORDER[a.type] - TYPE_ORDER[b.type] || a.title.localeCompare(b.title))
}

export function itemsThisWeek(today, items) {
  return items.filter((item) => inThisWeek(item.date, today))
}

export function weekGroups(today, items) {
  const current = mondayOf(today)
  const groups = new Map()
  for (const item of items) {
    const monday = mondayOf(item.date)
    const list = groups.get(monday) || []
    list.push(item)
    groups.set(monday, list)
  }
  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([monday, group]) => ({
      id: monday,
      label: monday === current ? 'This week' : `Week of ${weekdayDate(monday)}`,
      items: group,
    }))
}
