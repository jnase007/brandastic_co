import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import {
  FEATURE_SHEET_CSV_URL,
  groupByTier,
  parseFeatureSheet,
  sectionId,
} from '../lib/featureList'
import { useFeatureListNav } from '../lib/featureListNav'
import PageHeader from '../components/PageHeader'

const DIFFICULTY_STYLE = {
  Easy: 'bg-[#e8eeff] text-[#1644ED]',
  Medium: 'bg-[#f3e8ff] text-[#7c3aed]',
  Hard: 'bg-[#fee2e2] text-[#dc2626]',
}

function sectionNumber(index) {
  return String(index + 1).padStart(2, '0')
}

const PRIORITY_STYLE = {
  High: 'bg-[#fef3c7] text-[#b45309]',
  Medium: 'bg-[#e0f2fe] text-[#0369a1]',
  Low: 'bg-[#f1f5f9] text-[#64748b]',
}

function featureKey(feature) {
  return `${feature.category}|${feature.name}`
}

function featureCountLabel(total, completed) {
  const noun = total === 1 ? 'feature' : 'features'
  return `${total} ${noun} · ${completed} completed`
}

function scrollParent(node) {
  let parent = node.parentElement
  while (parent && parent !== document.body) {
    const overflow = getComputedStyle(parent).overflowY
    if ((overflow === 'auto' || overflow === 'scroll') && parent.scrollHeight > parent.clientHeight + 1) return parent
    parent = parent.parentElement
  }
  return null
}

export default function FeatureList() {
  const pageRef = useRef(null)
  const featureNav = useFeatureListNav()
  const setNavRef = useRef(featureNav?.setNav)
  const clearRef = useRef(featureNav?.clear)
  setNavRef.current = featureNav?.setNav
  clearRef.current = featureNav?.clear
  const [features, setFeatures] = useState([])
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState('')
  const [savingKey, setSavingKey] = useState('')
  const [cardErrors, setCardErrors] = useState({})
  const [category, setCategory] = useState('')
  const [showCompleted, setShowCompleted] = useState(false)
  const [activeId, setActiveId] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    let cancel = false
    async function load() {
      try {
        const response = await fetch(FEATURE_SHEET_CSV_URL)
        if (!response.ok) throw new Error(`Sheet download failed (${response.status})`)
        const rows = parseFeatureSheet(await response.text())
        if (cancel) return
        setFeatures(rows)
        setStatus('ready')
      } catch (err) {
        if (cancel) return
        setError(err.message || 'Could not load the sheet')
        setStatus('error')
      }
    }
    load()
    return () => { cancel = true }
  }, [])

  async function updatePriority(feature, priority) {
    const key = featureKey(feature)
    const previous = feature.priority
    setFeatures((current) => current.map((item) => (
      featureKey(item) === key ? { ...item, priority } : item
    )))
    setSavingKey(key)
    setCardErrors((current) => ({ ...current, [key]: '' }))
    try {
      const response = await fetch('/api/feature-priority', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category: feature.category, name: feature.name, priority }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || 'Could not save priority')
    } catch (err) {
      setFeatures((current) => current.map((item) => (
        featureKey(item) === key ? { ...item, priority: previous } : item
      )))
      setCardErrors((current) => ({ ...current, [key]: err.message || 'Could not save priority' }))
    } finally {
      setSavingKey('')
    }
  }

  const categories = useMemo(() => {
    const counts = new Map()
    for (const feature of features) counts.set(feature.category, (counts.get(feature.category) || 0) + 1)
    return [...counts.entries()].map(([name, count]) => ({ name, count }))
  }, [features])
  const listed = useMemo(
    () => (category ? features.filter((feature) => feature.category === category) : features),
    [features, category],
  )
  const groups = useMemo(() => groupByTier(listed), [listed])
  const quickWins = useMemo(
    () => features.filter((feature) => !feature.complete && feature.priority === 'High' && feature.difficulty === 'Easy').length,
    [features],
  )

  useEffect(() => {
    if (status !== 'ready' || groups.length === 0) return undefined
    const nodes = groups.flatMap((group) => (
      [...document.querySelectorAll(`[data-feature-section="${sectionId(group.name)}"]`)]
    )).filter((node) => node.getClientRects().length > 0)
    if (!nodes.length) return undefined
    const observer = new IntersectionObserver((entries) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0]
      if (visible) setActiveId(visible.target.getAttribute('data-feature-section') || '')
    }, { root: scrollParent(nodes[0]), rootMargin: '-15% 0px -55% 0px', threshold: [0.1, 0.25, 0.5] })
    nodes.forEach((node) => observer.observe(node))
    return () => observer.disconnect()
  }, [status, groups])

  const showGroup = useCallback((name) => {
    const id = sectionId(name)
    const nodes = [...document.querySelectorAll(`[data-feature-section="${id}"]`)]
    const target = nodes.find((node) => node.getClientRects().length > 0) || nodes[0]
    target?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    setActiveId(id)
    setMenuOpen(false)
  }, [])

  useEffect(() => {
    if (status !== 'ready') return undefined
    function publish() {
      const root = pageRef.current
      if (!root || root.getClientRects().length === 0) return
      setNavRef.current?.({
        sections: groups.map((group, index) => ({
          name: group.name,
          id: sectionId(group.name),
          number: sectionNumber(index),
        })),
        activeId,
        jump: showGroup,
      })
    }
    publish()
    window.addEventListener('resize', publish)
    return () => window.removeEventListener('resize', publish)
  }, [status, groups, activeId, showGroup])

  useEffect(() => () => clearRef.current?.(), [])

  const activeGroup = groups.find((group) => sectionId(group.name) === activeId)
  const completedCount = features.filter((feature) => feature.complete).length
  const counts = useMemo(() => ({
    easy: features.filter((feature) => feature.difficulty === 'Easy').length,
    medium: features.filter((feature) => feature.difficulty === 'Medium').length,
    hard: features.filter((feature) => feature.difficulty === 'Hard').length,
  }), [features])

  return (
    <div ref={pageRef} className="min-h-screen bg-[#f4f7fa] px-4 py-6 text-[#15202b] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <PageHeader
          title="Feature List"
          description="What brandastic.co should do next."
          actions={
            status === 'ready' ? (
              <p className="text-sm text-slate-500">
                {features.length} features · {quickWins} quick wins · {counts.easy}/{counts.medium}/{counts.hard} easy/med/hard
              </p>
            ) : null
          }
        />

        {status === 'ready' ? (
          <p className="mt-6 text-sm text-[#5c6b7a]">{featureCountLabel(features.length, completedCount)}</p>
        ) : null}

        {status === 'loading' ? (
          <p className="mt-8 text-sm text-[#5c6b7a]">Loading the sheet…</p>
        ) : null}
        {status === 'error' ? (
          <p className="mt-8 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">{error}</p>
        ) : null}

        {status === 'ready' ? (
          <>
            <div className="mt-6 flex flex-wrap gap-2">
              <FilterChip
                label="All"
                count={features.length}
                active={!category}
                onClick={() => setCategory('')}
              />
              {categories.map((item) => (
                <FilterChip
                  key={item.name}
                  label={item.name}
                  count={item.count}
                  active={category === item.name}
                  onClick={() => setCategory(item.name)}
                />
              ))}
            </div>

            <section className="mt-6 rounded-3xl bg-white p-6 shadow-sm sm:p-10">
              <p className="text-xs font-semibold tracking-[0.18em] text-[#9aa8b5]">WHAT WE ARE GOING TO COVER</p>
              <h2 className="mt-2 text-3xl font-semibold tracking-tight">Contents</h2>
              <div className="mt-6 grid gap-x-10 md:grid-cols-2">
                {groups.map((group, index) => (
                  <button
                    key={group.name}
                    type="button"
                    onClick={() => showGroup(group.name)}
                    className="flex items-baseline gap-3 border-b border-[#eef2f6] py-3 text-left text-[#15202b] hover:text-[#1644ED]"
                  >
                    <span className="w-6 text-sm text-[#8b98a5]">{sectionNumber(index)}</span>
                    <span className="flex-1 font-medium">{group.name}</span>
                    <span className="text-sm text-[#8b98a5]">{group.features.length}</span>
                  </button>
                ))}
              </div>
              <div className="mt-6 flex flex-wrap items-center gap-4 text-sm text-[#3d4d5c]">
                <Key swatch="bg-[#1644ED]" label="Easy" />
                <Key swatch="bg-[#7c3aed]" label="Medium" />
                <Key swatch="bg-[#dc2626]" label="Hard" />
              </div>
              <div className="mt-8 flex items-center justify-between text-[11px] font-semibold tracking-[0.16em] text-[#9aa8b5]">
                <span>BRANDASTIC</span>
                <span>CONTENTS</span>
              </div>
            </section>

            <div className="mt-6">
              {groups.length ? (
                <div className="sticky top-14 z-30 mb-4 lg:hidden">
                  <button
                    type="button"
                    onClick={() => setMenuOpen((open) => !open)}
                    className="flex w-full items-center justify-between rounded-xl border border-[#d5dde6] bg-white px-4 py-3 text-left shadow-sm"
                    aria-expanded={menuOpen}
                  >
                    <span>
                      <span className="block text-xs font-medium uppercase tracking-wide text-[#8b98a5]">Section</span>
                      <span className="font-medium">{activeGroup?.name || groups[0].name}</span>
                    </span>
                    <ChevronDown className={`h-4 w-4 text-[#8b98a5] ${menuOpen ? 'rotate-180' : ''}`} />
                  </button>
                  {menuOpen ? (
                    <div className="absolute left-0 right-0 z-40 mt-2 max-h-[60vh] overflow-y-auto rounded-2xl border border-[#d5dde6] bg-white p-2 shadow-lg">
                      {groups.map((group, index) => {
                        const active = sectionId(group.name) === (activeId || sectionId(groups[0].name))
                        return (
                          <button
                            key={group.name}
                            type="button"
                            onClick={() => showGroup(group.name)}
                            className={`flex w-full items-baseline gap-2 rounded-lg px-3 py-2 text-left text-sm ${active ? 'bg-[#e8eeff] font-medium text-[#1644ED]' : 'text-[#15202b]'}`}
                          >
                            <span className="w-5 shrink-0 text-xs text-[#8b98a5]">{sectionNumber(index)}</span>
                            <span>{group.name}</span>
                          </button>
                        )
                      })}
                    </div>
                  ) : null}
                </div>
              ) : null}
            {groups.map((group, index) => {
              const collapsed = group.name === 'Completed' && !showCompleted
              return (
              <section
                key={group.name}
                data-feature-section={sectionId(group.name)}
                className="mt-6 scroll-mt-28 rounded-3xl bg-white p-6 shadow-sm first:mt-0 sm:p-10"
              >
                <p className="text-sm font-semibold tracking-[0.16em] text-[#0f766e]">
                  {sectionNumber(index)} · {group.name.toUpperCase()}
                </p>
                <h2 className="mt-2 text-3xl font-semibold tracking-tight">{group.name}</h2>
                <p className="mt-1 text-sm text-[#5c6b7a]">{group.blurb}</p>
                <p className="mt-1 text-sm text-[#5c6b7a]">{group.features.length} {group.features.length === 1 ? 'feature' : 'features'}</p>
                {group.name === 'Completed' ? (
                  <button
                    type="button"
                    className="mt-4 text-sm font-semibold text-[#1644ED]"
                    aria-expanded={showCompleted}
                    onClick={() => setShowCompleted((open) => !open)}
                  >
                    {showCompleted ? `Hide ${group.features.length} completed` : `Show ${group.features.length} completed`}
                  </button>
                ) : null}
                {collapsed ? null : (
                <div className="mt-6 grid gap-4 md:grid-cols-2">
                  {group.features.map((feature) => (
                    <FeatureCard
                      key={`${group.name}|${feature.category}|${feature.name}`}
                      feature={feature}
                      saving={savingKey === featureKey(feature)}
                      error={cardErrors[featureKey(feature)]}
                      onPriority={(priority) => updatePriority(feature, priority)}
                    />
                  ))}
                </div>
                )}
              </section>
              )
            })}
            </div>
          </>
        ) : null}
      </div>
    </div>
  )
}

function FeatureCard({ feature, saving, error, onPriority }) {
  const [open, setOpen] = useState(false)
  const hasDetails = Boolean(feature.goal || feature.source || feature.notes)
  return (
    <article className="rounded-2xl border border-[#e6ebf2] bg-[#f8fafc] p-5">
      <h3 className="text-lg font-semibold leading-snug">{feature.name}</h3>
      <div className="mt-3 flex flex-wrap gap-2">
        <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${PRIORITY_STYLE[feature.priority] || 'bg-[#f1f5f9] text-[#94a3b8]'}`}>
          {feature.priority || 'Not set'}
        </span>
        {feature.difficulty ? (
          <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${DIFFICULTY_STYLE[feature.difficulty] || 'bg-slate-100 text-slate-700'}`}>
            {feature.difficulty}
          </span>
        ) : null}
        <span className="rounded-full bg-[#eef2f6] px-2.5 py-1 text-xs font-medium text-[#64748b]">{feature.category}</span>
      </div>
      {feature.description ? (
        <p className="mt-3 text-sm leading-6 text-[#3d4d5c]">{feature.description}</p>
      ) : null}
      {hasDetails ? (
        <>
          <button
            type="button"
            className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-[#64748b]"
            aria-expanded={open}
            onClick={() => setOpen((current) => !current)}
          >
            Details
            <ChevronDown className={`h-4 w-4 ${open ? 'rotate-180' : ''}`} />
          </button>
          {open ? (
            <div className="mt-3 space-y-2 text-sm">
              {feature.goal ? (
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-[#8b98a5]">Goal</p>
                  <p className="mt-0.5 text-[#15202b]">{feature.goal}</p>
                </div>
              ) : null}
              {feature.source ? (
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-[#8b98a5]">Current tool</p>
                  <p className="mt-0.5 text-[#15202b]">{feature.source}</p>
                </div>
              ) : null}
              {feature.notes ? (
                <p className="border-t border-[#e6ebf2] pt-3 leading-6 text-[#5c6b7a]">{feature.notes}</p>
              ) : null}
            </div>
          ) : null}
        </>
      ) : null}
      <label className="mt-4 block border-t border-[#e6ebf2] pt-4">
        <span className="text-xs font-medium uppercase tracking-wide text-[#8b98a5]">Priority</span>
        <select
          className="mt-1 h-10 w-full rounded-lg border border-[#d5dde6] bg-white px-3 text-sm text-[#15202b]"
          value={feature.priority}
          disabled={saving}
          aria-label={`Priority for ${feature.name}`}
          onChange={(event) => onPriority(event.target.value)}
        >
          <option value="">Not set</option>
          <option value="High">High</option>
          <option value="Medium">Medium</option>
          <option value="Low">Low</option>
        </select>
        {error ? <span className="mt-1 block text-xs text-[#dc2626]">{error}</span> : null}
      </label>
    </article>
  )
}

function FilterChip({ label, count, active, onClick }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`rounded-full px-3 py-1.5 text-sm font-medium ${active ? 'bg-[#15202b] text-white' : 'border border-[#d5dde6] bg-white text-[#3d4d5c]'}`}
    >
      {label} <span className={active ? 'text-white/70' : 'text-[#8b98a5]'}>{count}</span>
    </button>
  )
}

function Key({ swatch, label }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className={`h-2.5 w-2.5 rounded-full ${swatch}`} />
      {label}
    </span>
  )
}
