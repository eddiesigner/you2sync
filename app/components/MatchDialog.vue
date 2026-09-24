<script setup lang="ts">
import { Loader2, Search } from '@lucide/vue'
import { type MatchedTrack, type ReviewItem, SERVICE_LABEL, otherService } from '#shared/types'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'

const props = defineProps<{ item?: ReviewItem }>()
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ pick: [trackId: string] }>()

const query = ref('')
const candidates = ref<MatchedTrack[]>([])
const loading = ref(false)
const error = ref<string>()

const target = computed(() => props.item ? SERVICE_LABEL[otherService(props.item.source)] : '')

async function search(text?: string) {
  if (!props.item) {
    return
  }
  loading.value = true
  error.value = undefined
  try {
    candidates.value = await api<MatchedTrack[]>(`/api/reviews/${props.item.id}/candidates`, { query: { q: text || undefined } })
  }
  catch (err) {
    error.value = errorText(err)
  }
  finally {
    loading.value = false
  }
}

// Load default suggestions every time the dialog opens for a new song.
watch(() => [open.value, props.item?.id], () => {
  if (!open.value || !props.item) {
    return
  }
  query.value = `${props.item.track.title} ${props.item.track.artists[0] ?? ''}`.trim()
  candidates.value = []
  search()
}, { immediate: true })
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="flex max-h-[85dvh] flex-col sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>Find on {{ target }}</DialogTitle>
        <DialogDescription v-if="item">
          Pick the right version of “{{ item.track.title }}” by {{ item.track.artists.join(', ') || 'unknown artist' }}.
        </DialogDescription>
      </DialogHeader>

      <form class="flex gap-2" role="search" @submit.prevent="search(query)">
        <Input v-model="query" aria-label="Search query" class="rounded-full" />
        <Button type="submit" size="icon" class="shrink-0 rounded-full" aria-label="Search" :disabled="loading">
          <Loader2 v-if="loading" class="animate-spin" />
          <Search v-else />
        </Button>
      </form>

      <div class="-mx-2 min-h-40 flex-1 overflow-y-auto" aria-live="polite" :aria-busy="loading">
        <p v-if="error" class="p-4 text-sm text-destructive" role="alert">
          {{ error }}
        </p>
        <p v-else-if="!loading && !candidates.length" class="p-4 text-center text-sm text-muted-foreground">
          No results. Try a different search.
        </p>
        <ul v-else class="space-y-1">
          <li v-for="candidate in candidates" :key="candidate.target.id">
            <button
              type="button"
              class="w-full rounded-lg p-2 text-left hover:bg-white/5 focus-visible:bg-white/5 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
              @click="emit('pick', candidate.target.id)"
            >
              <TrackRow :track="candidate.target">
                <span class="shrink-0 rounded-full bg-white/5 px-2 py-0.5 text-xs tabular-nums" :class="candidate.score >= 0.75 ? 'text-primary-glow' : 'text-muted-foreground'">
                  {{ Math.round(candidate.score * 100) }}%
                </span>
              </TrackRow>
            </button>
          </li>
        </ul>
      </div>
    </DialogContent>
  </Dialog>
</template>
