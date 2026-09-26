import { Service } from '#shared/types'

// Query that opens the cookie dialog on the settings page.
export const UPDATE_COOKIE_QUERY = { update: 'cookie' }

export interface ReconnectTarget {
  label: string
  to: string
  // Spotify renews through its OAuth flow, outside the SPA router.
  external: boolean
}

// Where the user renews an expired session of each service.
export const RECONNECT: Record<Service, ReconnectTarget> = {
  [Service.Spotify]: { label: 'Reconnect Spotify', to: '/api/auth/spotify', external: true },
  [Service.YTMusic]: { label: 'Update cookie', to: `/settings?${new URLSearchParams(UPDATE_COOKIE_QUERY)}`, external: false },
}
