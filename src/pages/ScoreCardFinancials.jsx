import { useEffect, useMemo, useState } from 'react'
import { ExternalLink } from 'lucide-react'
import { CHANNEL_COLORS, LEAD_SOURCES, SHEET_CSV_URL, chipClass, formatMoney, sheetRowsToLeads } from '../lib/leads'
import { supabase } from '../lib/supabase'
import { cn } from '../lib/utils'
import { Input } from '../components/ui/input'
import { Button } from '../components/ui/button'
import { useToast } from '../hooks/useToast'
import PageHeader from '../components/PageHeader'

const SPEND_KEY = 'scorecard_monthly_spend_v1'
const SHEET = 'https://docs.google.com/spreadsheets/d/1h-O3MynKwL9MhxO2Ytly5gtHd_udyqNJ6n4_OfXLCgY'
const YEAR = 2026
const MONTHS = [
  { id: 1, label: 'Jan' },
  { id: 2, label: 'Feb' },
  { id: 3, label: 'Mar' },
  { id: 4, label: 'Apr' },
  { id: 5, label: 'May' },
  { id: 6, label: 'Jun' },
  { id: 7, label: 'Jul' },
  { id: 8, label: 'Aug' },
  { id: 9, label: 'Sep' },
  { id: 10, label: 'Oct' },
  { id: 11, label: 'Nov' },
  { id: 12, label: 'Dec' },
]

const PIE_COLORS = {
  Direct: '#7eb8d4',
  'Chamber + Events': '#5bb8b0',
  Meta: '#c084fc',
  'SEO (organic)': '#4ade80',
  'Google Ads': '#fb923c',
  Referral: '#eab308',
  'Outbound (LinkedIn + Email)': '#94a3b8',
  'OpenAI/ChatGPT': '#f472b6',
  'Existing client': '#6b7280',
}

/** From Justin's Score Card spend sheet (2026), used only if nothing saved yet. */
const SEED = {
  Direct: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  'Chamber + Events': [0, 0, 0, 0, 0, 0, 240, 600, 0, 0, 0, 0],
  Meta: [0, 0, 0, 0, 750, 127, 1425, 133, 218, 92, 0, 0],
  'SEO (organic)': [2500, 2500, 2500, 2500, 2500, 2500, 2500, 2500, 2500, 2500, 2500, 0],
  'Google Ads': [0, 0, 0, 0, 0, 924, 981, 1415, 465, 51, 0, 0],
  Referral: [120, 120, 120, 120, 120, 0, 20, 20, 20, 20, 0, 0],
  'Outbound (LinkedIn + Email)': [0, 0, 0, 0, 4000, 4000, 4000, 97, 97, 0, 0, 0],
  'OpenAI/ChatGPT': [0, 0, 0, 0, 0, 311, 783, 771, 728, 284, 0, 0],
  'Existing client': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
}

function isClosed(row) {
  return row.quality === 'Closed' || row.pipeline_stage === 'won'
}
function isProposal(row) {
  return row.quality === 'Proposal sent' || row.pipeline_stage === 'proposal' || row.pipeline_stage === 'contract'
}

function monthKey(monthId) {
  return `${YEAR}-${String(monthId).padStart(2, '0')}`
}

function emptyGrid() {
  const grid = {}
  for (const channel of LEAD_SOURCES) {
    grid[channel] = {}
    for (const month of MONTHS) grid[channel][monthKey(month.id)] = ''
  }
  return grid
}

function seedGrid() {
  const grid = emptyGrid()
  for (const channel of LEAD_SOURCES) {
    const row = SEED[channel] || []
    row.forEach((amount, index) => {
      grid[channel][monthKey(index + 1)] = amount ? String(amount) : '0'
    })
  }
  return grid
}

function readLocalSpend() {
  try {
    const raw = JSON.parse(localStorage.getItem(SPEND_KEY) || 'null')
    if (raw && typeof raw === 'object' && !Array.isArray(raw) && Object.keys(raw).length) return { ...emptyGrid(), ...raw }
  } catch {
    /* ignore */
  }
  return seedGrid()
}

function leadMonth(row) {
  const date = String(row.first_contact_date || '')
  if (!date.startsWith(String(YEAR))) return null
  const month = Number(date.slice(5, 7))
  return Number.isFinite(month) && month >= 1 && month <= 12 ? month : null
}

function commaNumber(value) {
  const cleaned = String(value ?? '').replace(/[^0-9.]/g, '')
  if (!cleaned) return ''
  const [whole, fraction] = cleaned.split('.')
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return fraction != null && fraction !== '' ? `${grouped}.${fraction.slice(0, 2)}` : grouped
}

function dealLabel(row) {
  const name = row.company || row.name || 'Deal'
  const money = formatMoney(row.value_2026 || row.close_amount)
  return money ? `${name} · ${money}` : name
}

function ClosedCell({ deals, amount }) {
  const [open, setOpen] = useState(false)
  return (
    <td
      className="relative px-2 py-2 text-right"
      onMouseEnter={() => deals.length && setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <div className={deals.length ? 'cursor-default underline decoration-dotted decoration-slate-400' : ''}>{deals.length}</div>
      <div className="text-[10px] opacity-70">{formatMoney(amount) || '$0'}</div>
      {open ? (
        <div className="absolute right-0 top-full z-30 mt-1 w-56 rounded-lg bg-slate-900 p-2 text-left text-xs text-white shadow-lg">
          {deals.map((row, index) => (
            <div key={`${row.import_key || row.company || row.name}-${index}`} className="py-0.5 leading-snug">
              {dealLabel(row)}
            </div>
          ))}
        </div>
      ) : null}
    </td>
  )
}

function Pie({ slices, title }) {
  const [hover, setHover] = useState(null)
  const total = slices.reduce((sum, slice) => sum + slice.value, 0)
  const size = 180
  const r = 70
  const cx = 90
  const cy = 90
  let angle = -Math.PI / 2
  const paths = []
  if (total <= 0) {
    return (
      <div className="rounded-xl border bg-white p-4">
        <h3 className="mb-3 text-sm font-semibold">{title}</h3>
        <p className="text-sm text-muted-foreground">No data yet</p>
      </div>
    )
  }
  slices.filter((slice) => slice.value > 0).forEach((slice) => {
    const next = angle + (slice.value / total) * Math.PI * 2
    const large = next - angle > Math.PI ? 1 : 0
    const x1 = cx + r * Math.cos(angle)
    const y1 = cy + r * Math.sin(angle)
    const x2 = cx + r * Math.cos(next)
    const y2 = cy + r * Math.sin(next)
    const percent = Math.round((slice.value / total) * 1000) / 10
    paths.push({
      d: `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`,
      color: slice.color,
      label: slice.label,
      value: slice.value,
      percent,
    })
    angle = next
  })
  return (
    <div className="overflow-hidden rounded-xl border bg-white p-4">
      <h3 className="mb-3 text-sm font-semibold">{title}</h3>
      <div className="flex min-w-0 flex-col items-center gap-3">
        <div className="relative">
          <svg width={size} height={size} viewBox="0 0 180 180">
            {paths.map((path) => (
              <path
                key={path.label}
                d={path.d}
                fill={path.color}
                className="cursor-pointer"
                opacity={hover && hover.label !== path.label ? 0.45 : 1}
                onMouseEnter={() => setHover(path)}
                onMouseLeave={() => setHover(null)}
              />
            ))}
          </svg>
          {hover ? (
            <div className="pointer-events-none absolute left-1/2 top-1/2 z-10 w-44 -translate-x-1/2 -translate-y-1/2 rounded-lg bg-slate-900 px-3 py-2 text-center text-white shadow-lg">
              <div className="text-xs font-semibold leading-tight">{hover.label}</div>
              <div className="mt-0.5 text-lg font-bold">{hover.percent}%</div>
              <div className="text-xs text-slate-300">{formatMoney(hover.value) || hover.value}</div>
            </div>
          ) : (
            <div className="pointer-events-none absolute left-1/2 top-1/2 w-28 -translate-x-1/2 -translate-y-1/2 text-center text-[11px] text-slate-400">
              Hover a slice
            </div>
          )}
        </div>
        <ul className="grid w-full min-w-0 grid-cols-1 gap-1 text-xs">
          {paths.map((path) => (
            <li
              key={path.label}
              className={cn('flex min-w-0 items-center gap-2', hover?.label === path.label && 'font-semibold')}
              onMouseEnter={() => setHover(path)}
              onMouseLeave={() => setHover(null)}
            >
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: path.color }} />
              <span className="min-w-0 truncate">{path.label}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

export default function ScoreCardFinancials() {
  const { toast } = useToast()
  const [leads, setLeads] = useState([])
  const [spend, setSpend] = useState(() => readLocalSpend())
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [monthView, setMonthView] = useState('all')

  const load = async () => {
    setLoading(true)
    let rows = []
    const { data, error } = await supabase.from('sales_leads').select('*')
    if (!error && data) rows = data
    if (!rows.length) {
      try {
        const response = await fetch(SHEET_CSV_URL)
        if (response.ok) {
          rows = sheetRowsToLeads(await response.text()).map((lead, index) => ({ ...lead, id: lead.import_key || String(index) }))
        }
      } catch {
        rows = []
      }
    }
    setLeads(rows)
    setSpend(readLocalSpend())
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  function spendFor(channel, monthId) {
    return Number(spend[channel]?.[monthKey(monthId)] || 0) || 0
  }

  function yearSpend(channel) {
    return MONTHS.reduce((sum, month) => sum + spendFor(channel, month.id), 0)
  }

  const selectedMonths = monthView === 'all' ? MONTHS.map((m) => m.id) : [Number(monthView)]

  const stats = useMemo(() => {
    return LEAD_SOURCES.map((channel) => {
      const group = leads.filter((row) => {
        if (row.source !== channel) return false
        if (monthView === 'all') return true
        return leadMonth(row) === Number(monthView)
      })
      const closed = group.filter(isClosed)
      const proposals = group.filter(isProposal)
      const closeAmount = closed.reduce((sum, row) => sum + (Number(row.value_2026 || row.close_amount) || 0), 0)
      const spendAmount = selectedMonths.reduce((sum, monthId) => sum + spendFor(channel, monthId), 0)
      const profit = closeAmount - spendAmount
      const roi = spendAmount ? closeAmount / spendAmount : null
      const cpl = group.length ? spendAmount / group.length : null
      const cps = closed.length ? spendAmount / closed.length : null
      return { channel, leads: group.length, proposals: proposals.length, closed: closed.length, closeAmount, spendAmount, profit, roi, cpl, cps }
    })
  }, [leads, spend, monthView])

  const total = stats.reduce(
    (acc, row) => ({
      leads: acc.leads + row.leads,
      proposals: acc.proposals + row.proposals,
      closed: acc.closed + row.closed,
      closeAmount: acc.closeAmount + row.closeAmount,
      spendAmount: acc.spendAmount + row.spendAmount,
      profit: acc.profit + row.profit,
    }),
    { leads: 0, proposals: 0, closed: 0, closeAmount: 0, spendAmount: 0, profit: 0 }
  )

  function closedInMonth(channel, monthId) {
    return leads.filter((row) => row.source === channel && isClosed(row) && leadMonth(row) === monthId)
  }

  async function saveGrid() {
    setSaving(true)
    localStorage.setItem(SPEND_KEY, JSON.stringify(spend))
    const yearly = {}
    for (const channel of LEAD_SOURCES) yearly[channel] = yearSpend(channel)
    for (const channel of LEAD_SOURCES) {
      await supabase.from('scorecard_channel_spend').upsert({
        channel,
        amount: yearly[channel],
        updated_at: new Date().toISOString(),
      })
    }
    setSaving(false)
    toast({ title: 'Monthly spend saved' })
  }

  function setCell(channel, monthId, value) {
    setSpend((current) => ({
      ...current,
      [channel]: { ...(current[channel] || {}), [monthKey(monthId)]: commaNumber(value).replace(/,/g, '') },
    }))
  }

  const pies = [
    { title: 'Spend by channel', slices: stats.map((row) => ({ label: row.channel, value: row.spendAmount, color: PIE_COLORS[row.channel] })) },
    { title: 'Leads by channel', slices: stats.map((row) => ({ label: row.channel, value: row.leads, color: PIE_COLORS[row.channel] })) },
    { title: 'Close $ by channel', slices: stats.map((row) => ({ label: row.channel, value: row.closeAmount, color: PIE_COLORS[row.channel] })) },
  ]

  return (
    <div className="p-4 sm:p-6">
      <PageHeader
        title="Score Card · Financials"
        description="Marketing spend by channel by month. Not company financials. Closed deals use the lead date on Score Card."
        actions={
        <div className="flex items-center gap-2">
          <select
            className="h-9 rounded-lg border bg-white px-3 text-sm"
            value={monthView}
            onChange={(event) => setMonthView(event.target.value)}
          >
            <option value="all">Month view: All</option>
            {MONTHS.map((month) => (
              <option key={month.id} value={String(month.id)}>{month.label} {YEAR}</option>
            ))}
          </select>
          <Button onClick={saveGrid} disabled={saving}>{saving ? 'Saving…' : 'Save spend'}</Button>
          <a href={`${SHEET}/edit?gid=1396795124`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-sm hover:bg-muted">
            Old sheet <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
        }
      />

      <h2 className="mb-2 text-lg font-semibold">Spend input — cost to run the channel</h2>
      <div className="mb-8 overflow-auto rounded-xl border bg-white shadow-sm">
        <table className="min-w-full border-collapse text-xs">
          <thead>
            <tr className="bg-slate-50 text-slate-600">
              <th className="sticky left-0 z-20 bg-slate-50 px-3 py-2 text-left shadow-[4px_0_8px_-4px_rgba(15,23,42,0.25)]">Channel</th>
              {MONTHS.map((month) => (
                <th key={month.id} className="px-2 py-2 text-right">{month.label}</th>
              ))}
              <th className="px-3 py-2 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {LEAD_SOURCES.map((channel) => (
              <tr key={channel} className={cn('border-b', chipClass(CHANNEL_COLORS, channel))}>
                <td className={cn('sticky left-0 z-10 px-3 py-1 font-semibold shadow-[4px_0_8px_-4px_rgba(15,23,42,0.18)]', chipClass(CHANNEL_COLORS, channel))}>{channel}</td>
                {MONTHS.map((month) => (
                  <td key={month.id} className="px-1 py-1">
                    <Input
                      className="h-8 w-[88px] bg-white/90 px-1 text-right text-xs"
                      value={commaNumber(spend[channel]?.[monthKey(month.id)] ?? '')}
                      onChange={(event) => setCell(channel, month.id, event.target.value)}
                    />
                  </td>
                ))}
                <td className="px-3 py-1 text-right font-semibold">{formatMoney(yearSpend(channel)) || '$0'}</td>
              </tr>
            ))}
            <tr className="bg-slate-800 font-semibold text-white">
              <td className="sticky left-0 z-10 bg-slate-800 px-3 py-2 shadow-[4px_0_8px_-4px_rgba(15,23,42,0.25)]">Total spend</td>
              {MONTHS.map((month) => (
                <td key={month.id} className="px-2 py-2 text-right">
                  {formatMoney(LEAD_SOURCES.reduce((sum, channel) => sum + spendFor(channel, month.id), 0)) || '$0'}
                </td>
              ))}
              <td className="px-3 py-2 text-right">{formatMoney(LEAD_SOURCES.reduce((sum, channel) => sum + yearSpend(channel), 0)) || '$0'}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2 className="mb-2 text-lg font-semibold">Closed deals by month</h2>
      <p className="mb-2 text-sm text-muted-foreground">Count / close $ from Score Card (lead date). Not spend. Hover a count to see the deals.</p>
      <div className="mb-8 overflow-auto rounded-xl border bg-white shadow-sm">
        <table className="min-w-full border-collapse text-xs">
          <thead>
            <tr className="bg-slate-50 text-slate-600">
              <th className="sticky left-0 z-20 bg-slate-50 px-3 py-2 text-left shadow-[4px_0_8px_-4px_rgba(15,23,42,0.25)]">Channel</th>
              {MONTHS.map((month) => (
                <th key={month.id} className="px-2 py-2 text-right">{month.label}</th>
              ))}
              <th className="px-3 py-2 text-right">Year</th>
            </tr>
          </thead>
          <tbody>
            {LEAD_SOURCES.map((channel) => {
              const yearClosed = MONTHS.reduce((sum, month) => sum + closedInMonth(channel, month.id).length, 0)
              const yearAmount = MONTHS.reduce(
                (sum, month) => sum + closedInMonth(channel, month.id).reduce((inner, row) => inner + (Number(row.value_2026 || row.close_amount) || 0), 0),
                0
              )
              return (
                <tr key={channel} className={cn('border-b', chipClass(CHANNEL_COLORS, channel))}>
                  <td className={cn('sticky left-0 z-10 px-3 py-2 font-semibold shadow-[4px_0_8px_-4px_rgba(15,23,42,0.18)]', chipClass(CHANNEL_COLORS, channel))}>{channel}</td>
                  {MONTHS.map((month) => {
                    const deals = closedInMonth(channel, month.id)
                    const amount = deals.reduce((sum, row) => sum + (Number(row.value_2026 || row.close_amount) || 0), 0)
                    return <ClosedCell key={month.id} deals={deals} amount={amount} />
                  })}
                  <ClosedCell
                    deals={MONTHS.flatMap((month) => closedInMonth(channel, month.id))}
                    amount={yearAmount}
                  />
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="mb-8 grid gap-4 lg:grid-cols-3">
        {pies.map((pie) => (
          <Pie key={pie.title} title={pie.title} slices={pie.slices} />
        ))}
      </div>

      <h2 className="mb-2 text-lg font-semibold">
        {monthView === 'all' ? 'Year totals' : `${MONTHS.find((m) => m.id === Number(monthView))?.label} ${YEAR}`}
      </h2>
      <div className="overflow-auto rounded-xl border bg-white shadow-sm">
        <table className="min-w-full border-collapse text-sm">
          <thead>
            <tr className="bg-[#3ba3d0] text-left text-xs uppercase tracking-wide text-white">
              {['Channel', 'Leads', 'Proposals sent', 'Closed', 'Close amount ($)', 'Spend ($)', 'Profit', 'ROI', 'Cost per lead', 'Cost per sale'].map((h) => (
                <th key={h} className="px-3 py-3 font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={10} className="px-3 py-8 text-muted-foreground">Loading…</td></tr>
            ) : stats.map((row) => (
              <tr key={row.channel} className={cn('border-b', chipClass(CHANNEL_COLORS, row.channel))}>
                <td className="px-3 py-2 font-semibold">{row.channel}</td>
                <td className="px-3 py-2">{row.leads}</td>
                <td className="px-3 py-2">{row.proposals}</td>
                <td className="px-3 py-2">{row.closed}</td>
                <td className="px-3 py-2">{formatMoney(row.closeAmount) || '$0'}</td>
                <td className="px-3 py-2">{formatMoney(row.spendAmount) || '$0'}</td>
                <td className="px-3 py-2">{formatMoney(row.profit) || '$0'}</td>
                <td className="px-3 py-2">{row.roi == null ? '—' : `${(row.roi * 100).toFixed(1)}%`}</td>
                <td className="px-3 py-2">{row.cpl == null ? '—' : formatMoney(row.cpl)}</td>
                <td className="px-3 py-2">{row.cps == null ? '—' : formatMoney(row.cps)}</td>
              </tr>
            ))}
            <tr className="bg-slate-800 font-semibold text-white">
              <td className="px-3 py-2">TOTAL</td>
              <td className="px-3 py-2">{total.leads}</td>
              <td className="px-3 py-2">{total.proposals}</td>
              <td className="px-3 py-2">{total.closed}</td>
              <td className="px-3 py-2">{formatMoney(total.closeAmount) || '$0'}</td>
              <td className="px-3 py-2">{formatMoney(total.spendAmount) || '$0'}</td>
              <td className="px-3 py-2">{formatMoney(total.profit) || '$0'}</td>
              <td className="px-3 py-2">{total.spendAmount ? `${((total.closeAmount / total.spendAmount) * 100).toFixed(1)}%` : '—'}</td>
              <td className="px-3 py-2">{total.leads ? formatMoney(total.spendAmount / total.leads) : '—'}</td>
              <td className="px-3 py-2">{total.closed ? formatMoney(total.spendAmount / total.closed) : '—'}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
