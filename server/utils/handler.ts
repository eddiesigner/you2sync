import type { EventHandlerRequest, H3Event } from 'h3'
import { getRequestHost, getRequestProtocol } from 'h3'
import { ProviderAuthError } from '../providers/types'
import { requireOwner } from '../services/accounts'

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

// Rejects cross-site writes; SameSite cookies cover most, this covers the rest.
export function assertSameOrigin(event: H3Event) {
  if (SAFE_METHODS.has(event.method)) {
    return
  }
  const origin = getRequestHeader(event, 'origin')
  const expected = `${getRequestProtocol(event, { xForwardedProto: true })}://${getRequestHost(event, { xForwardedHost: true })}`
  if (origin && origin !== expected) {
    throw createError({ statusCode: 403, statusMessage: 'Cross-origin request rejected' })
  }
}

// Expired service credentials become a 401 the UI turns into a reconnect prompt.
export function toHttpError(error: unknown): unknown {
  if (error instanceof ProviderAuthError) {
    return createError({ statusCode: 401, statusMessage: error.message, data: { service: error.service } })
  }
  return error
}

// Route wrapper for everything that needs both services connected.
export function defineOwnerHandler<T>(handler: (event: H3Event<EventHandlerRequest>) => T | Promise<T>) {
  return defineEventHandler(async (event) => {
    assertSameOrigin(event)
    await requireOwner(event)
    try {
      return await handler(event)
    }
    catch (error) {
      throw toHttpError(error)
    }
  })
}
