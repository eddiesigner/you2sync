import { z } from 'zod'
import { Service } from '#shared/types'
import { listTracks } from '../../../../services/library'

const paramsSchema = z.object({ service: z.enum(Service), id: z.string().min(1).max(128) })

export default defineOwnerHandler(async (event) => {
  const { service, id } = await getValidatedRouterParams(event, paramsSchema.parse)
  return await listTracks(service, id)
})
