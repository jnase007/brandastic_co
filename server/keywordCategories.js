/* eslint-env node */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

export const KEYWORD_CATEGORIES = [
  { id: 'brand', label: 'Brand' },
  { id: 'digital', label: 'Digital marketing agency' },
  { id: 'education', label: 'Education' },
  { id: 'senior', label: 'Senior living' },
  { id: 'seo', label: 'SEO topics' },
  { id: 'social', label: 'Social media / TikTok' },
  { id: 'other', label: 'Other' },
]

const CATEGORY_IDS = new Set(KEYWORD_CATEGORIES.map((item) => item.id))

const EDUCATION = /\b(schools?|colleges?|universit(?:y|ies)|after-?school|enrollment|education|campus|k-12|higher ed)\b/i
const SOCIAL = /\btik[\s-]?tok\b/i
const SEO_TOPIC = /\b(link profiles?|search engine optimi[sz]ation|organic search)\b/i
const AGENCY = /\bagenc(?:y|ies)\b/i
const SENIOR = /\b(senior living|assisted living|memory care|home care|senior care|senior housing|independent living|nursing home|retirement communit(?:y|ies))\b/i
const DIGITAL = /\b(digital marketing|advertising|branding|ppc|paid media|pay[- ]per|cro|wordpress|shopify|social media agency|content agency|marketing agency|google ads|irvine|costa mesa|newport beach|orange county|\boc\b)\b/i

export function normalizeKeyword(value) {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ')
}

export function loadKeywordOverrides(filePath) {
  const path = filePath || join(dirname(fileURLToPath(import.meta.url)), '../data/keyword-categories.json')
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf8'))
    const source = parsed?.overrides && typeof parsed.overrides === 'object' ? parsed.overrides : {}
    const overrides = {}
    for (const [keyword, category] of Object.entries(source)) {
      const id = String(category || '').trim().toLowerCase()
      const key = normalizeKeyword(keyword)
      if (key && CATEGORY_IDS.has(id)) overrides[key] = id
    }
    return overrides
  } catch {
    return {}
  }
}

export function assignKeywordCategory(keyword, overrides = {}) {
  const text = normalizeKeyword(keyword)
  if (!text) return 'other'
  const chosen = overrides[text]
  if (CATEGORY_IDS.has(chosen)) return chosen
  if (/brandastic|brandtastic/.test(text)) return 'brand'
  if (EDUCATION.test(text)) return 'education'
  if (SOCIAL.test(text)) return 'social'
  if (SEO_TOPIC.test(text) && !AGENCY.test(text)) return 'seo'
  if (SENIOR.test(text)) return 'senior'
  if (DIGITAL.test(text) || AGENCY.test(text)) return 'digital'
  return 'other'
}

export function categoryLabel(id) {
  return KEYWORD_CATEGORIES.find((item) => item.id === id)?.label || 'Other'
}
