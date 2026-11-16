import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import '../profitability.css'
import { fetchBilling } from '../lib/billingApi'
import { BillingScreen } from './BillingScreen'

export default function Billing() {
  const [state, setState] = useState({ status: 'loading' })

  useEffect(() => {
    const previousTitle = document.title
    document.title = 'Billing · Team'
    let robots = document.querySelector('meta[name="robots"]')
    const createdRobots = !robots
    if (!robots) {
      robots = document.createElement('meta')
      robots.setAttribute('name', 'robots')
      document.head.appendChild(robots)
    }
    const previousRobots = robots.getAttribute('content')
    robots.setAttribute('content', 'noindex, nofollow, noarchive')

    let referrer = document.querySelector('meta[name="referrer"]')
    const createdReferrer = !referrer
    if (!referrer) {
      referrer = document.createElement('meta')
      referrer.setAttribute('name', 'referrer')
      document.head.appendChild(referrer)
    }
    const previousReferrer = referrer.getAttribute('content')
    referrer.setAttribute('content', 'no-referrer')

    return () => {
      document.title = previousTitle
      if (createdRobots) robots.remove()
      else if (previousRobots == null) robots.removeAttribute('content')
      else robots.setAttribute('content', previousRobots)
      if (createdReferrer) referrer.remove()
      else if (previousReferrer == null) referrer.removeAttribute('content')
      else referrer.setAttribute('content', previousReferrer)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    fetchBilling()
      .then((result) => {
        if (!cancelled) setState(result)
      })
      .catch(() => {
        if (!cancelled) setState({ status: 'error' })
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (state.status === 'unauthorized') return <Navigate to="/login" replace />
  return <BillingScreen state={state} />
}
