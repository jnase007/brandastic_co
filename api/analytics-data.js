/* eslint-env node */
import { analyticsResponseHeaders, runAnalyticsRequest } from '../server/analyticsHttp.js'

function tokenFrom(req) {
  return String(req.headers.authorization || req.headers.Authorization || '').replace(/^Bearer\s+/i, '')
}

export default async function handler(req, res) {
  const headers = analyticsResponseHeaders()
  for (const [key, value] of Object.entries(headers)) res.setHeader(key, value)
  const url = new URL(req.url || '/', 'http://localhost')
  const result = await runAnalyticsRequest(process.env, {
    method: req.method,
    token: tokenFrom(req),
    range: url.searchParams.get('range'),
  })
  res.status(result.status).json(result.body)
}
