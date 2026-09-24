import { Service } from '#shared/types'
import { useDb } from '../db'

export enum MatchOrigin {
  Auto = 0,
  Manual = 1,
}

interface MatchRow {
  spotify_id: string
  ytmusic_id: string
  score: number
  manual: number
}

// Returns the counterpart id on the other service, preferring manual picks.
export function findMatch(source: Service, trackId: string): { id: string, score: number } | undefined {
  const [from, to] = source === Service.Spotify ? ['spotify_id', 'ytmusic_id'] as const : ['ytmusic_id', 'spotify_id'] as const
  const row = useDb().prepare(`SELECT * FROM matches WHERE ${from} = ? ORDER BY manual DESC, score DESC LIMIT 1`).get(trackId) as MatchRow | undefined
  return row ? { id: row[to], score: row.score } : undefined
}

export function saveMatch(spotifyId: string, ytmusicId: string, score: number, origin: MatchOrigin) {
  useDb().prepare(`
    INSERT INTO matches (spotify_id, ytmusic_id, score, manual) VALUES (?, ?, ?, ?)
    ON CONFLICT (spotify_id, ytmusic_id) DO UPDATE SET score = MAX(score, excluded.score), manual = MAX(manual, excluded.manual)
  `).run(spotifyId, ytmusicId, score, origin)
}
