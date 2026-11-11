import { useEffect, useMemo, useState } from 'react'
import { ExternalLink } from 'lucide-react'
import Leads from './Leads'
import { CHANNEL_COLORS, LEAD_SOURCES, chipClass, formatMoney } from '../lib/leads'
import { supabase } from '../lib/supabase'
import { cn } from '../lib/utils'
import { Input } from '../components/ui/input'
import { Button } from '../components/ui/button'

const SHEET = 'https://docs.google.com/spreadsheets/d/1h-O3MynKwL9MhxO2Ytly5gtHd_udyqNJ6n4_OfXLCgY'

function isClosed(row) {
  return row.quality === 'Closed' || row.pipeline_stage === 'won'
}
function isProposal(row) {
  return row.quality === 'Proposal sent' || row.pipeline_stage === 'proposal' || row.pipeline_stage === 'contract'
}

function FinancialsLive() {
  const [leads, setLeads] = useState([])
  const [spend, setSpend] = useState({})
  const [saving, setSaving] = useState('')

  const load = async () => {
    const { data } = await supabase.from('sales_leads').select('*')
    setLeads(data || [])
    const spendRes = await supabase.from('scorecard_channel_spend').select('*')
    const map = {}
    for (const row of spendRes.data || []) map[row.channel] = String(row.amount ?? 0)
    setSpend(map)
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

  async function saveSpend(channel, amount) {
    setSaving(channel)
    const value = Number(amount || 0)
    await supabase.from('scorecard_channel_spend').upsert({ channel, amount: value, updated_at: new Date().toISOString() })
    setSaving('')
    setSpend((current) => ({ ...current, [channel]: String(value) }))
  }

  const headers = ['Channel', 'Leads', 'Proposals sent', 'Closed', 'Close amount ($)', 'Spend ($)', 'Profit', 'ROI', 'Cost per lead', 'Cost per sale']

  return (
    <div className="overflow-auto px-4 py-4">
      <p className="mb-3 text-sm text-muted-foreground">
        Live from Score Card leads. Closed Won on the new pipeline fills Closed + channel. Spend is channel cost — edit and save.
      </p>
      <table className="min-w-full border-collapse text-sm">
        <thead>
          <tr className="text-left">
            {headers.map((h) => (
              <th key={h} className="border-b px-3 py-2 font-medium">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {stats.map((row) => (
            <tr key={row.channel} className={cn('border-b', chipClass(CHANNEL_COLORS, row.channel))}>
              <td className="px-3 py-2 font-semibold">{row.channel}</td>
              <td className="px-3 py-2">{row.leads}</td>
              <td className="px-3 py-2">{row.proposals}</td>
              <td className="px-3 py-2">{row.closed}</td>
              <td className="px-3 py-2">{formatMoney(row.closeAmount) || '$0'}</td>
              <td className="px-3 py-2">
                <div className="flex items-center gap-2">
                  <Input
                    className="h-8 w-28 bg-white/80"
                    value={spend[row.channel] ?? ''}
                    onChange={(event) => setSpend((current) => ({ ...current, [row.channel]: event.target.value }))}
                  />
                  <Button size="sm" variant="outline" className="bg-white/80" disabled={saving === row.channel} onClick={() => saveSpend(row.channel, spend[row.channel])}>
                    Save
                  </Button>
                </div>
              </td>
              <td className="px-3 py-2">{formatMoney(row.profit) || '$0'}</td>
              <td className="px-3 py-2">{row.roi == null ? '' : `${(row.roi * 100).toFixed(1)}%`}</td>
              <td className="px-3 py-2">{row.cpl == null ? '' : formatMoney(row.cpl)}</td>
              <td className="px-3 py-2">{row.cps == null ? '' : formatMoney(row.cps)}</td>
            </tr>
          ))}
          <tr className="bg-slate-800 text-white font-semibold">
            <td className="px-3 py-2">TOTAL</td>
            <td className="px-3 py-2">{total.leads}</td>
            <td className="px-3 py-2">{total.proposals}</td>
            <td className="px-3 py-2">{total.closed}</td>
            <td className="px-3 py-2">{formatMoney(total.closeAmount) || '$0'}</td>
            <td className="px-3 py-2">{formatMoney(total.spendAmount) || '$0'}</td>
            <td className="px-3 py-2">{formatMoney(total.profit) || '$0'}</td>
            <td className="px-3 py-2">{total.spendAmount ? `${((total.closeAmount / total.spendAmount) * 100).toFixed(1)}%` : ''}</td>
            <td className="px-3 py-2">{total.leads ? formatMoney(total.spendAmount / total.leads) : ''}</td>
            <td className="px-3 py-2">{total.closed ? formatMoney(total.spendAmount / total.closed) : ''}</td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}

export default function ScoreCard() {
  const [tab, setTab] = useState('leads')

  return (
    <div className="min-h-screen">
      <div className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-3 border-b bg-background/95 px-4 py-3 backdrop-blur">
        <div>
          <p className="text-xs font-semibold tracking-[0.2em] text-[#8eb4ff]">SCORE CARD V2 2026</p>
          <h1 className="text-xl font-bold">Score Card</h1>
          <p className="text-sm text-muted-foreground">Add a lead here or on Deals — same list, drag on the pipeline.</p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setTab('leads')} className={cn('rounded-lg px-3 py-1.5 text-sm font-medium', tab === 'leads' ? 'bg-brand-orange text-white' : 'border hover:bg-muted')}>All Leads</button>
          <button type="button" onClick={() => setTab('financials')} className={cn('rounded-lg px-3 py-1.5 text-sm font-medium', tab === 'financials' ? 'bg-brand-orange text-white' : 'border hover:bg-muted')}>Financials</button>
          <a href="/deals" className="rounded-lg border px-3 py-1.5 text-sm hover:bg-muted">Pipeline</a>
          <a href={`${SHEET}/edit`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-sm hover:bg-muted">
            Original sheet <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
      </div>
      {tab === 'leads' ? <Leads embedded /> : <FinancialsLive />}
    </div>
  )
}
