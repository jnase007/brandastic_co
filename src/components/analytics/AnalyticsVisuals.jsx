import { Sparkline } from '../Charts'
import { rankMeaning, rankSummary } from '../../lib/rankPages'

export const BRAND = {
  orange: '#F7931E',
  blue: '#00AEEF',
  teal: '#00D4AA',
  coral: '#FF6B6B',
  purple: '#8B5CF6',
  ink: '#1A1A2E',
}

export function formatCount(value) {
  if (value == null || Number.isNaN(Number(value))) return '—'
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(value)
}

export function formatPct(value, digits = 1) {
  if (value == null || Number.isNaN(Number(value))) return '—'
  const number = Math.abs(value) <= 1 && Math.abs(value) > 0 && digits === 1 ? value * 100 : value
  return `${number.toFixed(digits)}%`
}

export function formatPosition(value) {
  if (value == null || Number.isNaN(Number(value))) return '—'
  return Number(value).toFixed(1).replace(/\.0$/, '')
}

export function Trend({ current, previous, invert = false, suffix = '' }) {
  if (current == null || previous == null || Number.isNaN(Number(current)) || Number.isNaN(Number(previous))) {
    return <span className="text-xs font-medium text-slate-400">No prior period</span>
  }
  const diff = Number(current) - Number(previous)
  if (!Number.isFinite(diff)) return <span className="text-xs font-medium text-slate-400">No prior period</span>
  const better = invert ? diff < 0 : diff > 0
  const worse = invert ? diff > 0 : diff < 0
  const tone = !diff ? 'bg-slate-100 text-slate-600' : better ? 'bg-emerald-50 text-emerald-700' : worse ? 'bg-red-50 text-red-700' : 'bg-slate-100 text-slate-600'
  const arrow = !diff ? '●' : better ? '▲' : '▼'
  const shown = Math.abs(diff)
  const text = suffix === '%' ? `${shown.toFixed(1)} pts` : shown >= 100 ? formatCount(shown) : shown.toFixed(shown < 10 ? 1 : 0)
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${tone}`} title="Change versus the previous period">
      <span aria-hidden="true">{arrow}</span>
      {text}
    </span>
  )
}

export function PercentChange({ current, previous, invert = false }) {
  const currentNumber = Number(current)
  const previousNumber = Number(previous)
  if (current == null || previous == null || !Number.isFinite(currentNumber) || !Number.isFinite(previousNumber) || previousNumber === 0) {
    return <span className="text-xs font-medium text-slate-400">No comparison</span>
  }
  const pct = ((currentNumber - previousNumber) / previousNumber) * 100
  if (!Number.isFinite(pct)) return <span className="text-xs font-medium text-slate-400">No comparison</span>
  const better = invert ? pct < 0 : pct > 0
  const worse = invert ? pct > 0 : pct < 0
  const tone = !pct ? 'bg-slate-100 text-slate-600' : better ? 'bg-emerald-50 text-emerald-700' : worse ? 'bg-red-50 text-red-700' : 'bg-slate-100 text-slate-600'
  const arrow = !pct ? '●' : pct > 0 ? '▲' : '▼'
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${tone}`}>
      <span aria-hidden="true">{arrow}</span>
      {Math.abs(pct).toFixed(1)}%
    </span>
  )
}

export function KpiCard({ label, value, hint, current, previous, invert, series, color = BRAND.orange, testId, mode }) {
  return (
    <article className="flex min-h-[148px] flex-col justify-between rounded-2xl border border-slate-200 bg-white p-4 shadow-sm" data-testid={testId}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{label}</p>
          <p className="mt-1 text-3xl font-semibold tracking-tight text-slate-900">{value}</p>
        </div>
        {series?.length ? <Sparkline data={series} width={84} height={36} color={color} /> : <span className="h-9 w-16" />}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {mode === 'percent' ? <PercentChange current={current} previous={previous} invert={invert} /> : <Trend current={current} previous={previous} invert={invert} />}
        {hint ? <span className="text-[11px] text-slate-400">{hint}</span> : null}
      </div>
    </article>
  )
}

export function EmptyPanel({ title, children, testId }) {
  return (
    <section className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6" data-testid={testId}>
      <h3 className="text-base font-semibold text-slate-900">{title}</h3>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">{children}</p>
    </section>
  )
}

export function Legend({ items }) {
  return (
    <ul className="flex flex-wrap gap-3 text-xs text-slate-500">
      {items.map((item) => (
        <li key={item.label} className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: item.color }} />
          {item.label}
        </li>
      ))}
    </ul>
  )
}

export function StageFunnel({ stages }) {
  const max = Math.max(...stages.map((stage) => stage.count), 1)
  if (!stages.some((stage) => stage.count)) return <EmptyPanel title="No deals in this range">The funnel fills in when a lead date falls in the selected dates.</EmptyPanel>
  return (
    <ol className="space-y-2" aria-label="Deal stage funnel">
      {stages.map((stage) => (
        <li key={stage.id} className="grid grid-cols-[7.5rem_minmax(0,1fr)_auto] items-center gap-2" title={`${stage.title}: ${stage.count} deals, ${stage.valueLabel}`}>
          <span className="truncate text-sm text-slate-600">{stage.title}</span>
          <span className="block h-7 overflow-hidden rounded-md bg-slate-100">
            <span className="block h-full rounded-md" style={{ width: `${stage.count ? Math.max((stage.count / max) * 100, 6) : 0}%`, background: `linear-gradient(90deg, ${BRAND.orange}, ${BRAND.blue})` }} />
          </span>
          <span className="text-right text-xs font-semibold tabular-nums text-slate-700">{stage.count}</span>
        </li>
      ))}
    </ol>
  )
}

export function WinLossDonut({ won, lost }) {
  const total = won + lost
  if (!total) return <EmptyPanel title="No won or lost deals">Win rate appears after a deal in this range is won or lost.</EmptyPanel>
  const wonShare = won / total
  const radius = 42
  const circ = 2 * Math.PI * radius
  return (
    <div className="flex items-center gap-4">
      <svg width="120" height="120" viewBox="0 0 120 120" role="img" aria-label={`${won} won and ${lost} lost`}>
        <circle cx="60" cy="60" r={radius} fill="none" stroke="#e2e8f0" strokeWidth="14" />
        <circle cx="60" cy="60" r={radius} fill="none" stroke={BRAND.teal} strokeWidth="14" strokeDasharray={`${circ * wonShare} ${circ}`} strokeLinecap="butt" transform="rotate(-90 60 60)" />
        <circle cx="60" cy="60" r={radius} fill="none" stroke={BRAND.coral} strokeWidth="14" strokeDasharray={`${circ * (1 - wonShare)} ${circ}`} strokeDashoffset={-circ * wonShare} transform="rotate(-90 60 60)" />
        <text x="60" y="56" textAnchor="middle" className="fill-slate-900" fontSize="18" fontWeight="700">{Math.round(wonShare * 100)}%</text>
        <text x="60" y="74" textAnchor="middle" className="fill-slate-400" fontSize="10">won</text>
      </svg>
      <Legend items={[{ label: `Won ${won}`, color: BRAND.teal }, { label: `Lost ${lost}`, color: BRAND.coral }]} />
    </div>
  )
}

export function HorizontalBars({ rows, color = BRAND.orange, valueLabel = 'value' }) {
  const max = Math.max(...rows.map((row) => row.value), 1)
  if (!rows.length) return <p className="text-sm text-slate-500">Nothing to chart in this range.</p>
  return (
    <ul className="space-y-2">
      {rows.map((row) => (
        <li key={row.label} title={`${row.label}: ${row.display || row.value}`} className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1">
          <span className="truncate text-sm text-slate-700">{row.label}</span>
          <span className="text-xs font-semibold tabular-nums text-slate-600">{row.display || row.value}</span>
          <span className="col-span-2 block h-2 overflow-hidden rounded-full bg-slate-100">
            <span className="block h-full rounded-full" style={{ width: `${Math.max((row.value / max) * 100, row.value ? 4 : 0)}%`, background: row.color || color }} />
          </span>
        </li>
      ))}
    </ul>
  )
}

export function DualAxisChart({ series }) {
  const rows = (series || []).filter((row) => row.date)
  if (rows.length < 2) return <EmptyPanel title="No Search Console trend">A line chart appears when Search Console returns at least two days.</EmptyPanel>
  const width = 640
  const height = 220
  const pad = { l: 36, r: 36, t: 16, b: 28 }
  const maxClicks = Math.max(...rows.map((row) => row.clicks || 0), 1)
  const maxImpressions = Math.max(...rows.map((row) => row.impressions || 0), 1)
  const positions = rows.map((row) => row.position).filter((value) => value != null)
  const minPos = positions.length ? Math.min(...positions) : 1
  const maxPos = positions.length ? Math.max(...positions) : 1
  const x = (index) => pad.l + (index / (rows.length - 1)) * (width - pad.l - pad.r)
  const yOf = (value, max) => pad.t + (1 - (value || 0) / max) * (height - pad.t - pad.b)
  const yPos = (value) => {
    if (value == null) return null
    const span = maxPos - minPos || 1
    return pad.t + ((value - minPos) / span) * (height - pad.t - pad.b)
  }
  const line = (getter) => rows.map((row, index) => {
    const y = getter(row)
    return y == null ? null : `${index === 0 ? 'M' : 'L'} ${x(index)} ${y}`
  }).filter(Boolean).join(' ')
  const clicks = line((row) => yOf(row.clicks, maxClicks))
  const impressions = line((row) => yOf(row.impressions, maxImpressions))
  const position = line((row) => yPos(row.position))
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-56 w-full" role="img" aria-label="Clicks, impressions, and average position">
      <path d={clicks} fill="none" stroke={BRAND.orange} strokeWidth="3" />
      <path d={impressions} fill="none" stroke={BRAND.blue} strokeWidth="2" strokeDasharray="5 4" />
      {position ? <path d={position} fill="none" stroke={BRAND.teal} strokeWidth="2" /> : null}
    </svg>
  )
}

export function rankTone(position) {
  if (position == null || position > 40) return 'bg-slate-200 text-slate-600'
  if (position <= 3) return 'bg-emerald-600 text-white'
  if (position <= 10) return 'bg-[#00D4AA] text-[#1A1A2E]'
  if (position <= 20) return 'bg-amber-500 text-white'
  return 'bg-[#F7931E] text-white'
}

export function GoogleRank({ position, change, previous }) {
  const ranked = position != null && position > 0 && position <= 40
  const amount = change == null ? null : Math.abs(Number(change))
  const improved = Number(change) > 0
  const dropped = Number(change) < 0
  const changeText = amount == null || previous == null
    ? ''
    : Number(change) === 0
      ? `same as #${formatPosition(previous)}`
      : `${improved ? '▲' : '▼'}${amount} from #${formatPosition(previous)}`
  const meaning = rankMeaning(ranked ? position : null)
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className={`inline-flex min-h-[2.5rem] min-w-[4.75rem] items-center justify-center rounded-xl px-3 py-1.5 text-lg font-bold tabular-nums ${ranked ? '' : 'min-w-[7.5rem] text-sm'} ${rankTone(ranked ? position : null)}`} title={ranked ? `Google position ${position}. ${meaning}` : meaning}>
        {ranked ? `#${formatPosition(position)}` : 'Not ranking'}
      </span>
      <span className="flex flex-col">
        <span className="text-xs font-semibold text-slate-700">{meaning}</span>
        {changeText ? <span className={`text-xs font-semibold ${improved ? 'text-emerald-700' : dropped ? 'text-red-600' : 'text-slate-500'}`}>{changeText}</span> : null}
      </span>
    </div>
  )
}

export function RankLegend() {
  const items = [
    { label: '#1–3 · Page 1, top 3', color: '#059669' },
    { label: '#4–10 · Page 1', color: '#00D4AA' },
    { label: '#11–20 · Page 2', color: '#f59e0b' },
    { label: '#21–30 · Page 3', color: '#F7931E' },
    { label: '#31–40 · Page 4', color: '#F7931E' },
    { label: 'Not in top 4 pages', color: '#e2e8f0' },
  ]
  return (
    <ul className="flex flex-wrap gap-3 text-xs text-slate-600" aria-label="Google rank colors">
      {items.map((item) => (
        <li key={item.label} className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full border border-slate-200" style={{ background: item.color }} />
          {item.label}
        </li>
      ))}
    </ul>
  )
}

export function RankSummary({ rows }) {
  return (
    <div className="grid gap-2 sm:grid-cols-5" aria-label="Keyword rank summary">
      {rankSummary(rows).map((item) => (
        <div key={item.id} className="rounded-2xl border border-slate-200 bg-white px-3 py-2" title={item.detail}>
          <p className="text-2xl font-semibold tabular-nums text-slate-900">{formatCount(item.count)}</p>
          <p className="text-xs font-semibold text-slate-700">{item.label}</p>
          <p className="text-[11px] text-slate-400">{item.detail}</p>
        </div>
      ))}
    </div>
  )
}

export function PositionBadge({ position }) {
  return <GoogleRank position={position} />
}

export function BucketBars({ rows }) {
  const buckets = [
    { label: '1–3', color: '#059669', count: rows.filter((row) => row.position >= 1 && row.position <= 3).length },
    { label: '4–10', color: BRAND.blue, count: rows.filter((row) => row.position >= 4 && row.position <= 10).length },
    { label: '11–20', color: '#d97706', count: rows.filter((row) => row.position >= 11 && row.position <= 20).length },
    { label: '21–40', color: BRAND.orange, count: rows.filter((row) => row.position >= 21 && row.position <= 40).length },
  ]
  const max = Math.max(...buckets.map((bucket) => bucket.count), 1)
  return (
    <div className="grid grid-cols-4 gap-2" aria-label="Position buckets">
      {buckets.map((bucket) => (
        <div key={bucket.label} title={`${bucket.count} keywords in positions ${bucket.label}`}>
          <div className="flex h-16 items-end rounded-md bg-slate-50">
            <span className="w-full rounded-md" style={{ height: `${bucket.count ? Math.max((bucket.count / max) * 100, 12) : 0}%`, background: bucket.color }} />
          </div>
          <p className="mt-1 text-center text-[11px] font-semibold text-slate-500">{bucket.label}</p>
          <p className="text-center text-sm font-semibold text-slate-800">{bucket.count}</p>
        </div>
      ))}
    </div>
  )
}

export function Gauge({ value, label }) {
  if (value == null) return <EmptyPanel title="No visibility score yet">The gauge fills in after OpenSEO has a finished AI check.</EmptyPanel>
  const clamped = Math.max(0, Math.min(100, value))
  const angle = -180 + (clamped / 100) * 180
  return (
    <div className="flex flex-col items-center" title={`${label}: ${clamped.toFixed(1)}%`}>
      <svg width="180" height="110" viewBox="0 0 180 110" role="img" aria-label={`${label} ${clamped.toFixed(1)} percent`}>
        <path d="M20 100 A70 70 0 0 1 160 100" fill="none" stroke="#e2e8f0" strokeWidth="14" strokeLinecap="round" />
        <path d="M20 100 A70 70 0 0 1 160 100" fill="none" stroke={BRAND.orange} strokeWidth="14" strokeLinecap="round" strokeDasharray={`${(clamped / 100) * 220} 220`} />
        <line x1="90" y1="100" x2={90 + Math.cos((angle * Math.PI) / 180) * 58} y2={100 + Math.sin((angle * Math.PI) / 180) * 58} stroke={BRAND.ink} strokeWidth="3" strokeLinecap="round" />
        <circle cx="90" cy="100" r="4" fill={BRAND.ink} />
      </svg>
      <p className="text-3xl font-semibold text-slate-900">{clamped.toFixed(1)}%</p>
      <p className="text-xs text-slate-500">{label}</p>
    </div>
  )
}

export function Heatmap({ prompts }) {
  const engines = []
  for (const prompt of prompts) {
    for (const engine of prompt.engines || []) {
      if (!engines.includes(engine.engine)) engines.push(engine.engine)
    }
  }
  if (!prompts.length || !engines.length) return <EmptyPanel title="No prompt checks yet">The heatmap stays blank until OpenSEO stores an answer for a prompt.</EmptyPanel>
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[520px] border-separate border-spacing-1 text-left text-xs">
        <thead>
          <tr>
            <th className="px-2 py-1 font-semibold text-slate-500">Prompt</th>
            {engines.map((engine) => <th key={engine} className="px-2 py-1 font-semibold text-slate-500">{engine.replaceAll('_', ' ')}</th>)}
          </tr>
        </thead>
        <tbody>
          {prompts.slice(0, 24).map((prompt) => (
            <tr key={prompt.id}>
              <th className="max-w-[220px] truncate px-2 py-1 font-medium text-slate-700" title={prompt.prompt}>{prompt.prompt}</th>
              {engines.map((engine) => {
                const cell = (prompt.engines || []).find((item) => item.engine === engine)
                const tone = !cell ? 'bg-slate-100 text-slate-400' : cell.mentioned && cell.cited ? 'bg-emerald-500 text-white' : cell.mentioned ? 'bg-orange-400 text-white' : 'bg-slate-200 text-slate-600'
                const note = !cell ? 'Not checked' : `${cell.mentioned ? 'Mentioned' : 'Not mentioned'}${cell.cited ? ', cited' : ''}${cell.citedUrl ? ` ${cell.citedUrl}` : ''}`
                return <td key={engine} className={`rounded-md px-2 py-2 text-center font-semibold ${tone}`} title={note}>{!cell ? '—' : cell.mentioned ? 'Yes' : 'No'}</td>
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

const SLICE_COLORS = ['#F7931E', '#00AEEF', '#00D4AA', '#8B5CF6', '#FF6B6B', '#FBBF24', '#1A1A2E', '#94A3B8']

export function TimeSeriesChart({ series, compare, label = 'Sessions', valueKey = 'sessions' }) {
  const rows = (series || []).filter((row) => row.date && row[valueKey] != null)
  const prior = (compare || []).filter((row) => row[valueKey] != null)
  if (rows.length < 2) return <EmptyPanel title="No sessions trend">A chart appears when Google Analytics returns at least two days.</EmptyPanel>
  const width = 640
  const height = 200
  const pad = { l: 28, r: 12, t: 16, b: 28 }
  const max = Math.max(...rows.map((row) => row[valueKey]), ...prior.map((row) => row[valueKey]), 1)
  const xFor = (index, count) => pad.l + (index / (count - 1)) * (width - pad.l - pad.r)
  const y = (value) => pad.t + (1 - value / max) * (height - pad.t - pad.b)
  const line = rows.map((row, index) => `${index ? 'L' : 'M'} ${xFor(index, rows.length)} ${y(row[valueKey])}`).join(' ')
  const area = `${line} L ${xFor(rows.length - 1, rows.length)} ${height - pad.b} L ${xFor(0, rows.length)} ${height - pad.b} Z`
  const dashed = prior.length > 1 ? prior.map((row, index) => `${index ? 'L' : 'M'} ${xFor(index, prior.length)} ${y(row[valueKey])}`).join(' ') : ''
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-52 w-full" role="img" aria-label={label}>
      <path d={area} fill="#F7931E" opacity="0.18" />
      <path d={line} fill="none" stroke="#F7931E" strokeWidth="3" />
      {dashed ? <path d={dashed} fill="none" stroke="#64748b" strokeWidth="2" strokeDasharray="5 4" /> : null}
    </svg>
  )
}

export function MonthlyBars({ months }) {
  const rows = (months || []).filter((row) => row.month)
  const plotted = rows.filter((row) => row.sessions != null || row.clicks != null)
  if (plotted.length < 2) return <EmptyPanel title="No monthly history">A bar appears when Google Analytics or Search Console returns more than one month.</EmptyPanel>
  const maxSessions = Math.max(...rows.map((row) => row.sessions || 0), 1)
  const maxClicks = Math.max(...rows.map((row) => row.clicks || 0), 1)
  return (
    <div className="overflow-x-auto" aria-label="Last 13 months of organic sessions and clicks">
      <div className="flex min-w-[640px] items-end gap-2">
        {rows.map((row) => (
          <div key={row.month} className="flex flex-1 flex-col items-center gap-1">
            <div className="flex h-28 items-end gap-0.5">
              <span className="w-2 rounded-sm bg-[#F7931E]" style={{ height: row.sessions == null ? 0 : `${Math.max((row.sessions / maxSessions) * 100, row.sessions ? 6 : 0)}%` }} title={row.sessions == null ? `${row.month} sessions unavailable` : `${row.month}: ${row.sessions} organic sessions`} />
              <span className="w-2 rounded-sm bg-[#00AEEF]" style={{ height: row.clicks == null ? 0 : `${Math.max((row.clicks / maxClicks) * 100, row.clicks ? 6 : 0)}%` }} title={row.clicks == null ? `${row.month} clicks unavailable` : `${row.month}: ${row.clicks} clicks`} />
            </div>
            <span className="text-[10px] text-slate-500">{row.month.slice(5)}</span>
            <span className="text-[10px] tabular-nums text-slate-600">{row.sessions == null ? '—' : formatCount(row.sessions)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function SliceDonut({ slices, caption }) {
  const rows = (slices || []).filter((slice) => slice.value > 0)
  const total = rows.reduce((sum, slice) => sum + slice.value, 0)
  if (!total) return <EmptyPanel title="No channel mix">Channel share appears when Google Analytics returns sessions.</EmptyPanel>
  const radius = 42
  const circ = 2 * Math.PI * radius
  let offset = 0
  return (
    <div className="flex flex-wrap items-center gap-4">
      <svg width="140" height="140" viewBox="0 0 140 140" role="img" aria-label={caption || 'Channel share'}>
        {rows.map((slice, index) => {
          const length = (slice.value / total) * circ
          const dash = `${length} ${circ - length}`
          const node = (
            <circle key={slice.label} cx="70" cy="70" r={radius} fill="none" stroke={SLICE_COLORS[index % SLICE_COLORS.length]} strokeWidth="16" strokeDasharray={dash} strokeDashoffset={-offset} transform="rotate(-90 70 70)">
              <title>{`${slice.label}: ${slice.value}`}</title>
            </circle>
          )
          offset += length
          return node
        })}
        <text x="70" y="74" textAnchor="middle" fontSize="13" fontWeight="700" fill="#0f172a">{caption || ''}</text>
      </svg>
      <Legend items={rows.slice(0, 6).map((slice, index) => ({ label: slice.label, color: SLICE_COLORS[index % SLICE_COLORS.length] }))} />
    </div>
  )
}

export function KeywordSpark({ history }) {
  const points = (history || []).filter((point) => point.position != null).map((point) => point.position)
  if (points.length < 2) return <span className="text-[11px] text-slate-400">No history</span>
  return <Sparkline data={points} width={72} height={24} color={BRAND.blue} />
}
