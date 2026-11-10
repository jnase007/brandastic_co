import { useEffect, useState } from 'react'
import { supabase } from './supabase'

const RATE_COLUMNS = 'id, name, hourly, position, worker_type, weekly_capacity, role'
const BASIC_COLUMNS = 'id, name, hourly, position'
const PROFILE_PREFIX = '__tp__:'

function isMissingTable(error, table) {
  const text = `${error?.message || ''} ${error?.code || ''} ${error?.details || ''}`
  return text.includes(table) || text.includes('PGRST205') || text.includes('42P01')
}

function isMissingProfileColumn(error) {
  const text = `${error?.message || ''} ${error?.code || ''} ${error?.details || ''}`
  return text.includes('worker_type') || text.includes('weekly_capacity') || text.includes('role') || text.includes('42703') || text.includes('PGRST204')
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
    }
  })
}

export async function fetchLaborRates() {
  const full = await supabase.from('labor_rates').select(RATE_COLUMNS).order('position').order('name')
  if (!full.error) return { rows: (full.data || []).filter((row) => !isProfileRow(row)), profileReady: true }
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
  const payload = rows.map((row, position) => ({
    ...(row.id ? { id: row.id } : {}),
    name: row.name.trim(),
    hourly: Number(row.hourly),
    position,
    worker_type: row.workerType === 'contractor' ? 'contractor' : 'employee',
    weekly_capacity: row.workerType === 'contractor' ? null : Number(row.weeklyCapacity) || 40,
    role: String(row.role || '').trim() || null,
    updated_at: new Date().toISOString(),
  }))
  const full = await supabase.from('labor_rates').upsert(payload).select(RATE_COLUMNS).order('position')
  if (!full.error) {
    if (storedProfiles.length) {
      await supabase.from('labor_rates').delete().in('id', storedProfiles.map((row) => row.id))
    }
    return { rows: (full.data || []).filter((row) => !isProfileRow(row)), profileSaved: true }
  }
  if (!isMissingProfileColumn(full.error)) throw full.error
  const basicPayload = payload.map(({ worker_type, weekly_capacity, role, ...row }) => row)
  const basic = await supabase.from('labor_rates').upsert(basicPayload).select(BASIC_COLUMNS).order('position')
  if (basic.error) throw basic.error
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
  const stored = await supabase.from('labor_rates').insert(profilePayload).select('id, name')
  if (stored.error) throw stored.error
  return { rows: applyProfileRows(basic.data || [], stored.data || []), profileSaved: true }
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
