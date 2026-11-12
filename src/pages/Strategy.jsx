import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Compass, ExternalLink, Target, TrendingUp } from 'lucide-react'
import PageHeader from '../components/PageHeader'
import { Input } from '../components/ui/input'
import { loadStrategyGoals, saveStrategyGoals, OWNERS } from '../lib/strategyGoals'

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
  const [goals, setGoals] = useState(loadStrategyGoals)
  const [editing, setEditing] = useState(false)

  useEffect(() => {
    saveStrategyGoals(goals)
  }, [goals])

  const updateGoal = (id, patch) => {
    setGoals((rows) => rows.map((row) => (row.id === id ? { ...row, ...patch } : row)))
  }

  const addGoal = () => {
    setGoals((rows) => [
      ...rows,
      { id: `goal-${Date.now()}`, title: '', body: '', owner: 'Unassigned', href: '' },
    ])
    setEditing(true)
  }

  const removeGoal = (id) => {
    setGoals((rows) => rows.filter((row) => row.id !== id))
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-6">
      <PageHeader
        title="Strategy 2027"
        description="Rally cry: Focused. Growth. · 2027"
        actions={
          <a
            href="https://www.canva.com/design/DAHZ5LVC-QE/xPHtKLBkD24OUfGIlI_3UA/edit"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-orange hover:underline"
          >
            Strategy deck <ExternalLink className="h-3.5 w-3.5" />
          </a>
        }
      />
      <p className="mt-3 max-w-2xl text-muted-foreground">
        Built around education clients. Overall we want to be at <span className="font-semibold text-foreground">$3.5 million by 2030</span>.
      </p>
      <a
        href="https://www.canva.com/design/DAHZ5LVC-QE/xPHtKLBkD24OUfGIlI_3UA/edit"
        target="_blank"
        rel="noreferrer"
        className="mt-6 block overflow-hidden rounded-xl border bg-card shadow-sm hover:opacity-95"
      >
        <img
          src="/education-gtm-2027.jpg"
          alt="Education Go-To-Market Strategy 2027"
          className="w-full object-cover"
        />
      </a>
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
        <h2 className="font-semibold">40 schools by 2030</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Strategic direction: education retainers. Same people as{' '}
          <Link to="/ideal-target-client" className="font-medium text-brand-orange hover:underline">Target Client(s)</Link>
          — enrollment directors at private and public charter K–12.
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          Assumption: a ramp of 6, 10, 13, 18 new schools a year at about $7.5K/mo each, with 15% of schools leaving each year.
        </p>
        <div className="mt-4 rounded-xl bg-[#1644ED] p-4 text-white">
          <p className="font-semibold">Goal: $3.5M by 2030</p>
          <p className="text-sm text-white/80">40 education retainers × about $90K/year; excludes media. More than today’s $1.44M recurring book. Ramp math below is ~$3.6M — we hold the company target at $3.5M.</p>
        </div>
        <div className="mt-4 overflow-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-muted text-left">
              <tr>
                <th className="px-3 py-2">Year</th>
                <th className="px-3 py-2">New schools signed</th>
                <th className="px-3 py-2">Active after 15% churn</th>
                <th className="px-3 py-2">New annual revenue</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t"><td className="px-3 py-2">Today</td><td className="px-3 py-2">—</td><td className="px-3 py-2">2 current</td><td className="px-3 py-2">$315K/yr (CalOPS + Heart Christian)</td></tr>
              <tr className="border-t"><td className="px-3 py-2">2027</td><td className="px-3 py-2">6</td><td className="px-3 py-2">6</td><td className="px-3 py-2">~$540K</td></tr>
              <tr className="border-t"><td className="px-3 py-2">2028</td><td className="px-3 py-2">10</td><td className="px-3 py-2">15</td><td className="px-3 py-2">~$1.35M</td></tr>
              <tr className="border-t"><td className="px-3 py-2">2029</td><td className="px-3 py-2">13</td><td className="px-3 py-2">26</td><td className="px-3 py-2">~$2.34M</td></tr>
              <tr className="border-t bg-orange-50"><td className="px-3 py-2 font-semibold">2030</td><td className="px-3 py-2 font-semibold">18</td><td className="px-3 py-2 font-semibold">40</td><td className="px-3 py-2 font-semibold">~$3.6M</td></tr>
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-sm text-muted-foreground">47 schools signed, about 40 still active by 2030 after churn. Plus $315K/yr from current schools.</p>
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
      <div className="mt-8 rounded-xl border bg-card p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold">Brandastic top goals 2027</h2>
            <p className="mt-1 text-sm text-muted-foreground">Pick an owner. Use Update to change the list.</p>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => setEditing((value) => !value)} className="rounded-lg border px-3 py-1.5 text-sm font-medium">
              {editing ? 'Done' : 'Update'}
            </button>
            <button type="button" onClick={addGoal} className="rounded-lg bg-brand-orange px-3 py-1.5 text-sm font-medium text-white">
              Add goal
            </button>
          </div>
        </div>
        <ol className="mt-4 space-y-3">
          {goals.map((goal, index) => (
            <li key={goal.id} className="rounded-lg border bg-background p-4">
              {editing ? (
                <div className="space-y-2">
                  <Input value={goal.title} onChange={(event) => updateGoal(goal.id, { title: event.target.value })} placeholder="Goal" />
                  <textarea
                    className="min-h-[80px] w-full rounded-md border px-3 py-2 text-sm"
                    value={goal.body}
                    onChange={(event) => updateGoal(goal.id, { body: event.target.value })}
                    placeholder="What this means"
                  />
                  <Input value={goal.href || ''} onChange={(event) => updateGoal(goal.id, { href: event.target.value })} placeholder="Link (optional)" />
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="text-sm text-muted-foreground">Owner</label>
                    <select
                      className="h-10 rounded-md border px-2 text-sm"
                      value={goal.owner || 'Unassigned'}
                      onChange={(event) => updateGoal(goal.id, { owner: event.target.value })}
                    >
                      {OWNERS.map((name) => (
                        <option key={name} value={name}>{name}</option>
                      ))}
                    </select>
                    <button type="button" onClick={() => removeGoal(goal.id)} className="ml-auto text-sm text-red-600">Remove</button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <p className="text-sm font-semibold">
                      <span className="mr-2 text-brand-orange">{index + 1}.</span>
                      {goal.title || 'Untitled'}
                    </p>
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                      {goal.owner || 'Unassigned'}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{goal.body}</p>
                  {goal.href ? (
                    <a href={goal.href} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-brand-orange hover:underline">
                      Open link <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  ) : null}
                </>
              )}
            </li>
          ))}
        </ol>
      </div>
    </div>
  )
}
