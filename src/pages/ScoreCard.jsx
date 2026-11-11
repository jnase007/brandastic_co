import { useEffect, useState } from 'react'
import { ExternalLink } from 'lucide-react'
import { parseCsv } from '../lib/leads'
import Leads from './Leads'
import { cn } from '../lib/utils'

const SHEET = 'https://docs.google.com/spreadsheets/d/1h-O3MynKwL9MhxO2Ytly5gtHd_udyqNJ6n4_OfXLCgY'
const FINANCIALS_CSV = `${SHEET}/export?format=csv&gid=1396795124`

function FinancialsCopy() {
  const [rows, setRows] = useState([])
  const [error, setError] = useState('')

  useEffect(() => {
    let live = true
    ;(async () => {
      try {
        const response = await fetch(FINANCIALS_CSV)
        if (!response.ok) throw new Error(`Sheet download failed (${response.status})`)
        const parsed = parseCsv(await response.text()).filter((row) => row.some((cell) => String(cell || '').trim()))
        if (live) setRows(parsed)
      } catch (err) {
        if (live) setError(err.message || 'Could not load Financials')
      }
    })()
    return () => {
      live = false
    }
  }, [])

  if (error) {
    return (
      <div className="px-6 py-8 text-sm text-muted-foreground">
        Could not load the Financials tab here ({error}). Open the sheet instead.
      </div>
    )
  }
  if (!rows.length) {
    return <div className="px-6 py-8 text-sm text-muted-foreground">Loading Financials…</div>
  }

  return (
    <div className="overflow-auto px-4 py-4">
      <table className="min-w-full border-collapse text-sm">
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri} className={cn(ri === 0 || String(row[0]).toUpperCase() === 'TOTAL' ? 'font-semibold' : '', ri % 2 ? 'bg-muted/40' : '')}>
              {row.slice(0, 10).map((cell, ci) => (
                <td key={ci} className="whitespace-nowrap border-b px-3 py-2">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
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
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setTab('leads')}
            className={cn('rounded-lg px-3 py-1.5 text-sm font-medium', tab === 'leads' ? 'bg-brand-orange text-white' : 'border hover:bg-muted')}
          >
            All Leads
          </button>
          <button
            type="button"
            onClick={() => setTab('financials')}
            className={cn('rounded-lg px-3 py-1.5 text-sm font-medium', tab === 'financials' ? 'bg-brand-orange text-white' : 'border hover:bg-muted')}
          >
            Financials
          </button>
          <a
            href={`${SHEET}/edit?gid=${tab === 'financials' ? '1396795124' : '0'}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-sm hover:bg-muted"
          >
            Sheet <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
      </div>
      {tab === 'leads' ? <Leads /> : <FinancialsCopy />}
    </div>
  )
}
