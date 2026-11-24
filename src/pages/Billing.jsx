import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import '../profitability.css'
import { connectQuickBooks, fetchBilling, qboActionError, refreshQuickBooks } from '../lib/billingApi'
import { BillingScreen } from './BillingScreen'

function readNotice() {
  const code = new URLSearchParams(window.location.search).get('qbo')
  if (!code) return ''
  const params = new URLSearchParams(window.location.search)
  params.delete('qbo')
  const next = params.toString()
  window.history.replaceState(null, '', `${window.location.pathname}${next ? `?${next}` : ''}`)
  if (code === 'connected') return 'QuickBooks connected. Refresh to pull receivables.'
  if (code === 'denied') return 'That QuickBooks connection was not allowed.'
  if (code === 'error') return 'QuickBooks did not connect. Try again.'
  return ''
}

export default function Billing({ view = 'billing' }) {
  const [state, setState] = useState({ status: 'loading' })
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => {
    const previousTitle = document.title
    document.title = view === 'subscriptions' ? 'Subscriptions · Billing' : 'Billing · Team'
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
  }, [view])

  useEffect(() => {
    setNotice(readNotice())
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

  async function reload() {
    const result = await fetchBilling()
    setState(result)
  }

  async function onConnect() {
    setBusy(true)
    setActionError('')
    try {
      const result = await connectQuickBooks()
      if (result.ok && result.url) {
        window.location.assign(result.url)
        return
      }
      setActionError(qboActionError(result.code))
    } catch {
      setActionError(qboActionError('intuit_rejected'))
    } finally {
      setBusy(false)
    }
  }

  async function onRefresh() {
    setBusy(true)
    setActionError('')
    try {
      const result = await refreshQuickBooks()
      if (result.ok) {
        await reload()
        setNotice('Receivables refreshed from QuickBooks.')
      } else {
        setActionError(qboActionError(result.code))
        await reload().catch(() => {})
      }
    } catch {
      setActionError(qboActionError('intuit_rejected'))
    } finally {
      setBusy(false)
    }
  }

  if (state.status === 'unauthorized') return <Navigate to="/login" replace />
  return (
    <BillingScreen
      state={state}
      view={view}
      busy={busy}
      actionError={actionError}
      notice={notice}
      onConnect={onConnect}
      onRefresh={onRefresh}
    />
  )
}
