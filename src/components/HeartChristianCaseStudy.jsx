const CASE_STUDY = 'https://brandastic.com/portfolio/heart-christian-academy/'

const RESULTS = [
  { value: '13,217', label: 'Visits to campus landing pages' },
  { value: '497', label: 'Family inquiries from an open house interest form' },
  { value: '373', label: 'Meta inquiries at a $35 cost per lead' },
  { value: '124', label: 'Google Search inquiries' },
  { value: '166', label: 'Inquiries per campus, on average' },
  { value: '3', label: 'Campus markets launched' },
]

const ADS = [
  {
    campus: 'Chino',
    shots: [
      {
        src: '/heart-christian/heart-christian-chino-ad1.jpg',
        alt: 'Heart Chino ad: Christ-centered learning for junior kinder through 5th grade. Experience Heart Chino. Join an open house.',
      },
      {
        src: '/heart-christian/heart-christian-chino-ad2.jpg',
        alt: 'Heart Chino ad: Guided by faith, built for families. Visit our Chino campus today.',
      },
    ],
  },
  {
    campus: 'Heart High',
    shots: [
      {
        src: '/heart-christian/heart-christian-heart-high-ad1.jpg',
        alt: 'Heart High ad: Faith. Leadership. Purpose. Explore Heart High in San Juan Capistrano.',
      },
      {
        src: '/heart-christian/heart-christian-heart-high-ad2.jpg',
        alt: 'Heart High ad: Where teens are known and supported. Join an open house.',
      },
    ],
  },
  {
    campus: 'Santee',
    shots: [
      {
        src: '/heart-christian/heart-christian-santee-ad1.jpg',
        alt: 'Heart Santee ad: Christ-centered learning for junior kinder through 5th grade. Experience Heart Santee.',
      },
      {
        src: '/heart-christian/heart-christian-santee-ad2.jpg',
        alt: 'Heart Santee ad: Guided by faith, built for families. Visit our Santee campus today.',
      },
    ],
  },
  {
    campus: 'Montgomery, TX',
    shots: [
      {
        src: '/heart-christian/heart-christian-montgomery-ad1.jpg',
        alt: 'Heart Montgomery ad: Christ, community, curriculum. Explore Heart Montgomery at an open house.',
      },
      {
        src: '/heart-christian/heart-christian-montgomery-ad2.jpg',
        alt: 'Heart Montgomery ad: Now enrolling in Montgomery, TX. A Christ-centered campus for junior kinder through 6th grade.',
      },
    ],
  },
]

export default function HeartChristianCaseStudy() {
  return (
    <section className="mt-8 overflow-hidden rounded-2xl border bg-white shadow-sm" aria-labelledby="heart-christian-case-study">
      <div className="grid lg:grid-cols-[220px_minmax(0,1fr)]">
        <div className="relative h-52 lg:h-full lg:min-h-[220px]">
          <img
            src="/heart-christian/heart-christian-kids.jpg"
            alt="Heart Christian Academy students, one wearing a Heart Christian Academy cap"
            className="absolute inset-0 h-full w-full object-cover object-[center_15%]"
          />
        </div>
        <div className="p-6 sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-sky-700">Schools proof · Case study</p>
            <a href={CASE_STUDY} target="_blank" rel="noreferrer" className="text-sm font-medium text-[#FF6B00] hover:underline">
              Full case study
            </a>
          </div>
          <h2 id="heart-christian-case-study" className="mt-1 text-2xl font-bold">Heart Christian Academy</h2>
          <p className="mt-1 text-lg font-medium">Reaching new families through targeted digital campaigns</p>
          <p className="mt-3 text-sm text-slate-700">
            Brandastic partnered with Heart Christian Academy to strengthen its digital marketing and connect the academy with families seeking a different approach to education.
          </p>
          <a
            href={CASE_STUDY}
            target="_blank"
            rel="noreferrer"
            className="mt-4 inline-flex rounded-lg bg-[#1644ED] px-3 py-2 text-sm font-medium text-white hover:opacity-90"
          >
            Read the full case study
          </a>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 px-6 pb-2 sm:px-8 md:grid-cols-3">
        {RESULTS.map((item) => (
          <div key={item.value + item.label} className="rounded-xl border border-sky-100 bg-sky-50 px-3 py-3">
            <p className="text-2xl font-bold text-[#1644ED]">{item.value}</p>
            <p className="mt-1 text-xs leading-snug text-slate-600">{item.label}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 px-6 py-6 sm:px-8 md:grid-cols-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">The challenge</p>
          <p className="mt-2 text-sm text-slate-700">
            Heart Christian Academy wanted to introduce more families to its approach to education while strengthening awareness across existing campuses and expanding into new markets. Many parents are still unfamiliar with collaborative Christian education and the benefits of a structured hybrid model.
          </p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">The solution</p>
          <p className="mt-2 text-sm text-slate-700">
            Through targeted digital advertising and dedicated landing pages, Brandastic developed campaigns designed to increase local awareness, generate qualified interest, and introduce prospective families to Heart&apos;s collaborative Christian education model. Messaging highlighted Christ-centered learning, intentional parent involvement, academic support, and a welcoming community.
          </p>
        </div>
      </div>

      <div className="border-t px-6 py-6 sm:px-8">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">The results</p>
        <p className="mt-2 text-sm text-slate-700">
          Across three campus locations, Meta and Google campaigns drove 13,217 visits to campus landing pages and generated 497 family inquiries. Meta informational ads for each campus open house produced 373 inquiries at a $35 cost per lead. Google Search added 124 inquiries from families searching for Christian schools in their area.
        </p>
        <p className="mt-5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Paid ads</p>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {ADS.map((group) => (
            <div key={group.campus} className="min-w-0">
              <p className="mb-1.5 text-xs font-semibold text-slate-700">{group.campus}</p>
              <div className="grid grid-cols-2 gap-1.5">
                {group.shots.map((shot) => (
                  <img
                    key={shot.src}
                    src={shot.src}
                    alt={shot.alt}
                    className="aspect-square w-full rounded-lg object-cover ring-1 ring-black/5"
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
