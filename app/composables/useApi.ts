import { toast } from 'vue-sonner'
import { SERVICE_LABEL, type Service } from '#shared/types'

interface ApiErrorData {
  statusCode?: number
  statusMessage?: string
  message?: string
  data?: { service?: Service }
}

export function errorText(error: unknown): string {
  const data = (error as { data?: ApiErrorData })?.data
  return data?.statusMessage || data?.message || (error instanceof Error ? error.message : 'Something went wrong')
}

/*
 * $fetch for the app's API. An expired service session (401) sends the
 * user back to the connect screen instead of failing silently.
 */
export const api = $fetch.create({
  async onResponseError({ response }) {
    if (response.status !== 401) {
      return
    }

    const service = (response._data as ApiErrorData)?.data?.service
    if (service) {
      toast.error(`${SERVICE_LABEL[service]} needs to be reconnected`)
    }

    await useAuth().refresh()
    await navigateTo('/connect')
  },
})
