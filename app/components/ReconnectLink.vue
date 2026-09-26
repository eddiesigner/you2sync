<script setup lang="ts">
import type { Service } from '#shared/types'

defineProps<{ service: Service }>()
</script>

<template>
  <NuxtLink :to="RECONNECT[service].to" :external="RECONNECT[service].external" class="font-medium whitespace-nowrap text-foreground underline underline-offset-4 hover:text-primary-glow">
    {{ RECONNECT[service].label }}
  </NuxtLink>
</template>
