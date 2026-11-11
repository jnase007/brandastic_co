const CACHE_MS = 5 * 60 * 1000
const FIELDS = [
  'summary',
  'status',
  'assignee',
  'project',
  'customfield_10049',
  'customfield_10042',
  'customfield_10033',
  'customfield_10046',
  'customfield_10035',
]

let cache = { at: 0, data: null }

export async function loadWebsites(env) {
  if (cache.data && Date.now() - cache.at < CACHE_MS) return cache.data
  const data = await loadFresh(env)
  cache = { at: Date.now(), data }
  return data
}

async function loadFresh(env) {
  const epics = await searchJql(env, 'labels = website-build ORDER BY key', FIELDS)
  const epicKeys = epics.map((issue) => issue.key).filter(Boolean)
  const children = await searchParents(env, epicKeys)
  const childKeys = children.map((issue) => issue.key).filter(Boolean)
  const subtasks = await searchParents(env, childKeys)
  const issueEpic = new Map()
  const childEpic = new Map()
  for (const epic of epics) {
    if (epic.id) issueEpic.set(String(epic.id), epic.key)
  }
  for (const child of children) {
    const epicKey = child.fields?.parent?.key
    if (!epicKey || !child.id) continue
    issueEpic.set(String(child.id), epicKey)
    childEpic.set(child.key, epicKey)
  }
  for (const task of subtasks) {
    const parentKey = task.fields?.parent?.key
    const epicKey = parentKey ? childEpic.get(parentKey) : ''
    if (epicKey && task.id) issueEpic.set(String(task.id), epicKey)
  }

  const today = losAngelesDate()
  const logs = issueEpic.size ? await searchWorklogs(env, '2016-01-01', today, [...issueEpic.keys()]) : []
  const seen = new Set()
  const minutesByEpic = new Map()
  const minutesByPerson = new Map()
  const accountIds = []
  for (const log of logs) {
    const worklogId = log.tempoWorklogId
    if (worklogId != null && seen.has(worklogId)) continue
    if (worklogId != null) seen.add(worklogId)
    const issueId = log.issue?.id ? String(log.issue.id) : ''
    const epicKey = issueEpic.get(issueId)
    if (!epicKey) continue
    const minutes = (Number(log.timeSpentSeconds) || 0) / 60
    if (minutes <= 0) continue
    const accountId = log.author?.accountId || ''
    if (accountId) accountIds.push(accountId)
    minutesByEpic.set(epicKey, (minutesByEpic.get(epicKey) || 0) + minutes)
    const people = minutesByPerson.get(epicKey) || new Map()
    people.set(accountId || 'unassigned', (people.get(accountId || 'unassigned') || 0) + minutes)
    minutesByPerson.set(epicKey, people)
  }
  const names = await lookupUsers(env, [...issueEpic.keys()], accountIds)

  const builds = epics.map((issue) => {
    const merged = new Map()
    for (const [accountId, minutes] of minutesByPerson.get(issue.key) || new Map()) {
      const name = accountId === 'unassigned' ? 'Unassigned' : names.get(accountId) || 'Unassigned'
      merged.set(name, (merged.get(name) || 0) + minutes)
    }
    const people = [...merged.entries()]
      .map(([name, minutes]) => ({ name, minutes }))
      .sort((a, b) => b.minutes - a.minutes || a.name.localeCompare(b.name))
    const status = issue.fields?.status || {}
    return {
      key: issue.key,
      url: `https://brandastic.atlassian.net/browse/${issue.key}`,
      summary: issue.fields?.summary || issue.key,
      project: (issue.fields?.project?.name || '').trim(),
      status: status.name || '',
      done: status.statusCategory?.key === 'done',
      assignee: issue.fields?.assignee?.displayName || 'Unassigned',
      rate: numberField(issue.fields?.customfield_10049),
      contractedHours: hoursField(issue.fields?.customfield_10042),
      contractAmount: numberField(issue.fields?.customfield_10033),
      notes: cleanText(plainText(issue.fields?.customfield_10046)),
      deposit: cleanText(plainText(issue.fields?.customfield_10035)),
      loggedMinutes: minutesByEpic.get(issue.key) || 0,
      people,
    }
  })

  return { generatedAt: new Date().toISOString(), builds }
}

async function searchParents(env, keys) {
  const issues = []
  for (let index = 0; index < keys.length; index += 30) {
    const chunk = keys.slice(index, index + 30)
    if (!chunk.length) continue
    const jql = `parent in (${chunk.join(', ')}) ORDER BY key`
    issues.push(...(await searchJql(env, jql, ['parent'])))
  }
  return issues
}

async function searchJql(env, jql, fields) {
  const cloud = env.JIRA_CLOUD_ID
  const email = env.JIRA_EMAIL
  const token = env.JIRA_API_TOKEN
  if (!cloud || !email || !token) throw new Error('Jira is not configured')
  const auth = Buffer.from(`${email}:${token}`).toString('base64')
  const issues = []
  let nextPageToken
  while (issues.length < 1000) {
    const response = await fetch(`https://api.atlassian.com/ex/jira/${cloud}/rest/api/3/search/jql`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ jql, maxResults: 50, nextPageToken, fields }),
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

async function lookupUsers(env, issueIds, accountIds) {
  const names = await tempoMemberNames(env)
  const needed = new Set(accountIds.filter((id) => id && !names.has(id)))
  if (!needed.size) return names
  const cloud = env.JIRA_CLOUD_ID
  const email = env.JIRA_EMAIL
  const token = env.JIRA_API_TOKEN
  if (!cloud || !email || !token) return names
  const auth = Buffer.from(`${email}:${token}`).toString('base64')
  const ids = [...new Set(issueIds)]
  for (let index = 0; index < ids.length && needed.size; index += 6) {
    await Promise.all(ids.slice(index, index + 6).map(async (issueId) => {
      let startAt = 0
      while (needed.size && startAt < 1000) {
        const response = await fetch(`https://api.atlassian.com/ex/jira/${cloud}/rest/api/3/issue/${issueId}/worklog?startAt=${startAt}&maxResults=100`, {
          headers: { Authorization: `Basic ${auth}`, Accept: 'application/json' },
        })
        if (!response.ok) return
        const body = await response.json()
        const logs = body.worklogs || []
        for (const log of logs) {
          const accountId = log.author?.accountId
          const displayName = log.author?.displayName || ''
          if (!accountId || !displayName || /tempo/i.test(displayName)) continue
          if (!names.has(accountId)) names.set(accountId, displayName)
          needed.delete(accountId)
        }
        startAt += logs.length
        if (!logs.length || startAt >= (body.total || 0)) return
      }
    }))
  }
  return names
}

async function tempoMemberNames(env) {
  const names = new Map()
  const token = env.TEMPO_API_TOKEN
  if (!token) return names
  const teams = await tempoList(token, '/4/teams')
  const team = teams.find((item) => item.status === 'ACTIVE' && /employee/i.test(item.name) && /dashboard/i.test(item.name))
    || teams.find((item) => item.status === 'ACTIVE' && /employee/i.test(item.name))
  if (!team) return names
  const members = await tempoList(token, `/4/teams/${team.id}/members`)
  for (const row of members) {
    const accountId = row.member?.accountId || ''
    const name = row.memberships?.active?.role?.name || ''
    if (accountId && name) names.set(accountId, name)
  }
  return names
}

async function tempoList(token, path) {
  const items = []
  let offset = 0
  while (offset <= 5000) {
    const separator = path.includes('?') ? '&' : '?'
    const response = await fetch(`https://api.tempo.io${path}${separator}offset=${offset}&limit=1000`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    })
    if (!response.ok) throw new Error(`Tempo request failed (${response.status})`)
    const body = await response.json()
    const rows = body.results || []
    items.push(...rows)
    if (rows.length < 1000) break
    offset += 1000
  }
  return items
}

function numberField(value) {
  if (value == null || value === '') return null
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value === 'string') {
    const amount = Number(value.replace(/[$,]/g, '').trim())
    return Number.isFinite(amount) ? amount : null
  }
  if (typeof value === 'object' && value.value != null) return numberField(value.value)
  return null
}

function hoursField(value) {
  const text = plainText(value).replace(/,/g, ' ')
  if (!text.trim()) return null
  if (!/-?\d/.test(text)) return null
  const match = text.match(/-?\d+(?:\.\d+)?/)
  if (!match) return null
  const hours = Number(match[0])
  return Number.isFinite(hours) ? hours : null
}

function plainText(value) {
  if (value == null) return ''
  if (typeof value === 'string') return value.replace(/<[^>]+>/g, ' ')
  if (typeof value === 'number') return String(value)
  if (Array.isArray(value)) return value.map(plainText).join(' ')
  if (typeof value === 'object') return `${value.text || ''} ${value.content ? plainText(value.content) : ''}`.trim()
  return ''
}

function cleanText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim()
}

function losAngelesDate() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles' }).format(new Date())
}
