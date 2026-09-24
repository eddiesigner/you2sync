// Types shared by the browser app and the server API.

export enum Service {
  Spotify = 'spotify',
  YTMusic = 'ytmusic',
}

export enum SyncMode {
  // Apply only what changed on the source since the last sync.
  Changes = 'changes',
  // Make the target contain exactly the source's songs.
  Mirror = 'mirror',
}

export enum PlaylistKind {
  Playlist = 'playlist',
  Liked = 'liked',
}

export enum JobStatus {
  Running = 'running',
  Ready = 'ready',
  Done = 'done',
  Failed = 'failed',
}

export enum JobKind {
  Plan = 'plan',
  Apply = 'apply',
}

// Both services expose their "liked songs" through this pseudo playlist id.
export const LIKED_PLAYLIST_ID = '__liked__'

export const SERVICE_LABEL: Record<Service, string> = {
  [Service.Spotify]: 'Spotify',
  [Service.YTMusic]: 'YouTube Music',
}

export function otherService(service: Service): Service {
  return service === Service.Spotify ? Service.YTMusic : Service.Spotify
}

export interface Track {
  id: string
  title: string
  artists: string[]
  album?: string
  durationMs?: number
  image?: string
}

export interface PlaylistSummary {
  id: string
  service: Service
  kind: PlaylistKind
  name: string
  description?: string
  image?: string
  trackCount?: number
  // False for playlists the user follows but cannot read or edit.
  editable: boolean
  link?: LinkInfo
}

export interface LinkInfo {
  id: number
  counterpartId: string
  lastSyncedAt?: number
}

export interface AccountInfo {
  service: Service
  name: string
  avatar?: string
}

export interface SessionState {
  accounts: Partial<Record<Service, AccountInfo>>
  ready: boolean
}

export interface LibraryResponse {
  playlists: Record<Service, PlaylistSummary[]>
}

export interface SyncSelection {
  source: Service
  mode: SyncMode
  // Source playlist ids. Empty means every editable playlist.
  playlistIds: string[]
}

export interface MatchedTrack {
  source: Track
  target: Track
  score: number
}

export interface UnmatchedTrack {
  source: Track
  bestGuess?: Track
  score?: number
}

export interface PlaylistPlan {
  key: string
  source: Service
  sourcePlaylist: { id: string, name: string, image?: string, kind: PlaylistKind }
  // Undefined when the target playlist will be created.
  targetPlaylistId?: string
  targetName?: string
  willCreate: boolean
  willRename: boolean
  canCopyCover: boolean
  add: MatchedTrack[]
  remove: Track[]
  unmatched: UnmatchedTrack[]
  unchanged: number
  error?: string
}

export interface PlanDecision {
  key: string
  // Track ids (on the target) the user confirmed for removal.
  removeIds: string[]
  copyCover: boolean
}

export interface PlaylistResult {
  key: string
  name: string
  image?: string
  added: number
  removed: number
  unmatched: number
  created: boolean
  error?: string
}

export interface JobState {
  id: string
  kind: JobKind
  status: JobStatus
  source: Service
  mode: SyncMode
  total: number
  done: number
  current?: { name: string, image?: string }
  plans: PlaylistPlan[]
  results: PlaylistResult[]
  error?: string
}

export enum ReviewStatus {
  Open = 'open',
  Resolved = 'resolved',
  Dismissed = 'dismissed',
}

export interface ReviewItem {
  id: number
  source: Service
  sourcePlaylistId: string
  targetPlaylistId: string
  playlistName: string
  track: Track
  bestGuess?: Track
  createdAt: number
}
