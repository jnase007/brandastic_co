import { supabase } from './supabase'

const STORE = 'brd-scenarios-v1'

function readLocal() {
  try {
    return JSON.parse(localStorage.getItem(STORE) || 'null')
  } catch {
    return null
  }
}

function writeLocal(payload) {
  localStorage.setItem(STORE, JSON.stringify(payload))
}

export async function loadScenario() {
  const local = readLocal()
  const { data, error } = await supabase.from('scenario_plans').select('raise_from, raises, extra_client, client_ends').eq('id', 1).maybeSingle()
  if (error || !data) return local
  return {
    raiseFrom: data.raise_from || '',
    raises: data.raises || {},
    extraClient: data.extra_client == null ? '' : String(data.extra_client),
    clientEnds: data.client_ends || {},
  }
}

export async function saveScenario(payload) {
  writeLocal(payload)
  const row = {
    id: 1,
    raise_from: payload.raiseFrom || null,
    raises: payload.raises || {},
    extra_client: Number(String(payload.extraClient || '').replace(/[$,]/g, '')) || 0,
    client_ends: payload.clientEnds || {},
    updated_at: new Date().toISOString(),
  }
  const { error } = await supabase.from('scenario_plans').upsert(row)
  if (error) {
    const insert = await supabase.from('scenario_plans').insert(row)
    if (insert.error) return { savedLocal: true, error: insert.error }
  }
  return { savedLocal: true, error: null }
}
