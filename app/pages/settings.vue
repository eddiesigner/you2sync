<script setup lang="ts">
import { Loader2 } from '@lucide/vue'
import { toast } from 'vue-sonner'
import { SERVICE_LABEL, Service } from '#shared/types'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

useHead({ title: 'Settings · You2Sync' })

const { state, refresh: refreshAuth } = useAuth()
const { refresh: refreshLibrary } = useLibrary()
const services = [Service.Spotify, Service.YTMusic]
const { color: primaryColor, reset: resetPrimaryColor } = usePrimaryColor()

const cookie = ref('')
const cookieOpen = ref(false)
const cookieError = ref<string>()
const savingCookie = ref(false)

// Links to an expired YouTube Music session land here with the dialog open.
const route = useRoute()
watch(() => route.query.update, (update) => {
  if (update !== UPDATE_COOKIE_QUERY.update) {
    return
  }
  cookieOpen.value = true
  navigateTo({ query: {} }, { replace: true })
}, { immediate: true })

async function updateCookie() {
  cookieError.value = undefined
  savingCookie.value = true
  try {
    await $fetch('/api/auth/ytmusic', { method: 'POST', body: { cookie: cookie.value } })
    cookie.value = ''
    cookieOpen.value = false
    await refreshAuth()
    toast.success('YouTube Music cookie updated')
  }
  catch (error) {
    cookieError.value = errorText(error)
  }
  finally {
    savingCookie.value = false
  }
}

async function resetLinks() {
  try {
    await api<{ ok: boolean }>('/api/links', { method: 'DELETE' })
    await refreshLibrary()
    toast.success('Playlist links reset')
  }
  catch (error) {
    toast.error(errorText(error))
  }
}

async function unlinkAccounts() {
  try {
    await api<{ ok: boolean }>('/api/auth/unlink', { method: 'POST' })
    await refreshAuth()
    await navigateTo('/connect')
  }
  catch (error) {
    toast.error(errorText(error))
  }
}
</script>

<template>
  <div class="mx-auto max-w-3xl px-4 py-10 sm:px-6">
    <h1 class="text-3xl font-bold tracking-tight sm:text-4xl">
      Settings
    </h1>

    <section class="mt-8" aria-labelledby="accounts-title">
      <h2 id="accounts-title" class="text-lg font-semibold">
        Accounts
      </h2>
      <ul class="mt-3 divide-y divide-white/5 overflow-hidden rounded-2xl border border-white/10 bg-card/60">
        <li v-for="service in services" :key="service" class="flex items-center gap-4 p-4">
          <Avatar class="size-12">
            <AvatarImage v-if="state.accounts[service]?.avatar" :src="state.accounts[service]!.avatar!" alt="" referrerpolicy="no-referrer" />
            <AvatarFallback class="bg-secondary">
              <BrandIcon :service="service" class="size-6" />
            </AvatarFallback>
          </Avatar>
          <div class="min-w-0 flex-1">
            <p class="flex items-center gap-2 font-medium">
              <BrandIcon :service="service" class="size-4" /> {{ SERVICE_LABEL[service] }}
            </p>
            <p class="truncate text-sm text-muted-foreground">
              {{ state.accounts[service]?.name }}
            </p>
          </div>

          <Dialog v-if="service === Service.YTMusic" v-model:open="cookieOpen">
            <DialogTrigger as-child>
              <Button variant="secondary" size="sm" class="rounded-full">
                Update cookie
              </Button>
            </DialogTrigger>
            <DialogContent>
              <form class="space-y-4" @submit.prevent="updateCookie">
                <DialogHeader>
                  <DialogTitle>Update YouTube Music cookie</DialogTitle>
                  <DialogDescription>
                    Paste a fresh cookie header from music.youtube.com when the current one expires. It must belong to the same account.
                  </DialogDescription>
                </DialogHeader>
                <CookieSteps />
                <div class="space-y-1.5">
                  <Label for="settings-cookie">Cookie header</Label>
                  <Textarea id="settings-cookie" v-model="cookie" rows="4" required autocomplete="off" spellcheck="false" class="field-sizing-fixed resize-none overflow-y-auto font-mono text-xs break-all" :aria-invalid="!!cookieError" />
                  <p v-if="cookieError" class="text-sm text-destructive" role="alert">
                    {{ cookieError }}
                  </p>
                </div>
                <DialogFooter>
                  <Button type="submit" class="rounded-full" :disabled="savingCookie || !cookie.trim()">
                    <Loader2 v-if="savingCookie" class="animate-spin" /> Save
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </li>
      </ul>
    </section>

    <section class="mt-10" aria-labelledby="appearance-title">
      <h2 id="appearance-title" class="text-lg font-semibold">
        Appearance
      </h2>
      <div class="mt-3 flex flex-col gap-3 rounded-2xl border border-white/10 bg-card/60 p-4 sm:flex-row sm:items-center">
        <div class="flex-1">
          <Label for="settings-primary-color" class="font-medium">
            Primary color
          </Label>
          <p class="text-sm text-muted-foreground">
            Used for buttons, highlights and focus rings. Saved in this browser.
          </p>
        </div>
        <div class="flex items-center gap-2">
          <input id="settings-primary-color" v-model="primaryColor" type="color" class="size-9 cursor-pointer rounded-full border border-white/10 bg-transparent p-0.5 [&::-moz-color-swatch]:rounded-full [&::-moz-color-swatch]:border-0 [&::-webkit-color-swatch]:rounded-full [&::-webkit-color-swatch]:border-0 [&::-webkit-color-swatch-wrapper]:p-0">
          <Button variant="secondary" size="sm" class="rounded-full" :disabled="primaryColor === DEFAULT_PRIMARY" @click="resetPrimaryColor">
            Reset
          </Button>
        </div>
      </div>
    </section>

    <section class="mt-10" aria-labelledby="danger-title">
      <h2 id="danger-title" class="text-lg font-semibold">
        Reset
      </h2>
      <div class="mt-3 divide-y divide-white/5 overflow-hidden rounded-2xl border border-white/10 bg-card/60">
        <div class="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
          <div class="flex-1">
            <p class="font-medium">
              Reset playlist links
            </p>
            <p class="text-sm text-muted-foreground">
              Forget which playlists are paired. Next sync pairs them again by name. No playlist is deleted.
            </p>
          </div>
          <AlertDialog>
            <AlertDialogTrigger as-child>
              <Button variant="secondary" size="sm" class="rounded-full">
                Reset links
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Reset all playlist links?</AlertDialogTitle>
                <AlertDialogDescription>Sync history is cleared too, so the next sync compares playlists from scratch.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction @click="resetLinks">
                  Reset links
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>

        <div class="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
          <div class="flex-1">
            <p class="font-medium">
              Unlink accounts
            </p>
            <p class="text-sm text-muted-foreground">
              Delete the stored credentials of both services and sign out. You can connect again afterwards.
            </p>
          </div>
          <AlertDialog>
            <AlertDialogTrigger as-child>
              <Button variant="destructive" size="sm" class="rounded-full">
                Unlink
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Unlink both accounts?</AlertDialogTitle>
                <AlertDialogDescription>Stored tokens and cookies are deleted from this server.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction class="bg-destructive text-white hover:bg-destructive/90" @click="unlinkAccounts">
                  Unlink
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </section>
  </div>
</template>
