import { useEffect, useState } from 'react'
import { supabase } from './supabase'

function isMissingTable(error, table) {
  const text = `${error?.message || ''} ${error?.code || ''} ${error?.details || ''}`
  return text.includes(table) || text.includes('PGRST205') || text.includes('42P01')
}

export async function fetchLaborRates() {
  const { data, error } = await supabase
    .from('labor_rates')
    .select('id, name, hourly, position')
    .order('position')
    .order('name')
  if (error) {
    if (isMissingTable(error, 'labor_rates')) return null
    throw error
  }
  return data || []
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
    ...(rows ? { costRates: rows.map((row) => ({ name: row.name, hourly: Number(row.hourly) })) } : {}),
    ...(overhead == null ? {} : { monthlyOverhead: Number(overhead) }),
  }
}

export async function saveLaborRates(rows) {
  const { data: existing, error: readError } = await supabase.from('labor_rates').select('id')
  if (readError) throw readError
  const kept = new Set(rows.filter((row) => row.id).map((row) => row.id))
  const removed = (existing || []).map((row) => row.id).filter((id) => !kept.has(id))
  if (removed.length) {
    const { error } = await supabase.from('labor_rates').delete().in('id', removed)
    if (error) throw error
  }
  const payload = rows.map((row, position) => ({
    ...(row.id ? { id: row.id } : {}),
    name: row.name.trim(),
    hourly: Number(row.hourly),
    position,
    updated_at: new Date().toISOString(),
  }))
  const { data, error } = await supabase
    .from('labor_rates')
    .upsert(payload)
    .select('id, name, hourly, position')
    .order('position')
  if (error) throw error
  return data || []
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
  const [overheadMissing, setOverheadMissing] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancel = false
    Promise.all([fetchLaborRates(), fetchMonthlyOverhead()])
      .then(([rateResult, overheadResult]) => {
        if (cancel) return
        if (rateResult == null) {
          setMissing(true)
          setRows(null)
        } else {
          setRows(rateResult)
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
    overhead,
    setOverhead,
    missing,
    overheadMissing,
    error,
    ready: rows !== undefined && overhead !== undefined,
  }
}
