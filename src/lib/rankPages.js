export function rankMeaning(position) {
  if (position == null || position < 1 || position > 40) return 'Not in top 4 pages'
  if (position <= 3) return 'Page 1, top 3'
  if (position <= 10) return 'Page 1'
  if (position <= 20) return 'Page 2'
  if (position <= 30) return 'Page 3'
  return 'Page 4'
}

export function rankSummary(rows) {
  const counts = { top3: 0, page1: 0, page2: 0, later: 0, missing: 0 }
  for (const row of rows || []) {
    const position = row?.position
    if (position == null || position < 1 || position > 40) counts.missing += 1
    else if (position <= 3) counts.top3 += 1
    else if (position <= 10) counts.page1 += 1
    else if (position <= 20) counts.page2 += 1
    else counts.later += 1
  }
  return [
    { id: 'top3', label: 'Page 1, top 3', detail: '#1–3', count: counts.top3 },
    { id: 'page1', label: 'Page 1', detail: '#4–10', count: counts.page1 },
    { id: 'page2', label: 'Page 2', detail: '#11–20', count: counts.page2 },
    { id: 'later', label: 'Pages 3-4', detail: '#21–40', count: counts.later },
    { id: 'missing', label: 'Not ranking', detail: 'Not in top 4 pages', count: counts.missing },
  ]
}
