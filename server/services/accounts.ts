import type { H3Event } from 'h3'
import { type AccountInfo, Service, type SessionState } from '#shared/types'
import { decrypt, encrypt, parseKey } from '../lib/crypto'
import { type SpotifyTokens, type TokenResponse, refreshTokens, toTokens } from '../providers/spotify/auth'
import { SpotifyProvider } from '../providers/spotify/client'
import type { MusicProvider } from '../providers/types'
import { YTMusicProvider, dropSession, fetchAccount } from '../providers/ytmusic/client'
import { type AccountRow, deleteAccount, findAccount, listAccounts, saveAccount, updateCredentials } from '../repositories/accounts'

// Refresh a little before expiry so in-flight requests never race it.
const TOKEN_REFRESH_MARGIN_MS = 60_000

interface YTCredentials { cookie: string }

let encryptionKey: Buffer | undefined
function key(): Buffer {
  encryptionKey ??= parseKey(useRuntimeConfig().encryptionKey)
  return encryptionKey
}

function seal(value: unknown): string {
  return encrypt(JSON.stringify(value), key())
}

function unseal<T>(row: AccountRow): T {
  return JSON.parse(decrypt(row.credentials, key())) as T
}

/*
 * Ownership: the first account that connects on each service becomes the
 * instance owner. Anyone else is rejected until the owner resets the app.
 */
function assertOwner(service: Service, externalId: string) {
  const { ownerSpotifyId } = useRuntimeConfig()
  if (service === Service.Spotify && ownerSpotifyId && ownerSpotifyId !== externalId) {
    throw createError({ statusCode: 403, statusMessage: 'This Spotify account is not allowed on this instance' })
  }

  const existing = findAccount(service)
  if (existing && existing.external_id !== externalId) {
    throw createError({ statusCode: 403, statusMessage: 'This instance is linked to a different account' })
  }
}

export async function connectSpotify(event: H3Event, tokens: TokenResponse, user: { id: string, display_name?: string, images?: { url: string }[] }) {
  assertOwner(Service.Spotify, user.id)
  const returningOwner = findAccount(Service.Spotify)?.external_id === user.id

  saveAccount({
    service: Service.Spotify,
    external_id: user.id,
    name: user.display_name || user.id,
    avatar: user.images?.[0]?.url ?? null,
    credentials: seal(toTokens(tokens)),
  })

  // The returning owner keeps the established YouTube Music link. A first
  // login must prove YouTube Music ownership with its own cookie.
  const ytmusic = returningOwner ? findAccount(Service.YTMusic)?.external_id : undefined
  await replaceUserSession(event, { user: { spotify: user.id, ytmusic } })
}

export async function connectYTMusic(event: H3Event, cookie: string) {
  const session = await getUserSession(event)
  if (!session.user?.spotify) {
    throw createError({ statusCode: 401, statusMessage: 'Connect Spotify first' })
  }

  const account = await fetchAccount(cookie)
  assertOwner(Service.YTMusic, account.id)

  const previous = findAccount(Service.YTMusic)
  if (previous) {
    dropSession(unseal<YTCredentials>(previous).cookie)
  }

  saveAccount({
    service: Service.YTMusic,
    external_id: account.id,
    name: account.name,
    avatar: account.avatar ?? null,
    credentials: seal({ cookie } satisfies YTCredentials),
  })

  await setUserSession(event, { user: { ...session.user, ytmusic: account.id } })
}

function toInfo(row: AccountRow): AccountInfo {
  return { service: row.service, name: row.name, avatar: row.avatar ?? undefined }
}

// Session ids must still match the stored owner accounts.
export async function getSessionState(event: H3Event): Promise<SessionState> {
  const session = await getUserSession(event)
  const accounts: SessionState['accounts'] = {}

  for (const row of listAccounts()) {
    if (session.user?.[row.service] === row.external_id) {
      accounts[row.service] = toInfo(row)
    }
  }

  return { accounts, ready: !!accounts[Service.Spotify] && !!accounts[Service.YTMusic] }
}

export async function requireOwner(event: H3Event) {
  const state = await getSessionState(event)
  if (!state.ready) {
    throw createError({ statusCode: 401, statusMessage: 'Connect both services first' })
  }
}

export async function logout(event: H3Event) {
  await clearUserSession(event)
}

// Forgets both accounts so the instance can be linked again from scratch.
// Playlist links and the match cache are kept.
export async function unlinkAccounts(event: H3Event) {
  const ytmusic = findAccount(Service.YTMusic)
  if (ytmusic) {
    dropSession(unseal<YTCredentials>(ytmusic).cookie)
  }
  deleteAccount(Service.YTMusic)
  deleteAccount(Service.Spotify)
  await clearUserSession(event)
}

// Serializes refreshes so concurrent requests reuse one new token.
let spotifyRefresh: Promise<SpotifyTokens> | undefined

async function spotifyAccessToken(): Promise<string> {
  const row = findAccount(Service.Spotify)
  if (!row) {
    throw createError({ statusCode: 401, statusMessage: 'Spotify is not connected' })
  }

  const tokens = unseal<SpotifyTokens>(row)
  if (tokens.expiresAt - TOKEN_REFRESH_MARGIN_MS > Date.now()) {
    return tokens.accessToken
  }

  spotifyRefresh ??= refreshTokens(tokens.refreshToken)
    .then((fresh) => {
      updateCredentials(Service.Spotify, seal(fresh))
      return fresh
    })
    .finally(() => {
      spotifyRefresh = undefined
    })

  return (await spotifyRefresh).accessToken
}

export function getProvider(service: Service): MusicProvider {
  const row = findAccount(service)
  if (!row) {
    throw createError({ statusCode: 401, statusMessage: `${service} is not connected` })
  }

  if (service === Service.Spotify) {
    return new SpotifyProvider(row.external_id, spotifyAccessToken)
  }
  return new YTMusicProvider(unseal<YTCredentials>(row).cookie, row.name)
}
