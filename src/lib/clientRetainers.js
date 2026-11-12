import { useEffect, useState } from 'react'
import { supabase } from './supabase'

export async function fetchClientRetainers() {
  const { data, error } = await supabase.from('client_retainers').select('id, name, monthly, position').order('position').order('name')
  if (error) {
    if (`${error.message} ${error.code}`.includes('client_retainers') || error.code === '42P01' || error.code === 'PGRST205') return null
    throw error
  }
  return data || []
}

export async function saveClientRetainers(rows) {
  const { data: existing, error: readError } = await supabase.from('client_retainers').select('id')
  if (readError) throw readError
  const kept = new Set(rows.filter((row) => row.id).map((row) => row.id))
  const removed = (existing || []).map((row) => row.id).filter((id) => !kept.has(id))
  if (removed.length) {
    const { error } = await supabase.from('client_retainers').delete().in('id', removed)
    if (error) throw error
  }
  const payload = rows.map((row, position) => {
    const next = {
      ...(row.id ? { id: row.id } : {}),
      name: row.name.trim(),
      monthly: Number(row.monthly),
      position,
      updated_at: new Date().toISOString(),
    }
    if (!next.id) delete next.id
    return next
  })
  const { data, error } = await supabase.from('client_retainers').upsert(payload).select('id, name, monthly, position')
  if (error) throw error
  return data || []
}

export function useClientRetainers() {
  const [rows, setRows] = useState(undefined)
  const [missing, setMissing] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancel = false
    fetchClientRetainers()
      .then((result) => {
        if (cancel) return
        if (result == null) {
          setMissing(true)
          setRows([])
        } else {
          setRows(result)
        }
      })
      .catch((err) => {
        if (cancel) return
        setError(err.message || 'Could not load client retainers')
        setRows([])
      })
    return () => { cancel = true }
  }, [])

  return { rows, setRows, missing, error, ready: rows !== undefined }
}
