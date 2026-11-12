import { useEffect, useState } from 'react'
import { supabase } from './supabase'

const STORE = 'brd-client-retainers-v1'

export const HQ_RETAINERS = [
  { name: 'Adopt Hwy', monthly: 5880 },
  { name: 'CalOPS', monthly: 21000 },
  { name: "Check'n Play", monthly: 9600 },
  { name: 'Christian Heart School', monthly: 5250 },
  { name: 'Defy', monthly: 6750 },
  { name: 'DESS USA', monthly: 7800 },
  { name: 'Dhar Mann Studio', monthly: 5950 },
  { name: 'Friar Tux', monthly: 4550 },
  { name: 'Friar Tux Email', monthly: 2600 },
  { name: 'GrandSlam Tennis', monthly: 1750 },
  { name: 'Husby Crumack', monthly: 3500 },
  { name: 'IPA 1031 Group', monthly: 1199 },
  { name: 'JB White', monthly: 3500 },
  { name: 'Labtech PPC', monthly: 3500 },
  { name: 'Labtech SEO', monthly: 2650 },
  { name: 'Lee Partners', monthly: 1750 },
  { name: 'MonoB', monthly: 5000 },
  { name: 'Morehouse', monthly: 7500 },
  { name: 'Nordic ChatGPT', monthly: 850 },
  { name: 'Nordic Sauna', monthly: 3500 },
  { name: 'Paragon Implants', monthly: 3500 },
  { name: 'Posture Pump', monthly: 1000 },
  { name: 'Prudential Labs', monthly: 11000 },
  { name: 'Prudential Lab v2', monthly: 4500 },
  { name: 'Prudential v2', monthly: 4500 },
  { name: 'Revel Private Wealth', monthly: 4500 },
  { name: 'Roger Beltrans', monthly: 1500 },
  { name: 'Roger Beltrans 2nd PPC', monthly: 1750 },
  { name: 'Roger Beltrans SEO', monthly: 2625 },
  { name: 'Salvin', monthly: 10500 },
  { name: 'Salvin V2', monthly: 5250 },
  { name: 'Starboard Realty', monthly: 4350 },
  { name: 'Top Greener', monthly: 2500 },
  { name: 'Trico Realty', monthly: 1500 },
  { name: 'TriStar Insurance', monthly: 4500 },
  { name: 'Wearparts LLC', monthly: 10000 },
  { name: 'Wearparts v2', monthly: 3850 },
  { name: 'Young Surgical', monthly: 9100 },
  { name: 'Young Surgical V2', monthly: 4550 },
]

function readLocal() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORE) || '')
    if (Array.isArray(parsed) && parsed.length) return parsed
  } catch {
    /* ignore */
  }
  return HQ_RETAINERS.map((row, position) => ({ ...row, id: `local-${position}`, position }))
}

function writeLocal(rows) {
  localStorage.setItem(STORE, JSON.stringify(rows))
  return rows
}

export async function fetchClientRetainers() {
  const { data, error } = await supabase.from('client_retainers').select('id, name, monthly, position').order('position').order('name')
  if (error) {
    if (`${error.message} ${error.code}`.includes('client_retainers') || error.code === '42P01' || error.code === 'PGRST205') {
      return { rows: readLocal(), missing: true }
    }
    throw error
  }
  if (!(data || []).length) return { rows: readLocal(), missing: false }
  return { rows: data, missing: false }
}

export async function saveClientRetainers(rows) {
  const cleaned = rows.map((row, position) => ({
    ...(String(row.id || '').startsWith('local-') ? {} : row.id ? { id: row.id } : {}),
    name: String(row.name || '').trim(),
    monthly: Number(row.monthly),
    position,
    updated_at: new Date().toISOString(),
  }))
  const { data: existing, error: readError } = await supabase.from('client_retainers').select('id')
  if (readError) {
    const local = cleaned.map((row, position) => ({ ...row, id: row.id || `local-${position}` }))
    return writeLocal(local)
  }
  const kept = new Set(cleaned.filter((row) => row.id).map((row) => row.id))
  const removed = (existing || []).map((row) => row.id).filter((id) => !kept.has(id))
  if (removed.length) {
    const { error } = await supabase.from('client_retainers').delete().in('id', removed)
    if (error) throw error
  }
  const { data, error } = await supabase.from('client_retainers').upsert(cleaned).select('id, name, monthly, position')
  if (error) {
    const local = cleaned.map((row, position) => ({ ...row, id: row.id || `local-${position}` }))
    return writeLocal(local)
  }
  writeLocal(data || [])
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
        setMissing(Boolean(result.missing))
        setRows(result.rows)
      })
      .catch((err) => {
        if (cancel) return
        setError(err.message || 'Could not load client retainers')
        setRows(readLocal())
      })
    return () => { cancel = true }
  }, [])

  return { rows, setRows, missing, error, ready: rows !== undefined }
}
