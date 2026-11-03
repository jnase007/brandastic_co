import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import '../profitability.css'
import { TeamDashboard } from '../components/TeamDashboard'
import { teamRange } from '../lib/team'
import { cachedTeam, fetchTeam } from '../lib/profitabilityCache'
import { applyLaborRates, useLaborRateRows } from '../lib/laborRates'
import LaborRates from '../components/LaborRates'

export default function ProfitabilityTeam() {
  const { member } = useParams()
  const [searchParams] = useSearchParams()
  const [data, setData] = useState(() => cachedTeam())
  const [error, setError] = useState('')
  const { rows, setRows, missing, error: rateError, ready } = useLaborRateRows()
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

  if (!ready || (!data && !error)) {
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
        <LaborRates
          rows={rows}
          fallback={[]}
          missing={missing || Boolean(rateError)}
          onSaved={setRows}
        />
        <div className="pr-panel">
          <h1>Team Performance</h1>
          <p className="pr-note">{error}</p>
        </div>
      </div>
    )
  }

  const viewData = applyLaborRates(data, rows)

  return (
    <TeamDashboard
      extra={(
        <LaborRates
          rows={rows}
          fallback={data.costRates}
          missing={missing || Boolean(rateError)}
          onSaved={setRows}
        />
      )}
      data={viewData}
      view={member ? 'person' : 'overview'}
      member={member}
      range={range}
      client={client}
    />
  )
}
