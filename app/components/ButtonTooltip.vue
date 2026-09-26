<script setup lang="ts">
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

// Explains what a button does. Icon-only buttons keep their own aria-label.
defineProps<{ label: string, disabled?: boolean }>()
</script>

<template>
  <Tooltip :disabled="disabled">
    <TooltipTrigger as-child>
      <slot />
    </TooltipTrigger>
    <TooltipContent>
      {{ label }}
    </TooltipContent>
  </Tooltip>
</template>
