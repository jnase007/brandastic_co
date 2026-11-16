/* eslint-env node */
import { billingResponseHeaders, runBillingRequest } from '../server/billingHttp.js'

function tokenFrom(req) {
  return String(req.headers.authorization || req.headers.Authorization || '').replace(/^Bearer\s+/i, '')
}

export default async function handler(req, res) {
  const headers = billingResponseHeaders()
  for (const [key, value] of Object.entries(headers)) res.setHeader(key, value)
  const result = await runBillingRequest(process.env, {
    method: req.method,
    token: tokenFrom(req),
    kind: 'access',
  })
  res.status(result.status).json(result.body)
}
