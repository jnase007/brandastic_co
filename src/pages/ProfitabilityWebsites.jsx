import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import '../profitability.css'
import { useLaborRateRows } from '../lib/laborRates'
import { fetchWebsites, formatHours, formatMoney, formatPct, websiteRows } from '../lib/websites'

export default function ProfitabilityWebsites() {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [hideDone, setHideDone] = useState(false)
  const [open, setOpen] = useState(() => new Set())
  const [notesOpen, setNotesOpen] = useState(() => new Set())
  const { rows } = useLaborRateRows()
  const rates = Array.isArray(rows) ? rows : null

  useEffect(() => {
    let cancelled = false
    fetchWebsites()
      .then((body) => {
        if (!cancelled) {
          setData(body)
          setError('')
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || 'Could not load websites')
      })
    return () => {
      cancelled = true
    }
  }, [])

  const builds = useMemo(() => {
    const list = websiteRows(data?.builds, rates)
    return list.sort((a, b) => (b.percent ?? -1) - (a.percent ?? -1) || a.summary.localeCompare(b.summary))
  }, [data, rates])
  const shown = hideDone ? builds.filter((build) => !build.done) : builds
  const active = builds.filter((build) => !build.done)
  const contracted = active.reduce((sum, build) => sum + (build.budgetHours || 0), 0)
  const logged = active.reduce((sum, build) => sum + build.loggedHours, 0)
  const contractValue = active.reduce((sum, build) => sum + (build.budgetAmount || 0), 0)
  const over = active.filter((build) => build.percent != null && build.percent > 100).length

  const toggle = (key) => {
    setOpen((current) => {
      const next = new Set(current)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const toggleNotes = (key) => {
    setNotesOpen((current) => {
      const next = new Set(current)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  return (
    <div className="pr-page">
      <header className="pr-header">
        <div className="pr-brand">
          <div>
            <strong>Profitability</strong>
            <h1>Websites</h1>
          </div>
        </div>
        <label className="ws-toggle">
          <input type="checkbox" checked={hideDone} onChange={(event) => setHideDone(event.target.checked)} />
          Hide done
        </label>
      </header>
      <p className="pr-back ws-links">
        <Link to="/profitability">← Marketing retainers</Link>
        <Link to="/profitability/team">Team</Link>
        <Link to="/people">People</Link>
      </p>

      {!data && !error ? (
        <div className="pr-panel">
          <p className="pr-note">Loading…</p>
        </div>
      ) : null}
      {error && !data ? (
        <div className="pr-panel">
          <p className="pr-note">{error}</p>
        </div>
      ) : null}

      {data ? (
        <>
          <div className="pr-kpis pr-profit-kpis">
            <article className="pr-kpi">
              <span>Active builds</span>
              <strong>{active.length}</strong>
              <small>Epics that are not done</small>
            </article>
            <article className="pr-kpi">
              <span>Total contract value</span>
              <strong>{formatMoney(contractValue)}</strong>
              <small>Budget for active builds</small>
            </article>
            <article className="pr-kpi">
              <span>Hours logged</span>
              <strong>{formatHours(logged)}</strong>
              <small>{formatHours(contracted)} contracted</small>
            </article>
            <article className="pr-kpi">
              <span>Builds over budget</span>
              <strong className={over ? 'over' : undefined}>{over}</strong>
              <small>Logged hours over contracted hours</small>
            </article>
          </div>

          {shown.length ? (
            <div className="ws-list">
              {shown.map((build) => (
                <article key={build.key} className="pr-panel ws-card">
                  <header className="ws-head">
                    <div>
                      <a href={build.url} target="_blank" rel="noreferrer">
                        {build.summary}
                      </a>
                    </div>
                    <div className="ws-pills">
                      {build.status ? <span className="ws-status">{build.status}</span> : null}
                      {!build.ready ? <span className="ws-badge">Billing not set up</span> : null}
                    </div>
                  </header>

                  {build.ready && build.budgetHours != null ? (
                    <div className="ws-progress">
                      <div className="ws-track" aria-hidden="true">
                        <span className={`ws-fill ws-${build.tone}`} style={{ width: `${Math.min(build.percent || 0, 100)}%` }} />
                      </div>
                      <strong className="ws-pct">{formatPct(build.percent)}%</strong>
                    </div>
                  ) : null}

                  {build.ready ? (
                    <dl className="ws-metrics">
                      <div>
                        <dt>Budget</dt>
                        <dd>{build.budgetAmount == null ? '—' : formatMoney(build.budgetAmount)}</dd>
                      </div>
                      <div>
                        <dt>Labor</dt>
                        <dd title={build.uncostedHours > 0 ? `${formatHours(build.uncostedHours)} have no cost rate` : undefined}>
                          {build.labor == null ? '—' : formatMoney(build.labor)}
                        </dd>
                      </div>
                      <div>
                        <dt>Margin</dt>
                        <dd className={build.margin != null && build.margin < 0 ? 'ws-negative' : undefined}>{build.margin == null ? '—' : formatMoney(build.margin)}</dd>
                      </div>
                    </dl>
                  ) : null}
                  <dl className="ws-metrics ws-hours">
                    <div>
                      <dt>Logged</dt>
                      <dd>
                        {formatHours(build.loggedHours)}
                        {build.budgetHours != null ? ` / ${formatHours(build.budgetHours)}` : ''}
                      </dd>
                    </div>
                    {build.ready ? (
                      <div>
                        <dt>Hours left</dt>
                        <dd className={build.hoursLeft != null && build.hoursLeft < 0 ? 'ws-negative' : undefined}>{formatHours(build.hoursLeft)}</dd>
                      </div>
                    ) : null}
                  </dl>

                  <div className="ws-actions">
                    {build.notes ? (
                      <button type="button" aria-expanded={notesOpen.has(build.key)} onClick={() => toggleNotes(build.key)}>
                        Billing notes
                      </button>
                    ) : null}
                    <button type="button" onClick={() => toggle(build.key)}>
                      {open.has(build.key) ? 'Hide hours by person' : 'Hours by person'}
                    </button>
                  </div>
                  {notesOpen.has(build.key) && build.notes ? <p className="ws-note">{build.notes}</p> : null}
                  {open.has(build.key) ? (
                    <div className="ws-people">
                      {build.people.length ? (
                        <table className="pr-table">
                          <thead>
                            <tr>
                              <th>Person</th>
                              <th>Hours</th>
                              <th>Labor</th>
                            </tr>
                          </thead>
                          <tbody>
                            {build.people.map((person) => (
                              <tr key={person.name}>
                                <td>{person.name}</td>
                                <td>{formatHours(person.hours)}</td>
                                <td>{person.labor == null ? '—' : formatMoney(person.labor)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      ) : (
                        <p className="pr-note">No time logged on this epic yet.</p>
                      )}
                    </div>
                  ) : null}
                </article>
              ))}
            </div>
          ) : (
            <div className="pr-panel">
              <p className="pr-note">{hideDone ? 'No open website builds.' : 'No website builds with the website-build label.'}</p>
            </div>
          )}
        </>
      ) : null}
    </div>
  )
}
