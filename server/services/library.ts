import { type LibraryResponse, type PlaylistSummary, Service, type Track } from '#shared/types'
import { type LinkRow, deleteAllLinks, linkedId, listLinks } from '../repositories/links'
import { getProvider } from './accounts'

function withLink(playlist: PlaylistSummary, linksById: Map<string, LinkRow>, counterpart: Service): PlaylistSummary {
  const link = linksById.get(playlist.id)
  if (!link) {
    return playlist
  }
  return {
    ...playlist,
    link: { id: link.id, counterpartId: linkedId(link, counterpart), lastSyncedAt: link.last_synced_at ?? undefined },
  }
}

export async function listLibrary(): Promise<LibraryResponse> {
  const [spotify, ytmusic] = await Promise.all([
    getProvider(Service.Spotify).listPlaylists(),
    getProvider(Service.YTMusic).listPlaylists(),
  ])

  const links = listLinks()
  const bySpotify = new Map(links.map(link => [link.spotify_id, link]))
  const byYTMusic = new Map(links.map(link => [link.ytmusic_id, link]))

  return {
    playlists: {
      [Service.Spotify]: spotify.map(p => withLink(p, bySpotify, Service.YTMusic)),
      [Service.YTMusic]: ytmusic.map(p => withLink(p, byYTMusic, Service.Spotify)),
    },
  }
}

export async function listTracks(service: Service, playlistId: string): Promise<Track[]> {
  return await getProvider(service).getTracks(playlistId)
}

// Forget every playlist pairing (the playlists themselves are untouched).
export function resetLinks() {
  deleteAllLinks()
}
