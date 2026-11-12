export const ACCESS_MANAGERS = ['justin@brandastic.com', 'sandy@brandastic.com']

export const PAGE_AREAS = [
  { key: 'profitability', label: 'Marketing Retainers' },
  { key: 'score_card', label: 'Score Card' },
  { key: 'people', label: 'People' },
]

function emailOf(user, profile) {
  return String(user?.email || profile?.email || '').trim().toLowerCase()
}

export function isAccessManager(user, profile) {
  const email = emailOf(user, profile)
  return ACCESS_MANAGERS.includes(email) || profile?.role === 'admin'
}

export function hasAreaAccess(user, profile, key) {
  const email = emailOf(user, profile)
  if (!email) return false
  if (isAccessManager(user, profile)) return true
  const access = profile?.page_access
  if (access && Object.prototype.hasOwnProperty.call(access, key)) return access[key] === true
  if (key === 'profitability' && email.startsWith('maxwell@')) return true
  if (key === 'score_card' && email.startsWith('aaron@')) return true
  return false
}

export async function savePageAccess(supabase, userId, pageAccess) {
  return supabase.from('profiles').update({ page_access: pageAccess }).eq('id', userId)
}
