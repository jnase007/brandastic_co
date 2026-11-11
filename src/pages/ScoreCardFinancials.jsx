import { ExternalLink } from 'lucide-react'

const SHEET = 'https://docs.google.com/spreadsheets/d/1h-O3MynKwL9MhxO2Ytly5gtHd_udyqNJ6n4_OfXLCgY'
const GID = '1396795124'

export default function ScoreCardFinancials() {
  return (
    <div className="p-4 sm:p-6">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold tracking-[0.2em] text-[#8eb4ff]">SCORE CARD</p>
          <h1 className="text-2xl font-bold">Financials</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Cost per channel vs closed clients. Same Financials tab as the Score Card sheet — which channel brings the best clients, and what we spend to get them.
          </p>
        </div>
        <a
          href={`${SHEET}/edit?gid=${GID}#gid=${GID}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-sm hover:bg-muted"
        >
          Open sheet <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>
      <iframe
        title="Score Card Financials"
        src={`${SHEET}/htmlembed?gid=${GID}&single=true&widget=true&headers=false`}
        className="h-[78vh] w-full rounded-xl border bg-white"
      />
    </div>
  )
}
