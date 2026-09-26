import type { PlaylistResult } from '#shared/types'

export enum SyncOutcome {
  Success = 'success',
  Partial = 'partial',
  Failed = 'failed',
}

// How a finished sync went, judged by its per-playlist results.
export function syncOutcome(results: PlaylistResult[]): SyncOutcome {
  const failed = results.filter(result => result.error).length
  if (!failed) {
    return SyncOutcome.Success
  }
  return failed === results.length ? SyncOutcome.Failed : SyncOutcome.Partial
}
