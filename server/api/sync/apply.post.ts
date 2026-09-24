import { z } from 'zod'
import { startApply } from '../../services/sync'

const bodySchema = z.object({
  jobId: z.uuid(),
  decisions: z.array(z.object({
    key: z.string().min(1).max(128),
    removeIds: z.array(z.string().min(1).max(128)),
    copyCover: z.boolean(),
  })),
})

export default defineOwnerHandler(async (event) => {
  const { jobId, decisions } = await readValidatedBody(event, bodySchema.parse)
  return startApply(jobId, decisions)
})
