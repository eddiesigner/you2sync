import { unlinkAccounts } from '../../services/accounts'

export default defineOwnerHandler(async (event) => {
  await unlinkAccounts(event)
  return { ok: true }
})
