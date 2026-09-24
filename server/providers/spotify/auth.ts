// The authorization-code flow itself is handled by nuxt-auth-utils; this
// module only keeps tokens fresh.

const TOKEN_URL = 'https://accounts.spotify.com/api/token'

export const SPOTIFY_SCOPES = [
  'playlist-read-private',
  'playlist-read-collaborative',
  'playlist-modify-private',
  'playlist-modify-public',
  'user-library-read',
  'user-library-modify',
  'ugc-image-upload',
]

export interface SpotifyTokens {
  accessToken: string
  refreshToken: string
  expiresAt: number
}

export interface TokenResponse {
  access_token: string
  refresh_token?: string
  expires_in: number
}

export function toTokens(response: TokenResponse, previousRefresh = ''): SpotifyTokens {
  return {
    accessToken: response.access_token,
    // Spotify may or may not rotate the refresh token; keep the old one if not.
    refreshToken: response.refresh_token ?? previousRefresh,
    expiresAt: Date.now() + response.expires_in * 1000,
  }
}

export async function refreshTokens(refreshToken: string): Promise<SpotifyTokens> {
  const { clientId, clientSecret } = useRuntimeConfig().oauth.spotify
  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')
  const response = await $fetch<TokenResponse>(TOKEN_URL, {
    method: 'POST',
    headers: { 'Authorization': `Basic ${basic}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshToken }).toString(),
  })
  return toTokens(response, refreshToken)
}
