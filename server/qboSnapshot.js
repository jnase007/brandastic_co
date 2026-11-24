import { loadBillingDataset, parseBillingDataset } from './billingData.js'
import { qboClientReady, qboSlot } from './qboConfig.js'
import { createSupabaseQboStore } from './qboStore.js'

function baseStatus(env) {
  return {
    source: 'missing',
    refreshed_at: null,
    status: qboClientReady(env) ? 'disconnected' : 'unconfigured',
    slot: qboSlot(env),
  }
}

export async function loadPreferredDataset(env, options = {}) {
  const slot = qboSlot(env)
  let qbo = baseStatus(env)
  const store = options.store || (qboClientReady(env) ? createSupabaseQboStore(env) : null)
  if (!store && qboClientReady(env)) qbo = { ...qbo, status: 'unconfigured' }

  if (store) {
    try {
      const row = await store.readSlot(slot)
      if (row?.status === 'expired') qbo = { ...qbo, status: 'expired' }
      else if (row?.token?.refreshToken) qbo = { ...qbo, status: 'connected' }
      if (row?.snapshot && typeof row.snapshot === 'object') {
        const parsed = parseBillingDataset(row.snapshot)
        return {
          dataset: { source: 'quickbooks', ...parsed },
          qbo: {
            ...qbo,
            source: 'quickbooks',
            refreshed_at: row.refreshedAt || parsed.updated_at || null,
            status: row.status === 'expired' ? 'expired' : 'connected',
          },
        }
      }
    } catch {
      qbo = { ...qbo, status: 'unavailable' }
    }
  }

  const dataset = loadBillingDataset(env)
  const source = dataset.source === 'env' ? 'manual' : dataset.source === 'sample' ? 'sample' : 'missing'
  return { dataset, qbo: { ...qbo, source } }
}
