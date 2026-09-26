import tailwindcss from '@tailwindcss/vite'

const ONE_WEEK_SECONDS = 60 * 60 * 24 * 7

// Images are loaded straight from the services' CDNs, never proxied.
const IMAGE_HOSTS = [
  'https://*.scdn.co',
  'https://*.spotifycdn.com',
  'https://*.googleusercontent.com',
  'https://*.ytimg.com',
  'https://yt3.ggpht.com',
].join(' ')

const CONTENT_SECURITY_POLICY = [
  `default-src 'self'`,
  `script-src 'self' 'unsafe-inline'`,
  `style-src 'self' 'unsafe-inline'`,
  `img-src 'self' data: ${IMAGE_HOSTS}`,
  `connect-src 'self'`,
  `font-src 'self'`,
  `object-src 'none'`,
  `base-uri 'self'`,
  `form-action 'self'`,
  `frame-ancestors 'none'`,
].join('; ')

export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },

  // Pure SPA: the server only serves static files and a thin JSON API.
  ssr: false,

  // Spotify only accepts 127.0.0.1 redirects; "localhost" may bind to ::1 only.
  devServer: { host: '127.0.0.1' },

  modules: ['shadcn-nuxt', 'nuxt-auth-utils'],
  css: ['~/assets/css/main.css'],
  vite: { plugins: [tailwindcss()] },

  shadcn: {
    prefix: '',
    componentDir: './app/components/ui',
  },

  app: {
    head: {
      title: 'You2Sync',
      htmlAttrs: { lang: 'en', class: 'dark' },
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' },
        { name: 'description', content: 'Sync playlists between Spotify and YouTube Music.' },
        { name: 'theme-color', content: '#0a0a0b' },
        { name: 'color-scheme', content: 'dark' },
        { name: 'referrer', content: 'no-referrer' },
        { name: 'robots', content: 'noindex, nofollow' },
      ],
      link: [{ rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' }],
    },
  },

  runtimeConfig: {
    // 32-byte key (hex or base64) used to encrypt stored service credentials.
    encryptionKey: '',
    databasePath: './data/you2sync.db',
    // Optional: lock the instance to one Spotify user id.
    ownerSpotifyId: '',
    oauth: {
      spotify: {
        clientId: '',
        clientSecret: '',
        // Spotify rejects "localhost"; use the loopback IP for local setups.
        redirectURL: 'http://127.0.0.1:3000/api/auth/spotify',
      },
    },
    session: {
      maxAge: ONE_WEEK_SECONDS,
      cookie: {
        sameSite: 'lax',
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
      },
    },
  },

  routeRules: {
    '/**': {
      headers: {
        'Content-Security-Policy': CONTENT_SECURITY_POLICY,
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'Referrer-Policy': 'no-referrer',
        'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
        'Cross-Origin-Opener-Policy': 'same-origin',
        // Private instance: keep every page, API response and asset out of search engines.
        'X-Robots-Tag': 'noindex, nofollow',
      },
    },
    '/api/**': { headers: { 'Cache-Control': 'no-store' } },
  },

  nitro: {
    preset: 'node-server',
  },
})
