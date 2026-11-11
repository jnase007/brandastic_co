import { Compass, Target, TrendingUp } from 'lucide-react'

const PILLARS = [
  { title: 'Focus', body: 'Businesses with $10M+ in sales. Annual retainers. Holistic presence across channels — not one-off projects.' },
  { title: 'Growth', body: 'Increase revenue 25% YoY. One new deal a month. Team on billable work 80% of the time.' },
  { title: 'Margin', body: 'Positive bottom line each month. Higher rates ($175–$195/hr). Lifetime clients, not churn-and-burn.' },
]

const MOVES = [
  'Grow rev — 25% YoY, 6 new contracts toward $3M ARR',
  'Efficiency — billable work is the default, not the exception',
  'Team — growth mindset that shows up in client results',
  'Cash / margin — black each month',
  'Leadership owns it before it becomes a fire',
]

export default function Strategy() {
  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <p className="text-xs font-semibold tracking-[0.2em] text-[#8eb4ff]">BRANDASTIC · STRATEGY</p>
      <h1 className="mt-2 text-3xl font-bold">Strategy</h1>
      <p className="mt-3 text-lg text-muted-foreground">
        Rally cry: <span className="font-semibold text-foreground">Focused. Growth.</span>
      </p>
      <div className="mt-8 grid gap-4 md:grid-cols-3">
        {PILLARS.map((p) => (
          <div key={p.title} className="rounded-xl border bg-card p-5">
            <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-brand-orange/15 text-brand-orange">
              {p.title === 'Focus' ? <Target className="h-4 w-4" /> : p.title === 'Growth' ? <TrendingUp className="h-4 w-4" /> : <Compass className="h-4 w-4" />}
            </div>
            <h2 className="font-semibold">{p.title}</h2>
            <p className="mt-2 text-sm text-muted-foreground">{p.body}</p>
          </div>
        ))}
      </div>
      <div className="mt-8 rounded-xl border bg-card p-6">
        <h2 className="font-semibold">What we run this year</h2>
        <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
          {MOVES.map((m) => (
            <li key={m} className="flex gap-2">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-orange" />
              <span>{m}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
