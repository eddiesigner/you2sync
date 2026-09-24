const CONNECT_PATH = '/connect'

// Every page except /connect needs both services linked.
export default defineNuxtRouteMiddleware(async (to) => {
  const { state, loaded, refresh } = useAuth()
  if (!loaded.value) {
    await refresh()
  }

  if (!state.value.ready && to.path !== CONNECT_PATH) {
    return navigateTo(CONNECT_PATH)
  }
  if (state.value.ready && to.path === CONNECT_PATH) {
    return navigateTo('/')
  }
})
