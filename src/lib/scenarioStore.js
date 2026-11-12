const STORE = 'brd-scenario-list-v1'
const LEGACY = 'brd-scenarios-v1'

function readJson(key) {
  try {
    return JSON.parse(localStorage.getItem(key) || 'null')
  } catch {
    return null
  }
}

function writeList(list) {
  localStorage.setItem(STORE, JSON.stringify(list))
}

function snapshot(payload) {
  return {
    raiseFrom: payload.raiseFrom || '',
    raiseUntil: payload.raiseUntil || '',
    raises: payload.raises || {},
    extraClient: payload.extraClient || '',
    trendYear: payload.trendYear || '',
    otherMonthly: payload.otherMonthly || '',
    offBooks: payload.offBooks || '',
    clientEnds: payload.clientEnds || {},
    clientPlans: payload.clientPlans || {},
    futureClients: payload.futureClients || [],
  }
}

export function listScenarios() {
  const list = readJson(STORE)
  if (Array.isArray(list) && list.length) return list
  const legacy = readJson(LEGACY)
  if (!legacy) return []
  return [{
    id: 'legacy',
    name: 'Saved scenario',
    savedAt: new Date().toISOString(),
    data: snapshot(legacy),
  }]
}

export function loadScenario() {
  const list = listScenarios()
  const currentId = localStorage.getItem(`${STORE}-current`)
  const match = list.find((row) => row.id === currentId) || list[0]
  if (!match) return Promise.resolve(null)
  return Promise.resolve({ ...match.data, currentId: match.id, currentName: match.name, list })
}

export function saveScenario(payload, { name, id } = {}) {
  const list = listScenarios()
  const label = String(name || payload.currentName || 'Scenario').trim() || 'Scenario'
  const now = new Date().toISOString()
  const data = snapshot(payload)
  let nextId = id || payload.currentId
  if (nextId) {
    const index = list.findIndex((row) => row.id === nextId)
    if (index >= 0) {
      list[index] = { ...list[index], name: label, savedAt: now, data }
    } else {
      list.unshift({ id: nextId, name: label, savedAt: now, data })
    }
  } else {
    nextId = `s-${Date.now()}`
    list.unshift({ id: nextId, name: label, savedAt: now, data })
  }
  writeList(list)
  localStorage.setItem(`${STORE}-current`, nextId)
  return Promise.resolve({ savedLocal: true, error: null, id: nextId, list })
}

export function saveScenarioAs(payload, name) {
  return saveScenario(payload, { name, id: null })
}

export function deleteScenario(id) {
  const list = listScenarios().filter((row) => row.id !== id)
  writeList(list)
  const current = localStorage.getItem(`${STORE}-current`)
  if (current === id) localStorage.removeItem(`${STORE}-current`)
  return list
}

export function setCurrentScenario(id) {
  if (id) localStorage.setItem(`${STORE}-current`, id)
}
