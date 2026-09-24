# You2Sync

Self-hosted playlist sync between Spotify and YouTube Music.

- Sync one playlist, a selection, or everything, in either direction.
- **Only changes** mode applies what was added/removed since the last sync; **Full mirror** makes the target an exact copy.
- Playlists are paired by id, so renames on either side are fine. Unpaired playlists fall back to a same-named playlist, otherwise a new one is created.
- Liked songs sync too (Spotify "Liked Songs" ↔ YouTube Music "Liked Music").
- Every removal is previewed and must be confirmed.
- Songs without a confident match are skipped and listed under **Review**, where you pick the right version or dismiss them.

## How it works

```
Browser (Vue SPA) ──► Nuxt server API ──► services ──► providers ──► Spotify Web API
                                             │                 └──► YouTube Music (InnerTube, youtubei.js)
                                             └──► repositories ──► SQLite
```

- The server is a thin JSON API. Artwork loads straight from the services' CDNs.
- Spotify uses OAuth. YouTube Music has no public playlist API, so it is accessed through its internal API with your browser cookie.
- Tokens and cookies are encrypted with AES-256-GCM before they hit the database and never reach the browser.
- The first Spotify and YouTube Music accounts to connect become the instance owner. Other accounts are rejected.

## Limitations

- **Spotify development mode** (Feb 2026 rules): the app owner needs Premium, at most 5 allow-listed users, and only playlists you own or collaborate on can be read.
- **Covers** can be copied YouTube Music → Spotify only. YouTube does not allow custom playlist covers through any API.
- **YouTube Music cookie** expires when you sign out of that browser session. Paste a new one under Settings.
- Song order is not synced.

## Setup

1. Create an app at the [Spotify developer dashboard](https://developer.spotify.com/dashboard) (Web API). Add the redirect URI:
   - `http://127.0.0.1:3000/api/auth/spotify` for `npm run dev`
   - `http://127.0.0.1:8080/api/auth/spotify` for Docker
   - `https://your.domain/api/auth/spotify` in production

   Spotify rejects `localhost`; use `127.0.0.1` and open the app on that same host.

2. Copy `.env.example` to `.env` and fill it in:

   ```sh
   cp .env.example .env
   openssl rand -hex 32   # NUXT_SESSION_PASSWORD
   openssl rand -hex 32   # NUXT_ENCRYPTION_KEY
   ```

### Development

```sh
npm install
npm run dev        # http://127.0.0.1:3000
npm test           # unit tests
npm run typecheck
```

### Docker + nginx

```sh
docker compose up -d --build   # http://127.0.0.1:8080
```

For a public domain: set `NUXT_OAUTH_SPOTIFY_REDIRECT_URL` to the HTTPS URL, remove `NUXT_SESSION_COOKIE_SECURE: "false"` from `docker-compose.yml`, and enable the TLS block in `deploy/nginx.conf`.

## Connecting YouTube Music

1. Sign in at [music.youtube.com](https://music.youtube.com) in a desktop browser.
2. Open developer tools → **Network**, and click around until a `browse` request appears.
3. Copy the full `cookie` request header and paste it into You2Sync.

## Stack

Nuxt 4 (SPA mode) · Vue 3 · shadcn-vue · Tailwind CSS 4 · nuxt-auth-utils · youtubei.js · node:sqlite · Vitest
