import { randomUUID } from 'node:crypto'
import {
  JobKind,
  type JobState,
  JobStatus,
  LIKED_PLAYLIST_ID,
  type MatchedTrack,
  type PlanDecision,
  PlaylistKind,
  type PlaylistPlan,
  type PlaylistResult,
  type PlaylistSummary,
  SERVICE_LABEL,
  Service,
  SyncMode,
  type SyncSelection,
  type Track,
  type UnmatchedTrack,
  otherService,
} from '#shared/types'
import { mapLimit } from '../lib/util'
import type { MusicProvider } from '../providers/types'
import { type LinkRow, createLink, deleteLink, findLinkBy, linkedId, readSnapshot, saveSnapshots } from '../repositories/links'
import { MatchOrigin, findMatch, saveMatch } from '../repositories/matches'
import { isDismissed, resolveReviewsFor, upsertReview } from '../repositories/reviews'
import { getProvider } from './accounts'
import { fetchCoverJpeg } from './cover'
import { MATCH_THRESHOLD, bestMatch, normalize } from './matcher'
import { diffSource, mirrorRemovals, nextTargetSnapshot } from './planner'

const SEARCH_CONCURRENCY = 3
const JOB_TTL_MS = 60 * 60 * 1000

/*
 * A sync runs in two jobs so nothing is written without consent:
 *
 *   POST /api/sync/plan  ──► plan job: read both sides, match songs
 *                            (status: running → ready, exposes plans)
 *   POST /api/sync/apply ──► apply job: user-confirmed writes
 *                            (status: running → done, exposes results)
 */

interface InternalPlan {
  plan: PlaylistPlan
  summary: PlaylistSummary
  link?: LinkRow
  sourceTrackIds: string[]
}

interface Job {
  state: JobState
  internals: InternalPlan[]
  createdAt: number
}

const jobs = new Map<string, Job>()

function pruneJobs() {
  const cutoff = Date.now() - JOB_TTL_MS
  for (const [id, job] of jobs) {
    if (job.createdAt < cutoff && job.state.status !== JobStatus.Running) {
      jobs.delete(id)
    }
  }
}

function assertIdle() {
  for (const job of jobs.values()) {
    if (job.state.status === JobStatus.Running) {
      throw createError({ statusCode: 409, statusMessage: 'Another sync is already running' })
    }
  }
}

// Plans are heavy; only ship them once the job stops changing.
export function getJob(id: string): JobState {
  const job = jobs.get(id)
  if (!job) {
    throw createError({ statusCode: 404, statusMessage: 'Sync not found or expired' })
  }
  if (job.state.status === JobStatus.Running) {
    return { ...job.state, plans: [], results: [] }
  }
  return job.state
}

export function startPlan(selection: SyncSelection): JobState {
  pruneJobs()
  assertIdle()

  const job: Job = {
    state: {
      id: randomUUID(),
      kind: JobKind.Plan,
      status: JobStatus.Running,
      source: selection.source,
      mode: selection.mode,
      total: 0,
      done: 0,
      plans: [],
      results: [],
    },
    internals: [],
    createdAt: Date.now(),
  }
  jobs.set(job.state.id, job)

  runPlan(job, selection).catch((error) => {
    job.state.status = JobStatus.Failed
    job.state.error = errorMessage(error)
  })

  return job.state
}

function errorMessage(error: unknown): string {
  if (error && typeof error === 'object' && 'statusMessage' in error && error.statusMessage) {
    return String(error.statusMessage)
  }
  return error instanceof Error ? error.message : String(error)
}

async function runPlan(job: Job, selection: SyncSelection) {
  const source = getProvider(selection.source)
  const target = getProvider(otherService(selection.source))

  const [sourcePlaylists, targetPlaylists] = await Promise.all([source.listPlaylists(), target.listPlaylists()])
  const wanted = new Set(selection.playlistIds)
  const selected = sourcePlaylists.filter(p => p.editable && (!wanted.size || wanted.has(p.id)))

  job.state.total = selected.length

  for (const summary of selected) {
    job.state.current = { name: summary.name, image: summary.image }
    try {
      job.internals.push(await planPlaylist(summary, source, target, targetPlaylists, job.state))
    }
    catch (error) {
      job.internals.push(failedPlan(summary, errorMessage(error)))
    }
    job.state.done++
  }

  job.state.plans = job.internals.map(internal => internal.plan)
  job.state.current = undefined
  job.state.status = JobStatus.Ready
}

function failedPlan(summary: PlaylistSummary, error: string): InternalPlan {
  return {
    summary,
    sourceTrackIds: [],
    plan: {
      key: summary.id,
      source: summary.service,
      sourcePlaylist: { id: summary.id, name: summary.name, image: summary.image, kind: summary.kind },
      willCreate: false,
      willRename: false,
      canCopyCover: false,
      add: [],
      remove: [],
      unmatched: [],
      unchanged: 0,
      error,
    },
  }
}

// Linked by id first; an unlinked playlist falls back to a same-named one.
async function resolveTarget(summary: PlaylistSummary, target: MusicProvider, targetPlaylists: PlaylistSummary[]) {
  let link = findLinkBy(summary.service, summary.id)

  if (link) {
    const targetId = linkedId(link, target.service)
    const meta = await target.getPlaylist(targetId)
    if (meta) {
      return { link, targetId, targetName: meta.name }
    }
    // The counterpart was deleted; forget the link and start over.
    deleteLink(link.id)
    link = undefined
  }

  if (summary.kind === PlaylistKind.Liked) {
    return { targetId: LIKED_PLAYLIST_ID, targetName: undefined }
  }

  const name = normalize(summary.name)
  const sameName = targetPlaylists.find(p =>
    p.editable
    && p.kind === PlaylistKind.Playlist
    && normalize(p.name) === name
    && !findLinkBy(target.service, p.id))

  return { targetId: sameName?.id, targetName: sameName?.name }
}

async function planPlaylist(
  summary: PlaylistSummary,
  source: MusicProvider,
  target: MusicProvider,
  targetPlaylists: PlaylistSummary[],
  state: JobState,
): Promise<InternalPlan> {
  const { link, targetId, targetName } = await resolveTarget(summary, target, targetPlaylists)

  const [sourceTracks, targetTracks] = await Promise.all([
    source.getTracks(summary.id),
    targetId ? target.getTracks(targetId) : Promise.resolve([] as Track[]),
  ])

  const sourceById = new Map(sourceTracks.map(track => [track.id, track]))
  const targetById = new Map(targetTracks.map(track => [track.id, track]))
  const snapshot = link?.last_synced_at ? readSnapshot(link.id, source.service) : undefined
  const diff = diffSource(state.mode, sourceTracks.map(track => track.id), snapshot)

  // Resolve every source track that must exist on the target.
  const resolved = await mapLimit(diff.toResolve, SEARCH_CONCURRENCY, id => resolveTrack(sourceById.get(id)!, source.service, target, targetTracks, targetById))

  const add: MatchedTrack[] = []
  const unmatched: UnmatchedTrack[] = []
  const matchedTargetIds = new Set<string>()
  let unchanged = 0

  for (const result of resolved) {
    if (!('target' in result)) {
      if (!targetId || !isDismissed(source.service, targetId, result.source.id)) {
        unmatched.push(result)
      }
      continue
    }

    if (matchedTargetIds.has(result.target.id)) {
      continue
    }
    matchedTargetIds.add(result.target.id)

    if (targetById.has(result.target.id)) {
      unchanged++
    }
    else {
      add.push(result)
    }
  }

  const remove = planRemovals(state, diff.removed, source.service, sourceTracks, targetTracks, matchedTargetIds)
  const isPlaylist = summary.kind === PlaylistKind.Playlist

  return {
    summary,
    link,
    sourceTrackIds: sourceTracks.map(track => track.id),
    plan: {
      key: summary.id,
      source: source.service,
      sourcePlaylist: { id: summary.id, name: summary.name, image: summary.image, kind: summary.kind },
      targetPlaylistId: targetId,
      targetName,
      willCreate: !targetId,
      willRename: isPlaylist && !!targetId && !!targetName && targetName !== summary.name,
      canCopyCover: isPlaylist && target.service === Service.Spotify && !!summary.image,
      add,
      remove,
      unmatched,
      unchanged: state.mode === SyncMode.Mirror ? unchanged : sourceTracks.length - add.length - unmatched.length,
    },
  }
}

// Order: cached pair, then songs already on the target, then a search.
async function resolveTrack(
  track: Track,
  sourceService: Service,
  target: MusicProvider,
  targetTracks: Track[],
  targetById: Map<string, Track>,
): Promise<MatchedTrack | UnmatchedTrack> {
  const cached = findMatch(sourceService, track.id)
  if (cached) {
    const existing = targetById.get(cached.id)
    return { source: track, target: existing ?? { ...track, id: cached.id }, score: cached.score }
  }

  const local = bestMatch(track, targetTracks)
  if (local && local.score >= MATCH_THRESHOLD) {
    rememberMatch(sourceService, track.id, local.track.id, local.score, MatchOrigin.Auto)
    return { source: track, target: local.track, score: local.score }
  }

  const candidates = await target.search({ title: track.title, artists: track.artists, album: track.album })
  const found = bestMatch(track, candidates)
  if (found && found.score >= MATCH_THRESHOLD) {
    rememberMatch(sourceService, track.id, found.track.id, found.score, MatchOrigin.Auto)
    return { source: track, target: found.track, score: found.score }
  }

  return { source: track, bestGuess: found?.track, score: found?.score }
}

export function rememberMatch(sourceService: Service, sourceId: string, targetId: string, score: number, origin: MatchOrigin) {
  if (sourceService === Service.Spotify) {
    saveMatch(sourceId, targetId, score, origin)
  }
  else {
    saveMatch(targetId, sourceId, score, origin)
  }
}

function planRemovals(
  state: JobState,
  removedSourceIds: string[],
  sourceService: Service,
  sourceTracks: Track[],
  targetTracks: Track[],
  matchedTargetIds: Set<string>,
): Track[] {
  const targetById = new Map(targetTracks.map(track => [track.id, track]))

  if (state.mode !== SyncMode.Mirror) {
    const removals: Track[] = []
    for (const sourceId of removedSourceIds) {
      const match = findMatch(sourceService, sourceId)
      const track = match && targetById.get(match.id)
      if (track) {
        removals.push(track)
      }
    }
    return removals
  }

  // Keep target songs that correspond to any source song, even ones the
  // search could not resolve, so an unmatched song never causes a delete.
  const candidates = mirrorRemovals(targetTracks.map(track => track.id), matchedTargetIds)
  const sourceIds = new Set(sourceTracks.map(track => track.id))
  const targetService = otherService(sourceService)

  return candidates
    .map(id => targetById.get(id)!)
    .filter((track) => {
      const reverse = findMatch(targetService, track.id)
      if (reverse && sourceIds.has(reverse.id)) {
        return false
      }
      const local = bestMatch(track, sourceTracks)
      return !local || local.score < MATCH_THRESHOLD
    })
}

export function startApply(jobId: string, decisions: PlanDecision[]): JobState {
  const job = jobs.get(jobId)
  if (!job || job.state.kind !== JobKind.Plan || job.state.status !== JobStatus.Ready) {
    throw createError({ statusCode: 409, statusMessage: 'This sync is not ready to apply' })
  }
  assertIdle()

  job.state.kind = JobKind.Apply
  job.state.status = JobStatus.Running
  job.state.done = 0
  job.state.results = []

  const byKey = new Map(decisions.map(decision => [decision.key, decision]))
  runApply(job, byKey).catch((error) => {
    job.state.status = JobStatus.Failed
    job.state.error = errorMessage(error)
  })

  return getJob(jobId)
}

async function runApply(job: Job, decisions: Map<string, PlanDecision>) {
  const source = getProvider(job.state.source)
  const target = getProvider(otherService(job.state.source))
  const runnable = job.internals.filter(internal => !internal.plan.error)

  job.state.total = runnable.length

  for (const internal of runnable) {
    const { plan } = internal
    job.state.current = { name: plan.sourcePlaylist.name, image: plan.sourcePlaylist.image }
    try {
      job.state.results.push(await applyPlan(internal, decisions.get(plan.key), source, target))
    }
    catch (error) {
      job.state.results.push({
        key: plan.key,
        name: plan.sourcePlaylist.name,
        image: plan.sourcePlaylist.image,
        added: 0,
        removed: 0,
        unmatched: plan.unmatched.length,
        created: false,
        error: errorMessage(error),
      })
    }
    job.state.done++
  }

  job.state.current = undefined
  job.state.status = JobStatus.Done
}

async function applyPlan(internal: InternalPlan, decision: PlanDecision | undefined, source: MusicProvider, target: MusicProvider): Promise<PlaylistResult> {
  const { plan, summary } = internal

  // 1. Make sure the target playlist exists and is linked.
  let targetId = plan.targetPlaylistId
  if (!targetId) {
    const description = `Synced from ${SERVICE_LABEL[source.service]} by You2Sync`
    targetId = await target.createPlaylist(summary.name, description)
  }

  let link = internal.link
  if (!link) {
    const [spotifyId, ytmusicId] = source.service === Service.Spotify ? [summary.id, targetId] : [targetId, summary.id]
    link = createLink(summary.kind, spotifyId, ytmusicId)
  }

  // 2. Keep the name in step with the source.
  if (plan.willRename) {
    await target.renamePlaylist(targetId, summary.name)
  }

  // 3. Songs: add everything matched, remove only what the user confirmed.
  const addIds = plan.add.map(item => item.target.id)
  if (addIds.length) {
    await target.addTracks(targetId, addIds)
  }

  const confirmed = new Set(decision?.removeIds ?? [])
  const removeIds = plan.remove.map(track => track.id).filter(id => confirmed.has(id))
  if (removeIds.length) {
    await target.removeTracks(targetId, removeIds)
  }

  // 4. Cover art, where the target API allows it. Failures are not fatal.
  if (decision?.copyCover && plan.canCopyCover && target.setCover) {
    const meta = await source.getPlaylist(summary.id)
    const jpeg = meta?.image ? await fetchCoverJpeg(meta.image) : undefined
    if (jpeg) {
      await target.setCover(targetId, jpeg).catch(() => undefined)
    }
  }

  // 5. Bookkeeping: reviews for unmatched songs, new baselines.
  for (const item of plan.unmatched) {
    upsertReview({
      source: source.service,
      sourcePlaylistId: summary.id,
      targetPlaylistId: targetId,
      playlistName: summary.name,
      track: item.source,
      bestGuess: item.bestGuess,
    })
  }
  resolveReviewsFor(source.service, targetId, plan.add.map(item => item.source.id))

  const previousTarget = readSnapshot(link.id, target.service)
  const nextTarget = nextTargetSnapshot(previousTarget, addIds, removeIds)
  const sides = source.service === Service.Spotify
    ? { [Service.Spotify]: internal.sourceTrackIds, [Service.YTMusic]: nextTarget }
    : { [Service.Spotify]: nextTarget, [Service.YTMusic]: internal.sourceTrackIds }
  saveSnapshots(link.id, sides)

  return {
    key: plan.key,
    name: summary.name,
    image: summary.image,
    added: addIds.length,
    removed: removeIds.length,
    unmatched: plan.unmatched.length,
    created: !plan.targetPlaylistId,
  }
}
