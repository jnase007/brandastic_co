/* eslint-env node */
import { analyticsResponseHeaders } from '../server/analyticsHttp.js'
import { runRankCheckRequest } from '../server/analyticsRankCheck.js'

function tokenFrom(req) {
  return String(req.headers.authorization || req.headers.Authorization || '').replace(/^Bearer\s+/i, '')
}

export default async function handler(req, res) {
  const headers = analyticsResponseHeaders()
  for (const [key, value] of Object.entries(headers)) res.setHeader(key, value)
  const url = new URL(req.url || '/', 'http://localhost')
  const result = await runRankCheckRequest(process.env, {
    method: req.method,
    token: tokenFrom(req),
    action: url.searchParams.get('action'),
    runId: url.searchParams.get('runId'),
  })
  res.status(result.status).json(result.body)
}
