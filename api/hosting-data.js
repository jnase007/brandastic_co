import { assertTeam, loadHostingPortfolio } from '../server/hostingData.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).end()
    return
  }
  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '')
  const gate = await assertTeam(process.env, token)
  if (!gate.ok) {
    res.status(gate.status).json({ error: gate.error })
    return
  }
  try {
    const body = await loadHostingPortfolio(process.env, token)
    res.status(200).json(body)
  } catch (error) {
    res.status(500).json({ error: error.message || 'Could not load hosting' })
  }
}
