import { createClient } from '@supabase/supabase-js'

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const MONTH_PATTERN = new RegExp(`Invoiced every (${MONTHS.join('|')})`, 'i')
const EXCLUDED_KEYS = new Set(['NOS-42'])

export async function assertTeam(env, token) {
  if (!token) return { ok: false, status: 401, error: 'Sign in required' }
  const url = env.VITE_SUPABASE_URL
  const anon = env.VITE_SUPABASE_ANON_KEY
  if (!url || !anon) return { ok: false, status: 500, error: 'Hosting is not configured' }
  const supabase = createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  })
  const { data, error } = await supabase.auth.getUser(token)
  if (error || !data?.user) return { ok: false, status: 401, error: 'Sign in required' }
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', data.user.id).maybeSingle()
  if (profile?.role !== 'team' && profile?.role !== 'admin') {
    return { ok: false, status: 403, error: 'Team access required' }
  }
  return { ok: true }
}

export async function loadHostingPortfolio(env) {
  const issues = await searchRetainers(env)
  const retainers = issues.filter((issue) => !excluded(issue)).map(toRetainer).filter(Boolean)
  const windows = retainers.filter((row) => row.billing)
  const issueIds = windows.flatMap((row) => row.issueIds)
  const earliest = windows.reduce((min, row) => (row.billing.previousStart < min ? row.billing.previousStart : min), '9999-12-31')
  const latest = windows.reduce((max, row) => (row.billing.currentEnd > max ? row.billing.currentEnd : max), '0000-01-01')
  const worklogs = issueIds.length ? await searchWorklogs(env, earliest, latest, issueIds) : []
  const secondsByIssue = new Map()
  for (const log of worklogs) {
    const id = String(log.issue?.id || '')
    if (!id || !log.startDate) continue
    const dates = secondsByIssue.get(id) || []
    dates.push({ date: log.startDate, seconds: Number(log.timeSpentSeconds) || 0 })
    secondsByIssue.set(id, dates)
  }

  const rows = retainers.map((row) => {
    const hours = row.billing ? hoursFor(row, secondsByIssue) : { current: null, previous: null }
    const allotted = row.annualFee == null ? null : round1(row.annualFee / 200)
    const ratio = hours.current != null && allotted > 0 ? hours.current / allotted : null
    const level = ratio == null ? null : ratio >= 1 ? 'over' : ratio >= 0.8 ? 'warn' : 'ok'
    return {
      key: row.key,
      url: `https://brandastic.atlassian.net/browse/${row.key}`,
      client: row.client,
      project: row.project,
      service: row.service,
      tier: row.tier,
      annualFee: row.annualFee,
      amountPending: row.annualFee == null,
      invoiceMonth: row.billing?.month || null,
      chartMonth: row.chartMonth,
      chartMonthly: row.chartMonthly,
      billingMonthMissing: !row.billing,
      allottedHours: allotted,
      currentHours: hours.current == null ? null : round1(hours.current),
      previousHours: hours.previous == null ? null : round1(hours.previous),
      percentUsed: ratio == null ? null : Math.round(ratio * 1000) / 10,
      overUnder: hours.current == null || allotted == null ? null : round1(hours.current - allotted),
      level,
      status: row.status,
      assignee: row.assignee,
      updates: row.updates,
    }
  }).sort((a, b) => a.client.localeCompare(b.client))

  const knownFee = rows.filter((row) => row.annualFee != null)
  const today = losAngelesToday()
  const updateCycle = activeUpdateCycle(today)
  const tier2 = rows.filter((row) => row.tier === 'Tier-2')
  return {
    generatedAt: new Date().toISOString(),
    kpis: {
      active: rows.length,
      tier1: rows.filter((row) => row.tier === 'Tier-1').length,
      tier2: tier2.length,
      hosting: rows.filter((row) => row.service === 'Hosting').length,
      hostingMaintenance: rows.filter((row) => row.service === 'Hosting + Maintenance').length,
      maintenance: rows.filter((row) => row.service === 'Maintenance').length,
      annualRevenue: knownFee.reduce((sum, row) => sum + row.annualFee, 0),
      overHours: rows.filter((row) => row.level === 'over').length,
      warningHours: rows.filter((row) => row.level === 'warn').length,
      billingMonthMissing: rows.filter((row) => row.billingMonthMissing).length,
      updateCycle: updateCycle.id,
      updateCycleLabel: updateCycle.label,
      updatesDone: tier2.filter((row) => row.updates?.[updateCycle.id]?.state === 'done').length,
      updatesTotal: tier2.length,
    },
    retainers: rows,
  }
}

function hoursFor(row, secondsByIssue) {
  let current = 0
  let previous = 0
  for (const id of row.issueIds) {
    for (const log of secondsByIssue.get(id) || []) {
      if (log.date >= row.billing.currentStart && log.date <= row.billing.currentEnd) current += log.seconds
      else if (log.date >= row.billing.previousStart && log.date <= row.billing.previousEnd) previous += log.seconds
    }
  }
  return { current: current / 3600, previous: previous / 3600 }
}

async function searchRetainers(env) {
  const cloud = env.JIRA_CLOUD_ID
  const email = env.JIRA_EMAIL
  const token = env.JIRA_API_TOKEN
  if (!cloud || !email || !token) throw new Error('Jira is not configured')
  const auth = Buffer.from(`${email}:${token}`).toString('base64')
  const issues = []
  let nextPageToken = undefined
  while (issues.length < 100) {
    const response = await fetch(`https://api.atlassian.com/ex/jira/${cloud}/rest/api/3/search/jql`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jql: 'labels in (Hosting, Maintenance) AND labels in (Tier-1, Tier-2) ORDER BY key',
        maxResults: 50,
        nextPageToken,
        fields: ['summary', 'status', 'assignee', 'labels', 'project', 'customfield_10033', 'customfield_10046', 'subtasks'],
      }),
    })
    if (!response.ok) throw new Error(`Jira request failed (${response.status})`)
    const body = await response.json()
    issues.push(...(body.issues || []))
    if (!body.nextPageToken || !(body.issues || []).length) break
    nextPageToken = body.nextPageToken
  }
  return issues
}

async function searchWorklogs(env, from, to, issueIds) {
  const token = env.TEMPO_API_TOKEN
  if (!token) throw new Error('Tempo is not configured')
  const logs = []
  const unique = [...new Set(issueIds.map((id) => Number(id)).filter((id) => id > 0))]
  for (let index = 0; index < unique.length; index += 40) {
    const chunk = unique.slice(index, index + 40)
    let offset = 0
    while (offset <= 20000) {
      const response = await fetch(`https://api.tempo.io/4/worklogs/search?limit=1000&offset=${offset}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ from, to, issueIds: chunk }),
      })
      if (!response.ok) throw new Error(`Tempo request failed (${response.status})`)
      const body = await response.json()
      const rows = body.results || []
      logs.push(...rows)
      if (rows.length < 1000) break
      offset += 1000
    }
  }
  return logs
}

function cleanClient(summary) {
  return summary.replace(new RegExp(`\\s+-\\s+Invoiced every?\\s+(?:${MONTHS.join('|')})\\s*$`, 'i'), '').trim()
}

function excluded(issue) {
  if (EXCLUDED_KEYS.has(issue.key)) return true
  const project = issue.fields?.project?.name || ''
  const summary = issue.fields?.summary || ''
  return /back bay/i.test(project + ' ' + summary) || /chandler/i.test(project + ' ' + summary)
}

function toRetainer(issue) {
  const labels = issue.fields?.labels || []
  const hosting = labels.includes('Hosting')
  const maintenance = labels.includes('Maintenance')
  const tier = labels.includes('Tier-2') ? 'Tier-2' : labels.includes('Tier-1') ? 'Tier-1' : null
  if (!tier || (!hosting && !maintenance)) return null
  const notes = plainText(issue.fields?.customfield_10046)
  const line = firstBillingLine(issue.fields?.customfield_10046)
  const month = notes.match(MONTH_PATTERN)
  const chartEvery = line.match(MONTH_PATTERN)
  const today = losAngelesToday()
  const fee = money(issue.fields?.customfield_10033)
  const subtasks = issue.fields?.subtasks || []
  return {
    key: issue.key,
    client: cleanClient(issue.fields?.summary || issue.key),
    project: issue.fields?.project?.name || '',
    service: hosting && maintenance ? 'Hosting + Maintenance' : hosting ? 'Hosting' : 'Maintenance',
    tier,
    annualFee: fee,
    status: issue.fields?.status?.name || '',
    assignee: issue.fields?.assignee?.displayName || 'Unassigned',
    chartMonth: chartEvery ? MONTHS.find((name) => name.toLowerCase() === chartEvery[1].toLowerCase()) : null,
    chartMonthly: !chartEvery && /^invoiced monthly\b/i.test(line.trim()),
    billing: month ? billingWindows(month[1], today) : null,
    issueIds: [issue.id, ...subtasks.map((task) => task.id)].filter(Boolean).map(String),
    updates: tier === 'Tier-1' ? null : updateCycles(subtasks, today),
  }
}

const UPDATE_HALVES = [
  { id: 'june', label: 'June', half: '1', month: 6, endDay: 30 },
  { id: 'november', label: 'November', half: '2', month: 11, endDay: 30 },
]

function updateCycles(subtasks, today) {
  const cycles = {}
  for (const half of UPDATE_HALVES) {
    const match = subtasks.map((task) => readUpdateTask(task, today.year, half.half)).find(Boolean) || null
    cycles[half.id] = classifyCycle(match, today, half)
  }
  return cycles
}

function readUpdateTask(task, year, half) {
  const summary = task.fields?.summary || ''
  const pattern = new RegExp(`semi[-\\s]?annual.*${year}.*\\(${half}/2\\)`, 'i')
  if (!pattern.test(summary)) return null
  const status = task.fields?.status || {}
  return {
    key: task.key,
    url: `https://brandastic.atlassian.net/browse/${task.key}`,
    summary,
    status: status.name || '',
    done: status.statusCategory?.key === 'done',
  }
}

function classifyCycle(task, today, half) {
  const start = iso(today.year, half.month, 1)
  const end = iso(today.year, half.month, half.endDay)
  const base = task
    ? { key: task.key, url: task.url, status: task.status, summary: task.summary }
    : { key: null, url: null, status: null, summary: null }
  if (task?.done) return { ...base, state: 'done' }
  if (today.iso > end) return { ...base, state: 'overdue' }
  if (task) return { ...base, state: 'scheduled' }
  if (daysUntil(today.iso, start) <= 30) return { ...base, state: 'needs' }
  return { ...base, state: 'upcoming' }
}

function activeUpdateCycle(today) {
  const june = UPDATE_HALVES[0]
  const november = UPDATE_HALVES[1]
  if (today.iso <= iso(today.year, june.month, june.endDay)) return june
  return november
}

function daysUntil(fromIso, toIso) {
  const [fromYear, fromMonth, fromDay] = fromIso.split('-').map(Number)
  const [toYear, toMonth, toDay] = toIso.split('-').map(Number)
  const from = Date.UTC(fromYear, fromMonth - 1, fromDay)
  const to = Date.UTC(toYear, toMonth - 1, toDay)
  return Math.round((to - from) / 86400000)
}

function billingWindows(monthName, today) {
  const month = MONTHS.findIndex((name) => name.toLowerCase() === monthName.toLowerCase()) + 1
  let startYear = today.year
  if (today.month < month) startYear -= 1
  const currentStart = iso(startYear, month, 1)
  const nextStart = iso(startYear + 1, month, 1)
  const previousStart = iso(startYear - 1, month, 1)
  return {
    month: MONTHS[month - 1],
    currentStart,
    currentEnd: dayBefore(nextStart),
    previousStart,
    previousEnd: dayBefore(currentStart),
  }
}

function losAngelesToday() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date())
  const value = (type) => Number(parts.find((part) => part.type === type)?.value)
  const year = value('year')
  const month = value('month')
  const day = value('day')
  return { year, month, day, iso: iso(year, month, day) }
}

function iso(year, month, day) {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function dayBefore(date) {
  const [year, month, day] = date.split('-').map(Number)
  const value = new Date(Date.UTC(year, month - 1, day))
  value.setUTCDate(value.getUTCDate() - 1)
  return value.toISOString().slice(0, 10)
}

function money(value) {
  if (value == null || value === '') return null
  const amount = Number(value)
  return Number.isFinite(amount) ? amount : null
}

function firstBillingLine(value) {
  if (value == null) return ''
  if (typeof value === 'string') return value.replace(/<[^>]+>/g, ' ').trim().split('\n')[0].trim()
  if (value.type === 'doc' && Array.isArray(value.content) && value.content.length) return plainText(value.content[0]).replace(/\s+/g, ' ').trim()
  return plainText(value).replace(/\s+/g, ' ').trim()
}

function plainText(value) {
  if (value == null) return ''
  if (typeof value === 'string') return value.replace(/<[^>]+>/g, ' ')
  if (typeof value === 'number') return String(value)
  if (Array.isArray(value)) return value.map(plainText).join(' ')
  if (typeof value === 'object') {
    return `${value.text || ''} ${value.content ? plainText(value.content) : ''}`.trim()
  }
  return ''
}

function round1(value) {
  return Math.round(value * 10) / 10
}
