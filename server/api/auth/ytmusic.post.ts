import { z } from 'zod'
import { connectYTMusic } from '../../services/accounts'

// A full browser Cookie header is a few KB; cap it to reject junk.
const MAX_COOKIE_LENGTH = 16_384

const bodySchema = z.object({
  cookie: z.string().trim().min(1).max(MAX_COOKIE_LENGTH).refine(value => value.includes('SAPISID'), {
    message: 'The cookie must include SAPISID. Copy it from a signed-in music.youtube.com request.',
  }),
})

export default defineEventHandler(async (event) => {
  assertSameOrigin(event)
  const { cookie } = await readValidatedBody(event, bodySchema.parse)
  try {
    await connectYTMusic(event, cookie.replace(/^cookie:\s*/i, ''))
  }
  catch (error) {
    throw toHttpError(error)
  }
  return { ok: true }
})
