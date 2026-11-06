import { supabase } from './supabase'

export async function fetchHosting() {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new Error('Sign in required')
  const response = await fetch('/api/hosting-data', {
    headers: { Authorization: `Bearer ${token}` },
  })
  const body = await response.json()
  if (!response.ok) throw new Error(body.error || 'Could not load hosting')
  return body
}
