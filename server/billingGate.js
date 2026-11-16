/**
 * Billing is limited to exactly two login emails.
 * The addresses come only from BILLING_ALLOWED_EMAILS.
 * Anything else — missing, one address, three addresses, duplicates — denies everyone.
 */

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function parseAllowlist(raw) {
  const emails = String(raw || '')
    .split(/[,\n]/)
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean)
  const unique = [...new Set(emails)]
  if (unique.length !== 2) return null
  if (!unique.every((email) => email.length <= 254 && EMAIL_PATTERN.test(email))) return null
  return unique
}

export function isAllowedEmail(allowlist, email) {
  if (!Array.isArray(allowlist) || allowlist.length !== 2) return false
  const normalized = String(email || '').trim().toLowerCase()
  if (!normalized) return false
  return allowlist.includes(normalized)
}
