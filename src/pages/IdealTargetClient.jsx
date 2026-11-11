import { Building2, CheckCircle2, XCircle } from 'lucide-react'

const FITS = [
  'Companies at $10M+ in sales',
  'Need a holistic presence (ads, SEO/AEO, web, creative) — not a single channel',
  'Want an annual retainer, not a two-week project',
  'Owner or operator who will make decisions',
  'Care about pipeline and revenue, not vanity traffic',
]

const NOT_FITS = [
  'Job seekers, vendors selling to us, spam',
  'One-off logo / brochure work with no growth plan',
  'Businesses that will not retain or cannot fund a real program',
  '“Just get me cheap leads” with no offer or ops behind it',
]

export default function IdealTargetClient() {
  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <p className="text-xs font-semibold tracking-[0.2em] text-[#8eb4ff]">BRANDASTIC · ICP</p>
      <h1 className="mt-2 text-3xl font-bold">Ideal Target Client</h1>
      <p className="mt-3 text-muted-foreground">
        Who we say yes to. Aligns with the Score Card (Good Lead) and the Mission: 65 retainers by 2030.
      </p>
      <div className="mt-8 grid gap-6 md:grid-cols-2">
        <div className="rounded-xl border bg-card p-6">
          <div className="mb-4 flex items-center gap-2 font-semibold text-emerald-700">
            <CheckCircle2 className="h-5 w-5" />
            Fits
          </div>
          <ul className="space-y-3 text-sm text-muted-foreground">
            {FITS.map((t) => (
              <li key={t} className="flex gap-2">
                <Building2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                {t}
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-xl border bg-card p-6">
          <div className="mb-4 flex items-center gap-2 font-semibold text-red-700">
            <XCircle className="h-5 w-5" />
            Not a fit
          </div>
          <ul className="space-y-3 text-sm text-muted-foreground">
            {NOT_FITS.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}
