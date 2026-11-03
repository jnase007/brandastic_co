import { useEffect, useState } from 'react'
import { supabase } from './supabase'

export function isMissingLaborRates(error) {
  const text = `${error?.message || ''} ${error?.code || ''} ${error?.details || ''}`
  return text.includes('labor_rates') || text.includes('PGRST205') || text.includes('42P01')
}

export async function fetchLaborRates() {
  const { data, error } = await supabase
    .from('labor_rates')
    .select('id, name, hourly, position')
    .order('position')
    .order('name')
  if (error) {
    if (isMissingLaborRates(error)) return null
    throw error
  }
  return data || []
}

export function applyLaborRates(data, rows) {
  if (!data || !rows) return data
  return {
    ...data,
    costRates: rows.map((row) => ({ name: row.name, hourly: Number(row.hourly) })),
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

export function useLaborRateRows() {
  const [rows, setRows] = useState(undefined)
  const [missing, setMissing] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancel = false
    fetchLaborRates()
      .then((result) => {
        if (cancel) return
        if (result == null) {
          setMissing(true)
          setRows(null)
          return
        }
        setRows(result)
      })
      .catch((err) => {
        if (cancel) return
        setError(err.message || 'Could not load hourly costs')
        setRows(null)
      })
    return () => {
      cancel = true
    }
  }, [])

  return { rows, setRows, missing, error, ready: rows !== undefined }
}
