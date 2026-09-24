import type { ReviewItem } from '#shared/types'

// Fetched on demand: the list is only reachable once both services are linked.
export function useReviews() {
  return useAsyncData('reviews', () => api<ReviewItem[]>('/api/reviews'), {
    server: false,
    immediate: false,
    default: () => [] as ReviewItem[],
  })
}
