import { useEffect, useMemo, useState } from 'react'
import { ExternalLink } from 'lucide-react'
import { CHANNEL_COLORS, LEAD_SOURCES, SHEET_CSV_URL, chipClass, formatMoney, sheetRowsToLeads } from '../lib/leads'
import { supabase } from '../lib/supabase'
import { cn } from '../lib/utils'
import { Input } from '../components/ui/input'
import { Button } from '../components/ui/button'
import { useToast } from '../hooks/useToast'

const SPEND_KEY = 'scorecard_channel_spend_v1'
const SHEET = 'https://docs.google.com/spreadsheets/d/1h-O3MynKwL9MhxO2Ytly5gtHd_udyqNJ6n4_OfXLCgY'
const FINANCIALS_CSV = `${SHEET}/export?format=csv&gid=1396795124`

function isClosed(row) {
  return row.quality === 'Closed' || row.pipeline_stage === 'won'
}
function isProposal(row) {
  return row.quality === 'Proposal sent' || row.pipeline_stage === 'proposal' || row.pipeline_stage === 'contract'
}

function readLocalSpend() {
  try {
    return JSON.parse(localStorage.getItem(SPEND_KEY) || '{}')
  } catch {
    return {}
  }
}

function parseSpendFromFinancialsCsv(text) {
  const lines = text.split(/\r?\n/).filter(Boolean)
  if (!lines.length) return {}
  const headers = lines[0].split(',').map((h) => h.trim().toLowerCase())
  const channelIdx = headers.findIndex((h) => h.includes('channel'))
  const spendIdx = headers.findIndex((h) => h === 'spend' || h.includes('spend'))
  if (channelIdx < 0 || spendIdx < 0) return {}
  const map = {}
  for (const line of lines.slice(1)) {
    const cols = line.split(',')
    const channel = (cols[channelIdx] || '').trim()
    const amount = Number(String(cols[spendIdx] || '').replace(/[$,]/g, ''))
    if (LEAD_SOURCES.includes(channel) && Number.isFinite(amount)) map[channel] = String(amount)
  }
  return map
}

export default function ScoreCardFinancials() {
  const { toast } = useToast()
  const [leads, setLeads] = useState([])
  const [spend, setSpend] = useState(() => readLocalSpend())
  const [saving, setSaving] = useState('')
  const [loading, setLoading] = useState(true)

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

    const local = readLocalSpend()
    const spendRes = await supabase.from('scorecard_channel_spend').select('*')
    const fromDb = {}
    for (const row of spendRes.data || []) fromDb[row.channel] = String(row.amount ?? 0)
    let fromSheet = {}
    try {
      const csv = await fetch(FINANCIALS_CSV)
      if (csv.ok) fromSheet = parseSpendFromFinancialsCsv(await csv.text())
    } catch {
      fromSheet = {}
    }
    setSpend({ ...fromSheet, ...fromDb, ...local })
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  const stats = useMemo(() => {
    return LEAD_SOURCES.map((channel) => {
      const group = leads.filter((row) => row.source === channel)
      const closed = group.filter(isClosed)
      const proposals = group.filter(isProposal)
      const closeAmount = closed.reduce((sum, row) => sum + (Number(row.value_2026 || row.close_amount) || 0), 0)
      const spendAmount = Number(spend[channel] || 0)
      const profit = closeAmount - spendAmount
      const roi = spendAmount ? closeAmount / spendAmount : null
      const cpl = group.length ? spendAmount / group.length : null
      const cps = closed.length ? spendAmount / closed.length : null
      return { channel, leads: group.length, proposals: proposals.length, closed: closed.length, closeAmount, spendAmount, profit, roi, cpl, cps }
    })
  }, [leads, spend])

  const closedDeals = useMemo(
    () => leads.filter(isClosed).sort((a, b) => String(b.first_contact_date || '').localeCompare(String(a.first_contact_date || ''))),
    [leads]
  )

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

  const best = [...stats].sort((a, b) => b.closeAmount - a.closeAmount)[0]

  async function saveSpend(channel, amount) {
    setSaving(channel)
    const value = Number(amount || 0)
    const next = { ...spend, [channel]: String(value) }
    setSpend(next)
    localStorage.setItem(SPEND_KEY, JSON.stringify(next))
    const { error } = await supabase.from('scorecard_channel_spend').upsert({ channel, amount: value, updated_at: new Date().toISOString() })
    setSaving('')
    if (error) toast({ title: 'Saved on this device', description: 'Shared database table is not live yet — cost still calculates here.' })
    else toast({ title: `${channel} spend saved` })
  }

  const headers = ['Channel', 'Leads', 'Proposals sent', 'Closed', 'Close amount', 'Spend (edit)', 'Profit', 'ROI', 'Cost per lead', 'Cost per sale']

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold tracking-[0.2em] text-[#8eb4ff]">SCORE CARD</p>
          <h1 className="text-2xl font-bold">Financials</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Channel cost vs closed deals from Score Card. Edit Spend and Save. Closed on All Leads or Closed Won on the pipeline rolls in here.
          </p>
        </div>
        <a href={`${SHEET}/edit?gid=1396795124`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-sm hover:bg-muted">
          Old sheet <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>

      <div className="mb-4 grid gap-2 sm:grid-cols-4">
        <div className="rounded-xl bg-[#cfe8f8] px-4 py-3">
          <div className="text-xs uppercase tracking-wide opacity-70">Closed deals</div>
          <div className="text-2xl font-bold">{total.closed}</div>
        </div>
        <div className="rounded-xl bg-[#c7f0d6] px-4 py-3">
          <div className="text-xs uppercase tracking-wide opacity-70">Close amount</div>
          <div className="text-2xl font-bold">{formatMoney(total.closeAmount) || '$0'}</div>
        </div>
        <div className="rounded-xl bg-[#fddcc4] px-4 py-3">
          <div className="text-xs uppercase tracking-wide opacity-70">Channel spend</div>
          <div className="text-2xl font-bold">{formatMoney(total.spendAmount) || '$0'}</div>
        </div>
        <div className="rounded-xl bg-[#f9ecc1] px-4 py-3">
          <div className="text-xs uppercase tracking-wide opacity-70">Best channel</div>
          <div className="text-lg font-bold">{best?.closeAmount ? `${best.channel} · ${formatMoney(best.closeAmount)}` : '—'}</div>
        </div>
      </div>

      <div className="overflow-auto rounded-xl border bg-white shadow-sm">
        <table className="min-w-full border-collapse text-sm">
          <thead>
            <tr className="bg-slate-900 text-left text-xs uppercase tracking-wide text-white">
              {headers.map((h) => (
                <th key={h} className="px-3 py-3 font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={10} className="px-3 py-8 text-muted-foreground">Loading channel math…</td></tr>
            ) : stats.map((row) => (
              <tr key={row.channel} className={cn('border-b', chipClass(CHANNEL_COLORS, row.channel))}>
                <td className="px-3 py-2 font-semibold">{row.channel}</td>
                <td className="px-3 py-2">{row.leads}</td>
                <td className="px-3 py-2">{row.proposals}</td>
                <td className="px-3 py-2">{row.closed}</td>
                <td className="px-3 py-2">{formatMoney(row.closeAmount) || '$0'}</td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <Input
                      className="h-8 w-28 bg-white"
                      value={spend[row.channel] ?? ''}
                      onChange={(event) => setSpend((current) => ({ ...current, [row.channel]: event.target.value }))}
                    />
                    <Button size="sm" variant="outline" className="bg-white" disabled={saving === row.channel} onClick={() => saveSpend(row.channel, spend[row.channel])}>
                      Save
                    </Button>
                  </div>
                </td>
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

      <h2 className="mb-2 mt-8 text-lg font-semibold">Closed deals feeding this page</h2>
      <p className="mb-3 text-sm text-muted-foreground">Quality = Closed on Score Card, or Closed Won on the pipeline. Amount uses 2026 value, then close amount.</p>
      <div className="overflow-auto rounded-xl border bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-muted text-left text-xs uppercase tracking-wide">
            <tr>
              {['Channel', 'Name', 'Company', 'Amount', 'Jira'].map((h) => (
                <th key={h} className="px-3 py-2 font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {closedDeals.length === 0 ? (
              <tr><td colSpan={5} className="px-3 py-6 text-muted-foreground">No closed deals yet. Mark a Score Card lead Closed, or drag a pipeline card to Closed Won.</td></tr>
            ) : closedDeals.map((row) => (
              <tr key={row.id} className={cn('border-t', chipClass(CHANNEL_COLORS, row.source))}>
                <td className="px-3 py-2 font-medium">{row.source}</td>
                <td className="px-3 py-2">{row.name}</td>
                <td className="px-3 py-2">{row.company}</td>
                <td className="px-3 py-2">{formatMoney(row.value_2026 || row.close_amount) || '$0'}</td>
                <td className="px-3 py-2">{row.jira_key || ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
