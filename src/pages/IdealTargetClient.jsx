import PageHeader from '../components/PageHeader'

const WORK = 'https://brandastic.com/work/'

const MARKETS = [
  {
    rank: 'Primary',
    title: 'Schools',
    clients: 'CalOPS, Heart, Think Together',
    note: 'Enrollment-led K–12. Private and public charter.',
  },
  {
    rank: 'Secondary',
    title: 'Medical, Dental',
    clients: 'Young Surgical, DESS, Salvin',
    note: 'Practices and device brands that need patients and referrals.',
  },
  {
    rank: 'Third',
    title: 'Health & Wellness',
    clients: 'Healthmate, UFC Gym, Orangetheory Fitness',
    note: 'Fitness and wellness brands that need members in the door.',
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
            <p className="mt-3 text-sm font-medium text-slate-800">{market.clients}</p>
            <p className="mt-2 text-sm text-muted-foreground">{market.note}</p>
            <a
              href={WORK}
              target="_blank"
              rel="noreferrer"
              className="mt-4 inline-block text-sm font-medium text-[#FF6B00] hover:underline"
            >
              Case studies
            </a>
          </div>
        ))}
      </div>
    </div>
  )
}
