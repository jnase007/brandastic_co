import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import {
  DualAxisChart,
  EmptyPanel,
  GoogleRank,
  HorizontalBars,
  KpiCard,
  Legend,
  MonthlyBars,
  RankLegend,
  RankSummary,
  SliceDonut,
  TimeSeriesChart,
  formatCount,
  formatPosition,
} from '../components/analytics/AnalyticsVisuals'
import { estimateRankCheck, fetchAnalytics, rankCheckStatus, startRankCheck } from '../lib/analyticsApi'
import { ANALYTICS_RANGES, COMPARE_MODES } from '../lib/analyticsRange'
import { KEYWORD_CATEGORIES } from '../lib/keywordCategoryLabels'
import { averageRank, isRankingKeyword } from '../lib/rankPages'

function ctr(value) {
  if (value == null) return '—'
  return `${(value * 100).toFixed(1)}%`
}

function share(part, whole) {
  if (!whole) return '—'
  return `${((part / whole) * 100).toFixed(1)}%`
}

function Section({ id, title, children }) {
  return (
    <section id={id} className="space-y-3" aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`} className="text-xl font-semibold tracking-tight text-slate-900">{title}</h2>
      {children}
    </section>
  )
}

function CompactEmpty({ title, children, testId }) {
  return (
    <details className="rounded-xl border border-dashed border-slate-300 bg-slate-50" data-testid={testId}>
      <summary className="cursor-pointer px-4 py-2 text-sm font-semibold text-slate-800">{title}</summary>
      <p className="px-4 pb-3 text-sm leading-6 text-slate-600">{children}</p>
    </details>
  )
}

function externalHref(value) {
  const raw = String(value || '').trim()
  if (!raw) return ''
  if (/^https?:\/\//i.test(raw)) return raw
  if (/^(www\.)?brandastic\.com(\/|$)/i.test(raw)) return `https://${raw.replace(/^\/\//, '')}`
  if (raw.startsWith('/')) return `https://brandastic.com${raw}`
  return ''
}

function ExternalLink({ href, children, className = '' }) {
  const url = externalHref(href)
  if (!url) return <span className={className}>{children || '—'}</span>
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className={`text-[#1644ED] hover:underline ${className}`}>
      {children || url.replace(/^https?:\/\//, '')}
    </a>
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

function missingCopy(reason, what) {
  if (reason === 'not_configured') {
    return `Missing environment variable: OPENSEO_API_KEY. Add it on the Vercel project brandastic-co and redeploy. ${what}`
  }
  if (reason === 'ga4_not_connected' || reason === 'not_connected') {
    return 'OPENSEO_API_KEY is set, but this OpenSEO project does not have that Google property saved. In OpenSEO, open the Brandastic project, Project settings, Integrations, and connect it.'
  }
  return 'OpenSEO did not return this data. Nothing is estimated in its place.'
}

export default function Analytics() {
  const [rangeId, setRangeId] = useState('30')
  const [compare, setCompare] = useState('period')
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')
  const [state, setState] = useState({ status: 'loading' })
  const [dialog, setDialog] = useState(null)
  const [check, setCheck] = useState(null)

  const load = () => {
    fetchAnalytics({
      range: rangeId,
      compare,
      start: rangeId === 'custom' ? customStart : undefined,
      end: rangeId === 'custom' ? customEnd : undefined,
    }).then(setState).catch(() => setState({ status: 'error' }))
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
  }, [rangeId, compare, customStart, customEnd])

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

  if (state.status === 'unauthorized') return <Navigate to="/login" replace />
  const report = state.status === 'ready' ? state.report : null

  return (
    <div className="min-h-full bg-[#f6f7fb] px-4 py-6 lg:px-8">
      <div className="mx-auto flex max-w-[1200px] flex-col gap-6">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-brand-orange">Marketing</p>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Analytics</h1>
            <p className="mt-1 text-sm text-slate-500">brandastic.com · live reads only · a rank check starts only from Refresh rankings</p>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <label className="text-xs font-semibold text-slate-500">
              Date range
              <select value={rangeId} onChange={(event) => setRangeId(event.target.value)} className="mt-1 block rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-800">
                {ANALYTICS_RANGES.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
              </select>
            </label>
            {rangeId === 'custom' ? (
              <div className="flex gap-2">
                <label className="text-xs font-semibold text-slate-500">Start<input type="date" value={customStart} onChange={(event) => setCustomStart(event.target.value)} className="mt-1 block rounded-full border border-slate-200 px-3 py-1.5 text-sm" /></label>
                <label className="text-xs font-semibold text-slate-500">End<input type="date" value={customEnd} onChange={(event) => setCustomEnd(event.target.value)} className="mt-1 block rounded-full border border-slate-200 px-3 py-1.5 text-sm" /></label>
              </div>
            ) : null}
            <div className="flex rounded-full bg-white p-1 shadow-sm" role="group" aria-label="Comparison">
              {COMPARE_MODES.map((item) => (
                <button key={item.id} type="button" aria-pressed={compare === item.id} onClick={() => setCompare(item.id)} className={`rounded-full px-3 py-1.5 text-sm font-semibold ${compare === item.id ? 'bg-brand-orange text-white' : 'text-slate-600'}`}>
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        </header>

        {state.status === 'loading' ? <p className="flex items-center gap-2 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Loading analytics…</p> : null}
        {state.status === 'forbidden' ? <EmptyPanel title="You don't have access to analytics." testId="analytics-forbidden">This page is limited to the same two people as Billing.</EmptyPanel> : null}
        {state.status === 'not_configured' ? <EmptyPanel title="Analytics access is not configured." testId="analytics-unconfigured">Set BILLING_ALLOWED_EMAILS to exactly two login emails, the same variable Billing uses.</EmptyPanel> : null}
        {state.status === 'error' ? <EmptyPanel title="Analytics could not be loaded.">Try again in a moment. No numbers are filled in when the request fails.</EmptyPanel> : null}

        {report ? (
          <>
            <MarketingKpis report={report} />
            <TrafficSection ga4={report.ga4} />
            <KeywordList report={report.keywords} check={check} onRefresh={() => { setDialog({ status: 'loading' }); estimateRankCheck().then((result) => setDialog(result.body || { estimate: null })) }} />
            <AiList ai={report.ai} />
            <SearchCharts search={report.search} />
            <OtherCharts ga4={report.ga4} />
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

function MarketingKpis({ report }) {
  const ga4 = report.ga4 || {}
  const organic = ga4.organic || {}
  const organicPrevious = organic.compare?.available ? organic.compare : {}
  const search = report.search || {}
  const totals = search.totals || {}
  const previous = search.compare?.available ? (search.previous || {}) : {}
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" data-testid="marketing-kpis">
      <KpiCard label="Organic users" value={formatCount(organic.users)} current={organic.users} previous={organicPrevious.users} mode="percent" color="#00AEEF" testId="kpi-users" />
      <KpiCard label="Organic sessions" value={formatCount(organic.sessions)} current={organic.sessions} previous={organicPrevious.sessions} mode="percent" series={(organic.series || []).map((row) => row.sessions).filter((value) => value != null)} />
      <KpiCard label="Clicks" value={formatCount(totals.clicks)} current={totals.clicks} previous={previous.clicks} mode="percent" series={(search.series || []).map((row) => row.clicks)} />
      <KpiCard label="Impressions" value={formatCount(totals.impressions)} current={totals.impressions} previous={previous.impressions} mode="percent" series={(search.series || []).map((row) => row.impressions)} color="#00AEEF" />
      <KpiCard label="Avg position" value={formatPosition(totals.position)} current={totals.position} previous={previous.position} invert color="#00D4AA" />
      <KpiCard label="Keywords ranking" value={formatCount(report.keywords?.ranking)} hint={`of ${formatCount(report.keywords?.tracked)} tracked`} color="#8B5CF6" />
      <KpiCard label="AI mention rate" value={report.ai?.score == null ? '—' : `${Number(report.ai.score).toFixed(1)}%`} current={report.ai?.score} previous={report.ai?.trend == null || report.ai?.score == null ? null : report.ai.score - report.ai.trend} color="#F7931E" />
      <KpiCard label="CTR" value={ctr(totals.ctr)} current={totals.ctr == null ? null : totals.ctr * 100} previous={previous.ctr == null ? null : previous.ctr * 100} />
    </div>
  )
}

function TrafficSection({ ga4 }) {
  if (!ga4?.connected) {
    return (
      <Section id="traffic" title="Site traffic and sources">
        <CompactEmpty title="Site traffic is not connected." testId="ga4-empty">{missingCopy(ga4?.reason, 'Users and sessions stay blank until that key is set.')}</CompactEmpty>
      </Section>
    )
  }
  const total = (ga4.channels || []).reduce((sum, row) => sum + (row.sessions || 0), 0)
  return (
    <Section id="traffic" title="Site traffic and sources">
      <p className="text-sm text-slate-500">Channel totals cover every GA4 session. The daily chart is Organic Search only. The dashed line is the selected comparison, aligned by day.</p>
      {ga4.organic?.compare && !ga4.organic.compare.available && ga4.organic.compare.note ? <p className="text-sm text-amber-800">{ga4.organic.compare.note}</p> : null}
      <div className="grid gap-3 lg:grid-cols-2">
        <Card title="Organic sessions over time" info="Daily Organic Search sessions. All-channel totals are in the table.">
          <TimeSeriesChart series={ga4.organic?.series?.length ? ga4.organic.series : ga4.series} compare={ga4.organic?.compare?.available ? ga4.organic.compare.series : []} label="Organic sessions over time" />
          <Legend items={[{ label: 'This range', color: '#F7931E' }, { label: ga4.organic?.compare?.label || 'Comparison', color: '#64748b' }]} />
        </Card>
        <Card title="Sessions by channel" info="Share of all sessions.">
          <SliceDonut slices={(ga4.channels || []).map((row) => ({ label: row.label, value: row.sessions }))} caption="Sessions" />
        </Card>
      </div>
      <Card title="Channel breakdown" info="Sessions and share of the period.">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-[11px] uppercase tracking-wide text-slate-400">
              <tr><th className="py-2">Channel</th><th className="py-2 text-right">Sessions</th><th className="py-2 text-right">Share</th></tr>
            </thead>
            <tbody>
              {(ga4.channels || []).map((row) => (
                <tr key={row.label} className="border-t border-slate-100">
                  <td className="py-2 font-medium text-slate-800">{row.label}</td>
                  <td className="py-2 text-right tabular-nums">{formatCount(row.sessions)}</td>
                  <td className="py-2 text-right tabular-nums">{share(row.sessions, total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <Card title="Last 13 months" info="Orange bars are organic sessions. Blue bars are Search Console clicks. A dash means that month was not returned.">
        <MonthlyBars months={ga4.monthly} />
        <Legend items={[{ label: 'Organic sessions', color: '#F7931E' }, { label: 'Clicks', color: '#00AEEF' }]} />
      </Card>
      <Card title="Top sources" info="Source / medium from GA4.">
        <HorizontalBars rows={(ga4.sources || []).map((row) => ({ label: row.label, value: row.sessions, display: formatCount(row.sessions) }))} color="#00AEEF" />
      </Card>
    </Section>
  )
}

function byGoogleRank(a, b) {
  if (a.position == null && b.position == null) return a.keyword.localeCompare(b.keyword)
  if (a.position == null) return 1
  if (b.position == null) return -1
  return a.position - b.position || a.keyword.localeCompare(b.keyword)
}

function KeywordList({ report, check, onRefresh }) {
  const [showHidden, setShowHidden] = useState(false)
  const [opened, setOpened] = useState(null)
  const all = report?.rows || []
  const ranking = all.filter(isRankingKeyword).slice().sort(byGoogleRank)
  const hidden = all.filter((row) => !isRankingKeyword(row)).slice().sort(byGoogleRank)
  const groups = KEYWORD_CATEGORIES.map((category) => {
    const ranked = ranking.filter((row) => row.category === category.id)
    const quiet = hidden.filter((row) => row.category === category.id)
    return { ...category, ranked, quiet, items: showHidden ? ranked.concat(quiet) : ranked }
  }).filter((group) => group.items.length)
  const firstId = groups[0]?.id
  const isOpen = (id) => (opened == null ? id === firstId : opened.has(id))
  const toggle = (id) => {
    setOpened((current) => {
      const next = new Set(current ?? (firstId ? [firstId] : []))
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }
  return (
    <Section id="keywords" title="Keyword rankings">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-2">
          <p className="text-sm text-slate-600">
            {report?.connected ? `${formatCount(ranking.length)} ranking in the top 40` : 'Not connected'}
            {report?.lastCheckedAt ? ` · latest completed mobile check ${new Date(report.lastCheckedAt).toLocaleString()}` : ''}
          </p>
          <RankLegend />
        </div>
        <button type="button" onClick={onRefresh} disabled={!report?.connected || (check && !check.done)} className="rounded-full bg-slate-900 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50">
          {check && !check.done ? 'Checking rankings…' : 'Refresh rankings'}
        </button>
      </div>
      {report?.connected ? <RankSummary rows={all} /> : null}
      {!report?.connected ? <CompactEmpty title="Keyword rankings are not connected." testId="keywords-empty">{missingCopy(report?.reason, 'The ranking list stays empty until that key is set.')}</CompactEmpty> : null}
      {hidden.length ? (
        <button type="button" onClick={() => setShowHidden((value) => !value)} className="self-start text-sm font-semibold text-[#1644ED] hover:underline" aria-expanded={showHidden}>
          {showHidden ? `Hide ${formatCount(hidden.length)} not ranking` : `Show ${formatCount(hidden.length)} not ranking`}
        </button>
      ) : null}
      {groups.map((group) => {
        const avg = averageRank(group.ranked)
        return (
          <div key={group.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <button type="button" aria-expanded={isOpen(group.id)} onClick={() => toggle(group.id)} className="flex w-full items-center justify-between gap-3 bg-slate-50 px-4 py-2 text-left">
              <span className="text-sm font-semibold text-slate-900">{group.label}</span>
              <span className="text-xs font-medium text-slate-500">
                {formatCount(group.ranked.length)} ranking{showHidden && group.quiet.length ? ` · ${formatCount(group.quiet.length)} not ranking` : ''}
                {avg == null ? '' : ` · avg #${avg}`}
              </span>
            </button>
            {isOpen(group.id) ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-left text-sm">
                  <thead className="text-[11px] uppercase tracking-wide text-slate-400">
                    <tr>
                      <th className="px-4 py-2">Google rank</th>
                      <th className="px-3 py-2">Keyword</th>
                      <th className="px-3 py-2">Ranking URL</th>
                      <th className="px-3 py-2 text-right">Volume</th>
                      <th className="px-3 py-2 text-right">KD</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.items.map((row) => (
                      <tr key={row.id} className="border-t border-slate-100">
                        <td className="px-4 py-2"><GoogleRank position={row.position} change={row.change} previous={row.previousPosition} /></td>
                        <td className="px-3 py-2 font-medium text-slate-900">{row.keyword}</td>
                        <td className="max-w-[240px] px-3 py-2"><ExternalLink href={row.rankingUrl} className="block truncate text-sm" /></td>
                        <td className="px-3 py-2 text-right text-xs tabular-nums text-slate-500">{row.volume == null ? '—' : formatCount(row.volume)}</td>
                        <td className="px-3 py-2 text-right text-xs tabular-nums text-slate-500">{row.kd == null ? '—' : formatCount(row.kd)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </div>
        )
      })}
    </Section>
  )
}

function AiList({ ai }) {
  const [showBlank, setShowBlank] = useState(false)
  const [showVoices, setShowVoices] = useState(false)
  const [opened, setOpened] = useState(null)
  if (!ai?.connected) {
    return (
      <Section id="ai" title="AI visibility rankings">
        <CompactEmpty title="AI visibility is not connected." testId="ai-empty">{missingCopy(ai?.reason, 'Prompt rankings stay blank until that key is set.')}</CompactEmpty>
      </Section>
    )
  }
  const prompts = ai.prompts || []
  const answered = prompts.filter((row) => row.appears != null)
  const blank = prompts.filter((row) => row.appears == null)
  const visible = showBlank ? prompts : answered
  const topics = []
  for (const row of visible) {
    const topic = row.topic || 'Other'
    const group = topics.find((item) => item.topic === topic)
    if (group) group.items.push(row)
    else topics.push({ topic, items: [row] })
  }
  const firstTopic = topics[0]?.topic
  const isOpen = (topic) => (opened == null ? topic === firstTopic : opened.has(topic))
  const toggle = (topic) => {
    setOpened((current) => {
      const next = new Set(current ?? (firstTopic ? [firstTopic] : []))
      if (next.has(topic)) next.delete(topic)
      else next.add(topic)
      return next
    })
  }
  const voices = (ai.voices || []).slice().sort((a, b) => (b.mentions || 0) - (a.mentions || 0) || Number(b.own) - Number(a.own))
  const voiced = voices.filter((row) => row.mentions > 0)
  const quietVoices = voices.length - voiced.length
  const shownVoices = showVoices ? voices : voiced.slice(0, 6)
  const totalMentions = voices.reduce((sum, row) => sum + (row.mentions || 0), 0)
  return (
    <Section id="ai" title="AI visibility rankings">
      {shownVoices.length ? (
        <Card title="Share of voice" info="Mentions in the latest stored run.">
          <HorizontalBars rows={shownVoices.map((row) => ({ label: row.name, value: row.mentions, display: share(row.mentions, totalMentions), color: row.own ? '#F7931E' : '#00AEEF' }))} />
          {voices.length > shownVoices.length ? (
            <button type="button" onClick={() => setShowVoices(true)} className="mt-2 text-sm font-semibold text-[#1644ED] hover:underline">
              Show {formatCount(voices.length - shownVoices.length)} more brands
            </button>
          ) : null}
          {showVoices && quietVoices ? (
            <button type="button" onClick={() => setShowVoices(false)} className="mt-2 text-sm font-semibold text-[#1644ED] hover:underline">
              Hide brands with no mentions
            </button>
          ) : null}
        </Card>
      ) : null}
      {blank.length ? (
        <button type="button" onClick={() => setShowBlank((value) => !value)} className="text-sm font-semibold text-[#1644ED] hover:underline" aria-expanded={showBlank}>
          {showBlank ? `Hide ${formatCount(blank.length)} prompts with no results` : `Show ${formatCount(blank.length)} prompts with no results`}
        </button>
      ) : null}
      {topics.map((group) => (
        <div key={group.topic} className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <button type="button" aria-expanded={isOpen(group.topic)} onClick={() => toggle(group.topic)} className="flex w-full items-center justify-between gap-3 bg-slate-50 px-4 py-2 text-left">
            <span className="text-sm font-semibold text-slate-900">{group.topic}</span>
            <span className="text-xs font-medium text-slate-500">{formatCount(group.items.length)}</span>
          </button>
          {isOpen(group.topic) ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="text-[11px] uppercase tracking-wide text-slate-400">
                  <tr>{['Prompt', 'Mentioned', 'Rank', 'Cited URL', 'Engine', 'Competitors', 'Checked'].map((label) => <th key={label} className="px-3 py-2">{label}</th>)}</tr>
                </thead>
                <tbody>
                  {group.items.map((row) => (
                    <tr key={row.id} className="border-t border-slate-100">
                      <td className="max-w-[280px] px-3 py-2 font-medium text-slate-900">{row.prompt}{row.paused ? ' · paused' : ''}</td>
                      <td className="px-3 py-2">{row.appears == null ? 'Not checked' : row.appears ? 'Yes' : 'No'}</td>
                      <td className="px-3 py-2">{row.rank == null ? '—' : row.rank}</td>
                      <td className="max-w-[220px] px-3 py-2"><ExternalLink href={row.citedUrl} className="block truncate text-sm" /></td>
                      <td className="px-3 py-2">{row.engine || '—'}</td>
                      <td className="px-3 py-2 text-slate-600">{(row.competitors || []).join(', ') || '—'}</td>
                      <td className="px-3 py-2 text-slate-500">{row.checkedAt ? new Date(row.checkedAt).toLocaleDateString() : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      ))}
    </Section>
  )
}

function SearchCharts({ search }) {
  if (!search?.connected) {
    return (
      <Section id="search" title="Search Console">
        <CompactEmpty title="Search Console is not connected." testId="search-empty">{missingCopy(search?.reason, 'Clicks and impressions stay blank until that key is set.')}</CompactEmpty>
      </Section>
    )
  }
  return (
    <Section id="search" title="Search Console">
      <Card title="Clicks, impressions, and position" info="Orange is clicks, blue dashes are impressions, teal is average position.">
        <DualAxisChart series={search.series || []} />
        <Legend items={[{ label: 'Clicks', color: '#F7931E' }, { label: 'Impressions, own scale', color: '#00AEEF' }, { label: 'Avg position', color: '#00D4AA' }]} />
      </Card>
      <div className="grid gap-3 lg:grid-cols-2">
        <Card title="Top queries"><HorizontalBars rows={(search.queries || []).map((row) => ({ label: row.key, value: row.clicks, display: `${formatCount(row.clicks)} clicks` }))} /></Card>
        <Card title="Top pages">
          <ul className="space-y-2">
            {(search.pages || []).map((row) => (
              <li key={row.key} className="flex items-center justify-between gap-3">
                <ExternalLink href={row.key} className="min-w-0 truncate text-sm" />
                <span className="shrink-0 text-xs font-semibold tabular-nums text-slate-600">{formatCount(row.clicks)} clicks</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </Section>
  )
}

function OtherCharts({ ga4 }) {
  if (!ga4?.connected) return null
  return (
    <Section id="audience" title="Audience">
      <div className="grid gap-3 lg:grid-cols-2">
        <Card title="Devices"><HorizontalBars rows={(ga4.devices || []).map((row) => ({ label: row.label, value: row.value, display: formatCount(row.value) }))} /></Card>
        <Card title="Countries"><HorizontalBars rows={(ga4.countries || []).map((row) => ({ label: row.label, value: row.value, display: formatCount(row.value) }))} color="#00D4AA" /></Card>
      </div>
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
        <p className="mt-2 text-sm leading-6 text-slate-600">This starts one OpenSEO rank check. It uses credits and does not change the tracker schedule, devices, or keywords.</p>
        <p className="mt-3 text-sm font-semibold text-slate-800">{cost ? `Estimated cost: ${cost}.` : 'OpenSEO did not return an estimate. Starting a check still uses credits.'}</p>
        {dialog?.reason === 'cooldown' ? <p className="mt-2 text-sm text-amber-700">A check already ran in the last hour.</p> : null}
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-600">Cancel</button>
          <button type="button" onClick={onConfirm} disabled={busy || dialog?.allowed === false || dialog?.status === 'loading'} className="rounded-lg bg-brand-orange px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">Start check</button>
        </div>
      </div>
    </div>
  )
}
