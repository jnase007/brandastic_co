const ENGINE_ORDER = ['ChatGPT', 'Google AI Overviews', 'Google AI Mode', 'Gemini', 'Perplexity', 'Claude']

function engineOrder(name) {
  const index = ENGINE_ORDER.indexOf(name)
  return index === -1 ? ENGINE_ORDER.length : index
}

export function promptMentioned(card) {
  return (card?.engines || []).some((engine) => engine.appears === true)
}

export function groupAiPrompts(rows) {
  const cards = new Map()
  for (const row of rows || []) {
    const prompt = String(row?.prompt || '').trim()
    if (!prompt) continue
    const key = prompt.toLowerCase()
    if (!cards.has(key)) {
      cards.set(key, {
        id: key,
        prompt,
        topic: row.topic || 'Other',
        paused: row.paused === true,
        engines: [],
        citedUrls: [],
        competitors: [],
      })
    }
    const card = cards.get(key)
    if (row.paused === true) card.paused = true
    if (row.topic) card.topic = row.topic
    if (row.engine) {
      card.engines.push({
        engine: row.engine,
        appears: row.appears,
        rank: row.rank,
        answerStatus: row.answerStatus || (row.appears == null ? 'not_checked' : 'answered'),
      })
    }
    if (row.citedUrl && !card.citedUrls.includes(row.citedUrl)) card.citedUrls.push(row.citedUrl)
    for (const name of row.competitors || []) {
      if (name && !card.competitors.includes(name)) card.competitors.push(name)
    }
  }
  return [...cards.values()].map((card) => ({
    ...card,
    engines: card.engines.slice().sort((a, b) => engineOrder(a.engine) - engineOrder(b.engine) || a.engine.localeCompare(b.engine)),
  })).sort((a, b) => Number(promptMentioned(b)) - Number(promptMentioned(a)) || a.prompt.localeCompare(b.prompt))
}

export function engineAppearances(cards) {
  const counts = new Map()
  for (const card of cards || []) {
    for (const engine of card.engines || []) {
      if (engine.appears !== true) continue
      counts.set(engine.engine, (counts.get(engine.engine) || 0) + 1)
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || engineOrder(a[0]) - engineOrder(b[0]))
    .map(([label, value]) => ({ label, value }))
}
