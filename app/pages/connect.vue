<script setup lang="ts">
import { ArrowRight, Check, ChevronDown, Info, Loader2, ShieldCheck } from '@lucide/vue'
import { toast } from 'vue-sonner'
import { Service } from '#shared/types'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

useHead({ title: 'Connect · You2Sync' })

const route = useRoute()
const { state, refresh } = useAuth()

const spotify = computed(() => state.value.accounts[Service.Spotify])
const ytmusic = computed(() => state.value.accounts[Service.YTMusic])
const loginError = computed(() => typeof route.query.error === 'string' ? route.query.error : undefined)

const cookie = ref('')
const submitting = ref(false)
const cookieError = ref<string>()

async function connectYTMusic() {
  cookieError.value = undefined
  submitting.value = true
  try {
    await $fetch('/api/auth/ytmusic', { method: 'POST', body: { cookie: cookie.value } })
    cookie.value = ''
    await refresh()
    toast.success('YouTube Music connected')
    await navigateTo('/')
  }
  catch (error) {
    cookieError.value = errorText(error)
  }
  finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="relative isolate flex min-h-[calc(100dvh-4rem)] items-center overflow-hidden">
    <!-- Soft glowing orbs in both brand colors plus the primary violet. -->
    <div class="pointer-events-none absolute inset-0 -z-10" aria-hidden="true">
      <div class="absolute -left-32 top-10 size-96 rounded-full bg-spotify/20 blur-3xl" />
      <div class="absolute -right-24 top-40 size-[28rem] rounded-full bg-ytmusic/15 blur-3xl" />
      <div class="absolute bottom-0 left-1/3 size-[32rem] rounded-full bg-primary/60 blur-3xl" />
    </div>

    <div class="mx-auto grid w-full max-w-6xl grid-cols-1 gap-12 px-4 py-12 sm:px-6 lg:grid-cols-[1.1fr_1fr] lg:py-20">
      <section class="flex flex-col justify-center">
        <p class="mb-4 inline-flex w-fit items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-muted-foreground">
          <Equalizer class="text-primary-glow" /> Self-hosted playlist sync
        </p>
        <h1 class="text-4xl font-bold tracking-tight text-balance sm:text-5xl lg:text-6xl">
          Your music, <span class="bg-linear-to-r from-spotify via-primary-glow to-ytmusic bg-clip-text text-transparent">in sync</span> everywhere.
        </h1>
        <p class="mt-5 max-w-xl text-lg text-muted-foreground text-pretty">
          Keep your Spotify and YouTube Music playlists identical. Sync one playlist or your whole library, in either direction, and review every change before it happens.
        </p>
        <ul class="mt-8 grid gap-3 text-sm text-muted-foreground sm:grid-cols-2">
          <li class="flex items-center gap-2">
            <Check class="size-4 text-primary-glow" aria-hidden="true" /> Playlists and liked songs
          </li>
          <li class="flex items-center gap-2">
            <Check class="size-4 text-primary-glow" aria-hidden="true" /> Linked by id, survives renames
          </li>
          <li class="flex items-center gap-2">
            <Check class="size-4 text-primary-glow" aria-hidden="true" /> Preview before removing
          </li>
          <li class="flex items-center gap-2">
            <ShieldCheck class="size-4 text-primary-glow" aria-hidden="true" /> Credentials encrypted on your server
          </li>
        </ul>
      </section>

      <section aria-labelledby="connect-title" class="rounded-3xl border border-white/10 bg-card/70 p-6 shadow-2xl backdrop-blur-xl sm:p-8">
        <h2 id="connect-title" class="text-xl font-semibold">
          Connect your accounts
        </h2>
        <p class="mt-1 text-sm text-muted-foreground">
          Both are required to create the link between your libraries.
        </p>

        <Alert v-if="loginError" variant="destructive" class="mt-5">
          <Info />
          <AlertTitle>Could not connect</AlertTitle>
          <AlertDescription>{{ loginError }}</AlertDescription>
        </Alert>

        <ol class="mt-6 space-y-4">
          <!-- Step 1: Spotify OAuth. -->
          <li class="rounded-2xl border border-white/10 bg-background/40 p-4">
            <div class="flex items-center gap-3">
              <BrandIcon :service="Service.Spotify" class="size-9 shrink-0" />
              <div class="min-w-0 flex-1">
                <p class="font-medium">
                  1. Spotify
                </p>
                <p class="truncate text-sm text-muted-foreground">
                  {{ spotify ? `Connected as ${spotify.name}` : 'Sign in with your Spotify account' }}
                </p>
              </div>
              <span v-if="spotify" class="grid size-7 place-items-center rounded-full bg-spotify text-black" aria-label="Connected">
                <Check class="size-4" aria-hidden="true" />
              </span>
            </div>
            <Button v-if="!spotify" as-child class="mt-4 w-full rounded-full bg-spotify font-semibold text-black hover:bg-spotify/90">
              <a href="/api/auth/spotify">
                Continue with Spotify <ArrowRight />
              </a>
            </Button>
          </li>

          <!-- Step 2: YouTube Music browser cookie. -->
          <li class="rounded-2xl border border-white/10 bg-background/40 p-4" :class="{ 'opacity-60': !spotify }">
            <div class="flex items-center gap-3">
              <BrandIcon :service="Service.YTMusic" class="size-9 shrink-0" />
              <div class="min-w-0 flex-1">
                <p class="font-medium">
                  2. YouTube Music
                </p>
                <p class="truncate text-sm text-muted-foreground">
                  {{ ytmusic ? `Connected as ${ytmusic.name}` : 'Link with your browser session' }}
                </p>
              </div>
              <span v-if="ytmusic" class="grid size-7 place-items-center rounded-full bg-ytmusic text-white" aria-label="Connected">
                <Check class="size-4" aria-hidden="true" />
              </span>
            </div>

            <form v-if="spotify && !ytmusic" class="mt-4 space-y-3" @submit.prevent="connectYTMusic">
              <Collapsible>
                <CollapsibleTrigger class="group flex w-full items-center justify-between rounded-lg px-1 py-1 text-sm text-primary-glow hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none">
                  How do I get my cookie?
                  <ChevronDown class="size-4 transition-transform group-data-[state=open]:rotate-180" aria-hidden="true" />
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <ol class="mt-2 list-decimal space-y-1.5 pl-5 text-sm text-muted-foreground">
                    <li>Open <a href="https://music.youtube.com" target="_blank" rel="noopener noreferrer" class="text-primary-glow underline">music.youtube.com</a> in a desktop browser and sign in.</li>
                    <li>Open the developer tools (F12) and go to the <strong>Network</strong> tab.</li>
                    <li>Click around (e.g. open your library) and select any request named <code class="rounded bg-muted px-1">browse</code>.</li>
                    <li>Under <strong>Request Headers</strong>, copy the full value of <code class="rounded bg-muted px-1">cookie</code>.</li>
                    <li>Paste it below. Signing out of YouTube in that browser invalidates it.</li>
                  </ol>
                  <p class="mt-3 text-xs text-muted-foreground">
                    YouTube Music has no public API for playlists. The cookie is encrypted and stored only on this server, and it is never sent back to the browser.
                  </p>
                </CollapsibleContent>
              </Collapsible>

              <div class="space-y-1.5">
                <Label for="yt-cookie">Cookie header</Label>
                <Textarea
                  id="yt-cookie"
                  v-model="cookie"
                  rows="4"
                  required
                  autocomplete="off"
                  spellcheck="false"
                  placeholder="VISITOR_INFO1_LIVE=…; SAPISID=…; __Secure-3PAPISID=…"
                  class="field-sizing-fixed resize-none overflow-y-auto font-mono text-xs break-all"
                  :aria-invalid="!!cookieError"
                  aria-describedby="yt-cookie-error"
                />
                <p v-if="cookieError" id="yt-cookie-error" class="text-sm text-destructive" role="alert">
                  {{ cookieError }}
                </p>
              </div>

              <Button type="submit" class="w-full rounded-full bg-ytmusic font-semibold text-white hover:bg-ytmusic/90" :disabled="submitting || !cookie.trim()">
                <Loader2 v-if="submitting" class="animate-spin" />
                Connect YouTube Music
              </Button>
            </form>
          </li>
        </ol>
      </section>
    </div>
  </div>
</template>
