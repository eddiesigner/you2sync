<script setup lang="ts">
import { ArrowRight, Check, Search, X } from '@lucide/vue'
import { toast } from 'vue-sonner'
import { type ReviewItem, SERVICE_LABEL, otherService } from '#shared/types'
import { Button } from '@/components/ui/button'

useHead({ title: 'Review · You2Sync' })

const { data: reviews, status, refresh } = useReviews()
onMounted(() => refresh())

const dialogOpen = ref(false)
const active = ref<ReviewItem>()
const busy = ref(new Set<number>())

// Group by playlist so the page reads like a set of tracklists.
const groups = computed(() => {
  const byPlaylist = new Map<string, { key: string, name: string, item: ReviewItem, items: ReviewItem[] }>()
  for (const item of reviews.value) {
    const key = `${item.source}:${item.targetPlaylistId}`
    const group = byPlaylist.get(key) ?? { key, name: item.playlistName, item, items: [] }
    group.items.push(item)
    byPlaylist.set(key, group)
  }
  return [...byPlaylist.values()]
})

function openSearch(item: ReviewItem) {
  active.value = item
  dialogOpen.value = true
}

async function run(item: ReviewItem, action: () => Promise<unknown>, success: string) {
  busy.value = new Set(busy.value).add(item.id)
  try {
    await action()
    reviews.value = reviews.value.filter(review => review.id !== item.id)
    toast.success(success)
  }
  catch (error) {
    toast.error(errorText(error))
  }
  finally {
    const next = new Set(busy.value)
    next.delete(item.id)
    busy.value = next
  }
}

function resolve(item: ReviewItem, trackId: string) {
  dialogOpen.value = false
  return run(item, () => api<{ ok: boolean }>(`/api/reviews/${item.id}/resolve`, { method: 'POST', body: { trackId } }), `Added “${item.track.title}”`)
}

function dismiss(item: ReviewItem) {
  return run(item, () => api<{ ok: boolean }>(`/api/reviews/${item.id}/dismiss`, { method: 'POST' }), 'Dismissed')
}
</script>

<template>
  <div class="relative isolate">
    <AmbientBackdrop :src="reviews[0]?.track.image" />

    <div class="relative z-10 mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <p class="text-xs font-semibold tracking-widest text-muted-foreground uppercase">
        Needs your ear
      </p>
      <h1 class="mt-1 text-3xl font-bold tracking-tight sm:text-5xl">
        Review
      </h1>
      <p class="mt-2 max-w-2xl text-muted-foreground">
        These songs could not be matched confidently and were skipped. Pick the right version, or dismiss them so they are not suggested again.
      </p>

      <div v-if="status === 'pending' && !reviews.length" class="mt-16 flex justify-center text-primary-glow">
        <Equalizer class="text-2xl" />
        <span class="sr-only">Loading</span>
      </div>

      <div v-else-if="!reviews.length" class="mt-16 flex flex-col items-center text-center">
        <span class="grid size-16 place-items-center rounded-full bg-white/5">
          <Check class="size-8 text-primary-glow" aria-hidden="true" />
        </span>
        <p class="mt-4 text-lg font-medium">
          Nothing to review
        </p>
        <p class="text-sm text-muted-foreground">
          Every synced song found its match.
        </p>
      </div>

      <section v-for="group in groups" v-else :key="group.key" class="mt-8" :aria-labelledby="`group-${group.key}`">
        <h2 :id="`group-${group.key}`" class="flex items-center gap-2 text-lg font-semibold">
          {{ group.name }}
          <span class="flex items-center gap-1.5 text-sm font-normal text-muted-foreground">
            <BrandIcon :service="group.item.source" class="size-4" />
            <ArrowRight class="size-3" aria-label="to" />
            <BrandIcon :service="otherService(group.item.source)" class="size-4" />
          </span>
        </h2>

        <ul class="mt-3 divide-y divide-white/5 overflow-hidden rounded-2xl border border-white/10 bg-card/60 backdrop-blur">
          <li v-for="item in group.items" :key="item.id" class="flex flex-col gap-3 p-3 sm:flex-row sm:items-center">
            <div class="min-w-0 flex-1">
              <TrackRow :track="item.track" />
              <p v-if="item.bestGuess" class="mt-1.5 truncate pl-13 text-xs text-muted-foreground">
                Closest on {{ SERVICE_LABEL[otherService(item.source)] }}: {{ item.bestGuess.title }} · {{ item.bestGuess.artists.join(', ') }}
              </p>
            </div>
            <div class="flex shrink-0 gap-2 pl-13 sm:pl-0">
              <Button v-if="item.bestGuess" size="sm" variant="secondary" class="rounded-full" :disabled="busy.has(item.id)" @click="resolve(item, item.bestGuess.id)">
                Use closest
              </Button>
              <Button size="sm" variant="secondary" class="rounded-full" :disabled="busy.has(item.id)" @click="openSearch(item)">
                <Search /> Find
              </Button>
              <ButtonTooltip label="Dismiss">
                <Button size="icon-sm" variant="ghost" class="rounded-full" :aria-label="`Dismiss ${item.track.title}`" :disabled="busy.has(item.id)" @click="dismiss(item)">
                  <X />
                </Button>
              </ButtonTooltip>
            </div>
          </li>
        </ul>
      </section>
    </div>

    <MatchDialog v-model:open="dialogOpen" :item="active" @pick="active && resolve(active, $event)" />
  </div>
</template>
