import { z } from 'zod'
import { getJob } from '../../services/sync'

const paramsSchema = z.object({ id: z.uuid() })

export default defineOwnerHandler(async (event) => {
  const { id } = await getValidatedRouterParams(event, paramsSchema.parse)
  return getJob(id)
})
