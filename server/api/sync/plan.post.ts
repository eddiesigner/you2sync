import { z } from 'zod'
import { Service, SyncMode } from '#shared/types'
import { startPlan } from '../../services/sync'

const MAX_PLAYLISTS = 1000

const bodySchema = z.object({
  source: z.enum(Service),
  mode: z.enum(SyncMode),
  playlistIds: z.array(z.string().min(1).max(128)).max(MAX_PLAYLISTS),
})

export default defineOwnerHandler(async (event) => {
  const selection = await readValidatedBody(event, bodySchema.parse)
  return startPlan(selection)
})
