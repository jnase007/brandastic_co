/* eslint-env node */
import { billingResponseHeaders } from '../server/billingHttp.js'
import { runQboRequest } from '../server/qboHttp.js'

export default async function handler(req, res) {
  const headers = billingResponseHeaders()
  for (const [key, value] of Object.entries(headers)) res.setHeader(key, value)
  const result = await runQboRequest(process.env, {
    method: req.method,
    url: '/api/billing-refresh',
    headers: req.headers,
  })
  res.status(result.status).json(result.body)
}
