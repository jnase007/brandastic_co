import { parseCsv } from './leads'

export const FEATURE_SHEET_CSV_URL = 'https://docs.google.com/spreadsheets/d/1HA22NWYSMURZG7kRis5eGwBZrn1heLbme8nvEmd94mU/export?format=csv&gid=453210987'

const PRIORITIES = new Set(['High', 'Medium', 'Low'])

export function normalizePriority(value) {
  const text = String(value || '').trim()
  return PRIORITIES.has(text) ? text : ''
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
