import { useEffect, useState } from 'react'
import { supabase } from './supabase'

const STORE = 'brd-client-retainers-v1'
const RATE = 175

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

function keyName(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '')
}

function hqAmount(name) {
  const key = keyName(name)
  const hit = HQ_RETAINERS.find((row) => key.includes(keyName(row.name)) || keyName(row.name).includes(key))
  return hit ? hit.monthly : 0
}

export function isInternalClient(row) {
  const name = String(row?.name || '').trim().toLowerCase()
  return name === 'brandastic' || name.startsWith('brandastic ')
}

function amountOf(row) {
  if (isInternalClient(row)) return 0
  const hours = Number(row.monthly_hours) || 0
  if (hours > 0) return Math.round(hours * RATE)
  return hqAmount(row.name)
}

export async function fetchClientRetainers() {
  const { data, error } = await supabase
    .from('clients')
    .select('id, name, monthly_hours, is_active, client_status')
    .order('name')
  if (error) throw error
  return {
    rows: (data || [])
      .filter((row) => row.is_active !== false && row.client_status !== 'inactive')
      .map((row) => ({
        id: row.id,
        name: row.name,
        monthly: amountOf(row),
        internal: isInternalClient(row),
        hours: Number(row.monthly_hours) || 0,
      })),
    missing: false,
  }
}

export async function saveClientRetainers(rows) {
  for (const row of rows) {
    const name = String(row.name || '').trim()
    if (isInternalClient({ name })) continue
    const monthly = Number(row.monthly) || 0
    const hours = monthly / RATE
    if (!row.id || String(row.id).startsWith('local-')) {
      const { error } = await supabase.from('clients').insert({ name, monthly_hours: hours, is_active: true, client_status: 'active' })
      if (error) throw error
      continue
    }
    const { error } = await supabase.from('clients').update({ monthly_hours: hours, name }).eq('id', row.id)
    if (error) throw error
  }
  const next = await fetchClientRetainers()
  return next.rows
}

export async function deactivateClient(id) {
  if (!id) return
  const { error } = await supabase.from('clients').update({ is_active: false, client_status: 'inactive' }).eq('id', id)
  if (error) throw error
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
        setMissing(false)
        setRows(result.rows)
      })
      .catch((err) => {
        if (cancel) return
        setError(err.message || 'Could not load clients')
        setRows([])
      })
    return () => { cancel = true }
  }, [])

  return { rows, setRows, missing, error, ready: rows !== undefined }
}
