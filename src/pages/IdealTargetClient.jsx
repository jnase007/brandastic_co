import { useEffect, useMemo, useState } from 'react'
import PageHeader from '../components/PageHeader'
import HeartChristianCaseStudy from '../components/HeartChristianCaseStudy'

const SHEET = 'https://docs.google.com/spreadsheets/d/1yYH9HL9553Hq-ZwqlHrtTp3VC-rXKKAPSRRx5OijdDA/edit?gid=608242340#gid=608242340'

function siteHref(value) {
  const text = String(value || '').trim()
  if (!text) return ''
  if (/^https?:\/\//i.test(text)) return text
  return `https://${text}`
}

const DAILY = [
  'Family sign-ups that depend on search',
  'Ad spend that doesn’t turn into applications',
  'A board asking for enrollment numbers',
  'Agencies that don’t understand school rules',
]

const TITLES = [
  { pct: '60%', title: 'Enrollment directors', note: 'one school, many families who need to find it' },
  { pct: '25%', title: 'Heads of school', note: 'board pressure on enrollment numbers' },
  { pct: '15%', title: 'Marketing directors', note: 'they own the digital spend' },
]

const MARKETS = [
  {
    rank: 'Primary · 2027 focus',
    title: 'Schools',
    star: true,
    tone: 'border-sky-300 bg-sky-50 ring-2 ring-sky-200',
    rankClass: 'text-sky-700',
    note: 'Enrollment-led K–12. Private and public charter.',
    cases: [
      { name: 'CalOPS', href: 'https://brandastic.com/portfolio/california-online-public-schools/' },
      { name: 'Think Together', href: 'https://brandastic.com/portfolio/think-together/' },
      { name: 'Heart Christian', note: 'Case study in progress' },
    ],
  },
  {
    rank: 'Secondary',
    title: 'Medical, Dental',
    tone: 'border-emerald-200 bg-emerald-50',
    rankClass: 'text-emerald-700',
    note: 'Practices and device brands that need patients and referrals.',
    cases: [
      { name: 'Salvin', href: 'https://brandastic.com/portfolio/salvin-dental/' },
      { name: 'Young Surgical', href: 'https://brandastic.com/portfolio/young-surgical/' },
      { name: 'DESS USA', href: 'https://brandastic.com/portfolio/dess-usa/' },
    ],
  },
  {
    rank: 'Third',
    title: 'Health & Wellness',
    tone: 'border-orange-200 bg-orange-50',
    rankClass: 'text-orange-700',
    note: 'Fitness and wellness brands that need members in the door.',
    cases: [
      { name: 'Health Mate', href: 'https://brandastic.com/portfolio/health-mate/' },
      { name: 'Orangetheory Fitness', href: 'https://brandastic.com/portfolio/orangetheory-fitness/' },
      { name: 'Nordic Sauna', href: 'https://brandastic.com/portfolio/nordic-sauna/' },
    ],
  },
]

export default function IdealTargetClient() {
  const [schools, setSchools] = useState(null)
  const [tab, setTab] = useState('examples')
  const [query, setQuery] = useState('')

  useEffect(() => {
    fetch('/target-schools-2027.json')
      .then((res) => (res.ok ? res.json() : null))
      .then(setSchools)
      .catch(() => setSchools(null))
  }, [])

  const rows = useMemo(() => {
    if (!schools) return []
    const list = tab === 'examples' ? schools.examples : tab === 'online' ? schools.onlineCharters : schools.brickAndMortar
    const q = query.trim().toLowerCase()
    if (!q) return list
    return list.filter((row) => JSON.stringify(row).toLowerCase().includes(q))
  }, [schools, tab, query])

  return (
    <div className="mx-auto max-w-5xl px-6 py-6">
      <PageHeader
        title="Target Client(s)"
        description="Three markets. Proof lives on brandastic.com/work."
      />
      <div className="mt-8 grid gap-4 md:grid-cols-3">
        {MARKETS.map((market) => (
          <div key={market.title} className={`rounded-2xl border p-6 shadow-sm ${market.tone}`}>
            <p className={`text-xs font-semibold uppercase tracking-wide ${market.rankClass}`}>{market.star ? '★ ' : ''}{market.rank}</p>
            <h2 className="mt-1 text-2xl font-bold">{market.star ? '★ ' : ''}{market.title}</h2>
            <p className="mt-2 text-sm text-muted-foreground">{market.note}</p>
            <ul className="mt-4 space-y-1.5">
              {market.cases.map((item) => (
                <li key={item.name}>
                  {item.href ? (
                    <a href={item.href} target="_blank" rel="noreferrer" className="text-sm font-medium text-[#FF6B00] hover:underline">
                      {item.name}
                    </a>
                  ) : (
                    <span className="text-sm font-medium">
                      {item.name}
                      {item.note ? <span className="ml-1 font-normal text-muted-foreground">· {item.note}</span> : null}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <HeartChristianCaseStudy />
      <div className="mt-10 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-2xl border bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
            <img src="/maya-chen.jpg?v=justin-2" alt="Maya Chen, Director of Enrollment" className="h-64 w-48 shrink-0 rounded-2xl object-cover object-[50%_18%] shadow-md ring-1 ring-black/5" />
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Who she is</p>
              <h2 className="mt-1 text-2xl font-bold">Maya Chen, 41</h2>
              <p className="italic text-muted-foreground">Director of Enrollment</p>
              <p className="mt-4 text-lg font-medium">“If families can’t find us online, enrollment fails.”</p>
            </div>
          </div>
          <p className="mt-6 text-sm font-semibold">What she deals with every day</p>
          <ul className="mt-2 space-y-2 text-sm text-muted-foreground">
            {DAILY.map((item) => (
              <li key={item}>• {item}</li>
            ))}
          </ul>
        </div>
        <div className="rounded-2xl border bg-white p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">What titles we reach</p>
          <div className="mt-4 space-y-5">
            {TITLES.map((row) => (
              <div key={row.title}>
                <p className="text-xl font-bold">{row.pct} <span className="font-semibold">{row.title}</span></p>
                <p className="text-sm text-muted-foreground">{row.note}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="mt-8 rounded-2xl border bg-white p-6 shadow-sm sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">The market</p>
        <h2 className="mt-2 text-2xl font-bold">Who we serve and why now</h2>
        <p className="mt-4 text-4xl font-bold">38,601</p>
        <p className="text-sm text-muted-foreground">Estimated K–12 target · private + public charter</p>
        <ul className="mt-6 space-y-2 text-sm text-slate-700">
          <li>Private K–12, any affiliation: 30,553 (est.)</li>
          <li>Public charter K–12: 8,048</li>
          <li className="text-muted-foreground">Other public schools: 91,025 — not our target</li>
          <li className="text-muted-foreground">Higher ed, Title IV: 5,581 — context only</li>
        </ul>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-2xl font-bold text-[#1644ED]">30,558</p>
            <p className="text-sm text-muted-foreground">NCES directory records (22,510 private + 8,048 charter)</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-[#1644ED]">9,946</p>
            <p className="text-sm text-muted-foreground">working review list (Apollo + NCES)</p>
          </div>
        </div>
      </div>

      <div className="mt-8 rounded-2xl border-2 border-sky-300 bg-sky-50 p-6 shadow-sm sm:p-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-sky-700">2027 school list</p>
            <h2 className="mt-1 text-2xl font-bold">Target schools</h2>
            <p className="mt-1 text-sm text-muted-foreground">From the Brandastic 2027 School Target List. Search and open the sheet to edit.</p>
          </div>
          <a href={SHEET} target="_blank" rel="noreferrer" className="rounded-lg bg-[#1644ED] px-3 py-2 text-sm font-medium text-white hover:opacity-90">
            Open Google Sheet
          </a>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {[
            { id: 'examples', label: 'Start here (12)' },
            { id: 'online', label: `Online charters (${schools?.onlineCharters?.length || 85})` },
            { id: 'brick', label: `Brick-and-mortar (${schools?.brickAndMortar?.length || 6812})` },
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={`rounded-full border px-3 py-1.5 text-sm font-medium ${
                tab === item.id ? 'border-[#1644ED] bg-[#1644ED] text-white' : 'border-sky-200 bg-white'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
        <input
          className="mt-4 h-10 w-full rounded-lg border bg-white px-3 text-sm"
          placeholder="Search name, city, state, website…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <div className="mt-4 max-h-[520px] overflow-auto rounded-xl border bg-white">
          <table className="min-w-full text-left text-sm">
            <thead className="sticky top-0 bg-slate-50">
              <tr>
                {tab === 'examples' ? (
                  <>
                    <th className="px-3 py-2 font-semibold">School</th>
                    <th className="px-3 py-2 font-semibold">Type</th>
                    <th className="px-3 py-2 font-semibold">Place</th>
                    <th className="px-3 py-2 font-semibold">Contact</th>
                    <th className="px-3 py-2 font-semibold">Website</th>
                  </>
                ) : (
                  <>
                    <th className="px-3 py-2 font-semibold">#</th>
                    <th className="px-3 py-2 font-semibold">School</th>
                    <th className="px-3 py-2 font-semibold">State</th>
                    <th className="px-3 py-2 font-semibold">City</th>
                    <th className="px-3 py-2 font-semibold">Enrollment</th>
                    <th className="px-3 py-2 font-semibold">Website</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => {
                const href = siteHref(row.website)
                return (
                  <tr key={`${row.name}-${index}`} className="border-t">
                    {tab === 'examples' ? (
                      <>
                        <td className="px-3 py-2 font-medium">{row.name}</td>
                        <td className="px-3 py-2 text-muted-foreground">{row.type}</td>
                        <td className="px-3 py-2">{row.place}</td>
                        <td className="px-3 py-2">{row.role}</td>
                        <td className="px-3 py-2">{href ? <a className="text-[#1644ED] hover:underline" href={href} target="_blank" rel="noreferrer">{row.website}</a> : '—'}</td>
                      </>
                    ) : (
                      <>
                        <td className="px-3 py-2 text-muted-foreground">{row.rank}</td>
                        <td className="px-3 py-2 font-medium">{row.name}</td>
                        <td className="px-3 py-2">{row.state}</td>
                        <td className="px-3 py-2">{row.city}</td>
                        <td className="px-3 py-2">{row.enrollment || '—'}</td>
                        <td className="px-3 py-2">{href ? <a className="text-[#1644ED] hover:underline" href={href} target="_blank" rel="noreferrer">{row.website}</a> : '—'}</td>
                      </>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
          {!schools ? <p className="p-4 text-sm text-muted-foreground">Loading school list…</p> : null}
          {schools && !rows.length ? <p className="p-4 text-sm text-muted-foreground">No matches.</p> : null}
        </div>
        <p className="mt-3 text-xs text-muted-foreground">Showing {rows.length} of this tab. Full database stays in the Google Sheet (MASTER + national directory).</p>
      </div>
    </div>
  )
}
