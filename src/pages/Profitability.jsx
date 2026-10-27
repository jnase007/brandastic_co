import { useEffect, useState } from 'react'
import { useLocation, useSearchParams } from 'react-router-dom'
import '../profitability.css'
import { ProfitabilityDashboard } from '../components/ProfitabilityDashboard'
import { profitRange } from '../lib/profitability'
import { cachedProfitability, fetchProfitability } from '../lib/profitabilityCache'

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
  const [data, setData] = useState(() => cachedProfitability())
  const [error, setError] = useState('')
  const range = profitRange(searchParams.get('range') || undefined)

  useEffect(() => {
    let cancelled = false
    fetchProfitability()
      .then((body) => {
        if (!cancelled) {
          setData(body)
          setError('')
        }
      })
      .catch((err) => {
        if (!cancelled && !data) setError(err.message || 'Could not load profitability')
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (error && !data) {
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
