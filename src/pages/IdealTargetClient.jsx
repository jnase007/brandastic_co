import PageHeader from '../components/PageHeader'

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
    rank: 'Primary',
    title: 'Schools',
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
    note: 'Fitness and wellness brands that need members in the door.',
    cases: [
      { name: 'Health Mate', href: 'https://brandastic.com/portfolio/health-mate/' },
      { name: 'Orangetheory Fitness', href: 'https://brandastic.com/portfolio/orangetheory-fitness/' },
      { name: 'Nordic Sauna', href: 'https://brandastic.com/portfolio/nordic-sauna/' },
    ],
  },
]

export default function IdealTargetClient() {
  return (
    <div className="mx-auto max-w-5xl px-6 py-6">
      <PageHeader
        title="Target Client(s)"
        description="Three markets. Proof lives on brandastic.com/work."
      />
      <div className="mt-8 grid gap-4 md:grid-cols-3">
        {MARKETS.map((market) => (
          <div key={market.title} className="rounded-2xl border bg-white p-6 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#1644ED]">{market.rank}</p>
            <h2 className="mt-1 text-2xl font-bold">{market.title}</h2>
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
    </div>
  )
}
