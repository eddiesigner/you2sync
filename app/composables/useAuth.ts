import type { SessionState } from '#shared/types'

const EMPTY_SESSION: SessionState = { accounts: {}, ready: false }

// Which services the current browser session is linked to.
export function useAuth() {
  const state = useState<SessionState>('auth', () => EMPTY_SESSION)
  const loaded = useState('auth-loaded', () => false)

  async function refresh() {
    state.value = await $fetch<SessionState>('/api/session')
    loaded.value = true
  }

  async function logout() {
    await $fetch('/api/auth/logout', { method: 'POST' })
    state.value = EMPTY_SESSION
    await navigateTo('/connect')
  }

  return { state: readonly(state), loaded, refresh, logout }
}
