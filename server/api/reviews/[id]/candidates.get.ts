import { z } from 'zod'
import { findCandidates } from '../../../services/reviews'

const paramsSchema = z.object({ id: z.coerce.number().int().positive() })
const querySchema = z.object({ q: z.string().trim().max(200).optional() })

export default defineOwnerHandler(async (event) => {
  const { id } = await getValidatedRouterParams(event, paramsSchema.parse)
  const { q } = await getValidatedQuery(event, querySchema.parse)
  return await findCandidates(id, q || undefined)
})
