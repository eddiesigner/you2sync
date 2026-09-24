import { z } from 'zod'
import { resolveReview } from '../../../services/reviews'

const paramsSchema = z.object({ id: z.coerce.number().int().positive() })
const bodySchema = z.object({ trackId: z.string().min(1).max(128) })

export default defineOwnerHandler(async (event) => {
  const { id } = await getValidatedRouterParams(event, paramsSchema.parse)
  const { trackId } = await readValidatedBody(event, bodySchema.parse)
  await resolveReview(id, trackId)
  return { ok: true }
})
