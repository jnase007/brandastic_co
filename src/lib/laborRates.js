import { useEffect, useState } from 'react'
import { supabase } from './supabase'

const RATE_COLUMNS = 'id, name, hourly, position, worker_type, weekly_capacity, role, birthday, start_date, show_on_announcements'
const WORKER_COLUMNS = 'id, name, hourly, position, worker_type, weekly_capacity, role'
const BASIC_COLUMNS = 'id, name, hourly, position'
const PROFILE_PREFIX = '__tp__:'

function isMissingTable(error, table) {
  const text = `${error?.message || ''} ${error?.code || ''} ${error?.details || ''}`
  return text.includes(table) || text.includes('PGRST205') || text.includes('42P01')
}

function errorText(error) {
  return `${error?.message || ''} ${error?.code || ''} ${error?.details || ''} ${error?.hint || ''}`.toLowerCase()
}

function isMissingWorkerColumn(error) {
  const text = errorText(error)
  return text.includes('worker_type') || text.includes('weekly_capacity') || text.includes('role')
}

function isMissingAnnounceColumn(error) {
  const text = errorText(error)
  return text.includes('birthday') || text.includes('start_date') || text.includes('show_on_announcements')
}

function isMissingProfileColumn(error) {
  const text = errorText(error)
  return isMissingWorkerColumn(error) || text.includes('42703') || text.includes('pgrst204')
}

function dateOrBlank(value) {
  const text = String(value || '').trim()
  return /^\d{4}-\d{2}-\d{2}/.test(text) ? text.slice(0, 10) : ''
}

function isProfileRow(row) {
  return String(row?.name || '').startsWith(PROFILE_PREFIX)
}

function profileRecord(row) {
  const workerType = row.workerType === 'contractor' ? 'contractor' : 'employee'
  return {
    name: row.name.trim(),
    workerType,
    weeklyCapacity: workerType === 'contractor' ? null : Number(row.weeklyCapacity) || 40,
    role: String(row.role || '').trim(),
    birthday: dateOrBlank(row.birthday),
    startDate: dateOrBlank(row.startDate),
    showOnAnnouncements: row.showOnAnnouncements !== false,
  }
}

function encodeProfileRow(row) {
  return PROFILE_PREFIX + encodeURIComponent(JSON.stringify(profileRecord(row)))
}

function decodeProfileRow(row) {
  try {
    const parsed = JSON.parse(decodeURIComponent(String(row.name).slice(PROFILE_PREFIX.length)))
    if (!parsed?.name) return null
    return parsed
  } catch {
    return null
  }
}

function applyProfileRows(people, profileRows) {
  const byName = new Map()
  for (const row of profileRows) {
    const parsed = decodeProfileRow(row)
    if (parsed) byName.set(String(parsed.name).toLowerCase(), parsed)
  }
  return people.map((row) => {
    const extra = byName.get(String(row.name).toLowerCase())
    if (!extra) return row
    return {
      ...row,
      worker_type: extra.workerType === 'contractor' ? 'contractor' : 'employee',
      weekly_capacity: extra.weeklyCapacity,
      role: extra.role || '',
      birthday: extra.birthday || null,
      start_date: extra.startDate || null,
      show_on_announcements: extra.showOnAnnouncements === false ? false : true,
    }
  })
}

function applyAnnounceProfiles(people, profileRows) {
  const byName = new Map()
  for (const row of profileRows) {
    const parsed = decodeProfileRow(row)
    if (parsed) byName.set(String(parsed.name).toLowerCase(), parsed)
  }
  return people.map((row) => {
    const extra = byName.get(String(row.name).toLowerCase())
    if (!extra) return { ...row, birthday: row.birthday || null, start_date: row.start_date || null, show_on_announcements: row.show_on_announcements !== false }
    return {
      ...row,
      birthday: extra.birthday || null,
      start_date: extra.startDate || null,
      show_on_announcements: extra.showOnAnnouncements === false ? false : true,
    }
  })
}

const ANNOUNCE_COLUMNS = 'id, name, birthday, start_date, show_on_announcements'

export async function fetchAnnouncementPeople() {
  const { data, error } = await supabase.from('labor_rates').select(ANNOUNCE_COLUMNS).order('name')
  if (error) {
    if (isMissingTable(error, 'labor_rates')) return null
    throw error
  }
  return { rows: (data || []).filter((row) => !isProfileRow(row)) }
}

export async function fetchLaborRates() {
  const full = await supabase.from('labor_rates').select(RATE_COLUMNS).order('position').order('name')
  if (!full.error) return { rows: (full.data || []).filter((row) => !isProfileRow(row)), profileReady: true }
  if (isMissingAnnounceColumn(full.error) && !isMissingWorkerColumn(full.error)) {
    const worker = await supabase.from('labor_rates').select(WORKER_COLUMNS).order('position').order('name')
    if (worker.error) throw worker.error
    const all = worker.data || []
    return { rows: applyAnnounceProfiles(all.filter((row) => !isProfileRow(row)), all.filter(isProfileRow)), profileReady: true }
  }
  if (isMissingProfileColumn(full.error)) {
    const basic = await supabase.from('labor_rates').select(BASIC_COLUMNS).order('position').order('name')
    if (basic.error) {
      if (isMissingTable(basic.error, 'labor_rates')) return null
      throw basic.error
    }
    const all = basic.data || []
    const people = applyProfileRows(all.filter((row) => !isProfileRow(row)), all.filter(isProfileRow))
    return { rows: people, profileReady: true }
  }
  if (isMissingTable(full.error, 'labor_rates')) return null
  throw full.error
}

export async function fetchMonthlyOverhead() {
  const { data, error } = await supabase
    .from('profit_settings')
    .select('monthly_overhead')
    .eq('id', 'default')
    .maybeSingle()
  if (error) {
    if (isMissingTable(error, 'profit_settings')) return null
    throw error
  }
  if (!data || data.monthly_overhead == null) return { monthlyOverhead: null }
  return { monthlyOverhead: Number(data.monthly_overhead) }
}

export function applyProfitInputs(data, rows, overhead) {
  if (!data) return data
  return {
    ...data,
    ...(rows ? {
      costRates: rows.filter((row) => !isProfileRow(row)).map((row) => ({
        name: row.name,
        hourly: Number(row.hourly),
        workerType: row.worker_type === 'contractor' ? 'contractor' : 'employee',
        weeklyCapacity: row.weekly_capacity == null || row.weekly_capacity === '' ? null : Number(row.weekly_capacity),
        role: row.role ? String(row.role) : '',
      })),
    } : {}),
    ...(overhead == null ? {} : { monthlyOverhead: Number(overhead) }),
  }
}

export async function saveLaborRates(rows) {
  const { data: existing, error: readError } = await supabase.from('labor_rates').select('id, name')
  if (readError) throw readError
  const storedProfiles = (existing || []).filter(isProfileRow)
  const kept = new Set(rows.filter((row) => row.id).map((row) => row.id))
  const removed = (existing || [])
    .filter((row) => !isProfileRow(row) && !kept.has(row.id))
    .map((row) => row.id)
  if (removed.length) {
    const { error } = await supabase.from('labor_rates').delete().in('id', removed)
    if (error) throw error
  }
  const payload = rows.map((row, position) => {
    const next = {
      ...(row.id ? { id: row.id } : {}),
      name: row.name.trim(),
      hourly: Number(row.hourly),
      position,
      worker_type: row.workerType === 'contractor' ? 'contractor' : 'employee',
      weekly_capacity: row.workerType === 'contractor' ? null : Number(row.weeklyCapacity) || 40,
      role: String(row.role || '').trim() || null,
      birthday: dateOrBlank(row.birthday) || null,
      start_date: dateOrBlank(row.startDate) || null,
      show_on_announcements: row.showOnAnnouncements !== false,
      updated_at: new Date().toISOString(),
    }
    if (next.id == null || next.id === '') delete next.id
    return next
  })
  const full = await writeLaborRates(payload, RATE_COLUMNS)
  if (!full.error) {
    if (storedProfiles.length) {
      await supabase.from('labor_rates').delete().in('id', storedProfiles.map((row) => row.id))
    }
    return { rows: (full.data || []).filter((row) => !isProfileRow(row)), profileSaved: true, announceSaved: true }
  }
  if (isMissingAnnounceColumn(full.error) && !isMissingWorkerColumn(full.error)) {
    const workerPayload = payload.map(({ birthday, start_date, show_on_announcements, ...row }) => row)
    const worker = await writeLaborRates(workerPayload, WORKER_COLUMNS)
    if (worker.error) throw worker.error
    const stored = await replaceProfileRows(storedProfiles, rows)
    return { rows: applyAnnounceProfiles(worker.data || [], stored), profileSaved: true, announceSaved: true }
  }
  if (!isMissingProfileColumn(full.error)) throw full.error
  const basicPayload = payload.map(({ worker_type, weekly_capacity, role, birthday, start_date, show_on_announcements, ...row }) => row)
  const basic = await writeLaborRates(basicPayload, BASIC_COLUMNS)
  if (basic.error) throw basic.error
  const stored = await replaceProfileRows(storedProfiles, rows)
  return { rows: applyProfileRows(basic.data || [], stored), profileSaved: true, announceSaved: true }
}

async function writeLaborRates(payload, columns) {
  const updates = []
  const inserts = []
  for (const row of payload) {
    const next = { ...row }
    if (next.id == null || next.id === '') delete next.id
    if (next.id) updates.push(next)
    else inserts.push(next)
  }
  if (updates.length) {
    const { error } = await supabase.from('labor_rates').upsert(updates)
    if (error) return { error }
  }
  if (inserts.length) {
    const { error } = await supabase.from('labor_rates').insert(inserts, { defaultToNull: false })
    if (error) return { error }
  }
  return supabase.from('labor_rates').select(columns).order('position')
}

async function replaceProfileRows(storedProfiles, rows) {
  if (storedProfiles.length) {
    const { error } = await supabase.from('labor_rates').delete().in('id', storedProfiles.map((row) => row.id))
    if (error) throw error
  }
  const profilePayload = rows.map((row) => ({
    name: encodeProfileRow(row),
    hourly: 0.01,
    position: 10000,
    updated_at: new Date().toISOString(),
  }))
  const stored = await supabase.from('labor_rates').insert(profilePayload, { defaultToNull: false }).select('id, name')
  if (stored.error) throw stored.error
  return stored.data || []
}

export async function saveMonthlyOverhead(monthlyOverhead) {
  const { error } = await supabase.from('profit_settings').upsert({
    id: 'default',
    monthly_overhead: monthlyOverhead,
    updated_at: new Date().toISOString(),
  })
  if (error) throw error
  return monthlyOverhead
}

export function useLaborRateRows() {
  const [rows, setRows] = useState(undefined)
  const [overhead, setOverhead] = useState(undefined)
  const [missing, setMissing] = useState(false)
  const [profileReady, setProfileReady] = useState(true)
  const [overheadMissing, setOverheadMissing] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancel = false
    Promise.all([fetchLaborRates(), fetchMonthlyOverhead()])
      .then(([rateResult, overheadResult]) => {
        if (cancel) return
        if (rateResult == null) {
          setMissing(true)
          setProfileReady(false)
          setRows(null)
        } else {
          setRows(rateResult.rows)
          setProfileReady(rateResult.profileReady)
        }
        if (overheadResult == null) {
          setOverheadMissing(true)
          setOverhead(null)
        } else {
          setOverhead(overheadResult.monthlyOverhead)
        }
      })
      .catch((err) => {
        if (cancel) return
        setError(err.message || 'Could not load costs')
        setRows(null)
        setOverhead(null)
      })
    return () => {
      cancel = true
    }
  }, [])

  return {
    rows,
    setRows,
    profileReady,
    overhead,
    setOverhead,
    missing,
    overheadMissing,
    error,
    ready: rows !== undefined && overhead !== undefined,
  }
}
