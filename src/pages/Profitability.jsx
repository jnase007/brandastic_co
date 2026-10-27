import { useEffect, useState } from 'react'
import '../profitability.css'
import { ProfitabilityDashboard } from '../components/ProfitabilityDashboard'
import { profitRange } from '../lib/profitability'

export default function Profitability() {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const params = new URLSearchParams(window.location.search)
  const range = profitRange(params.get('range') || undefined)

  useEffect(() => {
    let cancelled = false
    fetch('https://dash.brandastic.com/api/profitability-data')
      .then(async (res) => {
        const body = await res.json()
        if (!res.ok) throw new Error(body.error || 'Could not load profitability')
        return body
      })
      .then((body) => {
        if (!cancelled) setData(body)
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || 'Could not load profitability')
      })
    return () => {
      cancelled = true
    }
  }, [])

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

  return <ProfitabilityDashboard data={data} view="overview" range={range} />
}
