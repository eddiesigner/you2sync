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

Requires Node.js 24 (as in the `Dockerfile`; `node:sqlite` needs at least 22.13) or Docker.

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

   | Variable | Required | Description |
   | --- | --- | --- |
   | `NUXT_OAUTH_SPOTIFY_CLIENT_ID` | Yes | Client ID of the Spotify app from step 1. |
   | `NUXT_OAUTH_SPOTIFY_CLIENT_SECRET` | Yes | Client secret of the same app. |
   | `NUXT_OAUTH_SPOTIFY_REDIRECT_URL` | Yes | Must match a redirect URI from step 1 exactly. Defaults to `http://127.0.0.1:3000/api/auth/spotify`. |
   | `NUXT_SESSION_PASSWORD` | Yes | Signs the session cookie. At least 32 characters. |
   | `NUXT_ENCRYPTION_KEY` | Yes | Encrypts stored tokens and cookies. 32 bytes, as 64 hex characters or base64. Changing it makes stored credentials unreadable; connect both services again. |
   | `NUXT_OWNER_SPOTIFY_ID` | No | Locks the instance to this Spotify user id (the "Username" on your Spotify account page). Without it, the first account to connect becomes the owner. |
   | `NUXT_DATABASE_PATH` | No | SQLite file location. Defaults to `./data/you2sync.db`. |
   | `NUXT_SESSION_COOKIE_SECURE` | No | Set to `false` only when serving production builds over plain HTTP, like the local Docker setup. |

### Development

```sh
npm install
npm run dev        # http://127.0.0.1:3000
```

| Command | What it does |
| --- | --- |
| `npm install` | Installs dependencies. Also runs `postinstall` (`nuxt prepare`), which generates the types in `.nuxt/`. |
| `npm run dev` | Starts the dev server with hot reload at `http://127.0.0.1:3000`. |
| `npm run build` | Builds the production server into `.output/`. |
| `npm run preview` | Runs the production build locally. Run `npm run build` first. |
| `npm test` | Runs the unit tests once with Vitest. |
| `npm run typecheck` | Type-checks the app and server with `vue-tsc`. Tests are not included. |
| `npm run generate` | Nuxt's static-site export. Not usable here: the app needs its server API. |

### Docker + nginx

```sh
docker compose up -d --build   # http://127.0.0.1:8080
```

This runs the app and nginx on your machine only. To put it on a server, see [Deployment](#deployment).

## Deployment

The Docker setup is meant for a small VPS or home server with a domain pointing at it. The app needs HTTPS in production: Spotify requires it for non-loopback redirect URIs, and the session cookie is `Secure`.

1. **Spotify.** Add `https://your.domain/api/auth/spotify` as a redirect URI in the Spotify app.
2. **Environment.** On the server, clone the repository and create `.env` as in [Setup](#setup).
3. **Compose.** In `docker-compose.yml`, values under `environment` override `.env`. For the `app` service:
   - set `NUXT_OAUTH_SPOTIFY_REDIRECT_URL` to `https://your.domain/api/auth/spotify`;
   - remove `NUXT_SESSION_COOKIE_SECURE: "false"`.

   For the `nginx` service, publish the public ports and mount your certificates:

   ```yaml
   ports:
     - "80:80"
     - "443:443"
   volumes:
     - ./deploy/nginx.conf:/etc/nginx/conf.d/default.conf:ro
     - ./certs:/etc/nginx/certs:ro   # fullchain.pem and privkey.pem
   ```

4. **TLS.** In `deploy/nginx.conf`, uncomment the `443` server block and set `server_name` to your domain. Replace the `location` blocks of the port 80 server with a redirect, so the app is only served over HTTPS:

   ```nginx
   location / {
     return 301 https://$host$request_uri;
   }
   ```

   Certificates can come from any ACME client, e.g. [certbot](https://certbot.eff.org). Copy them into `./certs` rather than mounting certbot's `live` directory, which contains symlinks.

5. **Start.**

   ```sh
   docker compose up -d --build
   ```

**Updating:** `git pull && docker compose up -d --build`. Data survives in the `data` volume.

**Backups:** the SQLite database lives in the `data` volume at `/data/you2sync.db`. Keep `NUXT_ENCRYPTION_KEY` with it; the stored credentials cannot be decrypted without it.

**Without Docker:** run `npm ci && npm run build`, then `node .output/server/index.mjs` with the variables from `.env` set. It listens on `PORT` (default `3000`). Put any HTTPS reverse proxy in front that forwards `Host` and `X-Forwarded-Proto`.

## Connecting YouTube Music

1. Sign in at [music.youtube.com](https://music.youtube.com) in a desktop browser.
2. Open developer tools → **Network**, and click around until a `browse` request appears.
3. Copy the full `cookie` request header and paste it into You2Sync.

## Stack

Nuxt 4 (SPA mode) · Vue 3 · shadcn-vue · Tailwind CSS 4 · nuxt-auth-utils · youtubei.js · node:sqlite · Vitest

## Credits

- Built by [Eduardo Gomez](https://github.com/eddiesigner).
- [youtubei.js](https://github.com/LuanRT/YouTube.js) by LuanRT makes the YouTube Music integration possible.
- UI components from [shadcn-vue](https://www.shadcn-vue.com) on [Reka UI](https://reka-ui.com); icons from [Lucide](https://lucide.dev).
- Spotify and YouTube Music logos from [Simple Icons](https://simpleicons.org) (CC0).

You2Sync is not affiliated with, endorsed by, or sponsored by Spotify or YouTube. Spotify and YouTube Music are trademarks of their respective owners.

## Support

If You2Sync saves you time, you can [buy me a coffee on Ko-fi](https://ko-fi.com/eddiesigner). ☕

## License

[MIT](LICENSE) © 2026 Eduardo Gomez
