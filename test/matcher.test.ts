import { describe, expect, it } from 'vitest'
import type { Track } from '#shared/types'
import { MATCH_THRESHOLD, bestMatch, normalize, scoreMatch, similarity } from '../server/services/matcher'

const track = (overrides: Partial<Track>): Track => ({ id: 'x', title: '', artists: [], ...overrides })

describe('normalize', () => {
  it('strips featuring credits, remaster tags and punctuation', () => {
    expect(normalize('Blinding Lights (feat. Someone) - 2020 Remaster')).toBe('blinding lights')
    expect(normalize('Café Tacvba & Friends')).toBe('cafe tacvba and friends')
    expect(normalize('Song [Official Video]')).toBe('song')
  })
})

describe('similarity', () => {
  it('is 1 for equal strings and 0 for disjoint ones', () => {
    expect(similarity('hello', 'hello')).toBe(1)
    expect(similarity('abc', 'xyz')).toBe(0)
  })
})

describe('scoreMatch', () => {
  const spotify = track({ title: 'Bohemian Rhapsody - Remastered 2011', artists: ['Queen'], durationMs: 354_000 })

  it('accepts the same song across services', () => {
    const yt = track({ title: 'Bohemian Rhapsody', artists: ['Queen'], durationMs: 355_000 })
    expect(scoreMatch(spotify, yt)).toBeGreaterThanOrEqual(MATCH_THRESHOLD)
  })

  it('accepts a music video with the artist in the title', () => {
    const video = track({ title: 'Queen – Bohemian Rhapsody (Official Video)', artists: [], durationMs: 360_000 })
    expect(scoreMatch(spotify, { ...video, title: 'Bohemian Rhapsody (Official Video)', artists: ['Queen'] })).toBeGreaterThanOrEqual(MATCH_THRESHOLD)
  })

  it('rejects a live version of a studio track', () => {
    const live = track({ title: 'Bohemian Rhapsody (Live)', artists: ['Queen'], durationMs: 354_000 })
    expect(scoreMatch(spotify, live)).toBeLessThan(MATCH_THRESHOLD)
  })

  it('rejects a different artist', () => {
    const cover = track({ title: 'Bohemian Rhapsody', artists: ['Panic! At The Disco'], durationMs: 370_000 })
    expect(scoreMatch(spotify, cover)).toBeLessThan(MATCH_THRESHOLD)
  })
})

describe('bestMatch', () => {
  it('picks the highest scoring candidate', () => {
    const source = track({ title: 'Yellow', artists: ['Coldplay'], durationMs: 266_000 })
    const result = bestMatch(source, [
      track({ id: 'a', title: 'Yellow Submarine', artists: ['The Beatles'], durationMs: 160_000 }),
      track({ id: 'b', title: 'Yellow', artists: ['Coldplay'], durationMs: 267_000 }),
    ])
    expect(result?.track.id).toBe('b')
  })

  it('returns undefined with no candidates', () => {
    expect(bestMatch(track({ title: 'x' }), [])).toBeUndefined()
  })
})
