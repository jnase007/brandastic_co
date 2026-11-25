import { useEffect, useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import DealReportingDashboard from '../components/DealReports'
import { MeetingCloseRateSection } from '../components/MeetingCloseRate'
import {
  BucketBars,
  DualAxisChart,
  EmptyPanel,
  Gauge,
  Heatmap,
  HorizontalBars,
  KeywordSpark,
  KpiCard,
  Legend,
  PositionBadge,
  StageFunnel,
  Trend,
  WinLossDonut,
  formatCount,
  formatPosition,
} from '../components/analytics/AnalyticsVisuals'
import { estimateRankCheck, fetchAnalytics, rankCheckStatus, startRankCheck } from '../lib/analyticsApi'
import { previousAnalyticsRange, resolveAnalyticsRange } from '../lib/analyticsRange'
import { salesSnapshot } from '../lib/analyticsSales'
import { formatMoney } from '../lib/leads'
import { KEYWORD_CATEGORIES } from '../lib/keywordCategoryLabels'
import { ensureValidSession, supabase } from '../lib/supabase'

const RANGES = ['7', '28', '90']

function money(value) {
  if (value == null) return '—'
  return formatMoney(value) || '$0'
}

function ctr(value) {
  if (value == null) return '—'
  return `${(value * 100).toFixed(1)}%`
}

function Section({ id, kicker, title, children }) {
  return (
    <section id={id} className="space-y-4" aria-labelledby={`${id}-title`}>
      <header>
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-brand-orange">{kicker}</p>
        <h2 id={`${id}-title`} className="text-xl font-semibold tracking-tight text-slate-900">{title}</h2>
      </header>
      {children}
    </section>
  )
}

function Card({ title, info, children }) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm" title={info}>
      <h3 className="mb-3 text-sm font-semibold text-slate-900">{title}</h3>
      {children}
    </article>
  )
}

export default function Analytics() {
  const [rangeId, setRangeId] = useState('28')
  const [state, setState] = useState({ status: 'loading' })
  const [leads, setLeads] = useState(null)
  const [leadError, setLeadError] = useState('')
  const [rankingOnly, setRankingOnly] = useState(true)
  const [query, setQuery] = useState('')
  const [openTable, setOpenTable] = useState(false)
  const [dialog, setDialog] = useState(null)
  const [check, setCheck] = useState(null)

  const load = () => {
    fetchAnalytics(rangeId).then(setState).catch(() => setState({ status: 'error' }))
  }

  useEffect(() => {
    const previous = document.title
    document.title = 'Analytics'
    let robots = document.querySelector('meta[name="robots"]')
    const created = !robots
    if (!robots) {
      robots = document.createElement('meta')
      robots.setAttribute('name', 'robots')
      document.head.appendChild(robots)
    }
    const prior = robots.getAttribute('content')
    robots.setAttribute('content', 'noindex, nofollow, noarchive')
    return () => {
      document.title = previous
      if (created) robots.remove()
      else if (prior == null) robots.removeAttribute('content')
      else robots.setAttribute('content', prior)
    }
  }, [])

  useEffect(() => {
    load()
    const timer = setInterval(load, 180000)
    return () => clearInterval(timer)
  }, [rangeId])

  useEffect(() => {
    if (state.status !== 'ready') return undefined
    let cancel = false
    ensureValidSession().then(() => supabase.from('sales_leads').select('*').order('first_contact_date', { ascending: false }))
      .then(({ data, error }) => {
        if (cancel) return
        if (error) {
          setLeadError('Deals could not be loaded.')
          setLeads([])
        } else {
          setLeadError('')
          setLeads(data || [])
        }
      })
    return () => { cancel = true }
  }, [state.status])

  useEffect(() => {
    if (!check?.runId || check.done) return undefined
    const timer = setInterval(async () => {
      const result = await rankCheckStatus(check.runId)
      const status = result.body?.status
      if (status === 'completed' || status === 'failed' || status === 'cancelled') {
        setCheck({ ...result.body, done: true })
        load()
      } else {
        setCheck(result.body)
      }
    }, 5000)
    return () => clearInterval(timer)
  }, [check?.runId, check?.done])

  const range = resolveAnalyticsRange(rangeId)
  const report = state.status === 'ready' ? state.report : null
  const sales = useMemo(() => (leads ? salesSnapshot(leads, range) : null), [leads, range])
  const priorSales = useMemo(() => (leads ? salesSnapshot(leads, previousAnalyticsRange(range)) : null), [leads, range])

  if (state.status === 'unauthorized') return <Navigate to="/login" replace />

  const keywords = report?.keywords?.rows || []
  const visibleKeywords = keywords.filter((row) => {
    if (rankingOnly && !row.ranking) return false
    if (query && !row.keyword.toLowerCase().includes(query.trim().toLowerCase())) return false
    return true
  })

  return (
    <div className="min-h-full bg-[#f6f7fb] px-4 py-6 lg:px-8">
      <div className="mx-auto flex max-w-[1200px] flex-col gap-8">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-brand-orange">Sales</p>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Analytics</h1>
            <p className="mt-1 text-sm text-slate-500">brandastic.com · refreshes every few minutes · rankings update only when you start a check</p>
          </div>
          <div className="flex rounded-full bg-white p-1 shadow-sm" role="group" aria-label="Date range">
            {RANGES.map((id) => {
              const item = resolveAnalyticsRange(id)
              return (
                <button key={id} type="button" aria-pressed={rangeId === id} onClick={() => setRangeId(id)} className={`rounded-full px-3 py-1.5 text-sm font-semibold ${rangeId === id ? 'bg-brand-orange text-white' : 'text-slate-600'}`}>
                  {item.label.replace('Last ', '')}
                </button>
              )
            })}
          </div>
        </header>

        {state.status === 'loading' ? <p className="flex items-center gap-2 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Loading analytics…</p> : null}
        {state.status === 'forbidden' ? <EmptyPanel title="You don't have access to analytics." testId="analytics-forbidden">This page is limited to the same two people as Billing.</EmptyPanel> : null}
        {state.status === 'not_configured' ? <EmptyPanel title="Analytics access is not configured." testId="analytics-unconfigured">Set BILLING_ALLOWED_EMAILS to exactly two login emails, the same variable Billing uses.</EmptyPanel> : null}
        {state.status === 'error' ? <EmptyPanel title="Analytics could not be loaded.">Try again in a moment. No numbers are filled in when the request fails.</EmptyPanel> : null}

        {state.status === 'ready' ? (
          <>
            <SalesSection sales={sales} prior={priorSales} leads={leads} error={leadError} range={range} />
            <SearchSection search={report.search} />
            <KeywordSection
              report={report.keywords}
              rows={visibleKeywords}
              rankingOnly={rankingOnly}
              onToggle={() => setRankingOnly((value) => !value)}
              query={query}
              onQuery={setQuery}
              openTable={openTable}
              onOpenTable={() => setOpenTable((value) => !value)}
              onRefresh={() => { setDialog({ status: 'loading' }); estimateRankCheck().then((result) => setDialog(result.body || { estimate: null })) }}
              check={check}
            />
            <AiSection ai={report.ai} />
          </>
        ) : null}
      </div>
      {dialog ? (
        <RankDialog
          dialog={dialog}
          busy={check && !check.done}
          onClose={() => setDialog(null)}
          onConfirm={async () => {
            setDialog(null)
            setCheck({ status: 'starting' })
            const result = await startRankCheck()
            setCheck(result.body || { status: 'failed', done: true })
          }}
        />
      ) : null}
    </div>
  )
}

function SalesSection({ sales, prior, leads, error, range }) {
  return (
    <Section id="sales" kicker="01" title="Sales pipeline">
      {error ? <EmptyPanel title="Deals could not be loaded.">{error}</EmptyPanel> : null}
      {!leads && !error ? <p className="text-sm text-slate-500">Loading deals…</p> : null}
      {sales ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard label="Open pipeline" value={money(sales.openValue)} current={sales.openValue} previous={prior?.openValue} hint={range.label} testId="kpi-open-value" />
            <KpiCard label="Weighted pipeline" value={money(sales.weightedValue)} current={sales.weightedValue} previous={prior?.weightedValue} hint="Stage weights on the deal board" color="#00AEEF" />
            <KpiCard label="Win rate" value={sales.winRate == null ? '—' : `${sales.winRate.toFixed(1)}%`} current={sales.winRate} previous={prior?.winRate} suffix="%" />
            <KpiCard label="New deals" value={formatCount(sales.createdCount)} current={sales.createdCount} previous={prior?.createdCount} hint="By created date" color="#8B5CF6" />
          </div>
          <div className="grid gap-3 lg:grid-cols-3">
            <Card title="Stage funnel" info="Count of deals whose lead date is in this range. Value uses the deal board amount.">
              <StageFunnel stages={sales.distribution.filter((stage) => stage.id !== 'lost').map((stage) => ({ ...stage, valueLabel: money(stage.value) }))} />
            </Card>
            <Card title="Won vs lost" info="A deal that is both Closed and Deal Lost counts as won, matching the existing reports.">
              <WinLossDonut won={sales.wonCount} lost={sales.lostCount} />
              <p className="mt-3 text-sm text-slate-600">Won {money(sales.wonValue)} · Lost {money(sales.lostValue)}</p>
              <p className="mt-1 text-sm text-slate-600">Average won deal {sales.averageDealSize == null ? '—' : money(sales.averageDealSize)}</p>
            </Card>
            <Card title="Lost reasons" info="Counted from the lost reason stored on the deal.">
              {sales.hasLostReasons ? <HorizontalBars rows={sales.lostReasons.map((row) => ({ label: row.reason, value: row.count }))} color="#FF6B6B" /> : <p className="text-sm text-slate-500">{sales.lostCount ? 'Lost reasons are not stored on these deals.' : 'No lost deals in this range.'}</p>}
            </Card>
          </div>
          <Card title="Days to close" info={sales.cycle.reason}>
            <p className="text-4xl font-semibold text-slate-300">—</p>
            <p className="mt-2 text-sm text-slate-500">{sales.cycle.reason}</p>
          </Card>
          <MeetingCloseRateSection leads={sales.leads} monthView="all" year={Number(range.endDate.slice(0, 4))} />
          <details className="rounded-2xl border border-slate-200 bg-white p-4">
            <summary className="cursor-pointer text-sm font-semibold text-slate-900">Eight report views</summary>
            <div className="mt-4">
              <DealReportingDashboard rows={sales.leads} monthView="all" onMonth={() => {}} now={new Date()} focus="all" onFocus={() => {}} controls={false} />
            </div>
          </details>
        </>
      ) : null}
    </Section>
  )
}

function SearchSection({ search }) {
  if (!search?.connected) {
    return (
      <Section id="search" kicker="02" title="Site analytics">
        <EmptyPanel title="Search Console is not connected." testId="search-empty">
          {search?.reason === 'not_configured'
            ? 'Add OPENSEO_API_KEY on the Vercel server. Search Console is read through the Brandastic OpenSEO project, which already has the property connected. No clicks or positions are shown until that key is set.'
            : 'OpenSEO did not return Search Console data. Nothing is estimated in its place.'}
        </EmptyPanel>
      </Section>
    )
  }
  const totals = search.totals || {}
  const previous = search.previous || {}
  const series = search.series || []
  return (
    <Section id="search" kicker="02" title="Site analytics">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Clicks" value={formatCount(totals.clicks)} current={totals.clicks} previous={previous.clicks} series={series.map((row) => row.clicks)} />
        <KpiCard label="Impressions" value={formatCount(totals.impressions)} current={totals.impressions} previous={previous.impressions} series={series.map((row) => row.impressions)} color="#00AEEF" />
        <KpiCard label="CTR" value={ctr(totals.ctr)} current={totals.ctr == null ? null : totals.ctr * 100} previous={previous.ctr == null ? null : previous.ctr * 100} series={series.map((row) => (row.ctr || 0) * 100)} color="#8B5CF6" />
        <KpiCard label="Average position" value={formatPosition(totals.position)} current={totals.position} previous={previous.position} invert series={series.map((row) => row.position).filter((value) => value != null)} color="#00D4AA" />
      </div>
      <Card title="Clicks, impressions, and position" info="Orange is clicks, blue dashes are impressions, teal is average position. Lower position is better.">
        <DualAxisChart series={series} />
        <Legend items={[{ label: 'Clicks', color: '#F7931E' }, { label: 'Impressions, own scale', color: '#00AEEF' }, { label: 'Avg position, lower is higher on the chart', color: '#00D4AA' }]} />
      </Card>
      <div className="grid gap-3 lg:grid-cols-2">
        <Card title="Top queries" info="Search Console queries for this range.">
          <HorizontalBars rows={(search.queries || []).map((row) => ({ label: row.key, value: row.clicks, display: `${formatCount(row.clicks)} clicks` }))} />
        </Card>
        <Card title="Top pages" info="Search Console pages for this range.">
          <HorizontalBars rows={(search.pages || []).map((row) => ({ label: row.key.replace('https://brandastic.com', ''), value: row.clicks, display: `${formatCount(row.clicks)} clicks` }))} color="#00AEEF" />
        </Card>
      </div>
    </Section>
  )
}

function KeywordSection({ report, rows, rankingOnly, onToggle, query, onQuery, openTable, onOpenTable, onRefresh, check }) {
  if (!report?.connected) {
    return (
      <Section id="keywords" kicker="03" title="SEO keywords">
        <EmptyPanel title="OpenSEO rank tracking is not connected." testId="keywords-empty">
          {report?.reason === 'not_configured'
            ? 'Add OPENSEO_API_KEY. Optional overrides: OPENSEO_PROJECT_ID and OPENSEO_RANK_TRACKER_ID. The keyword list stays empty until the key can read the Brandastic tracker.'
            : 'OpenSEO did not return tracker keywords. No positions are filled in.'}
        </EmptyPanel>
      </Section>
    )
  }
  const groups = KEYWORD_CATEGORIES.map((category) => {
    const items = rows.filter((row) => row.category === category.id).slice().sort((a, b) => (a.position ?? 999) - (b.position ?? 999))
    const ranked = items.filter((row) => row.position != null)
    const average = ranked.length ? ranked.reduce((sum, row) => sum + row.position, 0) / ranked.length : null
    return { ...category, items, average }
  }).filter((group) => group.items.length)
  return (
    <Section id="keywords" kicker="03" title="SEO keywords">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-600">
          Showing {report.ranking} ranking of {report.tracked} tracked
          {report.lastCheckedAt ? ` · last checked ${new Date(report.lastCheckedAt).toLocaleString()}` : ''}
        </p>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={onToggle} className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700" aria-pressed={!rankingOnly}>
            {rankingOnly ? 'Show all tracked' : 'Ranking only'}
          </button>
          <button type="button" onClick={onRefresh} disabled={check && !check.done} className="rounded-full bg-slate-900 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50">
            {check && !check.done ? 'Checking rankings…' : 'Refresh rankings'}
          </button>
        </div>
      </div>
      {check?.status ? <p className="text-sm text-slate-500">Rank check: {check.status}{check.done ? '' : ' · this page will reload when it finishes'}</p> : null}
      <input value={query} onChange={(event) => onQuery(event.target.value)} placeholder="Search keywords" aria-label="Search keywords" className="h-10 w-full max-w-sm rounded-lg border border-slate-200 bg-white px-3 text-sm" />
      <div className="grid gap-3 lg:grid-cols-2">
        {groups.map((group) => (
          <article key={group.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <h3 className="font-semibold text-slate-900">{group.label}</h3>
                <p className="text-xs text-slate-500">{group.items.length} keywords · avg position {formatPosition(group.average)}</p>
              </div>
            </div>
            <BucketBars rows={group.items} />
            <ul className="mt-3 space-y-2">
              {group.items.slice(0, 5).map((row) => (
                <li key={row.id} className="flex items-center justify-between gap-2" title={row.rankingUrl || row.keyword}>
                  <span className="truncate text-sm text-slate-700">{row.keyword}</span>
                  <span className="flex items-center gap-2">
                    <KeywordSpark history={row.history} />
                    <PositionBadge position={row.position} />
                    <Trend current={row.position} previous={row.previousPosition} invert />
                  </span>
                </li>
              ))}
            </ul>
          </article>
        ))}
      </div>
      <button type="button" onClick={onOpenTable} className="text-sm font-semibold text-[#1644ED]">{openTable ? 'Hide table' : 'Show keyword table'}</button>
      {openTable ? <KeywordTable rows={rows} /> : null}
    </Section>
  )
}

function KeywordTable({ rows }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
      <table className="w-full min-w-[880px] text-left text-sm">
        <thead className="text-[11px] uppercase tracking-wide text-slate-400">
          <tr>{['Keyword', 'URL', 'Position', 'Change', 'Best', 'Volume', 'KD', 'CPC', 'Checked'].map((label) => <th key={label} className="px-3 py-2">{label}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-t border-slate-100">
              <td className="px-3 py-2 font-medium text-slate-800">{row.keyword}</td>
              <td className="max-w-[180px] truncate px-3 py-2 text-slate-500">{row.rankingUrl || '—'}</td>
              <td className="px-3 py-2"><PositionBadge position={row.position} /></td>
              <td className="px-3 py-2"><Trend current={row.position} previous={row.previousPosition} invert /></td>
              <td className="px-3 py-2">{formatPosition(row.bestPosition)}</td>
              <td className="px-3 py-2">{row.volume == null ? '—' : formatCount(row.volume)}</td>
              <td className="px-3 py-2">{row.kd == null ? '—' : row.kd}</td>
              <td className="px-3 py-2">{row.cpc == null ? '—' : `$${Number(row.cpc).toFixed(2)}`}</td>
              <td className="px-3 py-2 text-slate-500">{row.checked ? (row.lastChecked ? new Date(row.lastChecked).toLocaleDateString() : 'Checked') : 'Not checked'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function AiSection({ ai }) {
  if (!ai?.connected) {
    return (
      <Section id="ai" kicker="04" title="AI visibility">
        <EmptyPanel title="AI visibility is not connected." testId="ai-empty">
          {ai?.reason === 'not_configured'
            ? 'The same OPENSEO_API_KEY reads the Brandastic AI tracker. No mention rate is shown until that read succeeds.'
            : 'OpenSEO did not return AI visibility. Unchecked prompts are not marked as misses.'}
        </EmptyPanel>
      </Section>
    )
  }
  const checked = (ai.prompts || []).some((prompt) => (prompt.engines || []).length)
  return (
    <Section id="ai" kicker="04" title="AI visibility">
      <div className="grid gap-3 lg:grid-cols-[280px_minmax(0,1fr)]">
        <Card title="Mention rate" info={ai.trendStatus === 'comparable' ? 'Change versus the previous OpenSEO period.' : 'No earlier period to compare yet.'}>
          {checked || ai.score != null ? <Gauge value={ai.score} label="Brand mentions" /> : <EmptyPanel title="Not checked yet">Prompts are listed, and each engine stays blank until a stored answer exists.</EmptyPanel>}
          <div className="mt-2 flex justify-center"><Trend current={ai.score} previous={ai.trend == null || ai.score == null ? null : ai.score - ai.trend} /></div>
        </Card>
        <Card title="Share of voice" info="Mentions in the latest stored run. Competitors come from the OpenSEO project.">
          {(ai.voices || []).length ? <HorizontalBars rows={ai.voices.map((voice) => ({ label: voice.name, value: voice.mentions, display: `${voice.mentions} mentions`, color: voice.own ? '#F7931E' : '#00AEEF' }))} /> : <p className="text-sm text-slate-500">No competitor comparison was stored on this run.</p>}
        </Card>
      </div>
      <Card title="Prompt by engine" info="Green means mentioned and cited. Orange means mentioned. Gray means an answer was stored without a mention.">
        <Heatmap prompts={ai.prompts || []} />
        <Legend items={[{ label: 'Mentioned and cited', color: '#10b981' }, { label: 'Mentioned', color: '#fb923c' }, { label: 'Not mentioned', color: '#e2e8f0' }, { label: 'Not checked', color: '#f1f5f9' }]} />
      </Card>
    </Section>
  )
}

function RankDialog({ dialog, busy, onClose, onConfirm }) {
  const estimate = dialog?.estimate
  const cost = estimate?.credits != null ? `${estimate.credits} credits` : estimate?.max != null ? `up to $${estimate.max}` : estimate?.min != null ? `from $${estimate.min}` : null
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/40 p-4" role="dialog" aria-modal="true" aria-labelledby="rank-check-title">
      <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
        <h2 id="rank-check-title" className="text-lg font-semibold text-slate-900">Refresh rankings?</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">This starts one OpenSEO rank check for the Brandastic mobile tracker. It uses credits and does not change the tracker schedule, devices, or keywords.</p>
        <p className="mt-3 text-sm font-semibold text-slate-800">{cost ? `Estimated cost: ${cost}.` : 'OpenSEO did not return an estimate. Starting a check still uses credits.'}</p>
        {dialog?.reason === 'cooldown' ? <p className="mt-2 text-sm text-amber-700">A check already ran in the last hour. Next check {dialog.nextAt ? new Date(dialog.nextAt).toLocaleString() : 'later'}.</p> : null}
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-600">Cancel</button>
          <button type="button" onClick={onConfirm} disabled={busy || dialog?.allowed === false || dialog?.status === 'loading'} className="rounded-lg bg-brand-orange px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">Start check</button>
        </div>
      </div>
    </div>
  )
}
