import type { PlaylistSummary, Service, Track } from '#shared/types'

export interface PlaylistMeta {
  id: string
  name: string
  image?: string
}

export interface TrackQuery {
  title: string
  artists: string[]
  album?: string
}

/**
 * Uniform access to a streaming service. The liked-songs collection is
 * addressed with LIKED_PLAYLIST_ID on every method.
 */
export interface MusicProvider {
  readonly service: Service
  listPlaylists(): Promise<PlaylistSummary[]>
  // Undefined when the playlist no longer exists.
  getPlaylist(id: string): Promise<PlaylistMeta | undefined>
  getTracks(id: string): Promise<Track[]>
  search(query: TrackQuery): Promise<Track[]>
  createPlaylist(name: string, description: string): Promise<string>
  renamePlaylist(id: string, name: string): Promise<void>
  addTracks(id: string, trackIds: string[]): Promise<void>
  removeTracks(id: string, trackIds: string[]): Promise<void>
  // Only services whose API allows custom covers implement this.
  setCover?(id: string, jpeg: Buffer): Promise<void>
}

export class ProviderAuthError extends Error {
  constructor(readonly service: Service, message: string) {
    super(message)
  }
}
