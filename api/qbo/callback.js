/* eslint-env node */
import { billingResponseHeaders } from '../../server/billingHttp.js'
import { runQboRequest } from '../../server/qboHttp.js'

export default async function handler(req, res) {
  const headers = billingResponseHeaders()
  for (const [key, value] of Object.entries(headers)) res.setHeader(key, value)
  const result = await runQboRequest(process.env, {
    method: req.method,
    url: req.url || '/api/qbo/callback',
    headers: req.headers,
  })
  if (result.redirect) {
    res.statusCode = result.status
    res.setHeader('Location', result.redirect)
    res.end()
    return
  }
  res.status(result.status).json(result.body)
}
