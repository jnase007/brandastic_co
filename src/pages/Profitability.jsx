import { useEffect, useState } from 'react'
import { useLocation, useSearchParams } from 'react-router-dom'
import '../profitability.css'
import { ProfitabilityDashboard } from '../components/ProfitabilityDashboard'
import { profitRange } from '../lib/profitability'

function clientSlugFromPath(pathname) {
  const parts = String(pathname || '').split('/').filter(Boolean)
  if (parts[0] !== 'profitability') return ''
  if (!parts[1] || parts[1] === 'team') return ''
  return parts[1]
}

export default function Profitability() {
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const slug = clientSlugFromPath(location.pathname)
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const range = profitRange(searchParams.get('range') || undefined)

  useEffect(() => {
    let cancelled = false
    setData(null)
    setError('')
    const url = slug
      ? `https://dash.brandastic.com/api/profitability-data?slug=${encodeURIComponent(slug)}`
      : 'https://dash.brandastic.com/api/profitability-data'
    fetch(url)
      .then(async (res) => {
        const body = await res.json()
        if (!res.ok) throw new Error(body.error || 'Could not load profitability')
        return body
      })
      .then(async (body) => {
        if (slug && !(body.clients || []).some((c) => c.slug === slug)) {
          const fullRes = await fetch('https://dash.brandastic.com/api/profitability-data')
          const full = await fullRes.json()
          if (!cancelled) setData(full)
          return
        }
        if (!cancelled) setData(body)
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || 'Could not load profitability')
      })
    return () => {
      cancelled = true
    }
  }, [slug])

  if (error) {
    return (
      <div className="pr-page">
        <div className="pr-panel">
          <h1>Client Reports & Profitability</h1>
          <p className="pr-note">{error}</p>
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="pr-page">
        <div className="pr-panel">
          <h1>Client Reports & Profitability</h1>
          <p className="pr-note">Loading…</p>
        </div>
      </div>
    )
  }

  return (
    <ProfitabilityDashboard
      data={data}
      view={slug ? 'client' : 'overview'}
      slug={slug || ''}
      range={range}
    />
  )
}
