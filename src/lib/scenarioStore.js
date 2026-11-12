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
    ...local,
    raiseFrom: data.raise_from || local?.raiseFrom || '',
    raises: data.raises || local?.raises || {},
    extraClient: data.extra_client == null ? (local?.extraClient || '') : String(data.extra_client),
    clientEnds: data.client_ends || local?.clientEnds || {},
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
    client_plans: payload.clientPlans || {},
    future_clients: payload.futureClients || [],
    updated_at: new Date().toISOString(),
  }
  const { error } = await supabase.from('scenario_plans').upsert(row)
  if (error) {
    const insert = await supabase.from('scenario_plans').insert(row)
    if (insert.error) return { savedLocal: true, error: insert.error }
  }
  return { savedLocal: true, error: null }
}
