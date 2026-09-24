import type { Track } from '#shared/types'

// Scores at or above this are applied automatically; below goes to review.
export const MATCH_THRESHOLD = 0.75

const WEIGHT_TITLE = 0.5
const WEIGHT_ARTIST = 0.3
const WEIGHT_DURATION = 0.2
const VERSION_MISMATCH_PENALTY = 0.2
const UNKNOWN_DURATION_SCORE = 0.6

// Duration difference (seconds) -> score. Checked in order.
const DURATION_STEPS: [number, number][] = [
  [2, 1],
  [5, 0.8],
  [10, 0.5],
  [20, 0.2],
]

// Bracketed or dashed suffixes that describe the upload, not the song.
const NOISE = /\b(official|video|audio|lyrics?|lyric video|visualizer|explicit|clean|hd|hq|4k|mv|remaster(ed)?(\s+\d{4})?|\d{4}\s+remaster(ed)?|mono|stereo|feat\.?|ft\.?|featuring|with)\b/g

// Words that mean a genuinely different recording.
const VERSION_WORDS = ['live', 'remix', 'acoustic', 'instrumental', 'karaoke', 'cover', 'demo', 'sped up', 'slowed', 'edit']

export function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/&/g, ' and ')
    // "(feat. X)" and "[Official Video]" style groups carry no title words.
    .replace(/[([](?:feat|ft|featuring|with|official|lyric|audio|video|remaster)[^)\]]*[)\]]/g, ' ')
    .replace(NOISE, ' ')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function bigrams(text: string): Map<string, number> {
  const grams = new Map<string, number>()
  const compact = text.replace(/\s/g, '')
  for (let i = 0; i < compact.length - 1; i++) {
    const gram = compact.slice(i, i + 2)
    grams.set(gram, (grams.get(gram) ?? 0) + 1)
  }
  return grams
}

// Sørensen–Dice coefficient over character bigrams, 0..1.
export function similarity(a: string, b: string): number {
  if (!a || !b) {
    return 0
  }
  if (a === b) {
    return 1
  }

  const gramsA = bigrams(a)
  const gramsB = bigrams(b)
  let overlap = 0
  let total = 0

  for (const count of gramsA.values()) {
    total += count
  }
  for (const [gram, count] of gramsB) {
    total += count
    overlap += Math.min(count, gramsA.get(gram) ?? 0)
  }

  return total ? (2 * overlap) / total : 0
}

function versionTags(text: string): Set<string> {
  const lower = text.toLowerCase()
  return new Set(VERSION_WORDS.filter(word => new RegExp(`\\b${word}\\b`).test(lower)))
}

function durationScore(a?: number, b?: number): number {
  if (!a || !b) {
    return UNKNOWN_DURATION_SCORE
  }
  const diffSeconds = Math.abs(a - b) / 1000
  for (const [limit, score] of DURATION_STEPS) {
    if (diffSeconds <= limit) {
      return score
    }
  }
  return 0
}

function artistScore(source: Track, candidate: Track): number {
  const sourceArtists = source.artists.map(normalize).filter(Boolean)
  const candidateArtists = candidate.artists.map(normalize).filter(Boolean)
  if (!sourceArtists.length || !candidateArtists.length) {
    // Video uploads often put the artist in the title instead.
    const title = normalize(candidate.title)
    return sourceArtists.some(artist => title.includes(artist)) ? 1 : 0.3
  }

  let best = 0
  for (const a of sourceArtists) {
    for (const b of candidateArtists) {
      best = Math.max(best, similarity(a, b), a.includes(b) || b.includes(a) ? 0.9 : 0)
    }
  }
  return best
}

export function scoreMatch(source: Track, candidate: Track): number {
  const title = similarity(normalize(source.title), normalize(candidate.title))
  const artist = artistScore(source, candidate)
  const duration = durationScore(source.durationMs, candidate.durationMs)
  let score = WEIGHT_TITLE * title + WEIGHT_ARTIST * artist + WEIGHT_DURATION * duration

  const sourceTags = versionTags(source.title)
  const candidateTags = versionTags(candidate.title)
  const sameVersion = sourceTags.size === candidateTags.size && [...sourceTags].every(tag => candidateTags.has(tag))
  if (!sameVersion) {
    score -= VERSION_MISMATCH_PENALTY
  }

  return Math.max(0, Math.min(1, score))
}

export function bestMatch(source: Track, candidates: Track[]): { track: Track, score: number } | undefined {
  let best: { track: Track, score: number } | undefined
  for (const candidate of candidates) {
    const score = scoreMatch(source, candidate)
    if (!best || score > best.score) {
      best = { track: candidate, score }
    }
  }
  return best
}
