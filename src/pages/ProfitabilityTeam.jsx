import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import '../profitability.css'
import { TeamDashboard } from '../components/TeamDashboard'
import { useAuth } from '../contexts/AuthContext'
import { teamRange } from '../lib/team'
import { cachedTeam, fetchTeam } from '../lib/profitabilityCache'
import { applyProfitInputs, useLaborRateRows } from '../lib/laborRates'

export default function ProfitabilityTeam() {
  const { member } = useParams()
  const [searchParams] = useSearchParams()
  const { isAdmin } = useAuth()
  const [data, setData] = useState(() => cachedTeam())
  const [error, setError] = useState('')
  const { rows, overhead } = useLaborRateRows()
  const range = teamRange(searchParams.get('range') || undefined)
  const client = searchParams.get('client') || undefined

  useEffect(() => {
    let cancelled = false
    fetchTeam()
      .then((body) => {
        if (!cancelled) {
          setData(body)
          setError('')
        }
      })
      .catch((err) => {
        if (!cancelled && !data) setError(err.message || 'Could not load team')
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (!data && !error) {
    return (
      <div className="pr-page">
        <div className="pr-panel">
          <h1>Team Performance</h1>
          <p className="pr-note">Loading…</p>
        </div>
      </div>
    )
  }

  if (error && !data) {
    return (
      <div className="pr-page">
        <div className="pr-panel">
          <h1>Team Performance</h1>
          <p className="pr-note">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <TeamDashboard
      data={applyProfitInputs(data, rows, overhead)}
      view={member ? 'person' : 'overview'}
      member={member}
      range={range}
      client={client}
      showMoney={isAdmin}
    />
  )
}
