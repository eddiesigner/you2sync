import { resetLinks } from '../services/library'

export default defineOwnerHandler(() => {
  resetLinks()
  return { ok: true }
})
