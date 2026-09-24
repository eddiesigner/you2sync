import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

const ALGORITHM = 'aes-256-gcm'
const KEY_BYTES = 32
const IV_BYTES = 12
const VERSION = 'v1'

// Accepts a 32-byte key encoded as hex (64 chars) or base64.
export function parseKey(raw: string): Buffer {
  const key = /^[0-9a-f]{64}$/i.test(raw) ? Buffer.from(raw, 'hex') : Buffer.from(raw, 'base64')
  if (key.length !== KEY_BYTES) {
    throw new Error('NUXT_ENCRYPTION_KEY must be 32 bytes (64 hex chars or base64). Generate one with: openssl rand -hex 32')
  }
  return key
}

// Output format: "v1.<iv>.<tag>.<ciphertext>", all base64url.
export function encrypt(plaintext: string, key: Buffer): string {
  const iv = randomBytes(IV_BYTES)
  const cipher = createCipheriv(ALGORITHM, key, iv)
  const data = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return [VERSION, iv, tag, data].map(part => typeof part === 'string' ? part : part.toString('base64url')).join('.')
}

export function decrypt(payload: string, key: Buffer): string {
  const [version, iv, tag, data] = payload.split('.')
  if (version !== VERSION || !iv || !tag || !data) {
    throw new Error('Unsupported encrypted payload')
  }

  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(iv, 'base64url'))
  decipher.setAuthTag(Buffer.from(tag, 'base64url'))
  return Buffer.concat([decipher.update(Buffer.from(data, 'base64url')), decipher.final()]).toString('utf8')
}
