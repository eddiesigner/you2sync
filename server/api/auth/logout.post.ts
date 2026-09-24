import { logout } from '../../services/accounts'

export default defineEventHandler(async (event) => {
  assertSameOrigin(event)
  await logout(event)
  return { ok: true }
})
