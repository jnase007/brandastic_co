import { writeFeaturePriority } from '../server/featurePriority.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).end()
    return
  }
  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {})
  const result = await writeFeaturePriority(process.env, body)
  res.status(result.status).json(result.body)
}
