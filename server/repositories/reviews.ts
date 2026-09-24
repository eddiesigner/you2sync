import { type ReviewItem, ReviewStatus, type Service, type Track } from '#shared/types'
import { useDb } from '../db'

interface ReviewRow {
  id: number
  source: Service
  source_playlist_id: string
  target_playlist_id: string
  playlist_name: string
  track_id: string
  track: string
  best_guess: string | null
  status: ReviewStatus
  created_at: number
}

export interface NewReview {
  source: Service
  sourcePlaylistId: string
  targetPlaylistId: string
  playlistName: string
  track: Track
  bestGuess?: Track
}

function toItem(row: ReviewRow): ReviewItem {
  return {
    id: row.id,
    source: row.source,
    sourcePlaylistId: row.source_playlist_id,
    targetPlaylistId: row.target_playlist_id,
    playlistName: row.playlist_name,
    track: JSON.parse(row.track),
    bestGuess: row.best_guess ? JSON.parse(row.best_guess) : undefined,
    createdAt: row.created_at,
  }
}

// Dismissed items stay dismissed; open ones get refreshed details.
export function upsertReview(review: NewReview) {
  useDb().prepare(`
    INSERT INTO reviews (source, source_playlist_id, target_playlist_id, playlist_name, track_id, track, best_guess, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT (source, target_playlist_id, track_id) DO UPDATE SET
      playlist_name = excluded.playlist_name,
      best_guess = excluded.best_guess,
      status = CASE WHEN reviews.status = '${ReviewStatus.Dismissed}' THEN reviews.status ELSE '${ReviewStatus.Open}' END
  `).run(
    review.source,
    review.sourcePlaylistId,
    review.targetPlaylistId,
    review.playlistName,
    review.track.id,
    JSON.stringify(review.track),
    review.bestGuess ? JSON.stringify(review.bestGuess) : null,
    ReviewStatus.Open,
    Date.now(),
  )
}

export function isDismissed(source: Service, targetPlaylistId: string, trackId: string): boolean {
  const row = useDb().prepare('SELECT status FROM reviews WHERE source = ? AND target_playlist_id = ? AND track_id = ?').get(source, targetPlaylistId, trackId) as { status: ReviewStatus } | undefined
  return row?.status === ReviewStatus.Dismissed
}

export function listOpenReviews(): ReviewItem[] {
  const rows = useDb().prepare('SELECT * FROM reviews WHERE status = ? ORDER BY created_at DESC').all(ReviewStatus.Open) as unknown as ReviewRow[]
  return rows.map(toItem)
}

export function findReview(id: number): ReviewItem | undefined {
  const row = useDb().prepare('SELECT * FROM reviews WHERE id = ?').get(id) as ReviewRow | undefined
  return row ? toItem(row) : undefined
}

export function setReviewStatus(id: number, status: ReviewStatus) {
  useDb().prepare('UPDATE reviews SET status = ? WHERE id = ?').run(status, id)
}

export function resolveReviewsFor(source: Service, targetPlaylistId: string, trackIds: string[]) {
  const statement = useDb().prepare('UPDATE reviews SET status = ? WHERE source = ? AND target_playlist_id = ? AND track_id = ? AND status = ?')
  for (const trackId of trackIds) {
    statement.run(ReviewStatus.Resolved, source, targetPlaylistId, trackId, ReviewStatus.Open)
  }
}
