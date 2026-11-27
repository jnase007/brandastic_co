import { Ear, MessageSquare, ShieldAlert, CalendarDays, Lightbulb, ExternalLink } from 'lucide-react'

// Reddit listening and community plan (senior living + private K-12).
// Source: The AI Strategist's finished Reddit plan, Nov 27, 2026. Draft-only channel:
// staff rewrite talking points in their own words and post from their own accounts.

const KPIS = [
  { label: 'Hard rules', value: '7', note: 'Break one and the account can be banned', icon: ShieldAlert, tone: 'bg-red-50 text-red-700 border-red-200' },
  { label: 'Rollout', value: '4 weeks', note: 'Week 1 is listen only', icon: CalendarDays, tone: 'bg-blue-50 text-[#1644ED] border-blue-200' },
  { label: 'Comment cap', value: '2–3', note: 'Per person, per week, weeks 2–3', icon: MessageSquare, tone: 'bg-orange-50 text-brand-orange border-orange-200' },
  { label: 'Communities', value: '14', note: '6 senior living · 8 private K-12', icon: Ear, tone: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  { label: 'Content goal', value: 'Top 10', note: 'Questions per vertical → client FAQ / AEO', icon: Lightbulb, tone: 'bg-violet-50 text-violet-700 border-violet-200' },
]

const BADGE = {
  ban: 'bg-red-100 text-red-800 ring-red-200',
  mod: 'bg-amber-100 text-amber-800 ring-amber-200',
  disclose: 'bg-blue-100 text-blue-800 ring-blue-200',
  safe: 'bg-emerald-100 text-emerald-800 ring-emerald-200',
  minor: 'bg-violet-100 text-violet-800 ring-violet-200',
  info: 'bg-slate-100 text-slate-700 ring-slate-200',
}

function Badge({ kind, children }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${BADGE[kind] || BADGE.info}`}>
      {children}
    </span>
  )
}

const RULES = [
  { n: 1, kind: 'ban', tag: 'No AI text', text: 'Human-written only. AgingParents, CaregiverSupport, dementia, Parenting and irvine ban AI content. Drafts are talking points to rewrite in your own words.' },
  { n: 2, kind: 'ban', tag: 'No links', text: 'No links, “free guides” or surveys. r/AgingParents perma-bans on first offense; CaregiverSupport and Parenting ban too.' },
  { n: 3, kind: 'mod', tag: 'Never solicit', text: 'No DMs, no “message me,” no client names. Any promo in r/orangecounty or r/applyprivateschools needs mod pre-approval.' },
  { n: 4, kind: 'disclose', tag: 'Disclose once', text: '“I work at an agency that does marketing for schools/senior communities.” Plainly, once.' },
  { n: 5, kind: 'info', tag: 'Real accounts', text: 'Real staff accounts with history. Never new accounts, never “Brandastic.”' },
  { n: 6, kind: 'ban', tag: 'Not as agency', text: 'Never post as the agency in AgingParents, CaregiverSupport, Parenting, or any grief/venting thread.' },
  { n: 7, kind: 'minor', tag: 'Minors', text: 'r/applyprivateschools is mostly students. Answer publicly, keep it general, never DM.' },
]

const TIMELINE = [
  { week: 'Week 1', title: 'Listen only', body: 'Read, don’t post. Log the top questions into client FAQ ideas.', color: 'bg-blue-600' },
  { week: 'Weeks 2–3', title: 'Help, lightly', body: 'At most 2–3 helpful comments per person per week, only on open, recent threads.', color: 'bg-brand-orange' },
  { week: 'Week 4', title: 'Review + publish', body: 'Review removals and downvotes. Turn the top 10 questions per vertical into client content.', color: 'bg-emerald-600' },
]

const SENIOR_SUBS = [
  { name: 'r/AgingParents', size: '91K', kind: 'ban', rule: 'Strictest. No AI, no links, no agency voice.' },
  { name: 'r/dementia', size: '71K', kind: 'ban', rule: 'No self-promo, no AI.' },
  { name: 'r/CaregiverSupport', size: '53K', kind: 'ban', rule: 'No disguised promo, human-only.' },
  { name: 'r/Alzheimers', size: '28K', kind: 'info', rule: 'Rules not checked yet. Read before posting.' },
  { name: 'r/eldercare', size: '18K', kind: 'disclose', rule: 'No promo rule, new mods. Disclose.' },
  { name: 'r/AssistedLiving', size: '3K', kind: 'safe', rule: 'No posted rules, industry people present. Disclose.' },
]

const SCHOOL_SUBS = [
  { name: 'r/Parenting', size: '8.3M', kind: 'ban', rule: 'Parents only. No self-promo, market research or AI.' },
  { name: 'r/orangecounty', size: '465K', kind: 'mod', rule: 'Ads removed. Promo needs mod approval.' },
  { name: 'r/irvine', size: '62K', kind: 'ban', rule: 'No AI posts.' },
  { name: 'r/applyprivateschools', size: '1.5K', kind: 'minor', rule: 'Active, mostly students. No ads without mod permission.' },
  { name: 'r/Mommit · r/daddit', size: 'Large', kind: 'info', rule: 'Occasional school posts.' },
  { name: 'r/ParentingADHD · r/Autism_Parenting', size: 'Niche', kind: 'info', rule: 'Families switching schools for programs.' },
  { name: 'r/privateschool', size: '—', kind: 'ban', rule: 'Skip. Run by a marketer.' },
]

// Status checked Nov 27, 2026 (public Reddit JSON). Re-check before posting.
const THREADS = [
  { vertical: 'Senior', sub: 'r/AgingParents', title: 'Where to start? 76yr old mom suddenly needs AL', href: 'https://www.reddit.com/r/AgingParents/comments/1y6k3i5/', angle: 'Plain steps: care assessment, inspection reports, ratios by shift, care-level fees. No links or business name.', status: 'Open · 11 comments · Nov 26', kind: 'ban' },
  { vertical: 'Senior', sub: 'r/AssistedLiving', title: 'Affordable assisted living near Fremont, CA', href: 'https://www.reddit.com/r/AssistedLiving/comments/1xp5m3y/', angle: 'CA Care Facility Search (CDSS), Medi-Cal ALW (care, not rent; waitlist), realistic costs. Disclose.', status: 'Open · 5 comments · Nov 5', kind: 'disclose' },
  { vertical: 'Senior', sub: 'r/AssistedLiving', title: 'When is it time to move to SNF?', href: 'https://www.reddit.com/r/AssistedLiving/comments/1xjg2db/', angle: 'What triggers a SNF move and how Medicare qualifies it. OP has since posted an update; low priority.', status: 'Open · 16 comments · Oct 30', kind: 'info' },
  { vertical: 'Senior', sub: 'r/eldercare', title: 'A Place for Mom vs Caring.com', href: 'https://www.reddit.com/r/eldercare/comments/1uyi9j3/', angle: 'Honest referral-fee explanation; families can call communities directly. Real industry knowledge only.', status: 'Open · 21 comments · Jul 16 (old)', kind: 'mod' },
  { vertical: 'K-12', sub: 'r/applyprivateschools', title: 'Vibes of LA elementary schools? (parent)', href: 'https://www.reddit.com/r/applyprivateschools/comments/1y0p43u/', angle: 'Fit beyond the tour: sit in on a class, talk to parents away from admissions, ask about teacher turnover. Disclose, no clients.', status: 'Open · 15 comments · Nov 19', kind: 'disclose' },
  { vertical: 'K-12', sub: 'r/applyprivateschools', title: 'Are college and private school essays similar?', href: 'https://www.reddit.com/r/applyprivateschools/comments/1y11y06/', angle: 'General K-12 essay advice. Likely a minor.', status: 'Open · 1 comment · Nov 20', kind: 'minor' },
  { vertical: 'K-12', sub: 'r/applyprivateschools', title: 'International applicant, 51st pct SSAT, no retake money', href: 'https://www.reddit.com/r/applyprivateschools/comments/1y56hes/', angle: 'Test-optional schools, ISEE as an alternative, fee waivers. Likely a minor; public only.', status: 'Open · 5 comments · Nov 25', kind: 'minor' },
  { vertical: 'K-12', sub: 'r/irvine', title: 'University High vs Sage Hill (research only)', href: 'https://www.reddit.com/r/irvine/comments/1q8wzrn/', angle: 'Objection mining for client FAQ / comparison pages. Don’t comment.', status: 'Research · 93 comments · Jan 9', kind: 'info' },
  { vertical: 'K-12', sub: 'r/orangecounty', title: 'Comparable schools in OC (research only)', href: 'https://www.reddit.com/r/orangecounty/comments/1qi6a8b/', angle: 'Objection mining for client FAQ / comparison pages. Don’t comment.', status: 'Archived · 43 comments · Jan 20', kind: 'info' },
]

const QUESTIONS = {
  senior: [
    'Real cost once care levels are added',
    'Medicaid / Medicare (waivers rarely cover room and board)',
    'What to ask on a tour',
    'Red flags: ratios by shift, state inspection reports, ombudsman, unannounced visits',
    'When to move to skilled nursing',
    'Guilt',
  ],
  school: [
    'Is private worth it vs. IUSD and strong public schools?',
    'Real cost after aid',
    'Fit beyond the tour',
    'SSAT / ISEE',
    'Financial aid',
    'Essays',
  ],
}

function SubTable({ title, rows }) {
  return (
    <div className="overflow-auto rounded-lg border">
      <table className="min-w-full text-sm">
        <thead className="bg-muted text-left">
          <tr>
            <th className="px-3 py-2">{title}</th>
            <th className="px-3 py-2">Members</th>
            <th className="px-3 py-2">Rules</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.name} className="border-t align-top">
              <td className="px-3 py-2 font-medium whitespace-nowrap">{row.name}</td>
              <td className="px-3 py-2 whitespace-nowrap">{row.size}</td>
              <td className="px-3 py-2"><div className="flex flex-wrap items-center gap-2"><Badge kind={row.kind}>{row.kind === 'ban' ? 'Strict' : row.kind === 'mod' ? 'Mod approval' : row.kind === 'disclose' ? 'Disclose' : row.kind === 'safe' ? 'Open' : row.kind === 'minor' ? 'Minors' : 'Check'}</Badge><span className="text-muted-foreground">{row.rule}</span></div></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function RedditListeningPlan() {
  return (
    <section id="reddit-plan" className="mt-8 rounded-2xl border bg-card p-6 shadow-sm sm:p-8">
      <p className="text-xs font-semibold uppercase tracking-wide text-brand-orange">Strategy 2027 · Community</p>
      <h2 className="mt-0.5 text-2xl font-bold tracking-tight">Reddit listening and community plan (senior living + private K-12)</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Drafts only. Staff rewrite talking points in their own words and post from their own accounts. Nothing is posted as Brandastic.
      </p>

      <div className="mt-4 rounded-xl bg-[#1644ED] p-4 text-white">
        <p className="font-semibold">Big picture: Reddit is a listening tool and an AEO content source, not a lead channel.</p>
        <p className="text-sm text-white/80">We listen for the questions families really ask, help where we can, and turn the top questions into client FAQ and comparison pages.</p>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {KPIS.map(({ label, value, note, icon: Icon, tone }) => (
          <div key={label} className={`rounded-xl border p-4 ${tone}`}>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide"><Icon className="h-4 w-4" />{label}</div>
            <p className="mt-2 text-2xl font-bold">{value}</p>
            <p className="mt-1 text-xs opacity-80">{note}</p>
          </div>
        ))}
      </div>

      <h3 className="mt-8 font-semibold">4-week rollout</h3>
      <ol className="mt-3 grid gap-3 md:grid-cols-3">
        {TIMELINE.map((step, index) => (
          <li key={step.week} className="relative rounded-xl border bg-background p-4">
            <div className="flex items-center gap-2">
              <span className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold text-white ${step.color}`}>{index + 1}</span>
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">{step.week}</span>
            </div>
            <p className="mt-2 font-semibold">{step.title}</p>
            <p className="mt-1 text-sm text-muted-foreground">{step.body}</p>
          </li>
        ))}
      </ol>
      <p className="mt-2 text-xs text-muted-foreground">School questions likely peak Dec–Jan around application deadlines (an inference, not measured).</p>

      <h3 className="mt-8 font-semibold">7 hard rules</h3>
      <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
        <Badge kind="ban">Red = ban risk</Badge>
        <Badge kind="mod">Amber = needs mod approval</Badge>
        <Badge kind="disclose">Blue = disclose</Badge>
        <Badge kind="minor">Purple = minors</Badge>
        <Badge kind="safe">Green = open</Badge>
      </div>
      <ul className="mt-3 grid gap-3 md:grid-cols-2">
        {RULES.map((rule) => (
          <li key={rule.n} className="rounded-lg border bg-background p-3">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-brand-orange">{rule.n}.</span>
              <Badge kind={rule.kind}>{rule.tag}</Badge>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{rule.text}</p>
          </li>
        ))}
      </ul>

      <div className="mt-8 rounded-xl border border-orange-200 bg-orange-50 p-4">
        <p className="font-semibold text-slate-900">Tone</p>
        <p className="mt-1 text-sm text-slate-700">
          A peer who has seen this many times. Lead with the answer, give specifics, admit downsides, never argue.
          If a reply wouldn’t help with Brandastic’s name removed, don’t post it.
        </p>
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border bg-background p-4">
          <p className="font-semibold">What senior living families ask</p>
          <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
            {QUESTIONS.senior.map((q) => (<li key={q} className="flex gap-2"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-orange" />{q}</li>))}
          </ul>
          <p className="mt-2 text-xs text-muted-foreground">Hostile to A Place for Mom. r/seniorliving doesn’t exist.</p>
        </div>
        <div className="rounded-xl border bg-background p-4">
          <p className="font-semibold">What private K-12 parents ask</p>
          <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
            {QUESTIONS.school.map((q) => (<li key={q} className="flex gap-2"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#1644ED]" />{q}</li>))}
          </ul>
        </div>
      </div>

      <h3 className="mt-8 font-semibold">Subreddits: senior living</h3>
      <div className="mt-3"><SubTable title="Community" rows={SENIOR_SUBS} /></div>

      <h3 className="mt-6 font-semibold">Subreddits: private K-12</h3>
      <div className="mt-3"><SubTable title="Community" rows={SCHOOL_SUBS} /></div>

      <h3 className="mt-8 font-semibold">Target threads</h3>
      <p className="mt-1 text-xs text-muted-foreground">Status checked Nov 27, 2026. Re-check that a thread is still open and recent before anyone comments.</p>
      <div className="mt-3 overflow-auto rounded-lg border">
        <table className="min-w-full text-sm">
          <thead className="bg-muted text-left">
            <tr>
              <th className="px-3 py-2">Vertical</th>
              <th className="px-3 py-2">Thread</th>
              <th className="px-3 py-2">Angle</th>
              <th className="px-3 py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {THREADS.map((t) => (
              <tr key={t.href} className="border-t align-top">
                <td className="px-3 py-2 whitespace-nowrap"><Badge kind={t.vertical === 'Senior' ? 'safe' : 'disclose'}>{t.vertical}</Badge></td>
                <td className="px-3 py-2">
                  <a href={t.href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium text-brand-orange hover:underline">
                    {t.title} <ExternalLink className="h-3 w-3" />
                  </a>
                  <p className="text-xs text-muted-foreground">{t.sub}</p>
                </td>
                <td className="px-3 py-2 text-muted-foreground">{t.angle}</td>
                <td className="px-3 py-2 whitespace-nowrap"><Badge kind={t.kind}>{t.status}</Badge></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
