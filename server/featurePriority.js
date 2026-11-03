const ALLOWED = new Set(['High', 'Medium', 'Low', ''])

export async function writeFeaturePriority(env, body) {
  const category = String(body?.category || '').trim()
  const name = String(body?.name || '').trim()
  const priority = String(body?.priority ?? '').trim()
  if (!category || !name) return { status: 400, body: { error: 'Missing feature' } }
  if (!ALLOWED.has(priority)) return { status: 400, body: { error: 'Priority must be High, Medium, or Low.' } }
  const url = env.FEATURE_SHEET_WEB_APP_URL
  const token = env.FEATURE_SHEET_WRITE_TOKEN
  if (!url || !token) return { status: 503, body: { error: 'The sheet script is not connected yet.' } }

  const endpoint = new URL(url)
  endpoint.searchParams.set('token', token)
  endpoint.searchParams.set('category', category)
  endpoint.searchParams.set('name', name)
  endpoint.searchParams.set('priority', priority)
  const response = await fetch(endpoint)
  const text = await response.text()
  let payload
  try {
    payload = JSON.parse(text)
  } catch {
    payload = { ok: false, error: 'The sheet did not save that priority.' }
  }
  if (!response.ok || payload.ok === false) {
    return { status: 502, body: { error: payload.error || 'The sheet did not save that priority.' } }
  }
  return { status: 200, body: { ok: true } }
}
