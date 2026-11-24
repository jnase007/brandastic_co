import { createClient } from '@supabase/supabase-js'
import { encryptionKey, open, seal } from './qboCrypto.js'

export function createMemoryQboStore() {
  const slots = new Map()
  const states = new Map()
  return {
    async readSlot(slot) {
      return slots.get(slot) || null
    },
    async writeSlot(slot, row) {
      const current = slots.get(slot) || {}
      slots.set(slot, {
        token: row.token === undefined ? current.token || null : row.token,
        snapshot: row.snapshot === undefined ? current.snapshot || null : row.snapshot,
        refreshedAt: row.refreshedAt === undefined ? current.refreshedAt || null : row.refreshedAt,
        connectedAt: row.connectedAt === undefined ? current.connectedAt || null : row.connectedAt,
        status: row.status || current.status || 'disconnected',
      })
    },
    async putState(row) {
      states.set(row.state, row)
    },
    async takeState(state) {
      const row = states.get(state) || null
      states.delete(state)
      if (!row) return null
      if (Date.parse(row.expiresAt) <= Date.now()) return null
      return row
    },
  }
}

function supabaseClient(env) {
  const url = env.SUPABASE_URL || env.VITE_SUPABASE_URL
  const key = String(env.SUPABASE_SERVICE_ROLE_KEY || '').trim()
  const secret = encryptionKey(env)
  if (!url || !key || !secret) return null
  return {
    secret,
    client: createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    }),
  }
}

function sealToken(secret, slot, token) {
  if (!token?.refreshToken || !token?.realmId) return null
  return seal(JSON.stringify({ realmId: token.realmId, refreshToken: token.refreshToken }), secret, `${slot}:token`)
}

function sealSnapshot(secret, slot, snapshot) {
  if (!snapshot) return null
  return seal(JSON.stringify(snapshot), secret, `${slot}:snapshot`)
}

function readToken(secret, slot, ciphertext) {
  if (!ciphertext) return null
  const parsed = JSON.parse(open(ciphertext, secret, `${slot}:token`))
  if (!parsed?.refreshToken || !parsed?.realmId) return null
  return { realmId: String(parsed.realmId), refreshToken: String(parsed.refreshToken) }
}

function readSnapshot(secret, slot, ciphertext) {
  if (!ciphertext) return null
  const parsed = JSON.parse(open(ciphertext, secret, `${slot}:snapshot`))
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null
  return parsed
}

export function createSupabaseQboStore(env) {
  const ready = supabaseClient(env)
  if (!ready) return null
  const { client, secret } = ready

  return {
    async readSlot(slot) {
      const { data, error } = await client
        .from('qbo_billing_store')
        .select('token_ciphertext, snapshot_ciphertext, refreshed_at, connected_at, status')
        .eq('slot', slot)
        .maybeSingle()
      if (error) {
        const failure = new Error('unavailable')
        failure.code = 'unavailable'
        throw failure
      }
      if (!data) return null
      let token = null
      let snapshot = null
      try {
        token = readToken(secret, slot, data.token_ciphertext)
      } catch {
        token = null
      }
      try {
        snapshot = readSnapshot(secret, slot, data.snapshot_ciphertext)
      } catch {
        snapshot = null
      }
      return {
        token,
        snapshot,
        refreshedAt: data.refreshed_at || null,
        connectedAt: data.connected_at || null,
        status: token ? (data.status === 'expired' ? 'expired' : 'connected') : (data.status || 'disconnected'),
      }
    },
    async writeSlot(slot, row) {
      const current = await this.readSlot(slot).catch(() => null)
      const token = row.token === undefined ? current?.token || null : row.token
      const snapshot = row.snapshot === undefined ? current?.snapshot || null : row.snapshot
      const { error } = await client.from('qbo_billing_store').upsert({
        slot,
        token_ciphertext: sealToken(secret, slot, token),
        snapshot_ciphertext: sealSnapshot(secret, slot, snapshot),
        refreshed_at: row.refreshedAt === undefined ? current?.refreshedAt || null : row.refreshedAt,
        connected_at: row.connectedAt === undefined ? current?.connectedAt || null : row.connectedAt,
        status: row.status || 'disconnected',
        updated_at: new Date().toISOString(),
      }, { onConflict: 'slot' })
      if (error) {
        const failure = new Error('unavailable')
        failure.code = 'unavailable'
        throw failure
      }
    },
    async putState(row) {
      await client.from('qbo_oauth_state').delete().lt('expires_at', new Date().toISOString())
      const { error } = await client.from('qbo_oauth_state').insert({
        state: row.state,
        slot: row.slot,
        email_hash: row.emailHash,
        expires_at: row.expiresAt,
      })
      if (error) {
        const failure = new Error('unavailable')
        failure.code = 'unavailable'
        throw failure
      }
    },
    async takeState(state) {
      const { data, error } = await client
        .from('qbo_oauth_state')
        .select('state, slot, email_hash, expires_at')
        .eq('state', state)
        .maybeSingle()
      if (error || !data) return null
      await client.from('qbo_oauth_state').delete().eq('state', state)
      if (Date.parse(data.expires_at) <= Date.now()) return null
      return {
        state: data.state,
        slot: data.slot,
        emailHash: data.email_hash,
        expiresAt: data.expires_at,
      }
    },
  }
}
