import { parseCsv } from './leads'

export const FEATURE_SHEET_CSV_URL = 'https://docs.google.com/spreadsheets/d/1HA22NWYSMURZG7kRis5eGwBZrn1heLbme8nvEmd94mU/export?format=csv&gid=453210987'

const PRIORITIES = new Set(['High', 'Medium', 'Low'])

export function normalizePriority(value) {
  const text = String(value || '').trim()
  return PRIORITIES.has(text) ? text : ''
}

export function isComplete(value) {
  return String(value || '').replace(/\s+/g, ' ').trim().toLowerCase() === 'yes'
}

export function sectionId(name) {
  const slug = String(name || 'other').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  return `feature-${slug || 'other'}`
}

export function parseFeatureSheet(text) {
  return parseCsv(text)
    .slice(1)
    .map((row) => ({
      category: (row[0] || '').trim(),
      name: (row[1] || '').trim(),
      description: (row[2] || '').trim(),
      priority: normalizePriority(row[3]),
      difficulty: (row[4] || '').trim(),
      goal: (row[5] || '').trim(),
      source: (row[6] || '').trim(),
      notes: (row[7] || '').trim(),
      complete: isComplete(row[8]),
    }))
    .filter((feature) => feature.category && feature.name)
}

export function groupFeatures(features) {
  const groups = []
  const byName = new Map()
  for (const feature of features) {
    let group = byName.get(feature.category)
    if (!group) {
      group = { name: feature.category, features: [] }
      byName.set(feature.category, group)
      groups.push(group)
    }
    group.features.push(feature)
  }
  return groups
}

const DIFFICULTY_RANK = { Easy: 0, Medium: 1, Hard: 2 }
const PRIORITY_RANK = { High: 0, Medium: 1, Low: 2 }

function compareBy(fields) {
  return (a, b) => {
    for (const field of fields) {
      const table = field === 'priority' ? PRIORITY_RANK : DIFFICULTY_RANK
      const delta = (table[a.feature[field]] ?? 99) - (table[b.feature[field]] ?? 99)
      if (delta) return delta
    }
    return a.index - b.index
  }
}

const bySheet = (a, b) => a.index - b.index

export function groupByTier(features) {
  const indexed = (features || []).map((feature, index) => ({ feature, index }))
  const used = new Set()
  const take = (match, compare) => {
    const picked = indexed.filter((item) => !used.has(item.index) && match(item.feature))
    picked.sort(compare)
    picked.forEach((item) => used.add(item.index))
    return picked.map((item) => item.feature)
  }
  const open = (feature) => !feature.complete
  const tiers = [
    {
      name: 'Quick wins',
      blurb: 'High priority and easy, start here',
      features: take((feature) => open(feature) && feature.priority === 'High' && feature.difficulty === 'Easy', bySheet),
    },
    {
      name: 'High priority',
      blurb: 'High priority, and more than a quick job',
      features: take((feature) => open(feature) && feature.priority === 'High' && (feature.difficulty === 'Medium' || feature.difficulty === 'Hard'), compareBy(['difficulty'])),
    },
    {
      name: 'Easy pickups',
      blurb: 'Easy work at medium or low priority',
      features: take((feature) => open(feature) && feature.difficulty === 'Easy' && (feature.priority === 'Medium' || feature.priority === 'Low'), compareBy(['priority'])),
    },
    {
      name: 'Everything else',
      blurb: 'Medium or low priority, and not a quick job',
      features: take((feature) => open(feature) && (feature.priority === 'Medium' || feature.priority === 'Low') && (feature.difficulty === 'Medium' || feature.difficulty === 'Hard'), compareBy(['priority', 'difficulty'])),
    },
    {
      name: 'Needs a priority',
      blurb: 'Set a priority so these can be sorted',
      features: take((feature) => open(feature) && !feature.priority, compareBy(['difficulty'])),
    },
    {
      name: 'Completed',
      blurb: 'Already done',
      features: take((feature) => feature.complete, bySheet),
    },
  ]
  const leftover = indexed.filter((item) => !used.has(item.index))
  if (leftover.length) {
    leftover.sort(bySheet)
    tiers[3].features.push(...leftover.map((item) => item.feature))
  }
  return tiers.filter((tier) => tier.features.length)
}
