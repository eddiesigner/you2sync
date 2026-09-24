import { randomBytes } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { decrypt, encrypt, parseKey } from '../server/lib/crypto'

describe('crypto', () => {
  const key = randomBytes(32)

  it('round-trips data', () => {
    expect(decrypt(encrypt('secret', key), key)).toBe('secret')
  })

  it('rejects tampered payloads', () => {
    const payload = encrypt('secret', key)
    const tampered = `${payload.slice(0, -2)}AA`
    expect(() => decrypt(tampered, key)).toThrow()
  })

  it('rejects keys of the wrong size', () => {
    expect(() => parseKey('abcd')).toThrow()
    expect(parseKey(key.toString('hex'))).toEqual(key)
  })
})
