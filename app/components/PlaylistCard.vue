<script setup lang="ts">
import { Check, Link2, Lock, RefreshCw } from '@lucide/vue'
import { PlaylistKind, type PlaylistSummary } from '#shared/types'

const props = defineProps<{ playlist: PlaylistSummary, selected: boolean }>()
const emit = defineEmits<{ toggle: [], syncNow: [] }>()

const liked = computed(() => props.playlist.kind === PlaylistKind.Liked)
const subtitle = computed(() => {
  const parts: string[] = []
  if (props.playlist.trackCount !== undefined) {
    parts.push(plural(props.playlist.trackCount, 'song'))
  }
  if (!props.playlist.editable) {
    parts.push('Read-only')
  }
  return parts.join(' · ')
})

const syncedAgo = computed(() => {
  const at = props.playlist.link?.lastSyncedAt
  return at ? timeAgo(at) : undefined
})
</script>

<template>
  <div
    class="group @container relative rounded-xl p-3 transition-colors"
    :class="[
      playlist.editable ? 'hover:bg-white/5' : 'opacity-50',
      selected ? 'bg-white/[0.07] ring-2 ring-primary-glow' : '',
    ]"
  >
    <button
      type="button"
      role="checkbox"
      :aria-checked="selected"
      :disabled="!playlist.editable"
      :aria-label="`Select ${playlist.name}`"
      class="block w-full text-left focus-visible:outline-none disabled:cursor-not-allowed [&:focus-visible_.cover]:ring-3 [&:focus-visible_.cover]:ring-ring"
      @click="emit('toggle')"
    >
      <div class="cover relative aspect-square overflow-hidden rounded-lg shadow-lg shadow-black/40">
        <CoverImage :src="playlist.image" :liked="liked" :alt="''" class="size-full transition-transform duration-500 group-hover:scale-105" />
        <span
          class="absolute left-2 top-2 grid size-6 place-items-center rounded-full border-2 transition-all"
          :class="selected ? 'border-primary-glow bg-primary-glow text-black' : 'border-white/70 bg-black/40 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100'"
          aria-hidden="true"
        >
          <Check v-if="selected" class="size-3.5" />
        </span>
      </div>
      <p class="mt-3 truncate font-medium">
        {{ playlist.name }}
      </p>
      <p class="mt-0.5 flex items-center gap-1.5 truncate text-xs text-muted-foreground">
        <Lock v-if="!playlist.editable" class="size-3" aria-hidden="true" />
        <Link2 v-else-if="playlist.link" class="size-3 text-primary-glow" aria-hidden="true" />
        <span class="truncate">{{ subtitle }}<template v-if="syncedAgo"> · synced {{ syncedAgo }}</template></span>
      </p>
    </button>

    <!-- Quick action: sync just this playlist. Floats like a play button. -->
    <button
      v-if="playlist.editable"
      type="button"
      class="absolute right-5 top-[calc(100cqw-2.5rem)] grid size-11 translate-y-2 place-items-center rounded-full bg-primary-glow text-black opacity-0 shadow-xl shadow-black/50 transition-all duration-200 group-hover:translate-y-0 group-hover:opacity-100 focus-visible:translate-y-0 focus-visible:opacity-100 focus-visible:ring-3 focus-visible:ring-white focus-visible:outline-none"
      :aria-label="`Sync ${playlist.name} now`"
      @click="emit('syncNow')"
    >
      <RefreshCw class="size-5" aria-hidden="true" />
    </button>
  </div>
</template>
