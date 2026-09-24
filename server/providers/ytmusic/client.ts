import { type Helpers, Innertube, YTMusic, YTNodes } from 'youtubei.js'
import { LIKED_PLAYLIST_ID, PlaylistKind, type PlaylistSummary, Service, type Track } from '#shared/types'
import { chunk, mapLimit } from '../../lib/util'
import { parseLibraryContinuation, parseLibraryPage } from './library'
import { type MusicProvider, type PlaylistMeta, ProviderAuthError, type TrackQuery } from '../types'

const LIKED_MUSIC_ID = 'LM'
const LIKED_NAME = 'Liked Music'
const LIBRARY_PLAYLISTS_BROWSE_ID = 'FEmusic_liked_playlists'
const BROWSE_PLAYLIST_PREFIX = 'VL'
const PRIVACY_PRIVATE = 'PRIVATE'
const ADD_BATCH = 50
const LIKE_CONCURRENCY = 2
// Library entries that are not real, editable playlists.
const SYSTEM_PLAYLIST_IDS = new Set([LIKED_MUSIC_ID, 'SE'])
// Thumbnail used for cards and track rows.
const MIN_THUMBNAIL_WIDTH = 120

type Thumbnail = { url: string, width: number }

export interface YTAccount {
  id: string
  name: string
  avatar?: string
}

// One Innertube session per cookie; creating one costs a network round trip.
const sessions = new Map<string, Promise<Innertube>>()

export function createSession(cookie: string): Promise<Innertube> {
  let session = sessions.get(cookie)
  if (!session) {
    session = Innertube.create({ cookie, retrieve_player: false })
    session.catch(() => sessions.delete(cookie))
    sessions.set(cookie, session)
  }
  return session
}

export function dropSession(cookie: string) {
  sessions.delete(cookie)
}

// Verifies the cookie by reading the signed-in account.
export async function fetchAccount(cookie: string): Promise<YTAccount> {
  const yt = await createSession(cookie)
  let accounts: YTNodes.AccountItem[]
  try {
    accounts = await yt.account.getInfo(true)
  }
  catch {
    dropSession(cookie)
    throw new ProviderAuthError(Service.YTMusic, 'The cookie was rejected by YouTube Music')
  }

  const account = accounts.find(item => item.is_selected) ?? accounts[0]
  if (!account) {
    dropSession(cookie)
    throw new ProviderAuthError(Service.YTMusic, 'No signed-in YouTube account found in the cookie')
  }

  const name = account.account_name.toString()
  const handle = account.channel_handle?.toString()
  return { id: handle || name, name, avatar: account.account_photo?.[0]?.url }
}

function pickThumbnail(thumbnails?: Thumbnail[]): string | undefined {
  if (!thumbnails?.length) {
    return undefined
  }
  const sorted = [...thumbnails].sort((a, b) => a.width - b.width)
  return (sorted.find(thumb => thumb.width >= MIN_THUMBNAIL_WIDTH) ?? sorted.at(-1))!.url
}

function parseCount(text?: string): number | undefined {
  const match = text?.match(/([\d.,]+)\s+(songs?|tracks?|videos?|episodes?)/i)
  return match ? Number(match[1]!.replace(/[.,]/g, '')) : undefined
}

function toApiId(id: string): string {
  return id === LIKED_PLAYLIST_ID ? LIKED_MUSIC_ID : id
}

function stripBrowsePrefix(id: string): string {
  return id.startsWith(BROWSE_PLAYLIST_PREFIX) ? id.slice(BROWSE_PLAYLIST_PREFIX.length) : id
}

// Videos uploaded as "Artist - Title" have no artist metadata; split it out.
function splitVideoTitle(title: string): { title: string, artist?: string } {
  const separator = title.indexOf(' - ')
  if (separator === -1) {
    return { title }
  }
  return { artist: title.slice(0, separator).trim(), title: title.slice(separator + 3).trim() }
}

function toTrack(item: YTNodes.MusicResponsiveListItem): Track | undefined {
  if (!item.id || !item.title) {
    return undefined
  }

  const artists = (item.artists ?? item.authors ?? []).map(artist => artist.name).filter(Boolean)
  let title = item.title
  if (!artists.length) {
    const split = splitVideoTitle(title)
    title = split.title
    if (split.artist) {
      artists.push(split.artist)
    }
  }

  return {
    id: item.id,
    title,
    artists,
    album: item.album?.name,
    durationMs: item.duration ? item.duration.seconds * 1000 : undefined,
    image: pickThumbnail(item.thumbnails),
  }
}

function playlistTracks(items: Iterable<Helpers.YTNode> | undefined): Track[] {
  const tracks: Track[] = []
  for (const node of items ?? []) {
    if (!node.is(YTNodes.MusicResponsiveListItem)) {
      continue
    }
    const track = toTrack(node)
    if (track) {
      tracks.push(track)
    }
  }
  return tracks
}

export class YTMusicProvider implements MusicProvider {
  readonly service = Service.YTMusic

  constructor(private readonly cookie: string, private readonly accountName: string) {}

  private async session(): Promise<Innertube> {
    return await createSession(this.cookie)
  }

  // Wraps calls so an expired cookie surfaces as a re-connect prompt.
  private async call<T>(fn: (yt: Innertube) => Promise<T>): Promise<T> {
    const yt = await this.session()
    try {
      return await fn(yt)
    }
    catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      if (/\b(401|403)\b|sign(ed)? in/i.test(message)) {
        dropSession(this.cookie)
        throw new ProviderAuthError(this.service, 'YouTube Music session expired')
      }
      throw error
    }
  }

  async listPlaylists(): Promise<PlaylistSummary[]> {
    return await this.call(async (yt) => {
      const response = await yt.actions.execute('/browse', { browseId: LIBRARY_PLAYLISTS_BROWSE_ID, client: 'YTMUSIC' })
      let page = parseLibraryPage(response)
      const nodes: Helpers.YTNode[] = [...page.nodes]

      while (page.continuation) {
        const next = await yt.actions.execute('/browse', { continuation: page.continuation, client: 'YTMUSIC' })
        page = parseLibraryContinuation(next)
        nodes.push(...page.nodes)
      }

      const summaries: PlaylistSummary[] = [this.likedSummary()]
      for (const node of nodes) {
        const summary = this.toSummary(node)
        if (summary) {
          summaries.push(summary)
        }
      }
      return summaries
    })
  }

  private likedSummary(): PlaylistSummary {
    return {
      id: LIKED_PLAYLIST_ID,
      service: this.service,
      kind: PlaylistKind.Liked,
      name: LIKED_NAME,
      editable: true,
    }
  }

  private toSummary(node: Helpers.YTNode): PlaylistSummary | undefined {
    if (node.is(YTNodes.MusicTwoRowItem)) {
      if (node.item_type !== 'playlist' || !node.id) {
        return undefined
      }
      const id = stripBrowsePrefix(node.id)
      if (SYSTEM_PLAYLIST_IDS.has(id)) {
        return undefined
      }
      const subtitle = node.subtitle.toString()
      const author = node.author?.name
      return {
        id,
        service: this.service,
        kind: PlaylistKind.Playlist,
        name: node.title.toString(),
        image: pickThumbnail(node.thumbnail),
        trackCount: parseCount(node.item_count ?? subtitle),
        editable: !author || author === this.accountName,
      }
    }

    if (node.is(YTNodes.MusicResponsiveListItem)) {
      if (node.item_type !== 'playlist' || !node.id) {
        return undefined
      }
      const id = stripBrowsePrefix(node.id)
      if (SYSTEM_PLAYLIST_IDS.has(id)) {
        return undefined
      }
      const author = node.author?.name
      return {
        id,
        service: this.service,
        kind: PlaylistKind.Playlist,
        name: node.title ?? '',
        image: pickThumbnail(node.thumbnails),
        trackCount: parseCount(node.item_count ?? node.subtitle?.toString()),
        editable: !author || author === this.accountName,
      }
    }

    return undefined
  }

  async getPlaylist(id: string): Promise<PlaylistMeta | undefined> {
    if (id === LIKED_PLAYLIST_ID) {
      return { id, name: LIKED_NAME }
    }

    return await this.call(async (yt) => {
      let playlist: YTMusic.Playlist
      try {
        playlist = await yt.music.getPlaylist(id)
      }
      catch (error) {
        if (error instanceof ProviderAuthError) {
          throw error
        }
        return undefined
      }

      let header = playlist.header as Helpers.YTNode | undefined
      if (header?.is(YTNodes.MusicEditablePlaylistDetailHeader)) {
        header = header.header
      }
      if (!header?.is(YTNodes.MusicResponsiveHeader, YTNodes.MusicDetailHeader)) {
        return { id, name: '' }
      }

      const thumbnails = header.is(YTNodes.MusicResponsiveHeader) ? header.thumbnail?.contents : header.thumbnails
      return { id, name: header.title.toString(), image: largestThumbnail(thumbnails) }
    })
  }

  async getTracks(id: string): Promise<Track[]> {
    return await this.call(async (yt) => {
      let playlist = await yt.music.getPlaylist(toApiId(id))
      const tracks = playlistTracks(playlist.contents)

      while (playlist.has_continuation) {
        playlist = await playlist.getContinuation()
        tracks.push(...playlistTracks(playlist.contents))
      }

      return tracks
    })
  }

  async search(query: TrackQuery): Promise<Track[]> {
    const text = [query.title, query.artists[0]].filter(Boolean).join(' ')
    return await this.call(async (yt) => {
      const songs = await yt.music.search(text, { type: 'song' })
      const results = playlistTracks(songs.songs?.contents)
      if (results.length) {
        return results
      }

      // Some tracks only exist as music videos.
      const videos = await yt.music.search(text, { type: 'video' })
      return playlistTracks(videos.videos?.contents)
    })
  }

  async createPlaylist(name: string, description: string): Promise<string> {
    return await this.call(async (yt) => {
      const response = await yt.actions.execute('/playlist/create', {
        title: name,
        description,
        privacyStatus: PRIVACY_PRIVATE,
        client: 'YTMUSIC',
      })
      const playlistId = (response.data as { playlistId?: string }).playlistId
      if (!playlistId) {
        throw new Error('YouTube Music did not return a playlist id')
      }
      return playlistId
    })
  }

  async renamePlaylist(id: string, name: string): Promise<void> {
    if (id === LIKED_PLAYLIST_ID) {
      return
    }
    await this.call(yt => yt.playlist.setName(id, name))
  }

  async addTracks(id: string, trackIds: string[]): Promise<void> {
    await this.call(async (yt) => {
      if (id === LIKED_PLAYLIST_ID) {
        await mapLimit(trackIds, LIKE_CONCURRENCY, videoId => yt.interact.like(videoId))
        return
      }
      for (const batch of chunk(trackIds, ADD_BATCH)) {
        await yt.playlist.addVideos(id, batch)
      }
    })
  }

  // Callers must only pass ids currently in the playlist; youtubei.js keeps
  // paging until it finds every id.
  async removeTracks(id: string, trackIds: string[]): Promise<void> {
    if (!trackIds.length) {
      return
    }
    await this.call(async (yt) => {
      if (id === LIKED_PLAYLIST_ID) {
        await mapLimit(trackIds, LIKE_CONCURRENCY, videoId => yt.interact.removeRating(videoId))
        return
      }
      await yt.playlist.removeVideos(id, trackIds)
    })
  }
}

function largestThumbnail(thumbnails?: Thumbnail[]): string | undefined {
  if (!thumbnails?.length) {
    return undefined
  }
  return [...thumbnails].sort((a, b) => b.width - a.width)[0]!.url
}
