import { SPOTIFY_SCOPES } from '../../providers/spotify/auth'
import { connectSpotify } from '../../services/accounts'

const CONNECT_PAGE = '/connect'

// Handles both the redirect to Spotify and the callback from it.
export default defineOAuthSpotifyEventHandler({
  config: { scope: SPOTIFY_SCOPES },
  async onSuccess(event, { tokens, user }) {
    try {
      await connectSpotify(event, tokens, user)
    }
    catch (error) {
      const message = (error as { statusMessage?: string }).statusMessage ?? 'Spotify login failed'
      return sendRedirect(event, `${CONNECT_PAGE}?error=${encodeURIComponent(message)}`)
    }
    return sendRedirect(event, CONNECT_PAGE)
  },
  onError(event) {
    return sendRedirect(event, `${CONNECT_PAGE}?error=${encodeURIComponent('Spotify login was cancelled or failed')}`)
  },
})
