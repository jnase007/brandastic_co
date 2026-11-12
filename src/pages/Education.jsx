import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { cn } from '../lib/utils'
import PageHeader from '../components/PageHeader'

const NAV = [
  {
    group: 'Masterclass 2026',
    items: [
      { slug: 'v1-overview', label: 'Video 01 · Bookings' },
      { slug: 'events', label: 'Client nights' },
      { slug: 'gifting', label: 'Gifts / Goody' },
      { slug: 'customer', label: 'Reopen / stay close' },
      { slug: 'seo', label: 'SEO 8-piece' },
      { slug: 'paid', label: 'Ads backup' },
      { slug: 'team', label: 'Thursday OS' },
      { slug: 'loss', label: 'When we lose' },
      { slug: 'whitespace', label: 'White space' },
      { slug: 'this-week', label: 'Start this week' },
      { slug: 'video-02-launch-services', label: 'Video 02 · Launch services' },
      { slug: 'v2-when-to-launch', label: 'Build vs buy' },
      { slug: 'v2-launch-checklist', label: '30-day kit' },
      { slug: 'v2-offer-rules', label: 'ICP + RFP' },
      { slug: 'v2-leadership', label: 'NRR / leadership' },
      { slug: 'v2-brandastic', label: 'Brandastic' },
      { slug: 'video-03-content-2026', label: 'Video 03 · Content 2026' },
      { slug: 'v3-ia-architecture', label: 'IA + spend' },
      { slug: 'v3-listicles-guides', label: 'Listicles + Clutch' },
      { slug: 'v3-pillars-brand', label: 'Pillars' },
      { slug: 'v3-team-flywheel', label: 'Team OS' },
      { slug: 'v3-brandastic', label: 'Brandastic' },
      { slug: 'video-04-advertise', label: 'Video 04 · Advertise' },
      { slug: 'v4-principles', label: 'TAM + Primer' },
      { slug: 'v4-channels', label: 'Channels + offers' },
      { slug: 'v4-sales-ops', label: 'Sales + measurement' },
      { slug: 'v4-brand-structure', label: 'Who to advertise' },
      { slug: 'v4-brandastic', label: 'Brandastic' },
    ],
  },
  {
    group: 'Courses',
    items: [
      { slug: 'agency-academy-course', label: 'Course hub' },
      { slug: 'course-downloads', label: 'All downloads' },
      { slug: 'course-intro', label: 'Intro' },
      { slug: 'course-sales-process', label: 'Sales process' },
      { slug: 'course-sales-team', label: 'Sales team' },
      { slug: 'course-sales-comp', label: 'Comp plans' },
      { slug: 'course-sales-pitch', label: 'Pitch / proposals' },
      { slug: 'course-sales-pricing', label: 'Pricing' },
      { slug: 'course-sales-contracts', label: 'Contracts / SOW' },
      { slug: 'course-mkt-position', label: 'Positioning' },
      { slug: 'course-mkt-brand', label: 'Branding' },
      { slug: 'course-mkt-channels', label: 'Channels' },
      { slug: 'course-mkt-budget', label: 'Budget' },
      { slug: 'course-fin-dept', label: 'Finance dept' },
      { slug: 'course-fin-pl', label: 'P&L' },
      { slug: 'course-fin-monthend', label: 'Month-end close' },
      { slug: 'course-fin-kpis', label: 'Exec KPIs' },
      { slug: 'course-fin-model', label: 'Financial model' },
      { slug: 'course-fin-reporting', label: 'Reporting' },
      { slug: 'course-ops-jit', label: 'JIT labor' },
      { slug: 'course-ops-global', label: 'Global hiring' },
      { slug: 'course-ops-talent-gate', label: 'Talent gate' },
      { slug: 'course-ops-kpis', label: 'Ops KPIs' },
      { slug: 'course-ops-reporting', label: 'Weekly + QBR' },
      { slug: 'course-ops-referrals', label: 'Referrals' },
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
]

export default function Education() {
  const { slug = 'agency-academy-course' } = useParams()
  const navigate = useNavigate()
  const [html, setHtml] = useState('')
  const [error, setError] = useState('')

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
    <div className="mx-auto flex max-w-7xl gap-6 px-4 py-6 sm:px-6">
      <aside className="hidden w-56 shrink-0 lg:block">
        {NAV.map((section) => (
          <div key={section.group} className="mb-5">
            <p className="px-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">{section.group}</p>
            <div className="mt-1 space-y-0.5">
              {section.items.map((item) => (
                <Link
                  key={item.slug}
                  to={`/education/${item.slug}`}
                  className={cn(
                    'block rounded-lg px-2 py-1.5 text-sm',
                    slug === item.slug ? 'bg-[#1644ED] text-white' : 'text-slate-600 hover:bg-slate-100'
                  )}
                >
                  {item.label}
                </Link>
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
            {NAV.flatMap((section) => section.items).map((item) => (
              <option key={item.slug} value={item.slug}>{item.label}</option>
            ))}
          </select>
        </div>
        {error ? <p className="mt-6 text-sm text-red-600">{error}</p> : null}
        <article className="prose mt-6 max-w-none" dangerouslySetInnerHTML={{ __html: html }} />
      </div>
    </div>
  )
}
