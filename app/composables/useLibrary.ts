import type { LibraryResponse } from '#shared/types'

// Cached across pages; call refresh() after a sync to pick up new links.
export function useLibrary() {
  return useAsyncData('library', () => api<LibraryResponse>('/api/library'), {
    server: false,
    dedupe: 'defer',
  })
}
