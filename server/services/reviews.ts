import { type MatchedTrack, type ReviewItem, ReviewStatus, otherService } from '#shared/types'
import { addToSnapshot, findLinkBy } from '../repositories/links'
import { MatchOrigin } from '../repositories/matches'
import { findReview, listOpenReviews, setReviewStatus } from '../repositories/reviews'
import { getProvider } from './accounts'
import { scoreMatch } from './matcher'
import { rememberMatch } from './sync'

function requireReview(id: number): ReviewItem {
  const review = findReview(id)
  if (!review) {
    throw createError({ statusCode: 404, statusMessage: 'Review item not found' })
  }
  return review
}

export function listReviews(): ReviewItem[] {
  return listOpenReviews()
}

// Candidates on the target service, best first. `query` overrides the
// default "title artist" search text.
export async function findCandidates(id: number, query?: string): Promise<MatchedTrack[]> {
  const review = requireReview(id)
  const target = getProvider(otherService(review.source))
  const results = query
    ? await target.search({ title: query, artists: [] })
    : await target.search({ title: review.track.title, artists: review.track.artists, album: review.track.album })

  return results
    .map(candidate => ({ source: review.track, target: candidate, score: scoreMatch(review.track, candidate) }))
    .sort((a, b) => b.score - a.score)
}

export async function resolveReview(id: number, targetTrackId: string) {
  const review = requireReview(id)
  const targetService = otherService(review.source)

  await getProvider(targetService).addTracks(review.targetPlaylistId, [targetTrackId])
  rememberMatch(review.source, review.track.id, targetTrackId, 1, MatchOrigin.Manual)
  setReviewStatus(id, ReviewStatus.Resolved)

  // Record the addition so the next sync back does not treat it as new.
  const link = findLinkBy(targetService, review.targetPlaylistId)
  if (link) {
    addToSnapshot(link.id, targetService, [targetTrackId])
  }
}

export function dismissReview(id: number) {
  requireReview(id)
  setReviewStatus(id, ReviewStatus.Dismissed)
}
