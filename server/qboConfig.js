import { encryptionKey } from './qboCrypto.js'

export function usesSandbox(env) {
  if (String(env?.VERCEL_ENV || '') !== 'production') return true
  return String(env?.QBO_ENVIRONMENT || '').trim().toLowerCase() === 'sandbox'
}

export function qboSlot(env) {
  return usesSandbox(env) ? 'sandbox' : 'production'
}

export function qboApiHost(env) {
  return usesSandbox(env)
    ? 'https://sandbox-quickbooks.api.intuit.com'
    : 'https://quickbooks.api.intuit.com'
}

export function redirectUri(env) {
  const raw = String(env?.QBO_REDIRECT_URI || '').trim()
  if (!raw || raw.length > 500) return null
  let url
  try {
    url = new URL(raw)
  } catch {
    return null
  }
  if (url.username || url.password || url.hash || url.search) return null
  const production = String(env?.VERCEL_ENV || '') === 'production'
  const local = url.hostname === 'localhost' || url.hostname === '127.0.0.1'
  if (production) {
    if (url.protocol !== 'https:') return null
  } else if (url.protocol !== 'https:' && !(url.protocol === 'http:' && local)) {
    return null
  }
  if (!url.pathname.endsWith('/api/qbo/callback')) return null
  return raw
}

export function qboClientReady(env) {
  return Boolean(
    String(env?.QBO_CLIENT_ID || '').trim() &&
    String(env?.QBO_CLIENT_SECRET || '').trim() &&
    redirectUri(env) &&
    encryptionKey(env),
  )
}

export function assertSlotMatchesHost(env) {
  const sandboxSlot = qboSlot(env) === 'sandbox'
  const sandboxHost = qboApiHost(env).includes('sandbox-quickbooks')
  if (sandboxSlot !== sandboxHost) {
    const error = new Error('not_configured')
    error.code = 'not_configured'
    throw error
  }
}
