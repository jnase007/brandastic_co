import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import '../profitability.css'
import { TeamDashboard } from '../components/TeamDashboard'
import { teamRange } from '../lib/team'

export default function ProfitabilityTeam() {
  const { member } = useParams()
  const [searchParams] = useSearchParams()
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const range = teamRange(searchParams.get('range') || undefined)
  const client = searchParams.get('client') || undefined

  useEffect(() => {
    let cancelled = false
    fetch('https://dash.brandastic.com/api/team-performance-data')
      .then(async (res) => {
        const body = await res.json()
        if (!res.ok) throw new Error(body.error || 'Could not load team')
        return body
      })
      .then((body) => {
        if (!cancelled) setData(body)
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || 'Could not load team')
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (error) {
    return (
      <div className="pr-page">
        <div className="pr-panel">
          <h1>Team Performance</h1>
          <p className="pr-note">{error}</p>
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="pr-page">
        <div className="pr-panel">
          <h1>Team Performance</h1>
          <p className="pr-note">Loading…</p>
        </div>
      </div>
    )
  }

  return (
    <TeamDashboard
      data={data}
      view={member ? 'person' : 'overview'}
      member={member}
      range={range}
      client={client}
    />
  )
}
