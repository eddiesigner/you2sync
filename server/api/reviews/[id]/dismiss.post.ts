import { z } from 'zod'
import { dismissReview } from '../../../services/reviews'

const paramsSchema = z.object({ id: z.coerce.number().int().positive() })

export default defineOwnerHandler(async (event) => {
  const { id } = await getValidatedRouterParams(event, paramsSchema.parse)
  dismissReview(id)
  return { ok: true }
})
