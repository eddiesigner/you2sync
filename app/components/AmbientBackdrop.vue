<script setup lang="ts">
// Blurred artwork that tints the page with the cover's colors.
defineProps<{ src?: string }>()
</script>

<template>
  <div class="ambient" aria-hidden="true">
    <Transition
      enter-active-class="transition-opacity duration-700"
      leave-active-class="transition-opacity duration-700"
      enter-from-class="opacity-0"
      leave-to-class="opacity-0"
    >
      <img v-if="src" :key="src" :src="src" alt="" referrerpolicy="no-referrer">
    </Transition>
  </div>
</template>
