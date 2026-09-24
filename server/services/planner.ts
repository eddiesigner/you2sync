import { SyncMode } from '#shared/types'

/*
 * Pure set arithmetic behind a sync plan.
 *
 *   Changes mode                      Mirror mode
 *   ------------                      -----------
 *   resolve = now - snapshot          resolve = now (every source track)
 *   removed = snapshot - now          remove  = target - matched(source)
 *
 * With no snapshot (first sync) Changes resolves everything and removes
 * nothing, so an existing target playlist is never trimmed by surprise.
 */

export interface SourceDiff {
  // Source ids that must be present on the target.
  toResolve: string[]
  // Source ids removed since the last sync (Changes mode only).
  removed: string[]
}

export function diffSource(mode: SyncMode, current: string[], snapshot?: Set<string>): SourceDiff {
  if (mode === SyncMode.Mirror || !snapshot) {
    return { toResolve: [...new Set(current)], removed: [] }
  }

  const currentSet = new Set(current)
  return {
    toResolve: [...currentSet].filter(id => !snapshot.has(id)),
    removed: [...snapshot].filter(id => !currentSet.has(id)),
  }
}

// Target tracks with no counterpart among the source's tracks.
export function mirrorRemovals(targetIds: string[], keep: Set<string>): string[] {
  return [...new Set(targetIds)].filter(id => !keep.has(id))
}

// Next baseline for the target: keep its unsynced changes, apply ours.
export function nextTargetSnapshot(previous: Set<string>, added: string[], removed: string[]): Set<string> {
  const next = new Set(previous)
  for (const id of added) {
    next.add(id)
  }
  for (const id of removed) {
    next.delete(id)
  }
  return next
}
