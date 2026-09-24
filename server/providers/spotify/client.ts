import { FetchError } from 'ofetch'
import { LIKED_PLAYLIST_ID, PlaylistKind, type PlaylistSummary, Service, type Track } from '#shared/types'
import { chunk, sleep } from '../../lib/util'
import { type MusicProvider, type PlaylistMeta, ProviderAuthError, type TrackQuery } from '../types'

const API_URL = 'https://api.spotify.com/v1'
const LIKED_NAME = 'Liked Songs'
const PAGE_SIZE = 50
const SEARCH_LIMIT = 10
const PLAYLIST_WRITE_BATCH = 100
const LIBRARY_WRITE_BATCH = 40
const MAX_RETRIES = 4
const DEFAULT_RETRY_SECONDS = 2
// Card-sized artwork; Spotify usually offers 640, 300 and 60 px.
const PREFERRED_IMAGE_WIDTH = 300

interface SpotifyImage { url: string, width?: number | null }
interface SpotifyTrack {
  id: string | null
  type: string
  name: string
  duration_ms: number
  artists: { name: string }[]
  album?: { name: string, images?: SpotifyImage[] }
}
interface SpotifyPlaylist {
  id: string
  name: string
  description?: string
  images?: SpotifyImage[] | null
  collaborative: boolean
  owner: { id: string }
  items?: { total: number }
  tracks?: { total: number }
}
interface Page<T> { items: T[], next: string | null, total: number }
interface PlaylistEntry { is_local?: boolean, item?: SpotifyTrack | null, track?: SpotifyTrack | null }

type TokenGetter = () => Promise<string>

function pickImage(images?: SpotifyImage[] | null): string | undefined {
  if (!images?.length) {
    return undefined
  }
  const sized = images.find(image => image.width === PREFERRED_IMAGE_WIDTH)
  return (sized ?? images[0])!.url
}

function toTrack(track: SpotifyTrack): Track {
  return {
    id: track.id!,
    title: track.name,
    artists: track.artists.map(artist => artist.name),
    album: track.album?.name,
    durationMs: track.duration_ms,
    image: pickImage(track.album?.images),
  }
}

const trackUri = (id: string) => `spotify:track:${id}`

export class SpotifyProvider implements MusicProvider {
  readonly service = Service.Spotify

  constructor(private readonly userId: string, private readonly getToken: TokenGetter) {}

  // Retries on rate limiting (429) and transient 5xx, honoring Retry-After.
  private async request<T>(path: string, options: { method?: string, query?: Record<string, unknown>, body?: unknown, headers?: Record<string, string> } = {}): Promise<T> {
    const url = path.startsWith('http') ? path : `${API_URL}${path}`

    for (let attempt = 0; ; attempt++) {
      try {
        return await $fetch<T>(url, {
          method: (options.method ?? 'GET') as 'GET',
          query: options.query,
          body: options.body as BodyInit,
          headers: { Authorization: `Bearer ${await this.getToken()}`, ...options.headers },
        })
      }
      catch (error) {
        if (!(error instanceof FetchError)) {
          throw error
        }

        const status = error.response?.status ?? 0
        if (status === 401) {
          throw new ProviderAuthError(this.service, 'Spotify session expired')
        }

        const retryable = status === 429 || status >= 500
        if (!retryable || attempt >= MAX_RETRIES) {
          throw error
        }

        const retryAfter = Number(error.response?.headers.get('retry-after')) || DEFAULT_RETRY_SECONDS * (attempt + 1)
        await sleep(retryAfter * 1000)
      }
    }
  }

  private async collect<T>(path: string, query: Record<string, unknown>): Promise<T[]> {
    const results: T[] = []
    let page = await this.request<Page<T>>(path, { query: { limit: PAGE_SIZE, ...query } })
    results.push(...page.items)

    while (page.next) {
      page = await this.request<Page<T>>(page.next)
      results.push(...page.items)
    }

    return results
  }

  async listPlaylists(): Promise<PlaylistSummary[]> {
    const [liked, playlists] = await Promise.all([
      this.request<Page<unknown>>('/me/tracks', { query: { limit: 1 } }),
      this.collect<SpotifyPlaylist>('/me/playlists', {}),
    ])

    const likedSummary: PlaylistSummary = {
      id: LIKED_PLAYLIST_ID,
      service: this.service,
      kind: PlaylistKind.Liked,
      name: LIKED_NAME,
      trackCount: liked.total,
      editable: true,
    }

    // Playlists owned by others (and not collaborative) cannot be read in
    // development mode, so they are listed but not selectable.
    const owned = playlists.filter(Boolean).map((playlist): PlaylistSummary => ({
      id: playlist.id,
      service: this.service,
      kind: PlaylistKind.Playlist,
      name: playlist.name,
      description: playlist.description || undefined,
      image: pickImage(playlist.images),
      trackCount: playlist.items?.total ?? playlist.tracks?.total,
      editable: playlist.owner.id === this.userId || playlist.collaborative,
    }))

    return [likedSummary, ...owned]
  }

  async getPlaylist(id: string): Promise<PlaylistMeta | undefined> {
    if (id === LIKED_PLAYLIST_ID) {
      return { id, name: LIKED_NAME }
    }

    try {
      const playlist = await this.request<SpotifyPlaylist>(`/playlists/${id}`, { query: { fields: 'id,name,images' } })
      return { id: playlist.id, name: playlist.name, image: pickImage(playlist.images) }
    }
    catch (error) {
      if (error instanceof FetchError && error.response?.status === 404) {
        return undefined
      }
      throw error
    }
  }

  async getTracks(id: string): Promise<Track[]> {
    const entries = id === LIKED_PLAYLIST_ID
      ? await this.collect<PlaylistEntry>('/me/tracks', {})
      : await this.collect<PlaylistEntry>(`/playlists/${id}/items`, { additional_types: 'track' })

    const tracks: Track[] = []
    for (const entry of entries) {
      const track = entry.item ?? entry.track
      if (entry.is_local || !track?.id || track.type !== 'track') {
        continue
      }
      tracks.push(toTrack(track))
    }
    return tracks
  }

  async search(query: TrackQuery): Promise<Track[]> {
    const artist = query.artists[0]
    const fielded = artist ? `track:${query.title} artist:${artist}` : query.title
    const candidates = await this.searchRaw(fielded)
    if (candidates.length) {
      return candidates
    }

    // Field filters are strict; retry as free text.
    return await this.searchRaw([query.title, artist].filter(Boolean).join(' '))
  }

  private async searchRaw(q: string): Promise<Track[]> {
    const response = await this.request<{ tracks: Page<SpotifyTrack | null> }>('/search', {
      query: { q, type: 'track', limit: SEARCH_LIMIT },
    })
    return response.tracks.items.filter((track): track is SpotifyTrack => !!track?.id).map(toTrack)
  }

  async createPlaylist(name: string, description: string): Promise<string> {
    const playlist = await this.request<SpotifyPlaylist>('/me/playlists', {
      method: 'POST',
      body: { name, description, public: false },
    })
    return playlist.id
  }

  async renamePlaylist(id: string, name: string): Promise<void> {
    if (id === LIKED_PLAYLIST_ID) {
      return
    }
    await this.request(`/playlists/${id}`, { method: 'PUT', body: { name } })
  }

  async addTracks(id: string, trackIds: string[]): Promise<void> {
    const uris = trackIds.map(trackUri)

    if (id === LIKED_PLAYLIST_ID) {
      for (const batch of chunk(uris, LIBRARY_WRITE_BATCH)) {
        await this.request('/me/library', { method: 'PUT', query: { uris: batch.join(',') } })
      }
      return
    }

    for (const batch of chunk(uris, PLAYLIST_WRITE_BATCH)) {
      await this.request(`/playlists/${id}/items`, { method: 'POST', body: { uris: batch } })
    }
  }

  async removeTracks(id: string, trackIds: string[]): Promise<void> {
    const uris = trackIds.map(trackUri)

    if (id === LIKED_PLAYLIST_ID) {
      for (const batch of chunk(uris, LIBRARY_WRITE_BATCH)) {
        await this.request('/me/library', { method: 'DELETE', query: { uris: batch.join(',') } })
      }
      return
    }

    for (const batch of chunk(uris, PLAYLIST_WRITE_BATCH)) {
      await this.request(`/playlists/${id}/items`, { method: 'DELETE', body: { items: batch.map(uri => ({ uri })) } })
    }
  }

  // Body must be a base64 JPEG no larger than 256 KB.
  async setCover(id: string, jpeg: Buffer): Promise<void> {
    if (id === LIKED_PLAYLIST_ID) {
      return
    }
    await this.request(`/playlists/${id}/images`, {
      method: 'PUT',
      body: jpeg.toString('base64'),
      headers: { 'Content-Type': 'image/jpeg' },
    })
  }
}
