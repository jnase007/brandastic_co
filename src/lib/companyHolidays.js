import { addDays } from './announcements'
import { supabase } from './supabase'

const HOLIDAY_COLUMNS = 'id, name, start_date, end_date, notes, repeat_rule, month, day, weekday, nth, length_days'

export const COMMON_US_HOLIDAYS = [
  { name: "New Year's Day", repeatRule: 'fixed', month: 1, day: 1, lengthDays: 1 },
  { name: 'Memorial Day', repeatRule: 'last_weekday', month: 5, weekday: 1, lengthDays: 1 },
  { name: 'Independence Day', repeatRule: 'fixed', month: 7, day: 4, lengthDays: 1 },
  { name: 'Labor Day', repeatRule: 'nth_weekday', month: 9, weekday: 1, nth: 1, lengthDays: 1 },
  { name: 'Thanksgiving', repeatRule: 'nth_weekday', month: 11, weekday: 4, nth: 4, lengthDays: 2 },
  { name: 'Christmas', repeatRule: 'fixed', month: 12, day: 25, lengthDays: 1 },
]

function missingTable(error) {
  const text = `${error?.message || ''} ${error?.code || ''} ${error?.details || ''}`
  return error?.code === 'PGRST205' || error?.code === '42P01' || (text.includes('does not exist') && text.includes('company_holidays') && !text.includes('column'))
}

function missingColumn(error) {
  const text = `${error?.message || ''} ${error?.code || ''} ${error?.details || ''}`
  return error?.code === '42703' || error?.code === 'PGRST204' || /repeat_rule|length_days|column/.test(text)
}

function daysInSpan(start, end) {
  const [startYear, startMonth, startDay] = start.split('-').map(Number)
  const [endYear, endMonth, endDay] = end.split('-').map(Number)
  const from = Date.UTC(startYear, startMonth - 1, startDay)
  const to = Date.UTC(endYear, endMonth - 1, endDay)
  return Math.round((to - from) / 86400000) + 1
}

export function holidayRuleFromRow(row) {
  const startDate = String(row.start_date || '').slice(0, 10)
  const endDate = String(row.end_date || '').slice(0, 10)
  let lengthDays = Number(row.length_days) || 1
  if (/^\d{4}-\d{2}-\d{2}$/.test(startDate) && /^\d{4}-\d{2}-\d{2}$/.test(endDate) && endDate >= startDate) {
    lengthDays = Math.max(lengthDays, daysInSpan(startDate, endDate))
  }
  return {
    name: row.name || '',
    notes: row.notes || '',
    repeatRule: row.repeat_rule || 'none',
    startDate,
    endDate,
    month: row.month ?? '',
    day: row.day ?? '',
    weekday: row.weekday ?? '',
    nth: row.nth ?? '',
    lengthDays,
  }
}

function payloadFrom(row) {
  const repeatRule = row.repeatRule || 'none'
  const lengthDays = Math.max(1, Number(row.lengthDays) || 1)
  const payload = {
    ...(row.id ? { id: row.id } : {}),
    name: row.name.trim(),
    notes: String(row.notes || '').trim() || null,
    repeat_rule: repeatRule,
    length_days: lengthDays,
    month: null,
    day: null,
    weekday: null,
    nth: null,
    start_date: null,
    end_date: null,
    updated_at: new Date().toISOString(),
  }
  if (payload.id == null || payload.id === '') delete payload.id
  if (repeatRule === 'none') {
    payload.start_date = row.startDate
    payload.end_date = lengthDays > 1 ? addDays(row.startDate, lengthDays - 1) : null
  } else if (repeatRule === 'fixed') {
    payload.month = Number(row.month)
    payload.day = Number(row.day)
  } else if (repeatRule === 'nth_weekday') {
    payload.month = Number(row.month)
    payload.weekday = Number(row.weekday)
    payload.nth = Number(row.nth)
  } else if (repeatRule === 'last_weekday') {
    payload.month = Number(row.month)
    payload.weekday = Number(row.weekday)
  }
  return payload
}

export async function fetchCompanyHolidays() {
  const full = await supabase.from('company_holidays').select(HOLIDAY_COLUMNS).order('name')
  if (!full.error) return { rows: full.data || [], missing: false, columnsMissing: false }
  if (missingColumn(full.error)) {
    const basic = await supabase.from('company_holidays').select('id, name, start_date, end_date, notes').order('name')
    if (basic.error) {
      if (missingTable(basic.error)) return { rows: [], missing: true, columnsMissing: false }
      throw basic.error
    }
    return { rows: basic.data || [], missing: false, columnsMissing: true }
  }
  if (missingTable(full.error)) return { rows: [], missing: true, columnsMissing: false }
  throw full.error
}

export async function saveCompanyHolidays(rows) {
  const { data: existing, error: readError } = await supabase.from('company_holidays').select('id')
  if (readError) throw readError
  const kept = new Set(rows.filter((row) => row.id).map((row) => row.id))
  const removed = (existing || []).filter((row) => !kept.has(row.id)).map((row) => row.id)
  if (removed.length) {
    const { error } = await supabase.from('company_holidays').delete().in('id', removed)
    if (error) throw error
  }
  const payloads = rows.map(payloadFrom)
  const updates = payloads.filter((row) => row.id)
  const inserts = payloads.filter((row) => !row.id)
  if (updates.length) {
    const { error } = await supabase.from('company_holidays').upsert(updates)
    if (error) throw error
  }
  if (inserts.length) {
    const { error } = await supabase.from('company_holidays').insert(inserts, { defaultToNull: false })
    if (error) throw error
  }
  const loaded = await fetchCompanyHolidays()
  return loaded.rows
}
