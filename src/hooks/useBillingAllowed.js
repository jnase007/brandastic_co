import { useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { fetchBillingAllowed } from '../lib/billingApi'

export function useBillingAllowed() {
  const { user } = useAuth()
  const [allowed, setAllowed] = useState(false)

  useEffect(() => {
    let cancelled = false
    if (!user?.id) {
      setAllowed(false)
      return undefined
    }
    fetchBillingAllowed(user.id)
      .then((ok) => {
        if (!cancelled) setAllowed(ok === true)
      })
      .catch(() => {
        if (!cancelled) setAllowed(false)
      })
    return () => {
      cancelled = true
    }
  }, [user?.id])

  return allowed
}
