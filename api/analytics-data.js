/* eslint-env node */
import { analyticsResponseHeaders, runAnalyticsRequest } from '../server/analyticsHttp.js'

function tokenFrom(req) {
  return String(req.headers.authorization || req.headers.Authorization || '').replace(/^Bearer\s+/i, '')
}

export default async function handler(req, res) {
  const headers = analyticsResponseHeaders()
  for (const [key, value] of Object.entries(headers)) res.setHeader(key, value)
  const url = new URL(req.url || '/', 'http://localhost')
  const read = (name) => {
    const fromUrl = url.searchParams.get(name)
    if (fromUrl) return fromUrl
    const value = req.query?.[name]
    if (Array.isArray(value)) return value[0] || null
    return value == null ? null : String(value)
  }
  const result = await runAnalyticsRequest(process.env, {
    method: req.method,
    token: tokenFrom(req),
    range: read('range'),
    start: read('start'),
    end: read('end'),
    compare: read('compare'),
  })
  res.status(result.status).json(result.body)
}
