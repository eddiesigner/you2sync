<script setup lang="ts">
import { Heart, Music2 } from '@lucide/vue'
import { cn } from '@/lib/utils'

const props = defineProps<{ src?: string, alt?: string, liked?: boolean, class?: string, eager?: boolean }>()
const failed = ref(false)

watch(() => props.src, () => {
  failed.value = false
})
</script>

<template>
  <div :class="cn('relative overflow-hidden bg-muted', props.class)">
    <img
      v-if="props.src && !failed"
      :src="props.src"
      :alt="props.alt ?? ''"
      :loading="props.eager ? 'eager' : 'lazy'"
      decoding="async"
      referrerpolicy="no-referrer"
      class="size-full object-cover"
      @error="failed = true"
    >
    <!-- Artwork placeholders: liked songs get the familiar heart gradient. -->
    <div
      v-else
      class="grid size-full place-items-center"
      :class="props.liked ? 'bg-linear-to-br from-primary via-violet-500 to-sky-300' : 'bg-linear-to-br from-zinc-700 to-zinc-900'"
      aria-hidden="true"
    >
      <Heart v-if="props.liked" class="size-2/5 fill-white text-white" />
      <Music2 v-else class="size-2/5 text-zinc-400" />
    </div>
  </div>
</template>
