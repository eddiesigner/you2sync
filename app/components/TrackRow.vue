<script setup lang="ts">
import type { Track } from '#shared/types'

defineProps<{ track: Track }>()

function formatDuration(ms?: number) {
  if (!ms) {
    return ''
  }
  const total = Math.round(ms / 1000)
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}
</script>

<template>
  <div class="flex min-w-0 items-center gap-3">
    <CoverImage :src="track.image" class="size-10 shrink-0 rounded" />
    <div class="min-w-0 flex-1">
      <p class="truncate text-sm font-medium">
        {{ track.title }}
      </p>
      <p class="truncate text-xs text-muted-foreground">
        {{ track.artists.join(', ') || 'Unknown artist' }}<template v-if="track.album">
          · {{ track.album }}
        </template>
      </p>
    </div>
    <span v-if="track.durationMs" class="hidden shrink-0 text-xs tabular-nums text-muted-foreground sm:inline">
      {{ formatDuration(track.durationMs) }}
    </span>
    <slot />
  </div>
</template>
