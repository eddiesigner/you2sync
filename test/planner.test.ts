import { describe, expect, it } from 'vitest'
import { SyncMode } from '#shared/types'
import { diffSource, mirrorRemovals, nextTargetSnapshot } from '../server/services/planner'

describe('diffSource', () => {
  it('resolves everything and removes nothing on the first sync', () => {
    expect(diffSource(SyncMode.Changes, ['a', 'b'])).toEqual({ toResolve: ['a', 'b'], removed: [] })
  })

  it('detects additions and removals since the snapshot', () => {
    const diff = diffSource(SyncMode.Changes, ['a', 'c'], new Set(['a', 'b']))
    expect(diff).toEqual({ toResolve: ['c'], removed: ['b'] })
  })

  it('resolves every track in mirror mode', () => {
    expect(diffSource(SyncMode.Mirror, ['a', 'a', 'c'], new Set(['a']))).toEqual({ toResolve: ['a', 'c'], removed: [] })
  })
})

describe('mirrorRemovals', () => {
  it('returns target ids without a source counterpart', () => {
    expect(mirrorRemovals(['x', 'y', 'z'], new Set(['y']))).toEqual(['x', 'z'])
  })
})

describe('nextTargetSnapshot', () => {
  it('keeps unsynced target history and applies our changes', () => {
    const next = nextTargetSnapshot(new Set(['old', 'gone']), ['new'], ['gone'])
    expect([...next].sort()).toEqual(['new', 'old'])
  })
})
