import { describe, expect, it } from 'vitest'
import type { PlaylistResult } from '#shared/types'
import { SyncOutcome, syncOutcome } from '../app/utils/sync'

function result(error?: string): PlaylistResult {
  return { key: 'k', name: 'n', added: 0, removed: 0, unmatched: 0, created: false, error }
}

describe('syncOutcome', () => {
  it('succeeds when no playlist failed', () => {
    expect(syncOutcome([result(), result()])).toBe(SyncOutcome.Success)
  })

  it('is partial when some playlists failed', () => {
    expect(syncOutcome([result(), result('YouTube Music session expired')])).toBe(SyncOutcome.Partial)
  })

  it('fails when every playlist failed', () => {
    expect(syncOutcome([result('YouTube Music session expired')])).toBe(SyncOutcome.Failed)
  })

  it('succeeds when there was nothing to sync', () => {
    expect(syncOutcome([])).toBe(SyncOutcome.Success)
  })
})
