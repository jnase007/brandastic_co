import { Buffer } from 'node:buffer'
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'

const VERSION = 'v1'

export function encryptionKey(env) {
  const raw = String(env?.QBO_TOKEN_ENCRYPTION_KEY || '').trim()
  if (!raw) return null
  const key = Buffer.from(raw, 'base64')
  if (key.length !== 32) return null
  return key
}

export function emailHash(email) {
  return createHash('sha256').update(String(email || '').trim().toLowerCase()).digest('hex')
}

export function seal(plaintext, key, aad) {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  cipher.setAAD(Buffer.from(String(aad)))
  const ciphertext = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return [VERSION, iv.toString('base64url'), tag.toString('base64url'), ciphertext.toString('base64url')].join('.')
}

export function open(sealed, key, aad) {
  const parts = String(sealed || '').split('.')
  if (parts.length !== 4 || parts[0] !== VERSION) {
    const error = new Error('unreadable')
    error.code = 'unreadable'
    throw error
  }
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(parts[1], 'base64url'))
  decipher.setAAD(Buffer.from(String(aad)))
  decipher.setAuthTag(Buffer.from(parts[2], 'base64url'))
  const plain = Buffer.concat([decipher.update(Buffer.from(parts[3], 'base64url')), decipher.final()])
  return plain.toString('utf8')
}
