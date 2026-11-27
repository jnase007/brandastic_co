import { BRAND, KpiCard, Legend, formatCount, formatPosition, rankTone } from './AnalyticsVisuals'
import { bestSearchQueries, rankGains, rankStatusLabel, seniorLocalKeywords, topTenKeywords, topTenTrend, winsSummary } from '../../lib/analyticsWins'

// Wins and Senior living Search Console visuals. Every number comes from the live report.

function KeywordChip({ row, emphasize = false }) {
  const label = rankStatusLabel(row)
  const ranked = !label
  return (
    <li
      className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-sm ${emphasize ? 'border-emerald-300 bg-emerald-50 font-semibold text-emerald-900 shadow-sm' : ranked ? 'border-slate-200 bg-white text-slate-800' : 'border-dashed border-slate-300 bg-slate-50 text-slate-600'}`}
      title={ranked ? `Google mobile position ${row.position} in Orange County` : label}
    >
      <span className={`inline-flex min-w-[2.25rem] justify-center rounded-full px-1.5 py-0.5 text-xs font-bold tabular-nums ${ranked ? rankTone(row.position) : 'bg-slate-200 text-slate-600'}`}>
        {ranked ? `#${formatPosition(row.position)}` : label}
      </span>
      <span>{row.keyword}</span>
      {ranked && Number(row.change) > 0 ? <span className="text-xs font-semibold text-emerald-700">▲{formatPosition(row.change)}</span> : null}
    </li>
  )
}

function TopTenTrendChart({ points }) {
  if (points.length < 2) return <p className="text-sm text-slate-500">The trend fills in after two completed rank checks.</p>
  const width = 320
  const height = 96
  const pad = 20
  const max = Math.max(...points.map((point) => point.top10), 1)
  const step = (width - pad * 2) / Math.max(points.length - 1, 1)
  const y = (value) => height - pad - (value / max) * (height - pad * 2)
  const line = (key) => points.map((point, index) => `${index ? 'L' : 'M'}${pad + index * step},${y(point[key])}`).join(' ')
  return (
    <div>
      <svg viewBox={`0 0 ${width} ${height}`} className="h-28 w-full" role="img" aria-label="Keywords in the top 10 at each rank check">
        <path d={line('top10')} fill="none" stroke={BRAND.teal} strokeWidth="3" strokeLinecap="round" />
        <path d={line('top3')} fill="none" stroke="#059669" strokeWidth="2" strokeDasharray="4 3" />
        {points.map((point, index) => (
          <g key={point.date}>
            <circle cx={pad + index * step} cy={y(point.top10)} r="4" fill={BRAND.teal} />
            <text x={pad + index * step} y={y(point.top10) - 8} textAnchor="middle" fontSize="10" className="fill-slate-700">{point.top10}</text>
            <text x={pad + index * step} y={height - 4} textAnchor="middle" fontSize="9" className="fill-slate-400">{point.date.slice(5)}</text>
          </g>
        ))}
      </svg>
      <Legend items={[{ label: 'Top 10 keywords', color: BRAND.teal }, { label: 'Top 3 keywords', color: '#059669' }]} />
    </div>
  )
}

export function WinsSection({ report }) {
  const rows = report?.keywords?.rows || []
  const summary = winsSummary(report)
  const top10 = topTenKeywords(rows)
  const pageOneTop = top10.filter((row) => row.position <= 3)
  const pageOneRest = top10.filter((row) => row.position > 3)
  const senior = seniorLocalKeywords(rows)
  const gains = rankGains(rows, 8)
  const trend = topTenTrend(rows)
  const best = bestSearchQueries(report?.searchExtras?.best || [], 10)
  const checked = report?.keywords?.lastCheckedAt ? new Date(report.keywords.lastCheckedAt).toLocaleString() : null
  return (
    <section id="wins" className="space-y-3 rounded-3xl border border-emerald-200 bg-gradient-to-br from-emerald-50 via-white to-sky-50 p-4 lg:p-5" aria-labelledby="wins-title" data-testid="wins-section">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-emerald-700">Team wins</p>
          <h2 id="wins-title" className="text-xl font-semibold tracking-tight text-slate-900">Where we're winning on Google</h2>
        </div>
        <p className="text-xs text-slate-500">{checked ? `Ranks from the latest mobile check, Orange County · ${checked}` : 'Ranks fill in after a completed rank check'}</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Top 3 on Google" value={formatCount(summary.top3)} hint={`of ${formatCount(summary.tracked)} tracked`} color="#059669" testId="wins-top3" />
        <KpiCard label="Page one (top 10)" value={formatCount(summary.top10)} hint="tracked keywords" series={trend.map((point) => point.top10)} color={BRAND.teal} testId="wins-top10" />
        <KpiCard label="Moved up since last check" value={formatCount(summary.improved)} hint="tracked keywords" color={BRAND.blue} testId="wins-improved" />
        <KpiCard label="Search Console top 10" value={formatCount(summary.gscTop10)} hint="queries, avg position 10 or better" color={BRAND.purple} testId="wins-gsc" />
      </div>
      <div className="grid gap-3 lg:grid-cols-3">
        <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm lg:col-span-2">
          <h3 className="mb-2 text-sm font-semibold text-slate-900">Page one keywords</h3>
          {top10.length ? (
            <div className="space-y-3">
              {pageOneTop.length ? (
                <div>
                  <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-emerald-700">Top 3</p>
                  <ul className="flex flex-wrap gap-2">{pageOneTop.map((row) => <KeywordChip key={row.id} row={row} emphasize />)}</ul>
                </div>
              ) : null}
              {pageOneRest.length ? (
                <div>
                  <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-slate-500">#4–10</p>
                  <ul className="flex flex-wrap gap-2">{pageOneRest.map((row) => <KeywordChip key={row.id} row={row} />)}</ul>
                </div>
              ) : null}
            </div>
          ) : <p className="text-sm text-slate-500">No tracked keyword is in the top 10 in the latest check.</p>}
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="mb-2 text-sm font-semibold text-slate-900">Top 10 over recent checks</h3>
          <TopTenTrendChart points={trend} />
        </article>
      </div>
      <div className="grid gap-3 lg:grid-cols-3">
        <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm" data-testid="wins-senior-oc">
          <h3 className="mb-2 text-sm font-semibold text-slate-900">Senior living · Orange County</h3>
          {senior.length ? <ul className="flex flex-wrap gap-2">{senior.map((row) => <KeywordChip key={row.id} row={row} emphasize={row.position != null && row.position <= 3} />)}</ul> : <p className="text-sm text-slate-500">No Orange County senior living keywords are tracked.</p>}
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="mb-2 text-sm font-semibold text-slate-900">Biggest gains vs prior check</h3>
          {gains.length ? (
            <ul className="space-y-1.5">
              {gains.map((row) => (
                <li key={row.id} className="flex items-center justify-between gap-2 text-sm">
                  <span className="truncate text-slate-800">{row.keyword}</span>
                  <span className="shrink-0 text-xs font-semibold tabular-nums text-emerald-700">#{formatPosition(row.previousPosition)} → #{formatPosition(row.position)} ▲{formatPosition(row.change)}</span>
                </li>
              ))}
            </ul>
          ) : <p className="text-sm text-slate-500">No keyword moved up between the last two checks.</p>}
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="mb-2 text-sm font-semibold text-slate-900">Best Search Console positions</h3>
          {best.length ? (
            <ul className="space-y-1.5">
              {best.map((row) => (
                <li key={row.key} className="flex items-center justify-between gap-2 text-sm" title={`${formatCount(row.impressions)} impressions, ${formatCount(row.clicks)} clicks`}>
                  <span className="truncate text-slate-800">{row.key}</span>
                  <span className="flex shrink-0 items-center gap-1.5">
                    <span className={`rounded-full px-1.5 py-0.5 text-xs font-bold tabular-nums ${rankTone(row.position)}`}>#{formatPosition(row.position)}</span>
                    <span className="text-[11px] tabular-nums text-slate-400">{formatCount(row.impressions)} impr.</span>
                  </span>
                </li>
              ))}
            </ul>
          ) : <p className="text-sm text-slate-500">Search Console returned no queries in the top 10 with 3+ impressions for this range.</p>}
        </article>
      </div>
    </section>
  )
}

export function SeniorSearchCard({ extras }) {
  const rows = extras?.senior || []
  const max = Math.max(...rows.map((row) => row.impressions), 1)
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm" data-testid="senior-gsc-card" title="Google Search Console queries containing senior, assisted living or memory care. Free data, all locations and devices.">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-900">Senior living searches in Google (Search Console)</h3>
        <span className="text-[11px] text-slate-400">avg position · impressions · all locations and devices</span>
      </div>
      {rows.length ? (
        <ul className="space-y-2">
          {rows.slice(0, 15).map((row) => (
            <li key={row.key} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1">
              <span className={`inline-flex min-w-[3rem] justify-center rounded-lg px-2 py-0.5 text-sm font-bold tabular-nums ${rankTone(row.position)}`}>#{formatPosition(row.position)}</span>
              <span className="truncate text-sm text-slate-800">{row.key}</span>
              <span className="text-xs font-semibold tabular-nums text-slate-600">{formatCount(row.impressions)}</span>
              <span className="col-span-3 block h-1.5 overflow-hidden rounded-full bg-slate-100">
                <span className="block h-full rounded-full" style={{ width: `${Math.max((row.impressions / max) * 100, row.impressions ? 4 : 0)}%`, background: BRAND.blue }} />
              </span>
            </li>
          ))}
        </ul>
      ) : <p className="text-sm text-slate-500">Search Console returned no senior living queries for this range.</p>}
    </article>
  )
}
