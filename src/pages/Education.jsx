import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { cn } from '../lib/utils'
import PageHeader from '../components/PageHeader'
import './education.css'

const NAV = [
  {
    group: 'Masterclass 2026',
    blocks: [
      {
        kicker: 'Video 01',
        title: 'Marketing Strategies That Drive Bookings',
        tone: 'v1',
        items: [
          { slug: 'v1-overview', label: 'Video title' },
          { slug: 'events', label: 'Client nights' },
          { slug: 'gifting', label: 'Gifts / Goody' },
          { slug: 'customer', label: 'Reopen / stay close' },
          { slug: 'seo', label: 'SEO 8-piece' },
          { slug: 'paid', label: 'Ads backup' },
          { slug: 'team', label: 'Thursday OS' },
          { slug: 'loss', label: 'When we lose' },
          { slug: 'whitespace', label: 'White space' },
          { slug: 'this-week', label: 'Start this week' },
        ],
      },
      {
        kicker: 'Video 02',
        title: 'How To Launch New Services/Offerings',
        tone: 'v2',
        items: [
          { slug: 'video-02-launch-services', label: 'Video title' },
          { slug: 'v2-when-to-launch', label: 'Build vs buy' },
          { slug: 'v2-launch-checklist', label: '30-day kit' },
          { slug: 'v2-offer-rules', label: 'ICP + RFP' },
          { slug: 'v2-leadership', label: 'NRR / leadership' },
          { slug: 'v2-brandastic', label: 'Brandastic' },
        ],
      },
      {
        kicker: 'Video 03',
        title: 'Content Marketing To Grow Your Agency In 2026',
        tone: 'v3',
        items: [
          { slug: 'video-03-content-2026', label: 'Video title' },
          { slug: 'v3-ia-architecture', label: 'IA + spend' },
          { slug: 'v3-listicles-guides', label: 'Listicles + Clutch' },
          { slug: 'v3-pillars-brand', label: 'Pillars' },
          { slug: 'v3-team-flywheel', label: 'Team OS' },
          { slug: 'v3-brandastic', label: 'Brandastic' },
        ],
      },
      {
        kicker: 'Video 04',
        title: 'How to Advertise Your Agency',
        tone: 'v4',
        items: [
          { slug: 'video-04-advertise', label: 'Video title' },
          { slug: 'v4-principles', label: 'TAM + Primer' },
          { slug: 'v4-channels', label: 'Channels + offers' },
          { slug: 'v4-sales-ops', label: 'Sales + measurement' },
          { slug: 'v4-brand-structure', label: 'Who to advertise' },
          { slug: 'v4-brandastic', label: 'Brandastic' },
        ],
      },
    ],
  },
  {
    group: 'Courses',
    blocks: [
      {
        kicker: 'Hub',
        title: 'Agency Academy',
        tone: 'hub',
        items: [
          { slug: 'agency-academy-course', label: 'Course hub' },
          { slug: 'course-downloads', label: 'All downloads' },
          { slug: 'course-intro', label: 'Intro' },
        ],
      },
      {
        kicker: 'Sales',
        title: 'Sales module',
        tone: 'sales',
        items: [
          { slug: 'course-sales-process', label: 'Sales process' },
          { slug: 'course-sales-team', label: 'Sales team' },
          { slug: 'course-sales-comp', label: 'Comp plans' },
          { slug: 'course-sales-pitch', label: 'Pitch / proposals' },
          { slug: 'course-sales-pricing', label: 'Pricing' },
          { slug: 'course-sales-contracts', label: 'Contracts / SOW' },
        ],
      },
      {
        kicker: 'Marketing',
        title: 'Marketing module',
        tone: 'mkt',
        items: [
          { slug: 'course-mkt-position', label: 'Positioning' },
          { slug: 'course-mkt-brand', label: 'Branding' },
          { slug: 'course-mkt-channels', label: 'Channels' },
          { slug: 'course-mkt-budget', label: 'Budget' },
        ],
      },
      {
        kicker: 'Finance',
        title: 'Finance module',
        tone: 'fin',
        items: [
          { slug: 'course-fin-dept', label: 'Finance dept' },
          { slug: 'course-fin-pl', label: 'P&L' },
          { slug: 'course-fin-monthend', label: 'Month-end close' },
          { slug: 'course-fin-kpis', label: 'Exec KPIs' },
          { slug: 'course-fin-model', label: 'Financial model' },
          { slug: 'course-fin-reporting', label: 'Reporting' },
        ],
      },
      {
        kicker: 'Operations',
        title: 'Operations module',
        tone: 'ops',
        items: [
          { slug: 'course-ops-jit', label: 'JIT labor' },
          { slug: 'course-ops-global', label: 'Global hiring' },
          { slug: 'course-ops-talent-gate', label: 'Talent gate' },
          { slug: 'course-ops-kpis', label: 'Ops KPIs' },
          { slug: 'course-ops-reporting', label: 'Weekly + QBR' },
          { slug: 'course-ops-referrals', label: 'Referrals' },
        ],
      },
      {
        kicker: 'People',
        title: 'People module',
        tone: 'people',
        items: [
          { slug: 'course-people-hiring', label: 'Hiring' },
          { slug: 'course-people-jd', label: 'Job descriptions' },
          { slug: 'course-people-onboard', label: 'Onboarding' },
          { slug: 'course-people-1on1', label: '1:1s + reviews' },
          { slug: 'course-people-benefits', label: 'Benefits' },
          { slug: 'course-people-perf', label: 'Performance' },
          { slug: 'course-people-bonus', label: 'Bonus' },
          { slug: 'course-people-allhands', label: 'All-hands' },
          { slug: 'course-people-retreats', label: 'Retreats' },
        ],
      },
    ],
  },
]

const ALL_ITEMS = NAV.flatMap((section) =>
  section.blocks.flatMap((block) => block.items.map((item) => ({ ...item, tone: block.tone, group: `${block.kicker} · ${item.label}` })))
)

export default function Education() {
  const { slug = 'agency-academy-course' } = useParams()
  const navigate = useNavigate()
  const [html, setHtml] = useState('')
  const [error, setError] = useState('')
  const tone = ALL_ITEMS.find((item) => item.slug === slug)?.tone || 'hub'
  const courseSlugs = new Set(
    NAV.find((section) => section.group === 'Courses').blocks.flatMap((block) => block.items.map((item) => item.slug))
  )
  const visibleNav = NAV.filter((section) =>
    courseSlugs.has(slug) ? section.group === 'Courses' : section.group === 'Masterclass 2026'
  )

  useEffect(() => {
    let cancel = false
    setHtml('')
    setError('')
    fetch(`/education-content/${slug}.html`)
      .then((res) => {
        if (!res.ok) throw new Error('missing')
        return res.text()
      })
      .then((text) => {
        if (!cancel) setHtml(text)
      })
      .catch(() => {
        if (!cancel) setError('This page is not on brandastic.co yet.')
      })
    return () => { cancel = true }
  }, [slug])

  return (
    <div className="education-shell mx-auto flex max-w-7xl gap-6 px-4 py-6 sm:px-6">
      <aside className="education-nav hidden w-[272px] shrink-0 lg:block">
        {visibleNav.map((section) => (
          <div key={section.group} className="mb-6">
            <p className="px-1 pb-3 text-[10px] font-semibold uppercase tracking-wider text-slate-400">{section.group}</p>
            <div className="space-y-4">
              {section.blocks.map((block) => (
                <div key={block.kicker}>
                  <p className={cn('ed-kicker', block.tone)}>{block.kicker}</p>
                  <div className={cn('ed-card', block.tone)}>
                    <p className="ed-card-title">{block.title}</p>
                    {block.items.map((item) => (
                      <Link
                        key={item.slug}
                        to={`/education/${item.slug}`}
                        className={cn('ed-link', slug === item.slug && 'on')}
                      >
                        <span className="ed-dot" />
                        {item.label}
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </aside>
      <div className="min-w-0 flex-1">
        <PageHeader title="Education" description="Masterclass and courses. PDFs open from All downloads." />
        <div className="mt-4 lg:hidden">
          <select
            className="h-10 w-full rounded-lg border px-3 text-sm"
            value={slug}
            onChange={(event) => navigate(`/education/${event.target.value}`)}
          >
            {visibleNav.flatMap((section) => section.blocks.flatMap((block) => block.items.map((item) => ({ ...item, group: `${block.kicker} · ${item.label}` })))).map((item) => (
              <option key={item.slug} value={item.slug}>{item.group}</option>
            ))}
          </select>
        </div>
        {error ? <p className="mt-6 text-sm text-red-600">{error}</p> : null}
        <article className={cn('education-body mt-6 rounded-2xl border bg-white p-5 shadow-sm sm:p-8', `tone-${tone}`)} dangerouslySetInnerHTML={{ __html: html }} />
      </div>
    </div>
  )
}
