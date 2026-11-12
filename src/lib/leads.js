export const LEAD_SOURCES = [
  'Direct',
  'SEO (organic)',
  'Google Ads',
  'Meta',
  'Referral',
  'Chamber + Events',
  'Outbound (LinkedIn + Email)',
  'OpenAI/ChatGPT',
  'Existing client',
]

/** Quality values currently on the All Leads sheet. Blank is allowed. */
export const LEAD_QUALITIES = [
  'New lead',
  'Good Lead',
  'Proposal sent',
  'Closed',
  'No response from emails & calls',
  'No show at KO',
  'No show for KO',
  'Vendor selling to us',
  'Looking for a job',
  'Spam',
]

export const DEAL_TYPES = ['One-time', 'Monthly']

export const CHANNEL_COLORS = {
  Direct: 'bg-[#cfe8f8] text-[#23637d]',
  'Chamber + Events': 'bg-[#c2e4e1] text-[#07514a]',
  Meta: 'bg-[#e9d4fd] text-[#5c2e87]',
  'SEO (organic)': 'bg-[#c7f0d6] text-[#126432]',
  'Google Ads': 'bg-[#fddcc4] text-[#883c0c]',
  Referral: 'bg-[#f9ecc1] text-[#80620a]',
  'Outbound (LinkedIn + Email)': 'bg-[#d8dce2] text-[#374151]',
  'OpenAI/ChatGPT': 'bg-[#facfe5] text-[#812854]',
  'Existing client': 'bg-[#e5e7eb] text-[#374151]',
}

export const QUALITY_COLORS = {
  'New lead': 'bg-[#dbeafe] text-[#1e3a8a]',
  'Good Lead': 'bg-[#b6d7a8] text-[#234d1a]',
  'Proposal sent': 'bg-[#fee6b8] text-[#92400e]',
  Closed: 'bg-[#bbf7d0] text-[#166534]',
  'No response from emails & calls': 'bg-[#e5e7eb] text-[#4b5563]',
  'No show at KO': 'bg-[#fecaca] text-[#991b1b]',
  'No show for KO': 'bg-[#fecaca] text-[#991b1b]',
  'Vendor selling to us': 'bg-[#e5e7eb] text-[#4b5563]',
  'Looking for a job': 'bg-[#e5e7eb] text-[#4b5563]',
  Spam: 'bg-[#f3f4f6] text-[#6b7280]',
}

export function chipClass(map, value) {
  return map[value] || 'bg-muted text-foreground'
}

export const SHEET_CSV_URL =
  'https://docs.google.com/spreadsheets/d/1h-O3MynKwL9MhxO2Ytly5gtHd_udyqNJ6n4_OfXLCgY/export?format=csv'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export function parseJiraKey(value) {
  const text = String(value || '').trim()
  const fromUrl = text.match(/browse\/([A-Z][A-Z0-9]+-\d+)/i)
  const key = (fromUrl ? fromUrl[1] : text).toUpperCase()
  if (!/^[A-Z][A-Z0-9]+-\d+$/.test(key)) return ''
  return key
}

export function jiraUrl(key) {
  const parsed = parseJiraKey(key)
  if (!parsed) return null
  return `https://brandastic.atlassian.net/browse/${parsed}`
}

export function monthLabel(isoDate) {
  if (!isoDate) return ''
  const month = Number(String(isoDate).slice(5, 7))
  return MONTHS[month - 1] || ''
}

export function parseSheetDate(value) {
  const match = String(value || '').trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/)
  if (!match) return null
  const month = Number(match[1])
  const day = Number(match[2])
  let year = Number(match[3])
  if (year < 100) year += 2000
  if (month < 1 || month > 12 || day < 1 || day > 31) return null
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

export function parseMoney(value) {
  const text = String(value || '').replace(/[$,]/g, '').trim()
  if (!text) return null
  const amount = Number.parseFloat(text)
  return Number.isFinite(amount) ? amount : null
}

export function commaMoney(value) {
  const parsed = parseMoney(value)
  if (parsed == null) return ''
  const [whole, dec] = String(parsed).split('.')
  const withCommas = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return dec != null ? `${withCommas}.${dec}` : withCommas
}

export function normalizeDealType(value) {
  const text = String(value || '').trim().toLowerCase()
  if (text === 'one-time' || text === 'onetime' || text === 'one time') return 'One-time'
  if (text === 'monthly') return 'Monthly'
  return null
}

export function parseCsv(text) {
  const rows = []
  let row = []
  let cell = ''
  let quoted = false
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]
    if (quoted) {
      if (char === '"') {
        if (text[index + 1] === '"') {
          cell += '"'
          index += 1
        } else quoted = false
      } else cell += char
    } else if (char === '"') quoted = true
    else if (char === ',') {
      row.push(cell)
      cell = ''
    } else if (char === '\n') {
      row.push(cell)
      rows.push(row)
      row = []
      cell = ''
    } else if (char !== '\r') cell += char
  }
  if (cell.length || row.length) {
    row.push(cell)
    rows.push(row)
  }
  return rows
}

export function sheetRowsToLeads(text) {
  return parseCsv(text)
    .slice(1)
    .map((row) => {
      const source = (row[0] || '').trim()
      const rawDate = (row[1] || '').trim()
      const firstContact = parseSheetDate(rawDate)
      const name = (row[3] || '').trim()
      const company = (row[4] || '').trim()
      const email = (row[6] || '').trim()
      if (!source && !name && !company && !email) return null
      const dealType = normalizeDealType(row[12])
      return {
        source,
        first_contact_date: firstContact,
        jira_key: (row[2] || '').trim(),
        name,
        company,
        telephone: (row[5] || '').trim(),
        email,
        notes: (row[7] || '').trim(),
        month: (row[8] || '').trim() || monthLabel(firstContact),
        quality: (row[9] || '').trim(),
        close_amount: parseMoney(row[10]),
        referred_by: (row[11] || '').trim(),
        deal_type: dealType,
        value_2026: parseMoney(row[13]),
        import_key: [source, firstContact || rawDate, name, company, email].join('|').toLowerCase(),
      }
    })
    .filter(Boolean)
}

export function formatMoney(value) {
  if (value == null || value === '') return ''
  const amount = Number(value)
  if (!Number.isFinite(amount)) return ''
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
  }).format(amount)
}

export function displayDate(isoDate) {
  if (!isoDate) return ''
  const [year, month, day] = String(isoDate).slice(0, 10).split('-')
  if (!year || !month || !day) return isoDate
  return `${Number(month)}/${Number(day)}/${year}`
}
