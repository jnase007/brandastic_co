import { Compass, Target, TrendingUp } from 'lucide-react'

const PILLARS = [
  {
    title: 'Focus',
    body: 'Enrollment directors at private and public charter K–12. Families who need to find the school. Not district public. Not one-off projects.',
  },
  {
    title: 'Growth',
    body: 'Bring in education retainers on a 6 / 10 / 13 / 18 school ramp. About $7.5K/mo each. Land at $3.5M by 2030.',
  },
  {
    title: 'Keep',
    body: 'Assume 15% leave each year. 40 active schools by 2030. Lifetime retainers, not churn-and-burn.',
  },
]

const MOVES = [
  'Sell to enrollment directors, heads of school, and marketing directors at private + charter schools',
  'Add schools so 2030 is 40 active and $3.5M in agency fees',
  'Keep CalOPS + Heart Christian as the base while new education retainers stack',
  'Holistic presence so families can find the school — search and ads that become applications',
  'Score Card + pipeline: a closed school deal shows up in Financials by channel',
]

export default function Strategy() {
  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <p className="text-xs font-semibold tracking-[0.2em] text-[#8eb4ff]">BRANDASTIC · STRATEGY</p>
      <h1 className="mt-2 text-3xl font-bold">Strategy</h1>
      <p className="mt-3 text-lg text-muted-foreground">
        Rally cry: <span className="font-semibold text-foreground">Focused. Growth.</span> · 2027
      </p>
      <p className="mt-3 max-w-2xl text-muted-foreground">
        Built around education clients. Overall we want to be at <span className="font-semibold text-foreground">$3.5 million by 2030</span>.
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
        <h2 className="font-semibold">What we run</h2>
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
